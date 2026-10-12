namespace pomonitor;

using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';

/**
 * Lieferant – repliziert aus API_BUSINESS_PARTNER (A_Supplier).
 */
entity Suppliers : managed {
  key ID                : String(10)  @title: '{i18n>Supplier}';
      name              : String(80)  @title: '{i18n>SupplierName}';
      purchasingBlocked : Boolean default false @title: '{i18n>PurchasingBlocked}';
      items             : Association to many PurchaseOrderItems
                            on items.supplier = $self;
}

/**
 * Einteilung einer offenen Bestellposition – die Bestelldaten werden aus
 * API_PURCHASEORDER_PROCESS_SRV repliziert, die Überwachungsdaten
 * (Bestätigung, Mahnstufe, Eskalation) entstehen nur in dieser Erweiterung.
 */
entity PurchaseOrderItems : managed {
      // --- aus S/4HANA (EKKO/EKPO/EKET) ---
  key purchaseOrder     : String(10)     @title: '{i18n>PurchaseOrder}';
  key purchaseOrderItem : String(5)      @title: '{i18n>PurchaseOrderItem}';
  key scheduleLine      : String(4)      @title: '{i18n>ScheduleLine}';
      supplier          : Association to Suppliers @title: '{i18n>Supplier}';
      purchasingGroup   : String(3)      @title: '{i18n>PurchasingGroup}';
      plant             : String(4)      @title: '{i18n>Plant}';
      material          : String(40)     @title: '{i18n>Material}';
      description       : String(40)     @title: '{i18n>Description}';
      orderDate         : Date           @title: '{i18n>OrderDate}';
      orderedQuantity   : Decimal(13, 3) @title: '{i18n>OrderedQuantity}';
      receivedQuantity  : Decimal(13, 3) @title: '{i18n>ReceivedQuantity}';
      unit              : String(3)      @title: '{i18n>Unit}';
      netPrice          : Decimal(16, 3) @title: '{i18n>NetPrice}';
      priceUnit         : Decimal(5, 0)  @title: '{i18n>PriceUnit}';
      openValue         : Decimal(15, 2) @title: '{i18n>OpenValue}';
      currency          : String(3)      @title: '{i18n>Currency}';
      requestedDate     : Date           @title: '{i18n>RequestedDate}';

      // --- Überwachung (nur in der Erweiterung) ---
      confirmedDate     : Date           @title: '{i18n>ConfirmedDate}';
      confirmedQuantity : Decimal(13, 3) @title: '{i18n>ConfirmedQuantity}';
      dunningLevel      : Integer default 0 @title: '{i18n>DunningLevel}';
      lastReminderAt    : Timestamp      @title: '{i18n>LastReminderAt}';
      escalated         : Boolean default false @title: '{i18n>Escalated}';
      status            : Association to ItemStatus default 'OPEN' @title: '{i18n>Status}';
      delayDays         : Integer default 0 @title: '{i18n>DelayDays}';
      activities        : Composition of many Activities
                            on activities.item = $self;
}

/**
 * Verlauf je Einteilung: Lieferantenbestätigungen, Mahnungen, Eskalationen.
 */
entity Activities : cuid, managed {
  item              : Association to PurchaseOrderItems;
  type              : Association to ActivityTypes @title: '{i18n>ActivityType}';
  text              : String(500)                 @title: '{i18n>Text}';
  channel           : Association to Channels     @title: '{i18n>Channel}';
  confirmedDate     : Date                        @title: '{i18n>ConfirmedDate}';
  confirmedQuantity : Decimal(13, 3)              @title: '{i18n>ConfirmedQuantity}';
  dunningLevel      : Integer                     @title: '{i18n>DunningLevel}';
}

entity ItemStatus : CodeList {
  key code        : String(10);
      criticality : Integer;
}

entity ActivityTypes : CodeList {
  key code : String(12);
}

entity Channels : CodeList {
  key code : String(10);
}
