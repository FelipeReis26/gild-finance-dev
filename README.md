# Finance tracker

Mobile-first budget and bill tracker. React app wrapped with Capacitor
so it runs as a real iOS or Android app.

## Screens

- Dashboard: monthly spend vs budget, income, category breakdown
- Add transaction: expense or income entry
- Activity: full transaction list, grouped by day, filterable by category
- Bills: recurring bills, due dates, mark as paid
- Scan: upload a screenshot, review the detected amount and merchant, confirm to save

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

## Wiring up real screenshot scanning

`src/screens/ScanImport.jsx` calls a stub function `scanImage()` that
returns fake data after a short delay. Replace its body with a real
call, for example sending the uploaded image to Claude's API with a
prompt asking for amount, merchant, and date back as JSON, or to a
dedicated OCR service. The rest of the screen, including the confirm
step, works unchanged once that function returns real data in the
same shape.

## Next steps worth considering

- Add recurring bill auto-generation (next month's bill appears
  automatically after the current one is paid)
- Push notifications for bills due soon
