import cds from '@sap/cds'
import { syncFromS4 } from './lib/s4-sync.js'
import { evaluate, MAX_DUNNING_LEVEL } from './lib/status.js'

const { PurchaseOrderItems: Items, Activities } = cds.entities('pomonitor')

const keyOf = i => ({ purchaseOrder: i.purchaseOrder, purchaseOrderItem: i.purchaseOrderItem, scheduleLine: i.scheduleLine })
const itemRef = i => ({ item_purchaseOrder: i.purchaseOrder, item_purchaseOrderItem: i.purchaseOrderItem, item_scheduleLine: i.scheduleLine })

export default class MonitorService extends cds.ApplicationService {
  init() {
    const { PurchaseOrderItems } = this.entities

    this.on('syncFromS4', PurchaseOrderItems, () => syncFromS4())

    this.on('recordConfirmation', PurchaseOrderItems, async req => {
      const item = await this.#openItem(req)
      const { confirmedDate, confirmedQuantity, channel, comment } = req.data
      const openQuantity = item.orderedQuantity - item.receivedQuantity
      const quantity = confirmedQuantity ?? openQuantity
      if (quantity <= 0 || quantity > openQuantity) {
        return req.reject(400, 'CONFIRMED_QUANTITY_INVALID', [openQuantity, item.unit], 'confirmedQuantity')
      }
      // Eine Rückmeldung des Lieferanten beendet das Mahnverfahren.
      await this.#change(item, { confirmedDate, confirmedQuantity: quantity, dunningLevel: 0, escalated: false })
      await INSERT.into(Activities).entries({
        ...itemRef(item), type_code: 'CONFIRMATION', channel_code: channel,
        confirmedDate, confirmedQuantity: quantity, text: comment
      })
      return SELECT.one.from(PurchaseOrderItems, keyOf(item))
    })

    this.on('sendReminder', PurchaseOrderItems, async req => {
      const item = await this.#openItem(req)
      if (item.status_code === 'CONFIRMED') return req.reject(409, 'REMINDER_NOT_NEEDED')
      if (item.dunningLevel >= MAX_DUNNING_LEVEL) return req.reject(409, 'MAX_DUNNING_LEVEL', [MAX_DUNNING_LEVEL])
      const level = item.dunningLevel + 1
      await this.#change(item, { dunningLevel: level, lastReminderAt: new Date().toISOString() })
      await INSERT.into(Activities).entries({
        ...itemRef(item), type_code: 'REMINDER', dunningLevel: level, text: reminderText(item, level)
      })
      return SELECT.one.from(PurchaseOrderItems, keyOf(item))
    })

    this.on('escalate', PurchaseOrderItems, async req => {
      const item = await this.#openItem(req)
      if (item.escalated) return req.reject(409, 'ALREADY_ESCALATED')
      await this.#change(item, { escalated: true })
      await INSERT.into(Activities).entries({ ...itemRef(item), type_code: 'ESCALATION', text: req.data.reason })
      return SELECT.one.from(PurchaseOrderItems, keyOf(item))
    })

    return super.init()
  }

  /** Lädt die Einteilung der gebundenen Aktion; geliefertes ist abgeschlossen. */
  async #openItem(req) {
    const item = await SELECT.one.from(Items, req.params[0])
    if (!item) return req.reject(404, 'ITEM_NOT_FOUND')
    if (item.status_code === 'DELIVERED') return req.reject(409, 'ITEM_DELIVERED')
    for (const q of ['orderedQuantity', 'receivedQuantity']) item[q] = Number(item[q] ?? 0)
    return item
  }

  async #change(item, data) {
    await UPDATE(Items, keyOf(item)).with({ ...data, ...evaluate({ ...item, ...data }) })
  }
}

function reminderText(item, level) {
  const position = `Bestellung ${item.purchaseOrder}, Position ${item.purchaseOrderItem}`
  const due = item.confirmedDate ?? item.requestedDate
  return item.delayDays > 0
    ? `${level}. Mahnung: ${position} – Liefertermin ${due} seit ${item.delayDays} Tagen überschritten.`
    : `${level}. Erinnerung: ${position} – bitte Liefertermin ${due} bestätigen.`
}
