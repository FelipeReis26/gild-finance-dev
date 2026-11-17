// Fixes from the 17 Nov review: each case failed before its fix.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
const st = await import('../src/statements.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

const cats = [
  { id: 'rent', name: 'Rent', kind: 'expense' },
  { id: 'card', name: 'Card', kind: 'expense', linkedBalanceAccountId: 'debt' },
  { id: 'transfers', name: 'Transfers', kind: 'expense', transfer: true },
  { id: 'wages', name: 'Wages', kind: 'income' }
]
const accounts = [{ id: 'main', name: 'Current account', primary: true, anchor: { enabled: true, openingValue: 200000, openingDate: '2026-11-01' } }]

// 1. a bill paid in Gild (row has no accountId) is recognised when the bank's statement brings the same payment
await db.importBackup({ schemaVersion: 2, ft_payday: 19, ft_categories: cats, ft_accounts: accounts, ft_bills: [{ id: 'r', name: 'Rent', amount: 120000, categoryId: 'rent', dueDay: 20, payments: {} }], ft_transactions: [] })
await db.markBillPaid('r', '2026-11')
let tx = await db.getTransactions()
ok(!tx[0].accountId, 'bill rows carry no account (the primary one is implied)')
const csv = st.detectStatement(`Date,Details,Debit,Credit,Balance\n20/11/2026,D/D LANDLORD,1200.00,,800.00\n`)
const p1 = st.prepareImport({ parsed: csv, accountId: 'main', transactions: tx, bills: await db.getBills(), categories: cats, accounts: await db.getAccounts(), payDay: 19 })
ok(p1.rows[0].status === 'duplicate', `the rent already paid isn't imported again (${p1.rows[0].status})`)

// 2. a bill moving a debt whose category is also linked to it moves it once, and Unpaid puts it all back
await db.importBackup({
  schemaVersion: 2, ft_payday: 19, ft_categories: cats,
  ft_bills: [{ id: 'c', name: 'Card', amount: 20000, categoryId: 'card', dueDay: 20, payments: {}, balanceAccountId: 'debt' }],
  ft_balances: [{ id: 'debt', name: 'Card', type: 'debt', entries: [{ date: '2026-11-01', value: 100000 }] }], ft_transactions: []
})
await db.markBillPaid('c', '2026-11')
ok(db.latestEntry((await db.getBalances())[0]).value === 800, `paid once: 1000 → 800 (${db.latestEntry((await db.getBalances())[0]).value})`)
await db.markBillUnpaid('c', '2026-11')
ok(db.latestEntry((await db.getBalances())[0]).value === 1000, `unpaid: back to 1000 (${db.latestEntry((await db.getBalances())[0]).value})`)

// 3. paying an earlier period's bill still moves the card's current figure
await db.importBackup({
  schemaVersion: 2, ft_payday: 19, ft_categories: cats,
  ft_bills: [{ id: 'b', name: 'Pot', amount: 70000, categoryId: 'transfers', dueDay: 19, payments: {}, balanceAccountId: 'pot' }],
  ft_balances: [{ id: 'pot', name: 'Pot', type: 'savings', entries: [{ date: '2026-11-16', value: 150000 }] }], ft_transactions: []
})
await db.markBillPaid('b', '2026-09')
ok(db.latestEntry((await db.getBalances())[0]).value === 2200, `back-dated payment is the newest figure (${db.latestEntry((await db.getBalances())[0]).value})`)

// 4. deleting a bill row un-pays the bill and Undo restores the row, the bill and the card
await db.importBackup({
  schemaVersion: 2, ft_payday: 19, ft_categories: cats,
  ft_bills: [{ id: 'b', name: 'Pot', amount: 70000, categoryId: 'transfers', dueDay: 19, payments: {}, balanceAccountId: 'pot' }],
  ft_balances: [{ id: 'pot', name: 'Pot', type: 'savings', entries: [{ date: '2026-11-01', value: 8000 }] }], ft_transactions: []
})
await db.markBillPaid('b', '2026-11')
const row = (await db.getTransactions())[0]
const links = await db.deleteTransaction(row.id)
ok(!(await db.getBills())[0].payments['2026-11'], 'delete un-pays the bill')
ok(db.latestEntry((await db.getBalances())[0]).value === 80, 'delete takes it off the card')
await db.restoreTransaction(row, links)
const back = (await db.getTransactions())[0]
ok(back && (await db.getBills())[0].payments['2026-11']?.transactionId === back.id, 'undo re-links the bill to the row')
ok(db.latestEntry((await db.getBalances())[0]).value === 780, `undo puts it back on the card (${db.latestEntry((await db.getBalances())[0]).value})`)
await db.markBillUnpaid('b', '2026-11')
ok((await db.getTransactions()).length === 0 && db.latestEntry((await db.getBalances())[0]).value === 80, 'and Unpaid after Undo still removes it cleanly')

// 5. a card payment received stays a transfer even with no income-side transfer category
const noIn = cats.filter((c) => !(c.transfer && c.kind === 'income'))
const pdf = st.detectPdfStatement(['Avant Money', 'Statement date 06 Dec 26', '19 Nov 26 19 Nov 26 CARD PAYMENT RECEIVED - THANK YOU 200.00 Cr', 'Current Statement Balance 800.00'])
const p5 = st.prepareImport({ parsed: pdf, accountId: 'avant', transactions: [], bills: [], categories: noIn, accounts: [], payDay: 19 })
ok(p5.rows[0].transfer && noIn.find((c) => c.id === p5.rows[0].categoryId)?.transfer, `filed under a transfer category (${p5.rows[0].categoryId})`)
await db.importBackup({ schemaVersion: 2, ft_payday: 19, ft_categories: noIn, ft_transactions: [] })
await db.importStatementRows(p5.rows)
const s5 = await db.getMonthSummary('2026-11', 19)
ok(s5.income === 0, `not counted as income (${s5.income})`)

// 7. rows in another currency are left out
const rev = st.detectStatement(`Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-11-20 10:00:00,2026-11-20 10:00:00,Walgreens,-13.10,0.00,USD,COMPLETED,40.00
CARD_PAYMENT,Current,2026-11-20 10:00:00,2026-11-20 10:00:00,Tesco,-12.50,0.00,EUR,COMPLETED,87.50
`)
const p7 = st.prepareImport({ parsed: rev, accountId: 'revolut', transactions: [], bills: [], categories: cats, accounts: [], payDay: 19, currencyCode: 'EUR' })
ok(p7.rows[0].status === 'foreign' && p7.rows[1].status === 'new' && p7.counts.new === 1 && p7.counts.foreign === 1, 'USD row left out, EUR row in')

// 9. with amounts hidden, a goal reminder doesn't name the goal
const text = (k, v = {}) => `${k}${JSON.stringify(v)}`
const plan = db.planReminders({
  bills: [], categories: cats, balances: [{ id: 'g', name: 'Secret trip', type: 'savings', entries: [{ date: '2026-11-01', value: 10 }], goal: { target: 5000, by: '2027-02-19' } }],
  transactions: [], payDay: 19, settings: { hideAmounts: true, payday: false, bills: false, nothingLogged: false }, now: new Date(2026, 10, 17, 20), text, money: (v) => `€${v}`, weekday: () => 'x'
})
ok(plan.length === 1 && !/Secret trip/.test(plan[0].title + plan[0].body), 'goal reminder anonymous when hidden')

// 10. a hidden subscription stays hidden when older statements arrive later
const charge = (date, amount) => ({ id: date, type: 'expense', amount, date, note: 'Gym Co', categoryId: 'rent' })
const recent = [charge('2026-08-05', 30), charge('2026-09-05', 30), charge('2026-10-05', 30), charge('2026-11-05', 30)]
const sub = db.findSubscriptions(recent, [], '2026-11-17', [])[0]
const hiddenList = [sub.key]
const withOlder = [charge('2026-05-05', 27), charge('2026-06-05', 28), charge('2026-07-05', 29), ...recent]
const again = db.findSubscriptions(withOlder, [], '2026-11-17', [])[0]
ok(db.isHiddenSubscription(again, hiddenList), 'still hidden after older, cheaper charges are imported')
const raised = db.findSubscriptions([...recent, charge('2026-12-05', 32)], [], '2026-12-17', [])[0]
ok(db.isHiddenSubscription(raised, hiddenList), 'still hidden after a small price rise')
ok(!db.isHiddenSubscription({ ...sub, merchant: 'other' }, hiddenList), 'another shop is not hidden')

console.log(`review: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
