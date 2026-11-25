/**
 * Rider Incentive Payout Calculator (reference version)
 * Reads archived rider activity, applies each campaign's rules and builds a payout file.
 */
const CONFIG = {
  ARCHIVE_ROOT_FOLDER_ID: 'YOUR_ARCHIVE_FOLDER_ID',
  TIMEZONE: 'Asia/Singapore',
  SAME_SECOND_RULE: 'favour-delivered'  // or 'favour-rejected' or 'strict'
}

const FILE_CACHE = new Map()  // one Drive lookup per archive file per run

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Incentives')
    .addItem('Run all campaigns', 'runAllCampaigns')
    .addItem('Audit one campaign or rider', 'runAudit')
    .addToUi()
}

function runAllCampaigns() {
  const log = ActivityLog.open()
  const campaigns = readCampaigns()  // from the Rules sheet
  preflightChecks(campaigns)          // stop early if a tab or column is missing
  for (const campaign of campaigns) {
    try {
      const riders = aggregateRiderActivity(campaign)
      const payouts = riders.map(r => ({ rider: r.id, amount: evaluateRider(campaign.rules, r, fastestVehicle(r.vehicles)) }))
      applyCampaignCap(payouts, campaign.cap)
      writePayoutExport(campaign, payouts)
      log.info(`${campaign.id}: ${payouts.length} riders`)
    } catch (e) {
      log.error(`${campaign.id} failed: ${e.message}`)  // one failure does not stop the run
    }
    log.flush()
  }
  updatePayCycleFile()
}

function findArchiveFile(week) {
  if (FILE_CACHE.has(week.key)) return FILE_CACHE.get(week.key)
  const root = DriveApp.getFolderById(CONFIG.ARCHIVE_ROOT_FOLDER_ID)
  const yearFolder = childFolder(root, String(week.isoYear))
  const weekFolder = yearFolder && childFolder(yearFolder, `Week ${week.number}`)
  const file = weekFolder ? firstFileContaining(weekFolder, week.key) : null
  FILE_CACHE.set(week.key, file)
  return file
}

// Orders finished in the same second are ordered by a fixed rule,
// so streaks count the same way on every run
function sortEvents(events) {
  const tie = (a, b) => CONFIG.SAME_SECOND_RULE === 'favour-delivered' ? b.delivered - a.delivered
    : CONFIG.SAME_SECOND_RULE === 'favour-rejected' ? a.delivered - b.delivered : 0
  return events.sort((a, b) => (a.time - b.time) || tie(a, b))
}

// Pay on the fastest vehicle a rider used, report on the slowest
const SPEED_ORDER = ['Scooter', 'E-bike', 'PMA', 'Bicycle', 'Walker']
const fastestVehicle = used => SPEED_ORDER.find(v => used.has(v)) || 'Walker'
const slowestVehicle = used => [...SPEED_ORDER].reverse().find(v => used.has(v)) || 'Walker'

function evaluateRider(rules, rider, vehicle) {
  const acceptance = rider.assigned ? rider.delivered / rider.assigned : 0
  let fixed = 0, perOrder = 0, streakBonus = 0
  for (const rule of rules) {
    if (!compare(acceptance, rule.acceptanceThreshold, rule.operator)) continue
    if (rule.vehicles.length && !rule.vehicles.includes(vehicle)) continue
    if (rule.type === 'fixed' && rider.delivered >= rule.fromOrder) {
      fixed = Math.max(fixed, rule.value)
    } else if (rule.type === 'per_order') {
      const upper = rule.toOrder ? Math.min(rider.delivered, rule.toOrder) : rider.delivered
      perOrder += Math.max(0, upper - Math.max(1, rule.fromOrder) + 1) * rule.value
    } else if (rule.type === 'streak') {
      streakBonus += countStreaks(sortEvents(rider.events), rule.fromOrder || 4) * rule.value
    }
  }
  return round2(fixed + perOrder + streakBonus)
}

// A streak is N delivered orders in a row. A rejected order resets the count.
function countStreaks(events, size) {
  let run = 0, sets = 0
  for (const e of events) {
    if (e.delivered) {
      run++
      if (run === size) { sets++; run = 0 }
    } else {
      run = 0
    }
  }
  return sets
}

// Scale every payout down evenly when a campaign goes over its budget
function applyCampaignCap(payouts, cap) {
  const total = round2(payouts.reduce((sum, p) => sum + p.amount, 0))
  if (!cap || total <= cap) return
  const factor = cap / total
  let running = 0
  payouts.forEach((p, i) => {
    const last = i === payouts.length - 1
    p.amount = last ? Math.max(0, round2(cap - running)) : round2(p.amount * factor)
    running += p.amount
  })
}
