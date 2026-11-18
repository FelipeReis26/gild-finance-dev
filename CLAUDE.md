# Gild

A private pay-period budget tracker. Everything stays on the device: no server, no account, no bank connection. It runs as a web app on Vercel and as an iPhone app (Capacitor) that carries its own copy of the web build. Pay periods start on the payday (the 19th by default, moved back off weekends), not on the 1st.

## Accounts

**Personal.** GitHub `FelipeReis26/gild-finance-dev`. **The repo is public**, so commits, tests and messages never hold real figures, balances, account or card numbers, or the names of real people or shops. Tests use made-up data.

- Local git identity: `Felipe Reis <78143596+FelipeReis26@users.noreply.github.com>`. Check `git config user.email` before every commit; the machine's global identity is the work one.
- Pushes go through the repo's deploy key: ssh alias `github-gild`, key `~/.ssh/gild_deploy`, push URL `git@github-gild:FelipeReis26/gild-finance-dev.git`. Never use the work `gh` login here, and never `gh auth login` / `switch`.
- PRs use a fine-grained token from the Keychain, passed per command: `GH_TOKEN="$(security find-generic-password -a FelipeReis26 -s gild-github-pat -w)" gh pr create --repo FelipeReis26/gild-finance-dev ...`. Never print it.
- Hosting is Felipe's personal Vercel. `netlify.toml` and `codemagic.yaml` are left over from earlier setups.

## Branches and the commit routine

- Work happens on `dev`, pushed straight to it. Each push builds a login-protected Vercel preview.
- `main` is the live site (gildfinance.vercel.app). It changes only through a PR from `dev`, and only when Felipe says "merge", after the preview deploy succeeded and `npm test` passes.
- No commits while still iterating. When Felipe says "commit it": commit, push to `dev`, and reinstall the same build on his iPhone so the phone matches `dev` (below). If the phone can't be reached, say the phone is behind.

## Running it

- `npm run dev` for the web app. The preview config is `.claude/launch.json` (`gild-dev`, port 5180).
- `npm test` runs every suite in `tests/` (plain Node, no framework). Add new suites to the `test` script.
- `npm run build` must pass before any push: `dev` and `main` both deploy from it.

## iPhone app

- Capacitor 8, signed with a free Apple personal team, so a build expires after 7 days. Bundle id `com.felipe.financetracker`.
- Install routine:
  1. Copy `Library/gild-data.json` off the phone as a safety copy (`xcrun devicectl device copy from ... --domain-type appDataContainer --domain-identifier com.felipe.financetracker`).
  2. `npm run build && npx cap sync ios`.
  3. In `ios/App`: `xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'id=<phone>' -derivedDataPath build/device -allowProvisioningUpdates build`.
  4. `xcrun devicectl device install app --device <phone> build/device/Build/Products/Debug-iphoneos/App.app`, then launch it.
  5. Copy the data file off again and check the counts match. `xcrun devicectl list devices` gives the phone's id.
- The phone runs an older iOS than the simulators. A fix that works in the simulator is untested on the phone until it has been checked there.
- Native code is in `ios/App/App/AppDelegate.swift`: the PdfText plugin (PDFKit reads statement PDFs; pdf.js legacy is only the browser fallback), `MainViewController` (registers it; `SceneDelegate` uses it as the root), and the "Log Apple Pay in GILD" App Intent, which writes `Library/gild-applepay-inbox.json` for `src/applePay.js` to pick up.
- `ios/App/App/public` and `ios/App/App/capacitor.config.json` are generated. Keep them untracked.

## Data

- Everything is in `localStorage` under `ft_*` keys, money as integer cents. `src/db.js` is the only layer that reads and writes them, and it hands out euros for display.
- In the iPhone app, `src/deviceStore.js` mirrors the `ft_*` keys to `Library/gild-data.json` so iOS can't wipe them. **The phone is the master copy of Felipe's data.** To change real data: copy the file off, change it, copy it back, relaunch with `--terminate-existing`, then copy it off again to check.
- `ft_tripsy_token` is a secret: stored raw, never exported in backups, never printed.
- Real data files live outside the repo, in `~/Desktop/Claude/GILD/Gild-DEV/Extras - Don't upload/`. Never copy them into the repo or the gitignored mock folder.

## Design

Visual or layout changes need a mock that Felipe has seen and picked before they're built. Every text field is at least 16px on mobile, or iOS zooms in on tap. Don't fix that with `maximum-scale`.

## Decisions

- 18 Nov 2026: safe to spend counts card spending once. A card purchase is spending in its own period; the part of a later card repayment that pays for it comes off what's set aside.
- 18 Nov 2026: work moved onto `dev`, pushed by Claude. Every "commit it" also reinstalls the iPhone app. The `ios-app` branch was merged into `dev` (fast-forward) and deleted.
- 18 Nov 2026: Apple Pay logging through a Shortcuts automation and the App Intent. Payments wait on the dashboard to be confirmed, never logged silently. No App Group needed, because the intent runs in the app's own process.
- 17 Nov 2026: iPhone app, savings and debt goals, subscriptions, warnings and reminders, payday plan, statement import (BOI CSV, Revolut CSV, Avant PDF) and the Tripsy link.
- 8 Oct 2026: balances tracked per account instead of one combined figure.
