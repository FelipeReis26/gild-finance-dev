---
target: the Dashboard
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-31T15-42-21Z
slug: the-dashboard-src-screens-dashboard-jsx
---
# /impeccable critique — Gild Dashboard

Method: dual-agent (A: isolated design review · B: isolated deterministic detector). Not degraded.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live totals present, but the headline % misreports the state it claims to show |
| 2 | Match System / Real World | 2 | "159% of budget used" is unreconcilable; label silently swaps between "budget used" and "income spent" |
| 3 | User Control & Freedom | 3 | Swipe periods / tap-a-bar-to-jump good; no way to hide the €0 noise |
| 4 | Consistency & Standards | 2 | Gold means 3 things (Left / Spent / under-budget-good); hamburger FAB instead of tab bar for 6 destinations |
| 5 | Error Prevention | 3 | Read-only screen, but induces a comprehension error (false over-budget panic) |
| 6 | Recognition Rather Than Recall | 3 | Trend legend needed because gold bars aren't self-evident |
| 7 | Flexibility & Efficiency | 2 | Every navigation is 2 taps; no glanceable shortcuts |
| 8 | Aesthetic & Minimalist | 2 | Four stacked data-viz + 13-row list (several €0) on a "3-second glance" screen |
| 9 | Error Recovery | 2 | "159%" and "+189% vs last month" appear in red with zero explanation |
| 10 | Help & Documentation | 2 | No tooltip/inline help on a screen aimed at non-technical users |
| Total | | 24/40 | Acceptable — significant improvements needed |

## Design Specificity Verdict

Category-interchangeable "fintech dark dashboard" with its one authentic idea (pay-period selector) underplayed and an anti-product element (the gauge) dominating.

Deterministic scan: detector ran clean (exit 0, [], zero anti-pattern findings across Dashboard.jsx, App.jsx, NavBar.jsx and all of src/). No false positives. But static-evidence pass surfaced real defects (i18n, tokenization, small targets) the design review under-weighted.

Visual overlays: not injected (browser pane went hidden); inspected via live screenshots + accessibility text in parent. Findings anchored to file:line.

## Overall Impression

Competent, ships honest per-category rows, but fails its own brief at the top: opens on a salmon "159% of budget used" while the user actually has €1045 left and most budgeted categories are under. Manufactures panic from an arithmetic mismatch, then trails into €0 rows. Biggest opportunity: make the hero honest and calm; let one number lead instead of four charts.

## What's Working

1. Pay-period selector as lead element (swipe + tap-a-bar-to-jump) — the product's positioning made visible. Build the redesign around it.
2. Per-category rows are more honest than the headline (real spent/effectiveBudget, red only when genuinely over, rollover-correct). Promote, don't bury.
3. Disciplined money rendering + comfortable primary targets (integer cents, tokens, 44–56px main controls).

## Priority Issues

[P0] Hero gauge is dishonest. rawPct = spent/budget divides ALL spend (incl. Rent €1100, no budget) by a partial denominator (only 6 budgeted categories ≈ €980) → €1555/€980 = 159%. Arc clamps to 100% while text says 159%. Fix: same universe for numerator/denominator — budgeted-spend-vs-total-budget (46%) or spent-vs-income (60%); or a pay-period burn-down ("€1045 left, 24 days"). Never let the label change meaning silently. Suggested: /impeccable clarify (+ small logic fix).

[P1] Overloaded color semantics. Gold = Left + Spent + under-budget-good; salmon = Spent + danger. Detector corroborates: 38 hardcoded color literals, glass/shadow/tint alphas re-hardcoded rather than tokenized — no enforced semantic map. Fix: one fixed semantic map applied everywhere; trend "Spent" bars must not be gold. Suggested: /impeccable colorize.

[P1] Primary nav hidden behind hamburger FAB. Six destinations = 2 taps each, against mobile convention and the glanceable/forgiving principle. Fix: bottom tab bar for the primary four. Suggested: /impeccable layout.

[P2] Zero-value clutter. Car loan/Savings/Gifts/Holidays/Other at €0 render as full rows (DB only drops archived zero rows). Fix: collapse no-activity/no-budget categories behind an expander. Suggested: /impeccable distill.

[P2] Four stacked visualizations on a 3-second screen. Cognitive load 5/8 checks failed; three separate >4-option decision points. Fix: one hero number/line; demote donut + trend into a tap-through Insights section. Suggested: /impeccable distill.

[P3] i18n breaks + red-by-default deltas (detector-caught). Months hardcoded toLocaleDateString('en-US') → English in a 5-language app. Currency = manual symbol concat (€1234, no thousands separators, toFixed(0) drops decimals; no Intl.NumberFormat anywhere). FAB aria-label="Menu" hardcoded English. "+189% vs last month" red for any increase, no absolute anchor. Fix: Intl locale-aware formatting; translate FAB label; show prior absolute value, reserve red for over-budget. Suggested: /impeccable harden.

## Persona Red Flags

Sam (a11y/SR/low vision): four charts have no accessible names (gauge/trend/donut silent to SR); gauge state color-alone; --text-secondary 0.62 alpha + 11px uppercase labels on blurred bg = low contrast; cat-row role=button handles Enter only, not Space; several targets below 44px (32/34/36/38); FAB label untranslated.

Casey (distracted, one-handed): primary action reachable and state persists, but a 2-tap tax per navigation and a false alarming "159%" on glance.

Gild-specific non-technical relative (PT/ES): English month abbreviations regardless of language; a big red 159% with no plain explanation — the exact "scary unreconcilable number" principle #4 exists to prevent.

## Minor Observations

- Gauge arc clamps to 100% while number reads 159% — they disagree.
- Donut center "€1555" duplicates the top SPENT stat.
- Rent (largest expense, no budget) has no bar/context — biggest spend driver is least explained.
- toFixed(0) hides cents — mild tension with "truthful money."

## Questions to Consider

1. If Rent (biggest expense) has no budget, what does "% of budget used" mean — should the hero be a pay-period burn-down?
2. Could the Dashboard lead with one reassuring sentence and push every chart behind a tap, so the first glance can never exceed 100%?
3. What if unbudgeted essentials (rent, loans) were visually separated from discretionary budgeted spend, so the budget number becomes honest and the false-panic gauge dissolves?

Load-bearing files: src/screens/Dashboard.jsx (gauge math :14-18, en-US months :159, keyboard :249), src/db.js (:638 spent vs :654-656 budget mismatch, :677 zero-row filter), src/components/NavBar.jsx (FAB, hardcoded aria-label :41), src/styles.css (color tokens :11-15, secondary text :9).
