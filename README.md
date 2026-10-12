# Bestellüberwachung – Side-by-Side-Erweiterung für SAP S/4HANA

Einkäufer-Cockpit für offene Bestellpositionen (MM-Einkauf): Die App repliziert offene
Einteilungen aus S/4HANA, bewertet sie nach Termin und Lieferantenbestätigung und
unterstützt das Mahnverfahren bis zur Eskalation. Gebaut mit dem **SAP Cloud Application
Programming Model (CAP, Node.js)** und **SAP Fiori Elements (OData V4)** – so, wie man
S/4HANA heute nach dem Clean-Core-Prinzip erweitert: außerhalb des Kerns, nur über
freigegebene APIs.

## Szenario

In S/4HANA zeigen Listen wie ME2M offene Bestellungen, und ME91F druckt Mahnungen – aber
telefonische Zusagen, Eskalationen und der Überblick über die Liefertreue landen meist in
Excel und E-Mails. Diese Erweiterung bündelt das Nachfassen an einer Stelle:

| Funktion | Beschreibung |
|---|---|
| **Replikation** | Offene Bestelleinteilungen (EKKO/EKPO/EKET) über `API_PURCHASEORDER_PROCESS_SRV`, Lieferanten über `API_BUSINESS_PARTNER` |
| **Statusbewertung** | Offen, Bestätigt, Gefährdet, Überfällig, Eskaliert, Geliefert – inkl. Verzug in Tagen |
| **Auftragsbestätigung** | Termin und Menge des Lieferanten mit Kanal (E-Mail, Telefon, Portal, EDI) erfassen |
| **Mahnverfahren** | Bis zu drei Mahnstufen, danach Eskalation an das Lieferantenmanagement |
| **Verlauf** | Jede Bestätigung, Mahnung und Eskalation mit Benutzer und Zeitpunkt |
| **Liefertreue** | `SupplierPerformance`: offene und überfällige Einteilungen je Lieferant |

### Statusregeln

Maßgeblich ist der bestätigte Termin, ohne Bestätigung der gewünschte Liefertermin.

| Status | Regel |
|---|---|
| Geliefert | Wareneingangsmenge ≥ Einteilungsmenge oder Position in S/4 nicht mehr offen |
| Eskaliert | manuell eskaliert, bis zur Lieferung oder neuen Bestätigung |
| Überfällig | Termin überschritten |
| Gefährdet | bestätigter Termin liegt nach dem Wunschtermin oder ≤ 3 Tage bis Termin ohne Bestätigung |
| Bestätigt | fristgerecht bestätigt |
| Offen | alles andere |

Eine neue Lieferantenbestätigung setzt Mahnstufe und Eskalation zurück.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run watch
```

Dann <http://localhost:4004/purchaseorders/webapp/index.html> öffnen.

| Benutzer | Passwort | Rolle |
|---|---|---|
| `anna` | `anna` | `Buyer` – darf bestätigen, mahnen, eskalieren, synchronisieren |
| `lea` | `lea` | nur lesen |

Die beiden S/4-APIs laufen lokal als Mock im selben Prozess (`srv/external/data`). Beim
Start werden die Demotermine relativ zum heutigen Datum verschoben und einmal
synchronisiert, damit die Liste immer dasselbe Bild zeigt.

```bash
npm test     # Unit- und Integrationstests (node:test + @cap-js/cds-test)
npm run lint
```

## Architektur

```
 S/4HANA (Cloud oder on-premise)                SAP BTP – diese App
┌──────────────────────────────┐  OData V2  ┌─────────────────────────────────────────┐
│ API_PURCHASEORDER_PROCESS_SRV│◀───────────│ srv/lib/s4-sync.js   Replikation        │
│ API_BUSINESS_PARTNER         │            │ srv/lib/status.js    Statusregeln       │
└──────────────────────────────┘            │ srv/monitor-service  OData V4 + Aktionen│
                                            │ db/schema.cds        eigene Tabellen    │
                                            │ app/purchaseorders   Fiori Elements     │
                                            └─────────────────────────────────────────┘
```

Die Bestelldaten werden repliziert statt bei jedem Aufruf live gelesen: So lassen sich
eigene Felder (Mahnstufe, Bestätigung) mit S/4-Daten filtern, sortieren und aggregieren,
und die App bleibt bedienbar, wenn S/4 nicht erreichbar ist.

```
db/                    Domänenmodell und Codelisten
srv/
  external/            Ausschnitte der S/4-APIs + Mockdaten
  lib/                 Synchronisation, Statusregeln, Demodaten
  monitor-service.*    Service-Definition und Aktionen
app/purchaseorders/    Fiori-Elements-App (List Report + Object Page)
test/                  Tests
_i18n/                 Texte und Fehlermeldungen
```

## Anbindung an ein echtes S/4HANA

1. EDMX der beiden APIs aus dem [SAP Business Accelerator Hub](https://api.sap.com)
   laden und mit `npx cds import <datei>.edmx` importieren – das ersetzt die Ausschnitte in
   `srv/external`.
2. Im BTP-Subaccount eine Destination `S4HANA` anlegen. Im Profil `production` sind beide
   Services bereits darauf konfiguriert (`package.json` → `cds.requires`).
3. `syncFromS4` regelmäßig auslösen, z. B. über den SAP BTP Job Scheduling Service.

## Nächste Schritte

- Deployment auf SAP BTP (Cloud Foundry): `cds add hana,xsuaa,mta,approuter`
- Mahnungen per E-Mail versenden (CAP-Outbox, Mail-Destination)
- Bestätigungen per Event (SAP Event Mesh, `sap.s4.beh.purchaseorder.v1`) statt Polling
- Zweite App „Liefertreue“ auf Basis von `SupplierPerformance`
