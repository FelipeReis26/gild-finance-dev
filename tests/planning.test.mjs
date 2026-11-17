// Payday plan and debt goals. planOverview sorts bills into what's fixed and
// what's set aside (savings, transfers, a card payment); a debt goal counts
// down to zero by a date, and paying its transfer bill brings the debt down.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

const cats = [
  { id: 'transfers', name: 'Transfers', kind: 'expense', transfer: true },
  { id: 'savings', name: 'Savings', kind: 'expense', monthlyBudget: 1000 },
  { id: 'inv', name: 'Investments', kind: 'expense', monthlyBudget: null },
  { id: 'rent', name: 'Rent', kind: 'expense', monthlyBudget: 500 },
  { id: 'food', name: 'Food', kind: 'expense', monthlyBudget: 350 },
  { id: 'fun', name: 'Fun', kind: 'expense', monthlyBudget: null },
  { id: 'old', name: 'Old', kind: 'expense', archived: true, monthlyBudget: 50 },
  { id: 'wages', name: 'Wages', kind: 'income' }
]
const bills = [
  { id: 'rent', name: 'Rent', amount: 500, categoryId: 'rent', dueDay: 30, payments: {} },
  { id: 'cu', name: 'Credit Union', amount: 1000, categoryId: 'savings', dueDay: 1, payments: {} },
  { id: 'cdi', name: 'CDI', amount: 120, categoryId: 'inv', dueDay: 1, payments: {}, flexible: true },
  { id: 'card', name: 'Card', amount: 100, minAmount: 100, categoryId: 'transfers', dueDay: 19, payments: {}, balanceAccountId: 'debt', startPeriod: '2026-11' },
  { id: 'later', name: 'Later', amount: 9, categoryId: 'rent', dueDay: 5, payments: {}, startPeriod: '2027-06' }
]
const txs = [
  { id: 'w1', type: 'income', amount: 3000.5, categoryId: 'wages', date: '2026-10-19' },
  { id: 'x', type: 'income', amount: 200, categoryId: 'other-income', date: '2026-10-25' }
]
const debt = { id: 'debt', name: 'Card', type: 'debt', entries: [{ date: '2026-11-17', value: 2400 }], goal: { target: 0, by: '2027-03-03', startValue: 2400 } }

const p = db.planOverview({ periodKey: '2026-11', payDay: 19, bills, categories: cats, balances: [debt], transactions: txs })
ok(p.income === 3000.5 && p.incomeIsEstimate, `income falls back to last period's wages only (${p.income})`)
ok(p.bills.map((b) => b.id).join() === 'rent', `fixed bills: rent only (${p.bills.map((b) => b.id)})`)
ok(p.billsTotal === 500, 'bills total')
ok(p.setAside.map((a) => a.bill.id).join() === 'cu,cdi,card', `set aside: savings, investments, transfers, biggest first (${p.setAside.map((a) => a.bill.id)})`)
ok(p.limits.map((c) => c.id).join() === 'food,fun', `limits: spending categories without a bill, not archived or transfer (${p.limits.map((c) => c.id)})`)
const card = p.setAside.find((a) => a.bill.id === 'card')
ok(card.goal?.progress.kind === 'debt', 'the card payment carries its debt goal')

// debt goal progress
let g = db.goalProgress(debt, bills, 19, '2026-11-17')
ok(g.paydaysLeft === 4 && Math.abs(g.remaining - 2400) < 0.001, `4 paydays before 3 Mar, all of it left (${g.paydaysLeft}, ${g.remaining})`)
ok(!g.onTrack && Math.abs(g.neededPerPayday - 600) < 0.001, `€100 a payday is behind; needs 600 (${g.neededPerPayday})`)
ok(g.fraction === 0, 'nothing paid yet')
g = db.goalProgress(debt, bills.map((b) => (b.id === 'card' ? { ...b, amount: 620 } : b)), 19, '2026-11-17')
ok(g.onTrack, '€620 a payday clears it')
g = db.goalProgress({ ...debt, entries: [{ date: '2027-02-20', value: 0 }] }, bills, 19, '2027-02-21')
ok(g.reached && g.fraction === 1, 'paid off')

// paying the card bill brings the debt down, and undo puts it back
await db.importBackup({
  schemaVersion: 2,
  ft_payday: 19,
  ft_categories: cats,
  ft_bills: [{ ...bills[3], amount: 10000, minAmount: 10000 }],
  ft_balances: [{ ...debt, entries: [{ date: '2026-11-17', value: 240000 }], goal: { target: 0, by: '2027-03-03', startValue: 240000 } }],
  ft_transactions: []
})
const shown = (await db.getBills())[0]
ok(shown.amount === 100 && shown.minAmount === 100, 'bill minAmount reads back in euros')
await db.markBillPaid('card', '2026-11')
let bal = (await db.getBalances())[0]
ok(db.latestEntry(bal).value === 2300, `paying takes 100 off the card (${db.latestEntry(bal).value})`)
ok(bal.goal.startValue === 2400, 'goal start stays where it began')
await db.markBillUnpaid('card', '2026-11')
bal = (await db.getBalances())[0]
ok(db.latestEntry(bal).value === 2400, 'undo puts it back')

// a debt goal is set with just a date
await db.setBalanceGoal('debt', { by: '2027-03-03' })
bal = (await db.getBalances())[0]
ok(bal.goal.target === 0 && bal.goal.by === '2027-03-03' && bal.goal.startValue === 2400, `debt goal set from a date (${JSON.stringify(bal.goal)})`)

// plan state
ok((await db.getPlanState('2026-11')) === null, 'not planned yet')
await db.setPlanState('2026-11', 'dismissed')
ok((await db.getPlanState('2026-11')).status === 'dismissed', 'put off')

console.log(`planning: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
