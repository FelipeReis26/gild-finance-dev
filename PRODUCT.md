# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!--
Mobile-first React/PWA packaged with Capacitor for iOS. The Capacitor
wrapper is distribution only; the design language is a single mobile web
app, not per-OS native. Confirmed with the user during init.
-->

## Users

Primary users are the maker and a small private circle of family and
friends — real people, but not a public App Store audience. They are
mostly non-technical and span several countries and languages, so plain
labels, forgiving first-run setup, and localized copy matter more than
power-user density. Each person runs the app on their own phone and sees
only their own data.

## Product Purpose

Gild is a personal budget and bill tracker for the phone. It answers, at
a glance, "how much have I spent this pay period, against my budget, and
what bills are still due." People log expenses and income, set per-category
budgets, track recurring bills, and review their activity over time.
Success is a person opening the app, trusting the numbers, and knowing
where they stand in a few seconds — without a spreadsheet, an account, or
handing their financial data to anyone.

## Positioning

The organizing idea is the **pay period, not the calendar month**: the
whole app reorganizes around a configurable pay day (e.g. the 19th to the
18th), with pay days that fall on a weekend treated as landing on the
nearest working day before, matching how salary actually settles. Combined
with being **fully on-device and account-free** — no server, no login, no
data leaving the phone — this is the position a typical budgeting app can't
truthfully copy without giving up either its cloud accounts or its
calendar-month framing.

## Operating Context

- Used on a personal phone, in short glances, often right after spending money.
- Core loop: check the dashboard (spend vs budget, income, category
  breakdown, income/spend trend) → add a transaction or scan a receipt →
  check what bills are due.
- Screens: Dashboard, Add transaction, Activity (transactions grouped by
  day, filterable by category), Bills (recurring, due dates, mark paid),
  Scan (OCR a receipt/screenshot, review, confirm), Balances, Settings.
- First run is a setup wizard: language → currency & pay day → choose
  categories → optional first income entry → finish.
- Entry is protected by an optional passcode lock.
- Because data is device-local, the backup ritual is load-bearing: users
  must export a backup file before switching phones or clearing browser
  data, and restore it afterward.

## Capabilities and Constraints

Confirmed capabilities:
- Pay-period engine with configurable pay day and weekend adjustment;
  optional "roll over unused budget to next month."
- Expense/income transactions; per-category monthly budgets (a category
  may be tracked with no budget); deleting a category **archives** it so
  old transactions keep its name and icon, and it can be restored.
- Recurring bills with due dates and mark-as-paid, correctly placed within
  a pay period even when the due day falls on the other side of pay day.
- Receipt/screenshot scanning via **on-device OCR (Tesseract.js)** — no
  image leaves the phone — with a review-and-confirm step before saving.
- Bulk transaction import that flags likely duplicates (same date, amount,
  note) to skip or keep.
- Backup export/import: backups are tagged with schema version, export
  date, and app version; restoring shows a preview and auto-downloads a
  safety copy of current data first.
- Dashboard trend chart showing income vs spending as separate bars over
  recent periods; swipe between periods; tap a bar to jump to a period.
- Edge-swipe-back gesture navigation, including stepping back within Settings.
- Undo toast on transaction delete (instead of a confirm prompt).

Constraints and terminology:
- **Money is stored as integer cents**, never floats, to avoid rounding drift.
- Data currently persists in `localStorage` (keys prefixed `ft_`); every
  function in `src/db.js` is async and returns plain objects, so the
  storage layer can later be swapped for `@capacitor-community/sqlite` by
  rewriting that one file only — no screen changes.
- Single-user, single-device per install; no multi-user or sync.
- "Pay period" and "pay day" are the app's native time unit; a pay day of
  1 (or less) is the sentinel for plain calendar months.

## Brand Commitments

- **Name: GILD** — set in capitals, and the capitalisation is deliberate. The product presents as "GILD" (HTML/PWA title, app
  title, theme color `#12141A`), superseding the earlier working name
  "Finance Tracker" (the Capacitor `appName` is now "GILD"; the appId remains
  `com.felipe.financetracker`, deliberately unchanged so existing installs are not orphaned). Confirmed as the intended name
  during init.
- A gold / "gild" motif runs through the identity: the current app icon is
  a diamond (replacing an original gold monogram) and the shell renders
  soft gold/blue/green background blobs. Recorded as existing identity
  signal, not as a prescribed visual direction.
- **Localized in five languages:** English, Français, Português (Brasil),
  Italiano, Español. Copy is expected to ship translated in all five.

## Evidence on Hand

- A working, feature-complete app (this repository) is the primary evidence.
- Development history is recorded in `src/changelog.js` (currently through
  v2.0.0), a factual account of shipped features.
- No testimonials, user counts, press, benchmarks, or pricing exist — this
  is a private tool for a small circle; future work must not fabricate any.

## Product Principles

1. **Truthful money.** Numbers are exact and trustworthy (integer cents,
   weekend-aware pay dates, duplicate flagging); never present a figure the
   user can't reconcile.
2. **The pay period is the unit.** Frame time, budgets, and bills around
   the salary cycle the person actually lives, not the calendar month.
3. **Private by construction.** Data stays on the device; no accounts, no
   servers, no telemetry. Make the backup/restore path safe and obvious
   because it is the only lifeline.
4. **Forgiving for non-technical people.** Gentle first-run setup, undo over
   confirm, restore previews, and localized copy — the circle isn't
   power users.
5. **Glanceable first.** The dashboard must answer "where do I stand this
   period" in seconds before it asks for any input.

## Accessibility & Inclusion

No formal standard has been set. Product-specific needs established:
multilingual (five languages) for a cross-country family circle, and a
non-technical audience for whom label clarity, legible numbers, and
touch-target comfort on a phone are the practical accessibility floor.
