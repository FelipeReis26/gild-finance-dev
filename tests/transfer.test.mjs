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
const { accountBalance, anchorFromReal, isTransfer } = db

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
const near = (a, b) => Math.abs(a - b) < 0.0001

// --- isTransfer is strict about the flag ---------------------------------
ok(isTransfer({ transfer: true }), 'flagged row is a transfer')
ok(!isTransfer({ transfer: false }), 'transfer:false is not a transfer')
ok(!isTransfer({}), 'absent flag is not a transfer')
ok(!isTransfer({ transfer: 'yes' }), 'only boolean true counts, not truthy strings')
ok(!isTransfer(null) && !isTransfer(undefined), 'null/undefined are safe')

// --- per-account cash (reconciliation-bugs-spec, bug 2) -------------------
// The cash figure belongs to ONE account. Earlier tests here asserted that a
// transfer leaves the balance untouched — true only for a combined figure
// across both banks, where an internal move nets to zero. Scoped to a real
// account it is wrong: a top-up genuinely left the current account and genuinely arrived in
// Revolut, so it must count on both sides.
const ACCTS = [
  { id: 'main', name: 'Current account', primary: true },
  { id: 'revolut', name: 'Revolut' }
]
const anchored = (id, value, date = '2026-09-03') => ({
  ...ACCTS.find((a) => a.id === id),
  anchor: { enabled: true, openingValue: value, openingDate: date }
})
const main = anchored('main', 1250.40)
const rev = anchored('revolut', 180.60)

ok(accountBalance({ id: 'main', anchor: null }, [], ACCTS) === null, 'no anchor returns null')
ok(accountBalance({ id: 'main', anchor: { enabled: false } }, [], ACCTS) === null,
  'a disabled anchor returns null')

// one top-up row: out of main, into Revolut, by exactly the same amount
const topUp = [{ date: '2026-09-04', type: 'expense', amount: 260, accountId: 'main',
                 counterAccountId: 'revolut', transfer: true }]
ok(near(accountBalance(main, topUp, ACCTS).balance, 1250.40 - 260),
  'a top-up reduces the account it left')
ok(near(accountBalance(rev, topUp, ACCTS).balance, 180.60 + 260),
  'and credits the account it arrived in, from the same single row')

// the transfer flag does not exempt anything here (it does on the dashboard)
const oneSided = [{ date: '2026-09-04', type: 'expense', amount: 500, accountId: 'main', transfer: true }]
ok(near(accountBalance(main, oneSided, ACCTS).balance, 1250.40 - 500),
  'money leaving the account counts even when it is flagged a transfer')

// each account only sees its own rows
const mixed = [
  { date: '2026-09-04', type: 'expense', amount: 258.07, accountId: 'revolut' }, // Amazon
  { date: '2026-09-04', type: 'expense', amount: 260, accountId: 'main', counterAccountId: 'revolut' },
  { date: '2026-09-05', type: 'income', amount: 100, accountId: 'main' },        // repayment
  { date: '2026-09-05', type: 'expense', amount: 80, accountId: 'main' }         // Virgin Media
]
const m = accountBalance(main, mixed, ACCTS)
const r = accountBalance(rev, mixed, ACCTS)
ok(near(m.balance, 1250.40 - 260 + 100 - 80), `main: 1250.40 - 260 + 100 - 80 (got ${m.balance})`)
ok(near(r.balance, 180.60 + 260 - 258.07), `revolut: 180.60 + 260 - 258.07 (got ${r.balance})`)
ok(m.counted === 3 && r.counted === 2, 'each account counts only the rows that touched it')

// rows written before accounts existed belong to the primary account
const legacy = [{ date: '2026-09-06', type: 'expense', amount: 20 }]
ok(near(accountBalance(main, legacy, ACCTS).balance, 1250.40 - 20),
  'an untagged row lands on the primary account')
ok(near(accountBalance(rev, legacy, ACCTS).balance, 180.60),
  'and never on the secondary one')

// nothing before the anchor date
const pre = [{ date: '2026-09-01', type: 'expense', amount: 999, accountId: 'main' }]
ok(near(accountBalance(main, pre, ACCTS).balance, 1250.40), 'pre-anchor rows are ignored')
ok(accountBalance(main, pre, ACCTS).counted === 0, 'and not reported as counted')

// integer-cent integrity
const many = Array.from({ length: 300 }, (_, i) => ({
  date: '2026-09-10', type: i % 2 ? 'income' : 'expense', amount: 0.01, accountId: 'main'
}))
ok(near(accountBalance(main, many, ACCTS).balance, 1250.40), '300 tiny movements cause no drift')

// a transfer between the two tracked accounts nets to zero ACROSS them,
// which is the property the old combined figure was really relying on
const sum = accountBalance(main, topUp, ACCTS).balance + accountBalance(rev, topUp, ACCTS).balance
ok(near(sum, 1250.40 + 180.60), 'moving money between his own accounts leaves the total unchanged')

// --- backfill: reading accounts out of the old provenance tags --------------
// Seeded as raw stored rows (cents, no accountId), exactly as a pre-accounts
// backup looks, then read back through the app so the migration runs.
localStorage.setItem('ft_schema_version', '2')
localStorage.removeItem('ft_accounts')
localStorage.setItem('ft_categories', JSON.stringify([{ id: 'x', name: 'Transfers', kind: 'expense', transfer: true }]))
localStorage.setItem('ft_transactions', JSON.stringify([
  // listed with the 19th FIRST on purpose: matching in list order would let it
  // steal the 16th's credit from the 15th, which is one day nearer
  { id: 'u19', type: 'expense', amount: 2000, date: '2026-07-19', note: 'Revolut**551 top-up', source: 'bank-main' },
  { id: 'u15', type: 'expense', amount: 2000, date: '2026-07-15', note: 'Revolut**551 top-up' },               // no source
  { id: 'c16', type: 'income',  amount: 2000, date: '2026-07-16', note: 'Apple Pay top-up by *0000', source: 'bank-revolut' },
  { id: 'u25', type: 'expense', amount: 15000, date: '2026-07-25', note: 'Revolut**551 top-up' },             // credit collapsed away
  { id: 'p1',  type: 'income',  amount: 832, date: '2026-05-03', note: 'Pocket Withdrawal', source: 'bank-revolut-pocket' },
  { id: 'v1',  type: 'expense', amount: 300, date: '2026-07-20', note: 'To EUR Flexible Cash Funds', source: 'bank-revolut' },
  { id: 'v2',  type: 'income',  amount: 100, date: '2026-07-21', note: 'From EUR Flexible Cash Funds', source: 'bank-revolut' },
  { id: 'n1',  type: 'expense', amount: 999, date: '2026-07-22', note: 'Tesco' }                                // typed in the app
]))
const mig = Object.fromEntries((await db.getTransactions()).map((t) => [t.id, t]))
const A = await db.getAccounts()

ok(A.map((a) => a.id).join() === 'main,revolut,revolut-savings', 'three accounts are seeded')
ok(mig.u15.accountId === 'main' && mig.u19.accountId === 'main', 'a top-up left the current account, with or without a source tag')
ok(!mig.u15.counterAccountId, "the 15th is paired with the 16th's credit: Revolut already records it")
ok(mig.u19.counterAccountId === 'revolut', 'the 19th has no credit of its own left, so it supplies one')
ok(mig.u25.counterAccountId === 'revolut', 'a top-up whose Revolut credit was collapsed away supplies it')
ok(mig.p1.accountId === 'revolut-savings', 'a pocket movement is on the vault, not the Revolut current account')
ok(mig.v1.accountId === 'revolut' && mig.v1.counterAccountId === 'revolut-savings', 'a sweep into the vault names the vault')
ok(mig.v2.counterAccountId === 'revolut-savings', 'and so does a withdrawal out of it')
ok(!mig.n1.accountId, 'a row typed into the app is left alone (it reads as the primary account)')

// the money now lands exactly once on each side
const open = (id) => ({ ...A.find((a) => a.id === id), anchor: { enabled: true, openingValue: 0, openingDate: '2026-07-01' } })
const all = Object.values(mig)
ok(near(accountBalance(open('main'), all, A).balance, -(20 + 20 + 150 + 9.99)),
  `the current account is debited each top-up once (got ${accountBalance(open('main'), all, A).balance})`)
ok(near(accountBalance(open('revolut'), all, A).balance, 20 + 20 + 150 - 3 + 1),
  `Revolut is credited each top-up once — never twice (got ${accountBalance(open('revolut'), all, A).balance})`)
ok(near(accountBalance(open('revolut-savings'), all, A).balance, 3 - 1),
  `the vault gains the sweep in and loses the withdrawal out (got ${accountBalance(open('revolut-savings'), all, A).balance})`)

// re-reading must not change anything — the backfill runs once
const again = Object.fromEntries((await db.getTransactions()).map((t) => [t.id, t]))
ok(JSON.stringify(again) === JSON.stringify(mig), 'the backfill is idempotent')

// --- deleting an account hands its rows to the primary, not into the void ---
const afterDelete = [{ id: 'main', name: 'Current account', primary: true }]   // revolut deleted
const orphaned = [{ date: '2026-09-05', type: 'expense', amount: 30, accountId: 'revolut' }]
ok(db.accountOf(orphaned[0], afterDelete) === 'main',
  "a row on a deleted account is read as the primary account's")
ok(near(accountBalance(anchored('main', 100), orphaned, afterDelete).balance, 70),
  'so it still counts somewhere rather than vanishing from every balance')
ok(db.accountOf({ accountId: 'revolut' }, ACCTS) === 'revolut', 'a live account is kept as-is')

// --- re-anchoring against the bank's figure must not double-count today ---
// The bank's "now" already includes what happened today. Stored as-is and
// dated today, today's rows would be counted on top of it a second time.
const today = '2026-10-08'
const todays = [
  { date: today, type: 'expense', amount: 13.5, accountId: 'main' },   // coffee, already logged
  { date: today, type: 'income', amount: 40, accountId: 'main' },      // repayment, already logged
  { date: '2026-10-07', type: 'expense', amount: 99, accountId: 'main' } // yesterday: not today's
]
const fresh = anchorFromReal(ACCTS[0], 412.30, todays, ACCTS, today)
const reAnchored = { ...ACCTS[0], anchor: fresh }
ok(near(accountBalance(reAnchored, todays, ACCTS).balance, 412.30),
  `re-anchoring reads exactly what the bank says (got ${accountBalance(reAnchored, todays, ACCTS).balance})`)
const later = [...todays, { date: today, type: 'expense', amount: 5, accountId: 'main' }]
ok(near(accountBalance(reAnchored, later, ACCTS).balance, 412.30 - 5),
  'and still counts something logged later the same day')
// the naive version this replaces would have drifted by today's net movement
ok(!near(accountBalance({ ...ACCTS[0], anchor: { enabled: true, openingValue: 412.30, openingDate: today } }, todays, ACCTS).balance, 412.30),
  'proof: storing the bank figure as-is would NOT have matched')

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
