// A bill can be a standing transfer into a savings pot: each payday the same
// amount leaves one account and lands in another. Paying it must move the
// money between those two accounts (not count as spending), add it to the
// linked Balances savings card, and marking it unpaid must undo all of that.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}

const db = await import('../src/db.js')

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

const backup = {
  schemaVersion: 2,
  ft_payday: 19,
  ft_categories: [
    { id: 'transfers', name: 'Transfers', kind: 'expense', transfer: true, monthlyBudget: null },
    { id: 'rent', name: 'Rent', kind: 'expense', monthlyBudget: null }
  ],
  ft_accounts: [
    { id: 'main', name: 'Current account', primary: true, anchor: { enabled: true, openingValue: 100000, openingDate: '2026-11-01' } },
    { id: 'pot', name: 'Trip pot', anchor: { enabled: true, openingValue: 5000, openingDate: '2026-11-01' } }
  ],
  ft_balances: [
    { id: 'tripcard', name: 'Trip', type: 'savings', entries: [{ date: '2026-11-01', value: 5000 }] }
  ],
  ft_bills: [
    { id: 'b1', name: 'Trip', amount: 70000, categoryId: 'transfers', dueDay: 19, payments: {}, accountId: 'main', counterAccountId: 'pot', balanceAccountId: 'tripcard' },
    { id: 'b2', name: 'Rent', amount: 50000, categoryId: 'rent', dueDay: 19, payments: {} }
  ],
  ft_transactions: []
}
await db.importBackup(backup)

const month = '2026-11'
await db.markBillPaid('b1', month)

const tx = await db.getTransactions()
const accts = await db.getAccounts()
const t = tx.find((x) => x.note === 'Trip')
ok(t && t.transfer === true, 'transfer bill makes a transfer row')
ok(t && t.accountId === 'main' && t.counterAccountId === 'pot', 'row leaves main and lands in the pot')

const bal = (id) => db.accountBalance(accts.find((a) => a.id === id), tx, accts).balance
ok(Math.abs(bal('main') - 300) < 0.005, `main drops by 700 (got ${bal('main')})`)
ok(Math.abs(bal('pot') - 750) < 0.005, `pot rises by 700 (got ${bal('pot')})`)

let card = (await db.getBalances()).find((b) => b.id === 'tripcard')
ok(db.latestEntry(card).value === 750, `savings card goes up to 750 (got ${db.latestEntry(card).value})`)

const s = await db.getMonthSummary(month, 19)
ok(s.spent === 0, `a transfer bill is not spending (spent ${s.spent})`)

await db.markBillUnpaid('b1', month)
const tx2 = await db.getTransactions()
ok(!tx2.some((x) => x.note === 'Trip'), 'unpaid removes the row')
card = (await db.getBalances()).find((b) => b.id === 'tripcard')
ok(db.latestEntry(card).value === 50, `unpaid takes the card back to 50 (got ${db.latestEntry(card).value})`)

// An ordinary bill is unchanged: primary account, counts as spending.
await db.markBillPaid('b2', month)
const r = (await db.getTransactions()).find((x) => x.note === 'Rent')
ok(r && !r.transfer && !r.counterAccountId && !r.autoBalanceEntryId, 'ordinary bill has no transfer fields')
ok((await db.getMonthSummary(month, 19)).spent === 500, 'ordinary bill counts as spending')

console.log(`billtransfer: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
