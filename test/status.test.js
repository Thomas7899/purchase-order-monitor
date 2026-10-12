import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate } from '../srv/lib/status.js'

const ON = '2026-10-12'
const item = data => ({ orderedQuantity: 100, receivedQuantity: 0, requestedDate: '2026-10-30', ...data })

describe('evaluate', () => {
  it('ist offen, solange der Termin weit genug weg ist', () => {
    assert.deepEqual(evaluate(item(), ON), { status_code: 'OPEN', delayDays: 0 })
  })

  it('ist gefährdet, wenn der Termin ohne Bestätigung naht', () => {
    assert.equal(evaluate(item({ requestedDate: '2026-10-15' }), ON).status_code, 'AT_RISK')
    assert.equal(evaluate(item({ requestedDate: '2026-10-16' }), ON).status_code, 'OPEN')
  })

  it('zählt den Verzug ab dem gewünschten Termin', () => {
    assert.deepEqual(evaluate(item({ requestedDate: '2026-10-02' }), ON), { status_code: 'OVERDUE', delayDays: 10 })
  })

  it('misst einen bestätigten Termin am bestätigten Datum', () => {
    assert.deepEqual(evaluate(item({ requestedDate: '2026-10-02', confirmedDate: '2026-10-20' }), ON),
      { status_code: 'AT_RISK', delayDays: 0 })
    assert.equal(evaluate(item({ confirmedDate: '2026-10-28' }), ON).status_code, 'CONFIRMED')
    assert.deepEqual(evaluate(item({ confirmedDate: '2026-10-10' }), ON), { status_code: 'OVERDUE', delayDays: 2 })
  })

  it('behält die Eskalation bis zur Lieferung', () => {
    assert.equal(evaluate(item({ escalated: true }), ON).status_code, 'ESCALATED')
    assert.deepEqual(evaluate(item({ escalated: true, receivedQuantity: 100 }), ON), { status_code: 'DELIVERED', delayDays: 0 })
  })
})
