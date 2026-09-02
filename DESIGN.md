---
name: Gild — Watch Dial
description: Haute-horlogerie instrument on dial black; champagne gold reserved for the precious, Cinzel for the balance, Hanken Grotesk for everything else.
colors:
  bg: "#0E0F12"
  plate: "#15171B"
  plate-2: "#1C1E24"
  plate-hover: "#23262D"
  plate-inset: "rgba(237, 235, 228, 0.03)"
  ink: "#EDEBE4"
  ink-2: "rgba(237, 235, 228, 0.68)"
  ink-3: "rgba(237, 235, 228, 0.52)"
  rule-gold: "rgba(201, 169, 106, 0.32)"
  rule-soft: "rgba(237, 235, 228, 0.09)"
  gold: "#C9A96A"
  gold-light: "#E3C88F"
  gold-deep: "#8F7440"
  gold-text: "#171204"
  credit: "#A9C9A4"
  debit: "#D2A578"
  danger: "#C75546"
  danger-text: "#DB7264"
typography:
  display:
    fontFamily: "'Cinzel', 'Hanken Grotesk', serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0.01em"
    fontFeature: "tabular-nums"
  wordmark:
    fontFamily: "'Cinzel', 'Hanken Grotesk', serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "0.18em"
    textTransform: "uppercase"
  engraved:
    fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.24em"
    textTransform: "uppercase"
  section-title:
    fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    fontFeature: "tabular-nums"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "20px"
  full: "999px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-text}"
    rounded: "16px"
    height: "54px"
    fontWeight: 700
    fontSize: "13px"
    letterSpacing: "0.14em"
    textTransform: "uppercase"
  button-secondary:
    backgroundColor: "{colors.plate-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
  button-mini:
    backgroundColor: "{colors.plate-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.xl}"
    padding: "18px"
  tile:
    backgroundColor: "{colors.plate-2}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.plate-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  chip-active:
    backgroundColor: "rgba(201, 169, 106, 0.14)"
    textColor: "{colors.gold-light}"
    rounded: "{rounded.full}"
    height: "34px"
    padding: "0 14px"
  cat-row:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  subdial:
    backgroundColor: "{colors.plate}"
    rounded: "16px"
    padding: "12px 6px"
  hero-stat:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "9px 14px"
  disclosure:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "50px"
    padding: "0 18px"
  drawer-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "14px"
    height: "52px"
    padding: "0 14px"
---

# Design System: Gild — Watch Dial

## Overview

**Creative North Star: "A Timepiece for Money"**

Gild is haute horlogerie, not fintech. The ground is dial black (`#0E0F12`), text is chalk ink (`#EDEBE4`), and one champagne gold (`#C9A96A`) plays the role of applied metal: the balance numeral, the remaining-day ticks of the dial, the one primary action, and the active place in navigation. The pay period is rendered as a power reserve — a 296px dial with one tick per day, engine-turned (guilloché) circles inside, and the money left as the applied numeral at center (Hanken Grotesk, gold). Budgets are complications: capped chronograph subdial arcs, each ringed by twelve faint chapter ticks. Money movement is muted sage in, warm bronze out; coral appears only for genuinely over budget, in two calibrated shades.

Two faces, strictly divided: Cinzel (500–700) exclusively for the balance numeral and the GILD wordmark — the applied metal — and Hanken Grotesk (400–800) for all other UI. The label grammar is engraved caps: 10px, 0.24em-tracked uppercase, the way POWER RESERVE is printed on a dial.

This world refuses the fintech card stack, the editorial serif ledger, and green-banking calm alike (both prior worlds are dead; none of their rules apply). Radial composition is the native grammar of the instrument itself — the hero is centered inside its dial — while everything below returns to refined rows. Depth stays physical: hairline borders and soft dark shadows on flat plates; no blur, no gradients, no blobs (`.bg-blobs`/`.blob` are hard-disabled at the source).

The story of the flagship surface: open → the dial shows the pay period as a power reserve — spent days faint, remaining days gold, today long and bright — with what's left as the gold Cinzel numeral at center → the subdial complications show the top budgets → the rows say where it went.

**Key Characteristics:**
- Dial black ground (#0E0F12), cool near-black plates, chalk ink — never pure black, never warm brown.
- Champagne gold as applied metal: balance numeral, remaining day ticks/arcs, primary action, active selection.
- Two faces: Cinzel for the balance + wordmark only; Hanken Grotesk for everything else.
- Data as honest instruments: per-day ticks, capped arcs — never a decorative chart.
- Sage = in, bronze = out; two corals (large vs. small text) only for genuinely over.

## Colors

### Primary
- **Champagne gold** (`{colors.gold}`, light `{colors.gold-light}`, deep `{colors.gold-deep}`): the applied metal. On surfaces it appears as: the balance numeral at dial center, the remaining-day ticks (0.8 opacity) and today's bright gold-light tick, the subdial arcs, the solid primary-button fill (ink `{colors.gold-text}` on it), the active drawer item (gold on a 12% gold tint), active chips (gold hairline + gold-light text on a 14% tint), the gold-light focus ring, and the `::selection` wash (`rgba(201,169,106,0.3)`).
- **Gold hairline** (`{colors.rule-gold}`): a 32%-gold rule for edges that deserve emphasis (currently the strong-border alias).

### Secondary — the money system
- **Sage / Credit** (`{colors.credit}`): money in. Income dot, income trend bars, success badges.
- **Bronze / Debit** (`{colors.debit}`): money out. Spent dot, spend trend bars.
- **Coral / Danger** (`{colors.danger}` + `{colors.danger-text}`): genuinely over budget only. See The Two-Coral Rule.

### Neutral
- **Ground** (`{colors.bg}`): the dial-black page; also the top bar (borderless).
- **Plate** (`{colors.plate}`), **Plate-2** (`{colors.plate-2}`), **Plate-hover** (`{colors.plate-hover}`): the elevation ramp — plate for cards, category rows, subdials, pills, the drawer; plate-2 for inset controls (inputs, secondary/mini buttons, chips, segmented) .
- **Ink ramp** (`{colors.ink}` / `{colors.ink-2}` at 68% / `{colors.ink-3}` at 52%): full ink for names and values; ink-2 for labels, captions, the dial subline; ink-3 for engraved caps and placeholders. Spent day ticks are ink at 0.16.
- **Soft hairline** (`{colors.rule-soft}`): the 1px edge on every plate; also the dial's chapter ring and the subdial track.

### Named Rules
**The Gold Grant.** Gold is granted to exactly four things: the balance numeral, the remaining day ticks/arcs (the reserve still unspent), the one primary action per surface, and the active selection state (drawer item, chip, focus ring). Anything else asking for gold is refused.

**The Two-Coral Rule.** `--danger` (#C75546) is for large numerals, arcs, and bar fills; `--danger-text` (#DB7264) is the same coral lifted to clear 4.5:1 for small text (over-budget category names/figures, error text). Both mean one thing only: genuinely over budget. Ordinary spending is never coral.

**The In/Out Rule.** Sage always means money in, bronze always means money out; never swap them.

## Typography

**Two faces, one boundary.** Cinzel (500/600/700) and Hanken Grotesk (400–800), loaded from Google Fonts.

**The Two-Face Rule.** Cinzel is the wordmark alone — GILD in the top bar (16px) and drawer head (22px), 600 weight, 0.18em tracked uppercase. Every figure, label, row and button is Hanken Grotesk, the balance numeral included (44/700, -0.02em, tabular): the money reads in the app's own voice, and the serif stays a signature rather than a costume.18em tracked uppercase). Everything else — every label, row, figure, and button — is Hanken Grotesk. A third Cinzel sighting is wrong. The breakdown ring's center total is deliberately `--ui` at 25/700: it is a reading, not the balance.

**The Engraved Caps Rule.** The label grammar of this world is `.engraved`: 10px / 600 / 0.24em tracked uppercase in ink-3 — dial print, like POWER RESERVE on a watch face. It labels the instrument (LEFT TO SPEND / OVERSPENT above the numeral). It is a dial-print device native to this world, not an editorial kicker; use it to caption instruments, not to introduce prose sections. Prose section headings stay sentence-case (15/700, -0.01em).

**The Tabular Money Rule.** Every money figure and period/date label carries `font-variant-numeric: tabular-nums`.

### Hierarchy
- **Balance numeral** (Cinzel 40/600, 0.01em, lh 1.05, tabular, gold — coral `--danger` when overspent).
- **Wordmark** (Cinzel 600, 0.18em caps: 16px top bar, 22px drawer head).
- **Engraved caps** (10/600/0.24em uppercase, ink-3): instrument labels.
- **Section title** (15/700, -0.01em, ink): sentence-case region headings ("Categories").
- **Disclosure** (15/600), **period label** (14/600, tabular, ink-2), **dial subline** (12/500, tabular, ink-2).
- **Body / row** (14/500): category names, row titles; drawer items 16/500.
- **Figures** (600–700, 12–14px, tabular): category `spent / budget` 13px, hero-stat values 13/700, subdial figure 12/700, row amounts 14/600.
- **Primary action** (13/700, 0.14em tracked uppercase) — the only tracked-caps text outside the engraved grammar.

## Layout

A single-column mobile shell, centered and capped at 480px, `overflow-x: hidden`. Main content pads 20px horizontally, clears the fixed top bar with `62px + safe-area-inset-top`, and pads `32px + safe-area-inset-bottom` below. Screens are vertical flex stacks on a 16px gap; card stacks (`.ledger`, `.stack`) use 10px; two-up grids 12px; subdials 10px.

**The Radial Instrument Rule.** The dial is the one centered composition on the page — a 296×296 instrument with its readout stacked at center (engraved label, numeral, subline, 7px gaps, 42px side padding), followed by centered in/out pills and the centered subdial trio. Below the instrument, the page returns to rows: period label left with chevrons pushed right, sentence-case headings ragged left, category rows reading left. Centering belongs to the instrument, not to prose.

## Elevation & Depth

Depth = 1px hairline border + soft dark drop shadow + a faint 1px inset top-light (`{colors.plate-inset}`). No blur, no gradients, no glow. Texture is permitted only inside the dial: the guilloché engine-turning (twelve concentric ink rings at 0.03 crossed by 36 radial spokes at 0.02 — a woven etching, never glow) — the one decorated surface in the world.

### Shadow Vocabulary
- **Card lift** — `0 10px 26px rgba(0,0,0,0.35), inset 0 1px 0 var(--plate-inset)`: cards.
- **Soft row lift** — `0 6px 16px rgba(0,0,0,0.22)`: category rows; subdials use `0 6px 16px rgba(0,0,0,0.25)`.
- **Button lift** — `0 6px 18px rgba(0,0,0,0.35)`: the primary gold button.
- **Inset only** — `inset 0 1px 0 var(--plate-inset)`: tiles, secondary buttons, list rows, segmented.
- **Drawer throw** — `18px 0 44px rgba(0,0,0,0.45)`: the slide-in drawer, over a `rgba(4,8,6,0.6)` scrim.

**The No-Glow Rule.** No `backdrop-filter`, no gradients, no colored blobs. The old glass token names (`--text-*`, `--glass*`, `--success`) survive only as back-compat aliases pointing at the new tokens.

## Shapes

Soft corners on flat fills: 20px cards, 18px category rows, 16px primary button and subdials, 14px base radius (inputs, tiles, disclosures, drawer items), 13px category icon chips, 12px icon badges, 10px mini-buttons, 999px pills. Signature line-work is the dial's: 1.5px day ticks (today 3px, longer: r121→143 vs r127→138 on the 296 viewBox), a 1px chapter ring at r112, 4px subdial arc strokes with round caps, and 3px category budget tracks with 0.85-opacity accent fills.

## Components

### Top Bar & Drawer (chrome)
- **Top bar:** fixed, ground-colored, no border, 56px + safe-area; a 44px hamburger (24px glyph, no chrome) and the Cinzel GILD wordmark.
- **Drawer:** 284px plate panel sliding from the left (0.28s decelerate + 0.25s scrim fade), soft-hairline right edge, drawer throw shadow. Head = 22px Cinzel wordmark over a hairline. Items are 52px, 14px radius, icon + 16/500 label in ink-2; **active item = gold at 700 on a 12% gold tint** — the active place. Keyboard-complete: focus moves to the first item on open, Escape closes and returns focus to the hamburger, scrim click closes, `aria-current="page"` on the active item.

### Period Row
Label left (14/600, ink-2, tabular; localized via `periodLabel(lang)` in db.js), two 40px mini-button chevrons right. Sits directly above the dial.

### The Dial (signature)
A 296×296 `role="img"` instrument whose aria-label leads with the focal fact (what's left), then pace, then income/spent. Inside the SVG, back to front: the guilloché (twelve rings r = 16 + 7i at 0.03, 36 spokes at 0.02); the rehaut register channel (two hairlines, r104 at 0.06 ink and r112 rule-soft); one tick per day of the pay period arranged from 12 o'clock — **spent days faint** (ink at 0.16), **remaining days gold** (0.8 — the power reserve), **today long and bright** (gold-light, 3px, extended both ways). Structural weight is separate from state color: the pay-day mark (index 0) is 2.5px, the period's quarter marks are 2px and longer, ordinary days 1.5px. Overlaid at center: engraved caps label, the gold balance numeral in Hanken Grotesk 44/700 (coral when overspent), and the days-left · per-day subline. Future periods show a full reserve ("upcoming"); past periods show none ("period ended") — never a future period labeled ended.

### Subdial Complications (signature)
The top three budgets by utilization, as chronograph subdials: plate buttons (16px radius, max-width 116px) holding a 64px SVG — rule-soft track ring (r26, 4px) and a gold arc (coral when over) with round caps, **capped at 100%** — with the percent numeral at center (12.5/700, `--ui`, ink), the category name (11/600, ink-2, ellipsized) and spent figure (12/700 tabular) below. Each is a button with a money aria-label.

### Hero-Stat Pills
Two plate pills (999px, hairline): sage dot + Income, bronze dot + Spent; labels 13/500 ink-2, values 700 tabular ink.

### Buttons
- **Primary:** solid gold, `{colors.gold-text}` ink, 54px, 16px radius, 13/700 tracked uppercase, button-lift shadow, `scale(0.985)` on press. One per surface.
- **Secondary:** plate-2, hairline, 48px, 14px radius, inset highlight only.
- **Mini:** 40×40 minimum, plate-2, hairline, 10px radius (period chevrons).
- **Focus:** 2px gold-light `:focus-visible` ring, offset 2 (inset −2 on in-flow controls: burger, drawer items, category rows, disclosures, trend bars).

### Category Rows (signature)
Each category is its own soft card (`.cat-row`, `role="button"` with Enter/Space): plate fill, hairline, 18px radius, soft row lift, 14px gap. Inside: a 42px tinted icon chip (13px radius, per-category tint + accent-colored glyph, no border), name at 14/500, right-aligned tabular `spent / budget` 13px in ink-2, optional last-period subline, and a 3px budget track filled in the category accent. Genuinely over flips name/figures to `--danger-text`, the bar to `--danger`, and adds an alert glyph — never color alone.

### Disclosures
Full-width 50px plate rows (14px radius, 15/600) with a chevron and `aria-expanded`, used for Insights and unused categories; the sub variant is transparent with a dashed hairline. Progressive disclosure keeps the first viewport to period row + dial + pills + subdials + gold action.

### Insights (inside the disclosure)
- **Spend trend:** paired 14px sage/bronze bars per month (0.5 opacity when unselected), each a button with a money aria-label.
- **Entry overlays (Add/Edit transaction):** two-plate composition — *setting the instrument* (expense/income segmented control whose active segment tints to its money color, bronze out / sage in, over the amount field) then *the details* (category chip grid with always-accented icons, date, note); the gold action sits naked below the plates. Money entry is instrument-grade: `.amount-input` at 32/700 tabular in a 64px field. Validation errors render with `role="alert"` and clear on the next edit of any implicated field.
- **Category breakdown (the breakdown ring):** a complication in the hero dial's own grammar — a 60-tick chapter bezel (ink, every 5th tick heavier) hugging a 13px category-accent band at 3.5px, with uniform 3px arc joints centered on every segment boundary (including the 12 o'clock closure; tiny segments clamp to a 1.5px minimum draw), and a rehaut hairline framing the center; the total sits centered (`--ui` 25/700, ink — a reading, not the balance) over the category count in 9px tracked engraved caps; below, a ranked list — accent dot, name, amount (600 weight tabular), share % muted right-aligned in a 32px column. The slim band + ticked bezel keep it precious rather than candy; the ranked amounts carry legibility when one category dominates.

### Chips, Inputs, Segmented
- **Chips:** plate-2 pills, 34px; active = gold hairline, gold-light text, 14% gold tint. Category chips theme their active accent per category.
- **Inputs:** plate-2, hairline, 14px radius, 44px, 16px text (no mobile zoom); amount inputs 22/600; placeholders ink-3; date-picker glyph inverted for the dark ground.
- **Segmented:** plate-2 track, 3px padding, active segment raised with inset highlight.

## App identity mark

The icon is **The Diamond** — the app's original diamond identity reborn in this world: a brilliant-cut diamond in champagne-gold line-work (solid outline; crown, girdle and pavilion facet lines at 0.55 opacity) on dial black. User-chosen from a three-mark hand (coin / diamond / dial). Two stroke weights ship: the master (20/12 at 1024, used for 512 and the iOS 1024) and a heavier small-size cut (34/20, used for 192/180) so the line-work holds at home-screen scale. The launch splash centers the mark at 62% on the full dial-black field. Masters live in `.impeccable/icon-src/` (`gild-icon.svg`, `gild-icon-small.svg`, `gild-splash.svg`); every shipped raster carries embedded provenance. Regenerate via qlmanage + sips.

## Motion

Minimal and physical, one shared curve: `cubic-bezier(0.22, 1, 0.36, 1)`. **The one authored moment:** opening a period sweeps the day ticks in chronologically around the dial (`.dial-tick`, 0.3s each, staggered across 0.45s) while the center reading settles up into place (`.dial-center`, 0.55s, 0.15s delay); the sweep replays on period change (the dial SVG is keyed by period). Everything else stays functional: the drawer slides in over 0.28s with a scrim fade; the primary button compresses to 0.985 on press; and long work shows a **sweeping hand** (`.sweep`, a 12-tick ring with a gold hand rotating 1.6s linear — the world's way of saying "working"), slowed rather than stopped under reduced motion so the feedback survives. No other entrance animates; no ambient or looping motion. `prefers-reduced-motion: reduce` disables the sweep and settle entirely.

## Accessibility

- Themed 2px gold-light focus ring everywhere via `:focus-visible`; inset on in-flow controls.
- The dial is `role="img"` with a spoken summary that leads with what's left, then pace, then income/spent — matching what the eye reads at center. Subdials, trend bars, and category rows carry money aria-labels; the drawer is a labeled `nav` with `aria-current` and full keyboard flow (focus in on open, Escape returns to the burger).
- Over-budget never relies on color alone: coral is paired with an alert glyph, and small coral text uses `--danger-text` to hold 4.5:1.
- `::selection` is a gold wash over ink; contrast holds because chalk ink is near-white on dial black.
- Money and dates are localized everywhere they appear (`formatMoney`, `formatMonthShort`, `localeFor` in i18n.js; `periodLabel(lang)` in db.js).

## Coverage / not-yet-passed surfaces

Fully realized in this world: the **Dashboard** (period row, dial, hero-stat pills, subdials, primary action, Insights, category rows) and the **chrome** (top bar, drawer, focus/selection, global controls).

**Formatting pass only:** Bills, Transactions, and Balances use `formatMoney` and localized dates but keep pre-dial compositions.

**Inheriting tokens, no dedicated pass:** Settings, Add, Scan, Onboarding, Lock. They render on the new palette through the back-compat aliases (`--text-primary/-secondary/-muted`, `--glass*`, `--success` → new tokens), but their compositions predate this world. Treat the Dashboard as the canonical reference when passing them.

**Carried dependency, not a rule:** icons are the Tabler icon font (`ti ti-*`), used as quiet single-color glyphs sized 13–24px, colored by context (ink-2 in chrome, category accent in icon chips, gold-text inside the primary button). Documented as the build's current dependency; a future icon decision may replace it without breaking this system.

**Ceiling backlog:** cleared — weighted quarter/pay-day ticks, the engine-turned guilloché weave, the rehaut register channel, and 12-tick subdial rings all shipped in the jeweling pass.

## Do's and Don'ts

### Do:
- **Do** grant gold only to the balance numeral, the remaining ticks/arcs, the one primary action, and the active place (The Gold Grant).
- **Do** render data as honest instruments: one tick per day, arcs capped at 100% — a gauge never lies past its stops (The Complication Rule).
- **Do** keep Cinzel to the balance and wordmark, Hanken Grotesk to everything else (The Two-Face Rule).
- **Do** label instruments in engraved caps (10/600/0.24em) and prose regions in sentence case (The Engraved Caps Rule).
- **Do** use `--danger` for large/graphic coral and `--danger-text` for small coral text, both only for genuinely over (The Two-Coral Rule).
- **Do** use sage for money in, bronze for money out; tabular-nums on every figure.
- **Do** build depth from hairlines and soft dark shadows; texture lives only inside the dial.

### Don't:
- **Don't** put Cinzel anywhere but the balance numeral and the wordmark.
- **Don't** add a gold element outside the four granted roles, or let a spent day tick go gold.
- **Don't** draw an arc or fill that exceeds its gauge; cap at 100% and let the numeral state the truth.
- **Don't** use coral for ordinary spending, use `--danger` at small text sizes, or swap the sage/bronze mapping.
- **Don't** reintroduce blur, gradients, or blobs; the glass tokens are aliases only.
- **Don't** center prose or rows — centering belongs to the dial instrument alone.
- **Don't** resurrect the dead worlds: no green plates, no editorial ledger serif, no burn-down bar.
