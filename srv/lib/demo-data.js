import { addDays, daysBetween, today } from './status.js'

/** Stichtag, auf den die Termine in srv/external/data abgestimmt sind. */
export const DEMO_DATE = '2026-10-12'

/**
 * Verschiebt Bestell- und Liefertermine der gemockten S/4-API um den Abstand
 * zwischen Stichtag und heute, damit die Demo jeden Tag dasselbe Bild zeigt.
 */
export async function shiftDemoDates(po) {
  const offset = daysBetween(DEMO_DATE, today())
  if (offset === 0) return
  const { A_PurchaseOrder, A_PurchaseOrderScheduleLine } = po.entities

  for (const h of await po.run(SELECT.from(A_PurchaseOrder).columns('PurchaseOrder', 'PurchaseOrderDate'))) {
    await po.run(UPDATE(A_PurchaseOrder, h.PurchaseOrder)
      .with({ PurchaseOrderDate: addDays(h.PurchaseOrderDate, offset) }))
  }
  const lines = await po.run(SELECT.from(A_PurchaseOrderScheduleLine)
    .columns('PurchasingDocument', 'PurchasingDocumentItem', 'ScheduleLine', 'ScheduleLineDeliveryDate'))
  for (const { ScheduleLineDeliveryDate, ...key } of lines) {
    await po.run(UPDATE(A_PurchaseOrderScheduleLine, key)
      .with({ ScheduleLineDeliveryDate: addDays(ScheduleLineDeliveryDate, offset) }))
  }
}
