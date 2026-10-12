import cds from '@sap/cds'
import { shiftDemoDates } from './srv/lib/demo-data.js'
import { syncFromS4 } from './srv/lib/s4-sync.js'

// Lokal laufen die S/4-APIs als Mock im selben Prozess: Demodaten auf das
// heutige Datum schieben und einmal synchronisieren, damit die Liste gefüllt ist.
cds.once('served', async () => {
  const po = cds.services.API_PURCHASEORDER_PROCESS_SRV
  if (!(po instanceof cds.ApplicationService)) return
  await shiftDemoDates(po)
  await syncFromS4()
})

export default cds.server
