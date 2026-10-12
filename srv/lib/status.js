/**
 * Statusermittlung einer Bestelleinteilung – reine Funktionen ohne
 * Datenbankzugriff, damit die Regeln einzeln testbar bleiben.
 */

/** Ohne Bestätigung gilt ein Termin ab so vielen Resttagen als gefährdet. */
export const AT_RISK_DAYS = 3

/** Höchste Mahnstufe; danach bleibt nur die Eskalation. */
export const MAX_DUNNING_LEVEL = 3

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const today = () => new Date().toISOString().slice(0, 10)

/** Kalendertage von `from` bis `to` (ISO-Datum, positiv wenn `to` später liegt). */
export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY)

export const addDays = (date, days) => new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10)

/**
 * Leitet Status und Verzug aus Bestell- und Überwachungsdaten ab.
 * Maßgeblich ist der bestätigte Termin, sonst der gewünschte.
 */
export function evaluate(item, on = today()) {
  if (Number(item.receivedQuantity ?? 0) >= Number(item.orderedQuantity)) {
    return { status_code: 'DELIVERED', delayDays: 0 }
  }
  const dueDate = item.confirmedDate ?? item.requestedDate
  const delayDays = Math.max(0, daysBetween(dueDate, on))

  if (item.escalated) return { status_code: 'ESCALATED', delayDays }
  if (delayDays > 0) return { status_code: 'OVERDUE', delayDays }
  if (item.confirmedDate) {
    const late = item.confirmedDate > item.requestedDate
    return { status_code: late ? 'AT_RISK' : 'CONFIRMED', delayDays }
  }
  const atRisk = daysBetween(on, item.requestedDate) <= AT_RISK_DAYS
  return { status_code: atRisk ? 'AT_RISK' : 'OPEN', delayDays }
}
