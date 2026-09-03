// A transfer moves money between the person's own accounts. It must appear in
// the ledger (so the data reconciles against a bank statement) but must never
// count as spending or income — otherwise importing bank data double-counts:
// the current account shows EUR 260 leaving as a Revolut top-up and Revolut
// shows the EUR 258.07 Amazon purchase that same money paid for.
//
// localStorage polyfill so db.js (which touches storage at module load) runs.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}

const db = await import('../src/db.js')
const { runningBalance, isTransfer } = db

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
const near = (a, b) => Math.abs(a - b) < 0.0001

// --- isTransfer is strict about the flag ---------------------------------
ok(isTransfer({ transfer: true }), 'flagged row is a transfer')
ok(!isTransfer({ transfer: false }), 'transfer:false is not a transfer')
ok(!isTransfer({}), 'absent flag is not a transfer')
ok(!isTransfer({ transfer: 'yes' }), 'only boolean true counts, not truthy strings')
ok(!isTransfer(null) && !isTransfer(undefined), 'null/undefined are safe')

// --- runningBalance ignores transfers on both sides ----------------------
const cash = { enabled: true, openingValue: 1901.39, openingDate: '2026-09-03' }

ok(runningBalance({ enabled: false }, []) === null, 'disabled anchor returns null')

const onlyTransfers = runningBalance(cash, [
  { date: '2026-09-04', type: 'income', amount: 260, transfer: true },
  { date: '2026-09-04', type: 'expense', amount: 260, transfer: true }
])
ok(near(onlyTransfers.balance, 1901.39), 'transfer pair leaves the balance untouched')
ok(near(onlyTransfers.income, 0) && near(onlyTransfers.spent, 0),
  'transfers contribute nothing to income or spent')

// A one-sided transfer is the dangerous case: if only the top-up out of the
// current account was captured and not the matching credit into Revolut, a
// naive sum would show phantom spending.
const oneSided = runningBalance(cash, [
  { date: '2026-09-04', type: 'expense', amount: 500, transfer: true }
])
ok(near(oneSided.balance, 1901.39), 'a one-sided transfer does not move the balance')

const mixed = runningBalance(cash, [
  { date: '2026-09-04', type: 'expense', amount: 258.07 },                  // real
  { date: '2026-09-04', type: 'income', amount: 260, transfer: true },      // funding
  { date: '2026-09-05', type: 'income', amount: 100 },                      // real
  { date: '2026-09-05', type: 'expense', amount: 27, transfer: true }       // funding
])
ok(near(mixed.spent, 258.07), 'only real spending is counted')
ok(near(mixed.income, 100), 'only real income is counted')
ok(near(mixed.balance, 1901.39 + 100 - 258.07), 'balance reflects real movement only')
ok(mixed.counted === 4, 'every row since the anchor is still counted as present')

// --- transfers before the anchor stay out regardless ---------------------
const preAnchor = runningBalance(cash, [
  { date: '2026-09-01', type: 'expense', amount: 999 },
  { date: '2026-09-02', type: 'income', amount: 999, transfer: true }
])
ok(near(preAnchor.balance, 1901.39), 'nothing before the anchor date is counted')
ok(preAnchor.counted === 0, 'pre-anchor rows are not reported as counted')

// --- integer-cent integrity: repeated small transfers must not drift -----
const many = runningBalance(cash, Array.from({ length: 300 }, (_, i) => ({
  date: '2026-09-10', type: i % 2 ? 'income' : 'expense', amount: 0.01, transfer: true
})))
ok(near(many.balance, 1901.39), '300 tiny transfers cause no drift')

// --- the flag is derived from the category, not trusted on its own --------
// Filing under a transfer category must mark the row a transfer; recategorising
// out of one must clear it. Otherwise a row can count as spending while sitting
// in a category that means the opposite.
localStorage.setItem('ft_schema_version', '2')
localStorage.setItem('ft_categories', JSON.stringify([
  { id: 'food', name: 'Food', kind: 'expense' },
  { id: 'transfers', name: 'Transfers', kind: 'expense', transfer: true }
]))
localStorage.setItem('ft_transactions', '[]')

const viaCategory = await db.addTransaction({
  type: 'expense', amount: 260, categoryId: 'transfers', date: '2026-09-04', note: 'top-up'
})
ok(isTransfer(viaCategory), 'a row filed under a transfer category is a transfer')

const normal = await db.addTransaction({
  type: 'expense', amount: 12.4, categoryId: 'food', date: '2026-09-04', note: 'Spar'
})
ok(!isTransfer(normal), 'a row in an ordinary category is not a transfer')

// a caller claiming transfer:true on an ordinary category must not be believed
const lying = await db.addTransaction({
  type: 'expense', amount: 5, categoryId: 'food', date: '2026-09-04', transfer: true
})
ok(!isTransfer(lying), 'transfer:true is ignored when the category is not a transfer')

const moved = await db.updateTransaction(normal.id, { categoryId: 'transfers' })
ok(isTransfer(moved), 'recategorising into Transfers sets the flag')
const movedBack = await db.updateTransaction(moved.id, { categoryId: 'food' })
ok(!isTransfer(movedBack), 'recategorising out of Transfers clears the flag')

// the breakdown must not offer a category that can never show spend
const summary = await db.getMonthSummary('2026-09', 1)
ok(!summary.byCategory.some((c) => c.id === 'transfers'),
  'transfer categories are absent from the spend breakdown')
// 12.40 Spar + 5.00 (the row whose bogus transfer:true was ignored, so it is
// ordinary food spending) — the 260 filed under Transfers must not appear.
ok(summary.spent === 17.4, `only real expenses count (got ${summary.spent})`)

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
