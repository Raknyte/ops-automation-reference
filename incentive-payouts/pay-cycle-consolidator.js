/**
 * Pay Cycle Consolidator (reference version)
 * Brings each mid-month or end-of-month cycle's payout files into one file per cycle.
 */
const CYCLE_CONFIG = {
  OUTPUT_FOLDER_ID: 'YOUR_OUTPUT_FOLDER_ID',
  LOG_RETENTION_DAYS: 60
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pay Cycles')
    .addItem('Refresh cycle (e.g. NOV MID 2026)', 'promptRefreshCycle')
    .addItem('Clean activity log', 'cleanActivityLog')
    .addToUi()
}

function refreshCycle(year, month, half) {
  const log = ActivityLog.open()
  const output = getOrCreateCycleFile(year, month, half)
  resetCycleFile(output)
  const rates = ratesForCycle(year, month, half)
  writeRatesSheet(output, rates)
  const knownCodes = new Set(rates.map(r => r.code))
  const results = []
  for (const type of readPaymentTypes().filter(t => t.enabled)) {
    try {
      const rows = readSourceRows(type)
      const exceptions = findVehicleExceptions(rows, knownCodes)
      if (exceptions.total) emailRunner(type.name, exceptions)
      results.push(writePaymentTypeTab(output, type, rows))
    } catch (e) {
      log.error(`${type.name} failed: ${e.message}`)
      if (type.stopOnError) throw e
    }
  }
  buildExecutiveSummary(output, results)  // gross and net, in total and by payment type
  log.info(`Cycle ${year}-${month}-${half} refreshed, ${results.length} payment types`)
}

// Rows with a missing or unknown vehicle type are emailed to whoever ran the refresh
function findVehicleExceptions(rows, knownCodes) {
  const missing = rows.filter(r => r.rider && !r.vehicle)
  const unknown = rows.filter(r => r.rider && r.vehicle && !knownCodes.has(r.vehicle))
  return { total: missing.length + unknown.length, missing: missing.slice(0, 20), unknown: unknown.slice(0, 20) }
}

// A weekly trigger keeps the activity log to the last 60 days
function cleanActivityLog() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Activity Log')
  const cutoff = Date.now() - CYCLE_CONFIG.LOG_RETENTION_DAYS * 86400000
  const rows = sheet.getDataRange().getValues()
  const keep = rows.filter((r, i) => i === 0 || new Date(r[0]).getTime() >= cutoff)
  sheet.clearContents()
  sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep)
}

// The archive export skips the write when totals and script version match the last run
function isUnchanged(lastRun, stats, version) {
  return Boolean(lastRun) &&
    lastRun.orders === stats.orders &&
    lastRun.amount.toFixed(2) === stats.amount.toFixed(2) &&
    lastRun.version === version
}
