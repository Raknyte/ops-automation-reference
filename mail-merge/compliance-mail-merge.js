/**
 * Compliance Mail Merge (reference version)
 * Sends one of several notice types from a sheet, each with its own HTML template.
 */
const AUTHORISED_SENDER = 'operations-team@example.com'
const TEMPLATES = {
  'Notice 1': 'template_notice_1',
  'Notice 2': 'template_notice_2',
  'Ad hoc notice': 'template_notice_adhoc',
  'Termination with notice': 'template_terminate_notice',
  'Immediate termination': 'template_terminate_immediate'
}
const COL = { EMAIL: 1, TYPE: 7, STATUS: 8, SENT_AT: 9, ERROR: 10 }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Mail Merge')
    .addItem('Send this row', 'sendCurrentRow')
    .addItem('Send all pending', 'sendAllPending')
    .addToUi()
}

function isAuthorised() {
  if (Session.getActiveUser().getEmail() === AUTHORISED_SENDER) return true
  SpreadsheetApp.getUi().alert(`Only ${AUTHORISED_SENDER} can send these notices.`)
  return false
}

function sendAllPending() {
  if (!isAuthorised()) return
  const sheet = SpreadsheetApp.getActiveSheet()
  const pending = sheet.getDataRange().getValues()
    .map((values, i) => ({ values, row: i + 1 }))
    .slice(1)
    .filter(x => x.values[COL.STATUS - 1] !== 'Sent' && x.values.some(String))
  const blank = pending.filter(x => !x.values[COL.EMAIL - 1])
  if (blank.length) {
    SpreadsheetApp.getUi().alert(`Blank email on row ${blank.map(x => x.row).join(', ')}. Nothing was sent.`)
    return
  }
  pending.forEach(x => {
    sendRow(sheet, x.row)
    if (pending.length > 20) Utilities.sleep(2000 + Math.random() * 3000)  // spread out large batches
  })
}

function sendRow(sheet, row) {
  const values = sheet.getRange(row, 1, 1, 10).getValues()[0]
  const type = values[COL.TYPE - 1]
  try {
    const html = HtmlService.createHtmlOutputFromFile(TEMPLATES[type]).getContent()
    GmailApp.sendEmail(values[COL.EMAIL - 1], subjectFor(type), '', { htmlBody: fillTemplate(html, values) })
    sheet.getRange(row, COL.STATUS, 1, 3).setValues([['Sent', new Date(), '']])
  } catch (e) {
    sheet.getRange(row, COL.ERROR).setValue(e.message)
  }
}
