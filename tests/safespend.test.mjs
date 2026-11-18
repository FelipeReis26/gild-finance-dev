// Safe to spend and savings goals. Safe to spend takes the bills still due
// and the money set aside for savings off what's left, so the dashboard says
// what can still be spent. A goal counts the paydays left before its date and
// checks the linked transfer bill gets there.
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
  { id: 'transfers', transfer: true },
  { id: 'rent' },
  { id: 'utilities' }
]
const bills = [
  { id: 'r', amount: 500, categoryId: 'rent', dueDay: 31, payments: {} },
  { id: 'n', amount: 18.99, categoryId: 'utilities', dueDay: 21, payments: { '2026-11': { paidDate: '2026-11-21' } } },
  { id: 'b', amount: 700, categoryId: 'transfers', dueDay: 19, payments: { '2026-11': { paidDate: '2026-11-19' } }, balanceAccountId: 'pot', startPeriod: '2026-11' }
]

// --- safe to spend --------------------------------------------------------
let s = db.safeToSpend({ income: 3000, spent: 178.99 }, bills, cats, '2026-11')
ok(s.billsDue === 500 && s.billsDueCount === 1, `only the unpaid ordinary bill is due (${s.billsDue}, ${s.billsDueCount})`)
ok(s.setAside === 700, `a paid transfer bill is still set aside (${s.setAside})`)
ok(Math.abs(s.safe - (3000 - 178.99 - 500 - 700)) < 0.001, `safe = income − spent − due − set aside (${s.safe})`)

const unpaid = bills.map((b) => (b.id === 'b' ? { ...b, payments: {} } : b))
s = db.safeToSpend({ income: 3000, spent: 178.99 }, unpaid, cats, '2026-11')
ok(s.setAside === 700 && s.billsDue === 500, 'an unpaid transfer bill is set aside, not double counted as due')

s = db.safeToSpend({ income: 3200, spent: 4100 }, bills, cats, '2026-10')
ok(s.setAside === 0, 'a bill before its startPeriod is ignored')
ok(s.safe < 0, 'overspent periods go negative')

// --- a card paid off by a transfer bill: card spending counts once ---------
// 300 a payday to the card from 2026-11. A purchase on the card counts as
// spending in its own period; the next repayment pays for it, so that much
// of the repayment isn't set aside a second time.
const cardBill = { id: 'c', amount: 300, categoryId: 'transfers', dueDay: 19, payments: {}, accountId: 'main', counterAccountId: 'card', balanceAccountId: 'debt', startPeriod: '2026-11' }
const debtAccounts = [{ id: 'debt', type: 'debt', entries: [] }]
const cardTx = [
  { date: '2026-11-10', type: 'expense', amount: 200, categoryId: 'rent', accountId: 'card' }, // before the plan
  { date: '2026-11-25', type: 'expense', amount: 80, categoryId: 'rent', accountId: 'card' }, // period 2026-11
  { date: '2026-11-26', type: 'income', amount: 30, categoryId: 'rent', accountId: 'card' }, // a refund
  { date: '2026-11-27', type: 'expense', amount: 40, categoryId: 'rent', accountId: 'main' }, // not the card
  { date: '2026-11-28', type: 'expense', amount: 300, categoryId: 'transfers', accountId: 'card', transfer: true } // not spending
]
const withCard = (key, tx = cardTx, accounts = debtAccounts) =>
  db.safeToSpend({ income: 3000, spent: 0 }, [cardBill], cats, key, { transactions: tx, balances: accounts, payDay: 19 })
s = withCard('2026-11')
ok(s.cardCovered === 0 && s.setAside === 300, `first period of the plan: the whole repayment is set aside (${s.setAside})`)
s = withCard('2026-12')
ok(s.cardCovered === 50 && s.setAside === 250 && s.safe === 2750, `next period: the 50 net card spend already counted comes off (${s.cardCovered}, ${s.safe})`)
s = withCard('2027-01')
ok(s.cardCovered === 0 && s.setAside === 300, `only once: the period after is back to the full repayment (${s.cardCovered})`)
const bigSpend = [{ date: '2026-11-25', type: 'expense', amount: 450, categoryId: 'rent', accountId: 'card' }]
ok(withCard('2026-12', bigSpend).cardCovered === 300 && withCard('2027-01', bigSpend).cardCovered === 150, 'spending above one repayment carries into the next')
ok(withCard('2026-12', cardTx, [{ id: 'debt', type: 'savings', entries: [] }]).cardCovered === 0, 'only a debt account, not a savings pot')
ok(db.safeToSpend({ income: 3000, spent: 0 }, [cardBill], cats, '2026-12').setAside === 300, 'without transactions it works as before')

ok(db.billAppliesTo({ startPeriod: '2026-11' }, '2026-12') && !db.billAppliesTo({ startPeriod: '2026-11' }, '2026-10') && db.billAppliesTo({}, '2000-01'), 'billAppliesTo')

// --- goals ----------------------------------------------------------------
// payday 19th; 19 Dec 2026 is a Saturday so that payday lands on Fri 18 Dec.
const pot = { id: 'pot', type: 'savings', entries: [{ date: '2026-11-19', value: 750 }], goal: { target: 2800, by: '2027-02-19' } }
let g = db.goalProgress(pot, bills, 19, '2026-11-22')
ok(g.paydaysLeft === 3, `three paydays to go after November is paid (${g.paydaysLeft})`)
ok(g.onTrack, '750 + 3 × 700 reaches 2,800')
ok(Math.abs(g.fraction - 750 / 2800) < 1e-9, 'fraction')

g = db.goalProgress({ ...pot, entries: [{ date: '2026-11-17', value: 50 }] }, unpaid, 19, '2026-11-20')
ok(g.paydaysLeft === 4, `November still counts while its transfer is unpaid (${g.paydaysLeft})`)
ok(g.onTrack, '50 + 4 × 700 reaches 2,800')

g = db.goalProgress(pot, [], 19, '2026-11-22')
ok(!g.hasBill && !g.onTrack && Math.abs(g.neededPerPayday - Math.ceil((280000 - 75000) / 3) / 100) < 0.001, `no bill: reports what each payday needs (${g.neededPerPayday})`)

g = db.goalProgress({ ...pot, entries: [{ date: '2027-01-01', value: 3000 }] }, bills, 19, '2027-01-02')
ok(g.reached && g.onTrack && g.fraction === 1, 'reached')

ok(db.goalProgress({ id: 'x', type: 'savings', entries: [] }, bills, 19) === null, 'no goal, no progress')

// --- stored goal survives a round trip in cents ----------------------------
await db.importBackup({ schemaVersion: 2, ft_balances: [{ id: 'pot', name: 'Pot', type: 'savings', entries: [{ date: '2026-11-17', value: 8024 }] }] })
await db.setBalanceGoal('pot', { target: 2800, by: '2027-02-19' })
let stored = (await db.getBalances())[0]
ok(stored.goal?.target === 2800 && stored.goal.by === '2027-02-19', `goal reads back in euros (${JSON.stringify(stored.goal)})`)
ok(JSON.parse(localStorage.getItem('ft_balances'))[0].goal.target === 280000, 'goal stored in cents')
await db.setBalanceGoal('pot', null)
ok(!(await db.getBalances())[0].goal, 'goal removed')

console.log(`safespend: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
