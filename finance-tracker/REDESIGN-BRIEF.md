# Gild — Redesign Package

A self-contained handoff for redesigning Gild's visual system in a fresh
session. It carries the product truth that must survive, an honest snapshot
of the current look (as *evidence and anti-reference*, not a spec to
preserve), the full screen inventory, the hard constraints, and where
everything lives. Paste or open this alongside the code.

> Companion file: **PRODUCT.md** (same folder) holds the durable product
> record. This brief adds the design-specific context a redesign needs.

---

## 1. What Gild is (the 30-second version)

A mobile-first **personal budget + bill tracker** for the phone. Renamed
from "Finance Tracker." React + Vite, wrapped with Capacitor for iOS —
but the design language is a **mobile web / PWA**, one UI everywhere
(Capacitor is just packaging, not a native design target).

- **Audience:** the maker + a small private circle of **family & friends** —
  real people, mostly **non-technical**, spread across countries and
  languages. Not a public App Store product.
- **The two uncopyable ideas:**
  1. Organized around the **pay period, not the calendar month** — a
     configurable pay day (e.g. 19th→18th), with weekend pay days snapped
     to the nearest working day before.
  2. **Fully on-device / account-free** — no server, no login, no data
     ever leaves the phone.

## 2. What the redesign must respect (non-negotiable)

These are product truth and function. Change the *look*, not these:

- Every product capability in §4 keeps working. This is a **reskin /
  visual redesign**, not a feature change — unless you deliberately decide
  otherwise and say so.
- **Five languages** ship translated: English, Français, Português (BR),
  Italiano, Español. Any new copy needs all five (see `src/i18n.js`).
  Layouts must survive long strings (German-length is a good stress test;
  Portuguese/French already run long).
- **Money is exact.** Displayed values come from integer-cent math — never
  reintroduce float formatting. Currency symbol is user-set.
- **Pay-period framing** stays the primary time unit across dashboard,
  budgets, and bills. Don't quietly revert to calendar months.
- **On-device / private** posture. No new network calls, analytics, or
  account UI. The **backup/restore** path is a safety lifeline — keep it
  prominent and reassuring, not buried.
- **Non-technical, forgiving UX:** undo over confirm, restore previews,
  gentle first-run wizard. Don't trade this for density.
- **Phone form factor.** Single column, thumb-reachable. Current shell caps
  at `max-width: 480px` centered; a desktop visitor hits a `MobileGuard`.
- **Icons** currently come from the Tabler webfont (`@tabler/icons-webfont`,
  `ti ti-*`). Fine to swap the icon set, but keep every action iconed and
  labeled.

## 3. Current visual system — honest snapshot (evidence, not gospel)

Treat this as *what exists today* so you can decide what to keep, evolve,
or throw out. It is the anti-reference for a redesign, not a style guide to
protect.

**Aesthetic:** dark **glassmorphism**. Near-black canvas, three fixed
blurred color "blobs" behind everything, frosted translucent cards with
white hairline borders + inset top highlights, large soft drop shadows.
A warm gold ("gild") accent is the identity thread.

**Tokens** (from `src/styles.css` `:root`):

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0B0C10` | near-black canvas |
| `--text-primary` | `#F0EEE8` | warm off-white |
| `--text-secondary` | `rgba(240,238,232,.62)` | secondary text |
| `--text-muted` | `rgba(240,238,232,.40)` | muted text |
| `--gold` / `--gold-light` | `#C9A24B` / `#F0D190` | primary accent (gradient) |
| `--danger` | `#E7998D` | salmon (expense/negative) |
| `--success` | `#8FDBB5` | mint (income/positive) |
| accent blue | `#3E6FF2` | secondary accent / blob |
| `--glass*` | `rgba(255,255,255,.06–.10)` + `.14–.22` borders | frosted surfaces |
| `--radius` / `--radius-lg` | `16px` / `22px` | corner radii |

**Type:** system stack only — `-apple-system, BlinkMacSystemFont, 'Segoe
UI', Roboto, sans-serif`. **No custom/brand typeface yet** — an open lever
for the redesign.

**Surfaces:** `.glass`, `.card`, `.tile` (backdrop-blur 22px), `.grid-2`
for stat pairs.

**Navigation:** a bottom-right **FAB** (`.nav-fab`) toggles a floating menu
overlay with 6 destinations: **Dashboard · Activity · Bills · Balances ·
Scan · Settings**. (Worth reconsidering — a FAB-hidden menu is an unusual
choice for a primary nav of six equal tabs.)

**Motion / gestures:** edge-swipe-back navigation, swipe between periods on
the dashboard, undo toast on delete.

**Identity assets:** app icon is a diamond (replaced an earlier gold
monogram); PWA `theme-color` `#12141A`; the gold/diamond "gild" motif is the
only committed brand thread. Everything else is open.

## 4. Screen & state inventory (what you're redesigning)

Primary tabs:
- **Dashboard** — spend vs budget for the period, income, category
  breakdown, income/spend trend chart (bars), swipe between periods, tap a
  bar to jump. The glanceable hero of the app.
- **Activity (Transactions)** — full list grouped by day, filterable by
  category, category drill-down, edit/delete with undo.
- **Bills** — recurring bills, due dates within the pay period, mark paid.
- **Balances** — account/balance view.
- **Scan (Import)** — pick a receipt/screenshot → on-device OCR
  (Tesseract.js) → review detected amount/merchant/category → confirm to
  save.
- **Settings** — language, currency, pay day, budget rollover, categories,
  passcode, backup export/import, changelog. Has sub-views + edge-back.

Overlays & flows:
- **Add Transaction** (expense/income, also edit) — modal overlay.
- **Add Bill** — modal overlay.

First-run & system states (don't forget these — they set the tone):
- **Onboarding wizard** — welcome/language → currency & pay day →
  categories → optional first income → finish.
- **Lock** — passcode entry when a passcode is set.
- **MobileGuard** — the "open me on a phone" screen for desktop visitors.
- **AddToHomeScreenBanner** — PWA install nudge.
- **UndoToast** — transient undo after delete.
- **Empty states** — new install has no transactions/bills; design them.

## 5. Open levers for the redesign (nothing here is fixed)

- Typography — no brand typeface exists; big opportunity.
- The whole surface treatment — glassmorphism is a choice, not a
  requirement. Keep the gold thread if you want continuity, or reinterpret it.
- Primary navigation pattern (the FAB-menu is the weakest current call).
- Data-viz language for the trend chart and category breakdown.
- Light mode / theming (currently dark-only).
- Empty, loading, and error states.

## 6. Where everything lives (file map)

```
src/
  App.jsx              # shell, tab/overlay routing, lock/onboarding/guard gating
  styles.css           # ALL styling + design tokens (:root). 652 lines. Start here.
  i18n.js              # 5-language string tables + t(); add copy in all 5
  db.js                # storage + pay-period math. Integer cents. DON'T restyle logic.
  changelog.js         # shipped-feature history (factual)
  useSwipe.js          # edge-swipe-back + period swipe
  context/AppContext.jsx
  components/
    NavBar.jsx         # FAB + menu overlay
    UndoToast.jsx
  screens/
    Dashboard.jsx  Transactions.jsx  Bills.jsx  AddBill.jsx
    AddTransaction.jsx  Balances.jsx  ScanImport.jsx  Settings.jsx
    Onboarding.jsx  Lock.jsx  MobileGuard.jsx  AddToHomeScreenBanner.jsx
```

- **Styling is centralized in `src/styles.css`** with class names — not
  CSS modules or Tailwind. A redesign lives mostly here + per-screen JSX
  class changes.
- **Do not touch the internals of `db.js`** (money math, pay-period logic,
  storage). Read from it; don't restyle it.

## 7. Working-context notes (so the other session isn't surprised)

- **Repo layout:** under `~/Desktop/GILD` there are two copies. `finance-tracker/`
  is **live prod** (in GitHub); **`Gild-DEV/finance-tracker/` is the
  preview/staging branch** where work is authored, then merged to prod. Do
  the redesign in the `Gild-DEV` copy (this folder) and merge over.
- **Node isn't installed on this machine** — `npm run dev`, and any
  node-based tooling, won't run here as-is. Install Node to preview the app
  live (it's a standard Vite project: `npm install && npm run dev`, then
  resize the browser to phone width or use device mode).
- **Name mismatch to reconcile:** the app presents as **Gild**, but
  `capacitor.config.json` `appName` and appId `com.felipe.financetracker`
  still say "Finance Tracker." Small, worth aligning during the redesign.
- **README is slightly stale:** it calls the scan feature a "stub" — it's
  now real on-device OCR.

## 8. Suggested first move in the redesign session

1. Run the app (`npm run dev`, phone width) and screenshot every screen in
   §4 — including the first-run wizard and empty states — to see the real
   starting point.
2. Decide the visual world first (typography + surface treatment + how the
   gold thread carries), then apply it token-first in `src/styles.css`
   before touching individual screens.
3. Keep every constraint in §2 as a checklist.
