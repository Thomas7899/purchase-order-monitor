using {pomonitor as db} from '../db/schema';

/**
 * Einkäufer-Cockpit für offene Bestellpositionen: Termine überwachen,
 * Lieferantenbestätigungen erfassen, mahnen und eskalieren.
 */
@requires: 'authenticated-user'
service MonitorService {

  type SyncResult {
    items     : Integer;
    suppliers : Integer;
    delivered : Integer;
  }

  @readonly
  entity PurchaseOrderItems  as projection on db.PurchaseOrderItems
    actions {
      @requires: 'Buyer'
      action recordConfirmation(
        @title: '{i18n>ConfirmedDate}'
        confirmedDate: Date not null,
        @title: '{i18n>ConfirmedQuantity}'
        confirmedQuantity: Decimal(13, 3),
        @title: '{i18n>Channel}'
        channel: db.Channels:code,
        @title: '{i18n>Comment}'
        @UI.MultiLineText
        comment: String(500)
      ) returns PurchaseOrderItems;

      @requires: 'Buyer'
      action sendReminder()                    returns PurchaseOrderItems;

      @requires: 'Buyer'
      action escalate(
        @title: '{i18n>Reason}'
        @UI.MultiLineText
        reason: String(500) not null
      )                                        returns PurchaseOrderItems;

      /** Offene Bestelleinteilungen aus S/4HANA nachladen und Status neu bewerten. */
      @requires: 'Buyer'
      @cds.odata.bindingparameter.collection
      action syncFromS4()                      returns SyncResult;
    };

  @readonly
  @cds.odata.valuelist
  entity Suppliers           as projection on db.Suppliers;

  @readonly
  entity Activities          as projection on db.Activities;

  @readonly
  entity ItemStatus          as projection on db.ItemStatus;

  @readonly
  entity Channels            as projection on db.Channels;

  /** Liefertreue je Lieferant über alle noch offenen Einteilungen. */
  @readonly
  @cds.redirection.target: false
  entity SupplierPerformance as
    select from db.PurchaseOrderItems {
      key supplier.ID                                           as supplier     : String(10),
          supplier.name                                         as supplierName : String(80),
          count(1)                                              as openItems    : Integer,
          sum(case when status.code in ('OVERDUE', 'ESCALATED')
                then 1 else 0 end)                              as overdueItems : Integer,
          sum(openValue)                                        as openValue    : Decimal(15, 2),
          max(delayDays)                                        as maxDelayDays : Integer
    }
    where status.code != 'DELIVERED'
    group by supplier.ID, supplier.name;
}
