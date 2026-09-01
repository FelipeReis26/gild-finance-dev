# Receipt OCR bench (dev only)

`bench.html` + `src/bench.js` measure receipt-reading accuracy so changes are
proven rather than guessed. Not referenced by the app and **not included in
`npm run build`** (Vite only builds `index.html`).

## Run it

    npm run dev
    # open http://localhost:5173/bench.html, then in the console:
    await runBench()                       # full corpus
    await runBench({ conditions: ['clean'] })
    window.__BENCH__                       # per-condition scores + failures

**Synthetic corpus:** 10 receipt layouts (Irish supermarket, diner with
CHK/GST, pub with column headers, pharmacy with a "YOU SAVED" line, Spanish
comma-decimal, fuel, UK thousands, tiny coffee slip, unbranded independent,
subscription invoice) × 12 photo conditions (clean, ±rotation, blur, faded
thermal, pink paper, yellow paper, glare, sensor noise, low resolution, JPEG
40%, and a stacked worst case) = **120 runs**, each scored against known
ground truth for amount / merchant / date / category.

## Real photographs

`runReal([...urls])` runs the same pipeline over real photos. Put images in
`public/_real/` first — they are deliberately **not committed**, because
third-party receipt photos carry their own licences.

## Results (2026-09-01)

- Synthetic: **120/120** on amount, merchant, date and category.
- Real photos (20, several countries): an amount on 15/20; the 5 misses were
  all images the recogniser scored 25–37% confidence, which the app now
  flags to the user as "unclear scan — check".
