/*
 * Ausschnitt aus der S/4HANA-Cloud-API "Purchase Order" (OData V2,
 * API_PURCHASEORDER_PROCESS_SRV) mit den Feldern, die die Erweiterung liest.
 * Feldnamen und Typen entsprechen dem Original; der vollständige Service
 * lässt sich mit `cds import API_PURCHASEORDER_PROCESS_SRV.edmx` aus dem
 * SAP Business Accelerator Hub erzeugen und ersetzt diese Datei 1:1.
 */
@cds.external: true
service API_PURCHASEORDER_PROCESS_SRV {

  @cds.external: true
  @sap.label: 'Bestellkopf'
  entity A_PurchaseOrder {
    key PurchaseOrder          : String(10);
        CompanyCode            : String(4);
        PurchaseOrderType      : String(4);
        PurchasingOrganization : String(4);
        PurchasingGroup        : String(3);
        Supplier               : String(10);
        PurchaseOrderDate      : Date;
        DocumentCurrency       : String(5);
        to_PurchaseOrderItem   : Association to many A_PurchaseOrderItem
                                   on to_PurchaseOrderItem.PurchaseOrder = PurchaseOrder;
  }

  @cds.external: true
  @sap.label: 'Bestellposition'
  entity A_PurchaseOrderItem {
    key PurchaseOrder                  : String(10);
    key PurchaseOrderItem              : String(5);
        PurchaseOrderItemText          : String(40);
        Material                       : String(40);
        Plant                          : String(4);
        StorageLocation                : String(4);
        OrderQuantity                  : Decimal(13, 3);
        PurchaseOrderQuantityUnit      : String(3);
        NetPriceAmount                 : Decimal(16, 3);
        NetPriceQuantity               : Decimal(5, 0);
        IsCompletelyDelivered          : Boolean;
        PurchasingDocumentDeletionCode : String(1);
        to_PurchaseOrder               : Association to one A_PurchaseOrder
                                           on to_PurchaseOrder.PurchaseOrder = PurchaseOrder;
        to_ScheduleLine                : Association to many A_PurchaseOrderScheduleLine
                                           on  to_ScheduleLine.PurchasingDocument     = PurchaseOrder
                                           and to_ScheduleLine.PurchasingDocumentItem = PurchaseOrderItem;
  }

  @cds.external: true
  @sap.label: 'Einteilung'
  entity A_PurchaseOrderScheduleLine {
    key PurchasingDocument        : String(10);
    key PurchasingDocumentItem    : String(5);
    key ScheduleLine              : String(4);
        ScheduleLineDeliveryDate  : Date;
        ScheduleLineOrderQuantity : Decimal(13, 3);
        RoughGoodsReceiptQty      : Decimal(13, 3);
  }
}
