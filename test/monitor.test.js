import cds from '@sap/cds'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, today } from '../srv/lib/status.js'
import { DEMO_DATE } from '../srv/lib/demo-data.js'

const { GET, POST } = cds.test(import.meta.dirname + '/..', '--with-mocks')

const anna = { auth: { username: 'anna', password: 'anna' } }
const lea = { auth: { username: 'lea', password: 'lea' } }
const item = (po, pos = '00010', line = '0001') =>
  `/odata/v4/monitor/PurchaseOrderItems(purchaseOrder='${po}',purchaseOrderItem='${pos}',scheduleLine='${line}')`
const action = (po, name, pos) => `${item(po, pos)}/MonitorService.${name}`

// Die Demodaten sind relativ zum heutigen Tag verschoben.
const shifted = date => addDays(date, Math.round((Date.parse(today()) - Date.parse(DEMO_DATE)) / 864e5))

const reason = async promise => (await promise.catch(e => e.response)).data.error

describe('Synchronisation', () => {
  it('repliziert offene Einteilungen und Lieferanten beim Start', async () => {
    const { data } = await GET('/odata/v4/monitor/PurchaseOrderItems?$count=true&$top=0', anna)
    assert.equal(data['@odata.count'], 16)
    const { data: s } = await GET(`${item('4500000101')}?$expand=supplier`, anna)
    assert.equal(s.supplier.name, 'Stahlwerk Rheinland GmbH')
    assert.equal(s.requestedDate, shifted('2026-09-28'))
    assert.deepEqual([s.status_code, s.delayDays, Number(s.openValue)], ['OVERDUE', 14, 3700])
  })

  it('übernimmt keine vollständig gelieferten Positionen', async () => {
    const { data } = await GET(`/odata/v4/monitor/PurchaseOrderItems?$filter=purchaseOrder eq '4500000109'`, anna)
    assert.equal(data.value.length, 0)
  })

  it('schließt gelieferte Einteilungen ab', async () => {
    const { data } = await GET(item('4500000101', '00020', '0001'), anna)
    assert.equal(data.status_code, 'DELIVERED')
  })

  it('erkennt gefährdete Termine', async () => {
    const { data } = await GET(item('4500000104'), anna)
    assert.equal(data.status_code, 'AT_RISK')
  })
})

describe('Mahnverfahren', () => {
  it('mahnt bis zur höchsten Stufe und verlangt dann die Eskalation', async () => {
    for (const level of [1, 2, 3]) {
      const { data } = await POST(action('4500000103', 'sendReminder', '00020'), {}, anna)
      assert.equal(data.dunningLevel, level)
    }
    const error = await reason(POST(action('4500000103', 'sendReminder', '00020'), {}, anna))
    assert.equal(error.code, 'MAX_DUNNING_LEVEL')
    const { data } = await GET(`${item('4500000103', '00020')}/activities?$filter=type_code eq 'REMINDER'`, anna)
    assert.equal(data.value.length, 3)
    assert.match(data.value[0].text, /Mahnung: Bestellung 4500000103/)
  })

  it('eskaliert genau einmal', async () => {
    const { data } = await POST(action('4500000103', 'escalate', '00020'), { reason: 'Linienstillstand droht' }, anna)
    assert.equal(data.status_code, 'ESCALATED')
    const error = await reason(POST(action('4500000103', 'escalate', '00020'), { reason: 'nochmal' }, anna))
    assert.equal(error.code, 'ALREADY_ESCALATED')
  })

  it('beendet Mahnung und Eskalation mit einer Lieferantenbestätigung', async () => {
    const confirmedDate = addDays(today(), 10)
    const { data } = await POST(action('4500000103', 'recordConfirmation', '00020'),
      { confirmedDate, channel: 'PHONE', comment: 'Ersatzteil eingetroffen' }, anna)
    assert.deepEqual([data.status_code, data.dunningLevel, data.escalated, Number(data.confirmedQuantity)], ['AT_RISK', 0, false, 300])
  })

  it('braucht nach fristgerechter Bestätigung keine Mahnung', async () => {
    const po = '4500000108'
    const { data: current } = await GET(item(po), anna)
    await POST(action(po, 'recordConfirmation'), { confirmedDate: current.requestedDate, confirmedQuantity: 250 }, anna)
    const error = await reason(POST(action(po, 'sendReminder'), {}, anna))
    assert.equal(error.code, 'REMINDER_NOT_NEEDED')
  })

  it('lehnt eine Bestätigung über die offene Menge hinaus ab', async () => {
    const error = await reason(POST(action('4500000110', 'recordConfirmation'),
      { confirmedDate: today(), confirmedQuantity: 20 }, anna))
    assert.equal(error.code, 'CONFIRMED_QUANTITY_INVALID')
    assert.match(error.message, /offene Menge von 15 ST/)
  })

  it('behält lokale Überwachungsdaten bei erneuter Synchronisation', async () => {
    const { data } = await POST('/odata/v4/monitor/PurchaseOrderItems/MonitorService.syncFromS4', {}, anna)
    assert.deepEqual(data, { '@odata.context': '../$metadata#MonitorService.SyncResult', items: 16, suppliers: 6, delivered: 0 })
    const { data: kept } = await GET(item('4500000108'), anna)
    assert.equal(kept.status_code, 'CONFIRMED')
  })
})

describe('Berechtigungen', () => {
  it('erlaubt ohne Rolle Buyer nur das Lesen', async () => {
    await GET('/odata/v4/monitor/PurchaseOrderItems', lea)
    const response = await POST(action('4500000105', 'sendReminder'), {}, lea).catch(e => e.response)
    assert.equal(response.status, 403)
  })

  it('verlangt eine Anmeldung', async () => {
    const response = await GET('/odata/v4/monitor/PurchaseOrderItems').catch(e => e.response)
    assert.equal(response.status, 401)
  })
})
