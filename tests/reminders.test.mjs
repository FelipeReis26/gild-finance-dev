// Reminders and limit warnings. planReminders is pure: it takes the data and
// returns what to schedule, so it can be checked here without a phone.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

const text = (key, vars = {}) => `${key}${Object.keys(vars).length ? ' ' + JSON.stringify(vars) : ''}`
const money = (v) => `€${v}`
const weekday = (iso) => `WD(${iso})`
const cats = [{ id: 'transfers', transfer: true }, { id: 'rent' }, { id: 'utilities' }]
const bills = [
  { id: 'r', name: 'Rent', amount: 500, categoryId: 'rent', dueDay: 30, payments: {} },
  { id: 'p', name: 'Phone', amount: 20, categoryId: 'utilities', dueDay: 30, payments: {} },
  { id: 'n', name: 'Netflix', amount: 18.99, categoryId: 'utilities', dueDay: 21, payments: { '2026-11': { paidDate: '2026-11-21' } } },
  { id: 'b', name: 'Trip pot', amount: 700, categoryId: 'transfers', dueDay: 19, payments: {}, balanceAccountId: 'pot', startPeriod: '2026-11' }
]
const balances = [{ id: 'pot', name: 'Trip pot', type: 'savings', entries: [{ date: '2026-11-17', value: 80 }], goal: { target: 2800, by: '2027-02-19' } }]
const txs = [{ id: 'a', type: 'expense', amount: 5, date: '2026-11-14', categoryId: 'utilities' }]
const now = new Date(2026, 10, 17, 20, 0) // 17 Nov 2026, 20:00 local
const plan = db.planReminders({ bills, categories: cats, balances, transactions: txs, payDay: 19, settings: {}, now, text, money, weekday })
const find = (prefix) => plan.filter((p) => p.title.startsWith(prefix) || p.body.startsWith(prefix))
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const paydays = plan.filter((p) => p.title === 'remPaydayTitle')
ok(paydays.length >= 2, `paydays in the next two months (${paydays.length})`)
ok(day(paydays[0].at) === '2026-11-19' && paydays[0].at.getHours() === 9, `first payday 19 Nov 9:00 (${paydays[0].at})`)
ok(paydays[0].body.includes('remPaydayBodyMove') && paydays[0].body.includes('€700') && paydays[0].body.includes('Trip pot'), 'payday mentions the transfer')
ok(day(paydays[1].at) === '2026-12-18', `December payday moves to Fri 18 Dec (${day(paydays[1].at)})`)

const billRem = plan.filter((p) => p.title === 'remBillTitle')
const nov29 = billRem.find((p) => day(p.at) === '2026-11-29')
ok(nov29 && nov29.body.startsWith('remTwoBills') && nov29.body.includes('Rent, €500') && nov29.body.includes('Phone, €20'), 'two bills due the same day share one reminder, biggest first')
ok(!billRem.some((p) => /Netflix/.test(p.body) && day(p.at) === '2026-11-20'), 'a paid bill is not reminded')
ok(billRem.some((p) => /Netflix/.test(p.body) && day(p.at) === '2026-12-20'), "next period's Netflix is")
ok(!billRem.some((p) => /Trip pot/.test(p.body)), 'transfer bills are in the payday reminder, not the bill ones')

const log = plan.find((p) => p.title.startsWith('remLogTitle'))
ok(log && day(log.at) === '2026-11-18' && log.title.includes('WD(2026-11-14)'), `nothing-logged: last on the 14th, opened today, so tomorrow (${log && day(log.at)})`)

ok(!plan.some((p) => p.title.startsWith('remGoalTitle')), 'an on-track goal sends nothing')
const behind = db.planReminders({ bills: bills.filter((b) => b.id !== 'b'), categories: cats, balances, transactions: txs, payDay: 19, settings: {}, now, text, money, weekday })
const goal = behind.find((p) => p.title.startsWith('remGoalTitle'))
ok(goal && day(goal.at) === '2026-11-20', `a goal with no transfer is behind, reminded the day after the next payday (${goal && day(goal.at)})`)

ok(plan.every((p) => p.at > now), 'nothing in the past')
ok(new Set(plan.map((p) => p.id)).size === plan.length, 'ids unique')
const again = db.planReminders({ bills, categories: cats, balances, transactions: txs, payDay: 19, settings: {}, now, text, money, weekday })
ok(JSON.stringify(again.map((p) => p.id)) === JSON.stringify(plan.map((p) => p.id)), 'ids stable between runs')

const hidden = db.planReminders({ bills, categories: cats, balances, transactions: txs, payDay: 19, settings: { hideAmounts: true }, now, text, money, weekday })
ok(!hidden.some((p) => /€|Rent|Phone|Netflix|Trip pot/.test(p.title + p.body)), 'hide amounts: no names or figures anywhere')
ok(hidden.some((p) => p.title === 'remBillsTitleHidden {"n":2}'), 'hidden: counts the bills instead')

const off = db.planReminders({ bills, categories: cats, balances, transactions: txs, payDay: 19, settings: { payday: false, bills: false, nothingLogged: false, goals: false }, now, text, money, weekday })
ok(off.length === 0, 'everything off schedules nothing')

const late = db.planReminders({ bills, categories: cats, balances, transactions: txs, payDay: 19, settings: { time: '07:30' }, now, text, money, weekday })
ok(late.every((p) => p.at.getHours() === 7 && p.at.getMinutes() === 30), 'chosen time')

// --- limit crossing ------------------------------------------------------
const sum = (spent) => ({ byCategory: [{ id: 'food', name: 'Food', spent, effectiveBudget: 350 }] })
ok(db.budgetCrossing(sum(270), sum(290), 'food')?.level === 'near', '77% → 83% warns')
ok(db.budgetCrossing(sum(290), sum(300), 'food') === null, 'already past 80% stays quiet')
ok(db.budgetCrossing(sum(340), sum(360), 'food')?.level === 'over', 'crossing the limit warns again')
ok(db.budgetCrossing(sum(360), sum(380), 'food') === null, 'already over stays quiet')
ok(db.budgetCrossing(sum(100), sum(400), 'food')?.level === 'over', 'jumping straight past the limit says over')
ok(db.budgetCrossing({ byCategory: [] }, { byCategory: [{ id: 'x', spent: 5, effectiveBudget: null }] }, 'x') === null, 'no limit, no warning')

// --- settings -------------------------------------------------------------
ok((await db.getReminderSettings()).payday === true && (await db.getReminderSettings()).hideAmounts === false, 'defaults')
await db.setReminderSettings({ hideAmounts: true, time: 'bad' })
const s2 = await db.getReminderSettings()
ok(s2.hideAmounts === true && s2.time === '09:00', 'saves, and a bad time falls back')

console.log(`reminders: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
