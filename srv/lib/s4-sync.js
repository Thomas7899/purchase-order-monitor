import cds from '@sap/cds'
import { evaluate } from './status.js'

const LOG = cds.log('s4-sync')

const keyOf = i => ({ purchaseOrder: i.purchaseOrder, purchaseOrderItem: i.purchaseOrderItem, scheduleLine: i.scheduleLine })
const idOf = i => `${i.purchaseOrder}/${i.purchaseOrderItem}/${i.scheduleLine}`
const round2 = n => Math.round(n * 100) / 100

/**
 * Repliziert alle offenen Bestelleinteilungen samt Lieferanten aus S/4HANA
 * und bewertet danach jede lokal überwachte Einteilung neu. Lokale Daten
 * (Bestätigung, Mahnstufe, Eskalation) bleiben dabei erhalten.
 */
export async function syncFromS4() {
  const po = await cds.connect.to('API_PURCHASEORDER_PROCESS_SRV')
  const bp = await cds.connect.to('API_BUSINESS_PARTNER')
  const { A_PurchaseOrderItem } = po.entities
  const { A_Supplier } = bp.entities
  const { PurchaseOrderItems, Suppliers } = cds.entities('pomonitor')

  const s4Items = await po.run(
    SELECT.from(A_PurchaseOrderItem, i => {
      i.PurchaseOrder, i.PurchaseOrderItem, i.PurchaseOrderItemText, i.Material, i.Plant,
      i.OrderQuantity, i.PurchaseOrderQuantityUnit, i.NetPriceAmount, i.NetPriceQuantity,
      i.PurchasingDocumentDeletionCode,
      i.to_PurchaseOrder(h => { h.Supplier, h.PurchasingGroup, h.PurchaseOrderDate, h.DocumentCurrency }),
      i.to_ScheduleLine(s => { s.ScheduleLine, s.ScheduleLineDeliveryDate, s.ScheduleLineOrderQuantity, s.RoughGoodsReceiptQty })
    }).where({ IsCompletelyDelivered: false })
  )

  const rows = []
  for (const i of s4Items) {
    if (i.PurchasingDocumentDeletionCode) continue // gelöscht (L) oder gesperrt (S)
    const header = i.to_PurchaseOrder
    const pricePerUnit = Number(i.NetPriceAmount) / (Number(i.NetPriceQuantity) || 1)
    for (const s of i.to_ScheduleLine) {
      const ordered = Number(s.ScheduleLineOrderQuantity)
      const received = Number(s.RoughGoodsReceiptQty ?? 0)
      rows.push({
        purchaseOrder: i.PurchaseOrder,
        purchaseOrderItem: i.PurchaseOrderItem,
        scheduleLine: s.ScheduleLine,
        supplier_ID: header.Supplier,
        purchasingGroup: header.PurchasingGroup,
        plant: i.Plant,
        material: i.Material,
        description: i.PurchaseOrderItemText,
        orderDate: header.PurchaseOrderDate,
        orderedQuantity: ordered,
        receivedQuantity: received,
        unit: i.PurchaseOrderQuantityUnit,
        netPrice: Number(i.NetPriceAmount),
        priceUnit: Number(i.NetPriceQuantity),
        openValue: round2(Math.max(0, ordered - received) * pricePerUnit),
        currency: header.DocumentCurrency,
        requestedDate: s.ScheduleLineDeliveryDate
      })
    }
  }

  const supplierIds = [...new Set(rows.map(r => r.supplier_ID))]
  const suppliers = supplierIds.length
    ? await bp.run(SELECT.from(A_Supplier).where({ Supplier: { in: supplierIds } }))
    : []
  if (suppliers.length) await UPSERT.into(Suppliers).entries(suppliers.map(s => ({
    ID: s.Supplier, name: s.SupplierName, purchasingBlocked: !!s.PurchasingIsBlocked
  })))
  if (rows.length) await UPSERT.into(PurchaseOrderItems).entries(rows)

  // Neu bewerten; was in S/4 nicht mehr offen ist, gilt als geliefert.
  const stillOpen = new Set(rows.map(idOf))
  const local = await SELECT.from(PurchaseOrderItems)
    .columns('purchaseOrder', 'purchaseOrderItem', 'scheduleLine', 'orderedQuantity', 'receivedQuantity',
      'requestedDate', 'confirmedDate', 'escalated', 'status_code', 'delayDays')
    .where({ status_code: { '!=': 'DELIVERED' } })
  let delivered = 0
  for (const item of local) {
    const next = stillOpen.has(idOf(item)) ? evaluate(item) : { status_code: 'DELIVERED', delayDays: 0 }
    if (next.status_code === 'DELIVERED') delivered++
    if (next.status_code !== item.status_code || next.delayDays !== item.delayDays)
      await UPDATE(PurchaseOrderItems, keyOf(item)).with(next)
  }

  LOG.info(`${rows.length} Einteilungen und ${suppliers.length} Lieferanten synchronisiert, ${delivered} als geliefert abgeschlossen`)
  return { items: rows.length, suppliers: suppliers.length, delivered }
}
