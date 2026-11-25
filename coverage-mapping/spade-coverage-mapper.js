/**
 * SPADE+ Delivery Coverage Mapper (reference version)
 * Looks up each outlet's delivery area in a master file and exports map layers (KML).
 */
const CONFIG = {
  MASTER_FILE_ID: 'YOUR_MASTER_FILE_ID',  // kept on a Resources tab in the real tool
  EXPORT_FOLDER_NAME: 'Coverage Exports',
  MARKET_BOUNDS: { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 }  // set to your market to drop stray points
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('SPADE+')
    .addItem('Load delivery coverage', 'loadCoverage')
    .addItem('Export KML for Google Maps', 'exportKml')
    .addItem('Validate settings', 'validateSettings')
    .addToUi()
}

function loadCoverage() {
  const sheet = SpreadsheetApp.getActiveSheet()
  const master = indexMaster(readMasterFile())  // by outlet ID and by postal code
  const rows = sheet.getDataRange().getValues().slice(2)  // headers sit on row 2
  const out = rows.map(([outletId, postal]) => {
    const byPostal = master.byPostal.get(String(postal).replace(/\D/g, '').slice(0, 6)) || []
    const hit = master.byId.get(String(outletId)) || byPostal.find(o => o.geojson)
    return hit
      ? [hit.name, hit.pin, hit.geojson, hit.travelMinutes, hit.haversineKm, hit.sourceDate]
      : ['Not found', '', '', '', '', '']
  })
  if (out.length) sheet.getRange(3, 3, out.length, out[0].length).setValues(out)
  RunLog.write('loadCoverage', out.length)
}

// Revenue view: the smallest travel-time polygon is tier 1, the rest are tier 2
function splitTiers(geojson) {
  const polygons = flattenFeatures(JSON.parse(geojson))
    .filter(f => f.geometry && /Polygon/.test(f.geometry.type))
    .sort((a, b) => (a.properties.value || 0) - (b.properties.value || 0))
  return { tier1: polygons.slice(0, 1), tier2: polygons.slice(1) }
}

function exportKml() {
  const rows = SpreadsheetApp.getActiveSheet().getDataRange().getValues().slice(2)
  const placemarks = rows.filter(r => r[4]).map(r => placemark(r[2], r[4], r[5]))
  const kml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
    kmlStyles() + placemarks.join('') +
    '</Document></kml>'
  exportFolder().createFile(`${brandName()}_coverage.kml`, kml, 'application/vnd.google-earth.kml+xml')
}

// Each person works in their own copy of the sheet. The daily sync trigger lives
// only in the master file, so copies never run duplicate syncs.
function dailySyncFromMaster() {
  const master = readMasterFile()
  listUserCopies().forEach(copy => writeResources(copy, master))
}
