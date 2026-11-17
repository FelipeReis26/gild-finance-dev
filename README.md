# Finance tracker

Mobile-first budget and bill tracker. React app wrapped with Capacitor
so it runs as a real iOS or Android app.

## Screens

- Dashboard: safe to spend today (income, minus bills still due, money set
  aside and spending so far), savings and pay-off goals, top budgets
- Payday plan: on payday, split the pay across bills, savings and limits
- Add transaction: expense, income or a move between your own accounts
- Activity: full transaction list, grouped by day, filterable by category
- Bills: recurring bills, due dates, mark as paid (a transfer bill moves
  money into a savings pot or onto a card)
- Balances: debts, savings and money owed, with goals
- Subscriptions: repeat charges found in the transactions
- Scan: read a receipt screenshot on the device, or import a bank
  statement (Bank of Ireland CSV, Revolut CSV, Avant PDF)
- Settings: reminders, the Tripsy link, categories and limits, backups

## Data

All data lives in `src/db.js`, which reads and writes the browser's
localStorage. In the iPhone app, `src/deviceStore.js` also keeps a copy
in a file in the app's own storage (Library/gild-data.json), because iOS
can clear a web view's storage on its own. That file is loaded back into
localStorage before the app starts, and rewritten after every change. In
a browser it does nothing.

## Run in the browser

```
npm install
npm run dev
```

Open the printed local URL. Resize your browser to a phone width, or
open dev tools device mode, to see it as intended.

## Package as an iOS app

The iPhone app is the web app built into a Capacitor shell, so it runs
offline and a Vercel deploy doesn't change it. It's signed with a free
Apple ID (personal team), which means:

- it installs from Xcode only, onto your own devices;
- an install lasts 7 days, then press Run in Xcode again (your data
  stays on the phone through reinstalls);
- one free Apple ID can have 3 of its apps on a phone at once.

To build and install:

```
npm install
npm run ios
```

That builds the web app, syncs it into `ios/` and opens Xcode. Pick your
iPhone as the run destination and press Run.

On the phone, backups go to Files → On My iPhone → GILD. Export backup
saves there and opens the share sheet. Restore backup picks a file from
there (or anywhere in Files). Restoring first saves a safety copy of the
current data in the same folder, and doesn't restore if it can't.

`codemagic.yaml` is from an earlier plan to build in the cloud for
TestFlight, which needs the paid developer account.

## Statement import and trips

`src/statements.js` reads the statement files and matches them against what
is already in Gild (duplicates, moves already counted from the other account,
bills paid, last time's category, the bank's closing balance). PDFs are read
by iOS's own PDFKit in the app (the PdfText plugin in
`ios/App/App/AppDelegate.swift`) and by pdf.js in a browser.

`src/tripsy.js` reads trip costs from the Tripsy trip planner's feed so a
savings goal can follow a trip. It only reads; the access key stays on the
device and is never put in a backup.

## Tests

```
npm test
```

## Next steps worth considering

- Add recurring bill auto-generation (next month's bill appears
  automatically after the current one is paid)
- Push notifications for bills due soon
