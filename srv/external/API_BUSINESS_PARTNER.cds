/*
 * Ausschnitt aus der S/4HANA-Cloud-API "Business Partner" (OData V2,
 * API_BUSINESS_PARTNER) – nur die Lieferantensicht. Feldnamen wie im
 * Original; vollständig per `cds import API_BUSINESS_PARTNER.edmx`.
 */
@cds.external: true
service API_BUSINESS_PARTNER {

  @cds.external: true
  @sap.label: 'Lieferant'
  entity A_Supplier {
    key Supplier            : String(10);
        SupplierName        : String(80);
        SupplierFullName    : String(220);
        PurchasingIsBlocked : Boolean;
        PostingIsBlocked    : Boolean;
  }
}
