# Operations Automation: Reference Scripts

Rewritten reference versions of Google Apps Script tools I built while running operations for a food delivery platform. Company names, file IDs, email addresses and internal terms have been taken out, and the code is condensed to show how each tool works.

Use these for ideas, not as production code. Placeholders such as `YOUR_FOLDER_ID` need your own values, and helper functions that only read or write sheets are left out.

## What's here

| Folder | Tool | Result |
| --- | --- | --- |
| [`incentive-payouts`](incentive-payouts) | Incentive payout calculator and pay cycle consolidator | Fortnightly payout checks cut from about 6 hours to about 5 minutes |
| [`coverage-mapping`](coverage-mapping) | SPADE+ delivery coverage mapper | Commercial team maps restaurant coverage in a few clicks instead of asking operations |
| [`mail-merge`](mail-merge) | Compliance mail merge | No more send limits, and no risk of the wrong notice going to a rider |

## Automated rider incentive payouts

Checking rider incentive payouts by hand took about 6 hours every fortnight. These two scripts brought it down to about 5 minutes. The first works out what each rider earned across several campaigns at once. The second brings each pay cycle's files together for finance.

- Reads each week's archived rider activity and applies each campaign's rules, including time windows, zones, vehicle types, acceptance rate thresholds and order streaks.
- Pays on the fastest vehicle a rider used and reports on the slowest, for riders who switch vehicles mid-shift.
- Orders completed in the same second are sorted by a fixed rule, so streaks count the same way on every run.
- Caches archive file lookups, which stopped long runs failing on Google Drive limits.
- Has an audit mode for one campaign or rider, a payout cap per campaign and an activity log.
- The pay cycle consolidator builds one file per mid-month or end-of-month cycle, with rates, an executive summary and an email alert when a row has a missing or unknown vehicle type.

## Delivery coverage mapping tool (SPADE+)

The commercial team needed to see where each restaurant delivered, by travel time, without asking operations each time. I built this from scratch with AI coding assistants. It turns delivery area data into map layers they can open in Google Maps in a few clicks.

- Looks up each outlet by ID in a central master file, or by postal code when the ID is missing.
- Splits coverage into tiers by travel time for revenue planning, and carries a straight-line (Haversine) distance for each outlet.
- Exports KML with a set colour for each layer, named after the brand on the sheet.
- Each team member works in their own copy. The daily sync runs only from the master file, so copies never run duplicate syncs.
- Keeps a run log and a changelog of versions.

## Rider compliance mail merge

A free mail merge tool capped how many notices we could send, and picking the template by hand risked sending a rider the wrong notice. This replaced it inside Google Sheets.

- Five notice types, each with its own HTML template.
- Only one authorised account can send.
- Checks every pending row first and sends nothing if an email address is blank.
- Spaces out batches of more than 20 emails to avoid spam filters, and records the send time or the error against each row.

## Using this code

There's no licence on this repository. You're welcome to read it and take ideas from it. If you adapt any of it, test it on a copy of your own data first.

Built by AJ Sirajudeen. [LinkedIn](https://www.linkedin.com/in/ajsiraj)
