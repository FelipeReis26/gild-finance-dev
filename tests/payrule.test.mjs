// Property tests for the pay-rule engine. localStorage polyfill so db.js
// (which touches storage at module load) can run under node.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}

const db = await import('../src/db.js')
const { periodBounds, currentPeriodKey, billDateWithinPeriod, normalizePayRule, inPeriod } = db

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
const DAY = 86400000
const iso = (d) => d.toISOString().slice(0, 10)

const months = []
for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, '0')}`)
const nextKey = (k) => { let [y, m] = k.split('-').map(Number); m === 12 ? (y++, m = 1) : m++; return `${y}-${String(m).padStart(2, '0')}` }

const RULES = [
  ['day25', { type: 'day', day: 25 }],
  ['day2', { type: 'day', day: 2 }],
  ['day31', { type: 'day', day: 31 }],
  ['calendar', { type: 'day', day: 1 }],
  ['lastFriday', { type: 'lastWeekday', weekday: 5 }],
  ['lastMonday', { type: 'lastWeekday', weekday: 1 }],
  ['lastWorking', { type: 'lastWorkingDay' }]
]

// 1. Continuity: every period ends exactly one day before the next begins.
for (const [name, rule] of RULES) {
  for (const k of months.slice(0, -1)) {
    const { end } = periodBounds(k, rule)
    const { start } = periodBounds(nextKey(k), rule)
    ok(end.getTime() + DAY === start.getTime(), `${name} ${k}: gap/overlap end=${iso(end)} nextStart=${iso(start)}`)
  }
}

// 2. lastWeekday: start is that weekday, and it is the LAST one of its month.
for (const k of months) {
  const { start } = periodBounds(k, { type: 'lastWeekday', weekday: 5 })
  ok(start.getUTCDay() === 5, `lastFriday ${k}: start ${iso(start)} not a Friday`)
  const plus7 = new Date(start.getTime() + 7 * DAY)
  ok(plus7.getUTCMonth() !== start.getUTCMonth(), `lastFriday ${k}: ${iso(start)} not the LAST Friday`)
}

// 3. lastWorkingDay: Mon–Fri, and everything after it in the month is weekend.
for (const k of months) {
  const { start } = periodBounds(k, { type: 'lastWorkingDay' })
  ok(start.getUTCDay() >= 1 && start.getUTCDay() <= 5, `lastWorking ${k}: ${iso(start)} is a weekend`)
  let d = new Date(start.getTime() + DAY)
  while (d.getUTCMonth() === start.getUTCMonth()) {
    ok(d.getUTCDay() === 0 || d.getUTCDay() === 6, `lastWorking ${k}: working day ${iso(d)} after start`)
    d = new Date(d.getTime() + DAY)
  }
}

// 4. Legacy regression: bare number 25 === {type:'day',day:25}, both pre- and post-normalize.
for (const k of months) {
  const a = periodBounds(k, 25)
  const b = periodBounds(k, { type: 'day', day: 25 })
  ok(a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime(), `legacy 25 mismatch at ${k}`)
}

// 5. currentPeriodKey: today falls inside the period it names.
for (const [name, rule] of RULES) {
  const key = currentPeriodKey(rule)
  const today = new Date()
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  ok(inPeriod(t, key, rule), `${name}: today ${t} not inside its own period ${key}`)
}

// 6. Bill placement.
// 6a. Rolled-back anchor: Aug 2 2026 is a Sunday, so {day:2} pays Fri Jul 31;
//     a bill due the 5th must land Aug 5 (own month), not September.
ok(iso(periodBounds('2026-08', { type: 'day', day: 2 }).start) === '2026-07-31', 'Aug-2026 day2 should pay Jul 31')
ok(billDateWithinPeriod('2026-08', { type: 'day', day: 2 }, 5) === '2026-08-05', 'rolled anchor: due-5 must be Aug 5')
// 6b. lastFriday: Aug 2026 pays Aug 28; due 30 → own month, due 5 → next month.
ok(iso(periodBounds('2026-08', { type: 'lastWeekday', weekday: 5 }).start) === '2026-08-28', 'Aug-2026 lastFriday should be Aug 28')
ok(billDateWithinPeriod('2026-08', { type: 'lastWeekday', weekday: 5 }, 30) === '2026-08-30', 'lastFriday: due-30 own month')
ok(billDateWithinPeriod('2026-08', { type: 'lastWeekday', weekday: 5 }, 5) === '2026-09-05', 'lastFriday: due-5 next month')
// 6c. Every placed bill date must actually fall inside its period.
for (const [name, rule] of RULES) {
  for (const k of ['2026-02', '2026-08', '2026-12']) {
    for (const due of [1, 5, 15, 28, 31]) {
      const placed = billDateWithinPeriod(k, rule, due)
      ok(inPeriod(placed, k, rule), `${name} ${k} due-${due}: placed ${placed} outside period`)
    }
  }
}

// 7. Normalization round-trips.
ok(normalizePayRule('25').day === 25, 'string 25')
ok(normalizePayRule(null).day === 1, 'null -> calendar')
ok(normalizePayRule({ type: 'lastWeekday', weekday: 9 }).type === 'day', 'invalid weekday rejected')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
