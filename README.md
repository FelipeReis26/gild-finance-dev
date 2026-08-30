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

All data lives in `src/db.js`. It currently uses the browser's
localStorage so you can run and test the app instantly with no setup.
Every function in that file is async and returns plain objects, so
swapping the storage for `@capacitor-community/sqlite` later means
rewriting the inside of that one file only, no screen changes needed.

## Run in the browser

```
npm install
npm run dev
```

Open the printed local URL. Resize your browser to a phone width, or
open dev tools device mode, to see it as intended.

## Package as an iOS app

The `ios/` folder is already generated and included in this project,
so no local Xcode step is needed before uploading to a build service
like Codemagic. A ready-made `codemagic.yaml` is also included at the
project root, so Codemagic picks up the whole build automatically
once you connect your Apple ID.

In Codemagic:

1. Add the app, pick "iOS app with Capacitor" or just let it detect
   `codemagic.yaml`
2. Under code signing, connect your Apple Developer account (uses
   Codemagic's App Store Connect integration, follow their one-time
   setup link, it walks you through generating an API key on
   developer.apple.com)
3. Start the build, it installs dependencies, builds the web app,
   syncs Capacitor, then builds and signs the iOS app
4. On success, it publishes to TestFlight automatically. Install the
   TestFlight app on your iPhone, accept the invite, and install
   from there

If you ever build locally on a Mac instead, from this folder run:

```
npm install
npm run build
npx cap sync ios
npx cap open ios
```

That opens the project in Xcode, where you can run it on a
connected iPhone or simulator like any native project.

## Wiring up real screenshot scanning

`src/screens/ScanImport.jsx` calls a stub function `scanImage()` that
returns fake data after a short delay. Replace its body with a real
call, for example sending the uploaded image to Claude's API with a
prompt asking for amount, merchant, and date back as JSON, or to a
dedicated OCR service. The rest of the screen, including the confirm
step, works unchanged once that function returns real data in the
same shape.

## Next steps worth considering

- Swap localStorage for `@capacitor-community/sqlite` for reliable
  on-device storage
- Add recurring bill auto-generation (next month's bill appears
  automatically after the current one is paid)
- Push notifications for bills due soon
- Testing the auto deploy feature on Netlify
