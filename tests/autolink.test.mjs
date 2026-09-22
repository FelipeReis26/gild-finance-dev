// Covers three specs' data layers:
//   1. category -> balance auto-linking (auto-balance-link-spec.md)
//   2. editing a bill in place (edit-bill-spec.md)
//   3. excluding a category from totals (exclude-category-totals-spec.md)
//
// localStorage polyfill so db.js (which touches storage at module load) runs.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}

const db = await import('../src/db.js')

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
const near = (a, b) => Math.abs(a - b) < 0.0001

// Re-seed from scratch before each case so one test cannot leak into the next.
async function seed({ linked = true, accountType = 'debt' } = {}) {
  localStorage.setItem('ft_schema_version', '2')
  localStorage.setItem('ft_transactions', '[]')
  localStorage.setItem('ft_bills', '[]')
  localStorage.setItem('ft_balances', JSON.stringify([
    { id: 'acct-tv', name: 'Humm Group TV', type: accountType, icon: 'ti-credit-card',
      entries: [{ date: '2026-09-01', value: 100000 }] }   // EUR 1,000.00 in cents
  ]))
  localStorage.setItem('ft_categories', JSON.stringify([
    { id: 'tv', name: 'TV repayment', kind: 'expense',
      ...(linked ? { linkedBalanceAccountId: 'acct-tv' } : {}) },
    { id: 'food', name: 'Food', kind: 'expense' }
  ]))
}
const acct = async (id = 'acct-tv') => (await db.getBalances()).find((a) => a.id === id)
const latest = async (id) => db.latestEntry(await acct(id))?.value

// === 1. an expense in a linked category drops the balance by exactly that ===
await seed()
const tx1 = await db.addTransaction({ type: 'expense', amount: 100, categoryId: 'tv', date: '2026-09-10' })
ok(near(await latest(), 900), `balance 1000 - 100 = 900 (got ${await latest()})`)
ok(db.latestEntry(await acct()).date === '2026-09-10', 'entry is dated like the transaction')
ok(tx1._autoBalance?.accountName === 'Humm Group TV', 'the effect is reported back for a confirmation')
ok(near(tx1._autoBalance.value, 900), 'reported value matches the new balance')

// === 2. two on the same day: the same-day tie-break still holds ============
await seed()
await db.addTransaction({ type: 'expense', amount: 100, categoryId: 'tv', date: '2026-09-10' })
await db.addTransaction({ type: 'expense', amount: 50, categoryId: 'tv', date: '2026-09-10' })
ok(near(await latest(), 850), `two same-day payments chain: 1000 - 100 - 50 = 850 (got ${await latest()})`)
ok((await acct()).entries.length === 3, 'both entries were added, neither overwrote the other')

// === 3. deleting a linked transaction removes the entry it created =========
await seed()
const tx3 = await db.addTransaction({ type: 'expense', amount: 250, categoryId: 'tv', date: '2026-09-11' })
ok(near(await latest(), 750), 'balance dropped before the delete')
await db.deleteTransaction(tx3.id)
ok(near(await latest(), 1000), `balance restored to 1000 (got ${await latest()})`)
ok((await acct()).entries.length === 1, 'the auto entry is gone, the opening reading is not')

// deleting a NON-linked transaction must leave the account alone
await seed()
const plain = await db.addTransaction({ type: 'expense', amount: 9, categoryId: 'food', date: '2026-09-11' })
await db.deleteTransaction(plain.id)
ok(near(await latest(), 1000), 'an unlinked category never touches a balance')

// === 4. unlinking leaves history alone, stops affecting new rows ===========
await seed()
const before = await db.addTransaction({ type: 'expense', amount: 100, categoryId: 'tv', date: '2026-09-10' })
await db.updateCategory('tv', { linkedBalanceAccountId: null })
ok(near(await latest(), 900), 'the entry created while linked survives unlinking')
await db.addTransaction({ type: 'expense', amount: 77, categoryId: 'tv', date: '2026-09-12' })
ok(near(await latest(), 900), `new rows no longer move the balance (got ${await latest()})`)
ok(!!before.autoBalanceEntryId, 'the earlier row still remembers its entry')

// === 5. linked account deleted: saves normally, does nothing else ==========
await seed()
await db.deleteBalanceAccount('acct-tv')
const orphan = await db.addTransaction({ type: 'expense', amount: 42, categoryId: 'tv', date: '2026-09-12' })
ok(orphan && near(orphan.amount, 42), 'the transaction still saves when the account is gone')
ok(!orphan.autoBalanceEntryId, 'and claims no balance entry')
ok(!orphan._autoBalance, 'and reports no effect to confirm')

// === 6. income in a linked category is ignored ============================
await seed()
await db.addTransaction({ type: 'income', amount: 100, categoryId: 'tv', date: '2026-09-12' })
ok(near(await latest(), 1000), 'income (e.g. a refund) does not pay down the debt')

// === a savings/owed account is not a valid target =========================
for (const type of ['savings', 'owed']) {
  await seed({ accountType: type })
  const t = await db.addTransaction({ type: 'expense', amount: 30, categoryId: 'tv', date: '2026-09-12' })
  ok(near(await latest(), 1000), `a ${type} account is never auto-adjusted`)
  ok(!t.autoBalanceEntryId, `no entry claimed against a ${type} account`)
}

// === editing: reverse the old effect, then apply the new one ===============
await seed()
const e1 = await db.addTransaction({ type: 'expense', amount: 100, categoryId: 'tv', date: '2026-09-10' })
const e2 = await db.updateTransaction(e1.id, { amount: 300 })
ok(near(await latest(), 700), `edited 100 -> 300 leaves 1000 - 300 = 700 (got ${await latest()})`)
ok((await acct()).entries.length === 2, 'the old entry was replaced, not stacked on')
ok(near(e2._autoBalance.value, 700), 'the edit reports the corrected figure')

// moving OUT of the linked category reverses and applies nothing
await seed()
const m1 = await db.addTransaction({ type: 'expense', amount: 100, categoryId: 'tv', date: '2026-09-10' })
await db.updateTransaction(m1.id, { categoryId: 'food' })
ok(near(await latest(), 1000), 'recategorising out of the linked category undoes the payment')

// moving INTO the linked category applies it
await seed()
const m2 = await db.addTransaction({ type: 'expense', amount: 60, categoryId: 'food', date: '2026-09-10' })
await db.updateTransaction(m2.id, { categoryId: 'tv' })
ok(near(await latest(), 940), `recategorising into the linked category applies it (got ${await latest()})`)

// editing something irrelevant must not churn the entry
await seed()
const n1 = await db.addTransaction({ type: 'expense', amount: 100, categoryId: 'tv', date: '2026-09-10' })
const entryIdBefore = n1.autoBalanceEntryId
await db.updateTransaction(n1.id, { note: 'Humm Group' })
const after = (await db.getTransactions()).find((t) => t.id === n1.id)
ok(after.autoBalanceEntryId === entryIdBefore, 'editing only the note leaves the balance entry untouched')
ok(near(await latest(), 900), 'and the balance is unchanged')

// === bill editing (edit-bill-spec.md) =====================================
await seed()
const bill = await db.addBill({ name: 'TV repayment', amount: 55, categoryId: 'tv', dueDay: 12 })
await db.markBillPaid(bill.id, '2026-09')
const paidTxId = (await db.getBills()).find((b) => b.id === bill.id).payments['2026-09'].transactionId
const paidTxBefore = (await db.getTransactions()).find((t) => t.id === paidTxId)
ok(paidTxBefore && near(paidTxBefore.amount, 55), 'marking paid created a EUR 55 transaction')

const edited = await db.updateBill(bill.id, { amount: 70, categoryId: 'food', dueDay: 20 })
ok(near(edited.amount, 70), 'amount updated')
ok(edited.categoryId === 'food', 'category updated')
ok(edited.dueDay === 20, 'due day updated')
ok(Object.keys(edited.payments).length === 1, 'payment history survived the edit')
ok(edited.payments['2026-09'].transactionId === paidTxId, 'the payment still points at the same transaction')

const paidTxAfter = (await db.getTransactions()).find((t) => t.id === paidTxId)
ok(near(paidTxAfter.amount, 55), `the already-paid transaction is frozen at 55 (got ${paidTxAfter.amount})`)
ok(paidTxAfter.categoryId === 'tv', 'and keeps the category it was paid under')

// clamping, and the next payment using the new figure
ok((await db.updateBill(bill.id, { dueDay: 99 })).dueDay === 31, 'dueDay clamps to 31')
ok((await db.updateBill(bill.id, { dueDay: 0 })).dueDay === 1, 'dueDay clamps to 1')
await db.updateBill(bill.id, { amount: 70, categoryId: 'food' })
await db.markBillPaid(bill.id, '2026-10')
const nextId = (await db.getBills()).find((b) => b.id === bill.id).payments['2026-10'].transactionId
const nextTx = (await db.getTransactions()).find((t) => t.id === nextId)
ok(near(nextTx.amount, 70), `the next payment uses the new amount (got ${nextTx.amount})`)
ok(nextTx.categoryId === 'food', 'and the new category')

ok((await db.updateBill('nope', { amount: 1 })) === null, 'editing a missing bill returns null')

// === excluding a category from the totals (exclude-category-totals-spec) ===
// A flagged category stays completely normal everywhere except the headline
// figures, the budget sum, the breakdown and the trend chart.
async function seedTotals(flags = {}) {
  localStorage.setItem('ft_schema_version', '2')
  localStorage.setItem('ft_balances', '[]')
  localStorage.setItem('ft_bills', '[]')
  localStorage.setItem('ft_payday', JSON.stringify(1))
  localStorage.setItem('ft_categories', JSON.stringify([
    { id: 'food', name: 'Food', kind: 'expense', monthlyBudget: 20000 },
    { id: 'xfer', name: 'Transfers', kind: 'expense', monthlyBudget: 50000, ...flags.xfer },
    { id: 'wages', name: 'Wages', kind: 'income' },
    { id: 'xferin', name: 'Transfers in', kind: 'income', ...flags.xferin }
  ]))
  localStorage.setItem('ft_transactions', JSON.stringify([
    { id: 'a', type: 'expense', amount: 5000, categoryId: 'food', date: '2026-09-10' },
    { id: 'b', type: 'expense', amount: 500000, categoryId: 'xfer', date: '2026-09-10' },
    { id: 'c', type: 'income', amount: 300000, categoryId: 'wages', date: '2026-09-05' },
    { id: 'd', type: 'income', amount: 400000, categoryId: 'xferin', date: '2026-09-06' },
    // last month, for the trend chart
    { id: 'e', type: 'expense', amount: 2500, categoryId: 'food', date: '2026-08-10' },
    { id: 'f', type: 'expense', amount: 900000, categoryId: 'xfer', date: '2026-08-11' }
  ]))
}
const ON = { xfer: { excludeFromTotals: true }, xferin: { excludeFromTotals: true } }

// 1 + 2. the headline figures ignore flagged categories, in both directions
await seedTotals()
let sum = await db.getMonthSummary('2026-09', 1)
ok(near(sum.spent, 5050) && near(sum.income, 7000), `unflagged counts everything (${sum.spent}/${sum.income})`)
await seedTotals(ON)
sum = await db.getMonthSummary('2026-09', 1)
ok(near(sum.spent, 50), `Spent excludes the flagged expense category (got ${sum.spent})`)
ok(near(sum.income, 3000), `Income excludes the flagged income category (got ${sum.income})`)

// 3. and they are absent from the breakdown that feeds the list and the donut
ok(!sum.byCategory.some((c) => c.id === 'xfer'), 'flagged category is not a slice of the breakdown')
ok(sum.byCategory.some((c) => c.id === 'food'), 'ordinary categories still appear')

// ...while the transactions themselves are untouched in Activity
const all = await db.getTransactions()
ok(all.length === 6 && all.some((t) => t.categoryId === 'xfer'),
  'flagged transactions still show in the transaction list')

// 6. the overall budget figure skips them too
ok(near(sum.budget, 200), `budget sum is Food's 200 alone, not 700 (got ${sum.budget})`)

// 4. the trend chart agrees with the gauge
const trend = await db.getRecentMonthTotals('2026-09', 2, 1)
ok(near(trend[0].total, 25), `trend excludes flagged amounts in past periods (got ${trend[0].total})`)
ok(near(trend[1].total, 50), `and in the current one (got ${trend[1].total})`)

// 5. un-flagging brings them straight back, with nothing rewritten
await db.updateCategory('xfer', { excludeFromTotals: false })
await db.updateCategory('xferin', { excludeFromTotals: false })
sum = await db.getMonthSummary('2026-09', 1)
ok(near(sum.spent, 5050) && near(sum.income, 7000), 'un-flagging restores the totals immediately')
ok(near(sum.budget, 700), 'and restores the budget sum')

// a transfer category is excluded without needing the box ticked
await seedTotals({ xfer: { transfer: true } })
sum = await db.getMonthSummary('2026-09', 1)
ok(near(sum.spent, 50), 'a transfer category is excluded by what it is')
ok(db.isExcludedFromTotals({ transfer: true }), 'transfer implies excluded')
ok(db.isExcludedFromTotals({ excludeFromTotals: true }), 'the flag alone is enough')
ok(!db.isExcludedFromTotals({}), 'and a plain category is counted')

// === income breakdown ======================================================
// Mirrors byCategory: income-kind categories, what each brought in, excluded
// ones left out entirely.
await seedTotals()
let isum = await db.getMonthSummary('2026-09', 1)
ok(Array.isArray(isum.byIncomeCategory), 'byIncomeCategory is returned')
ok(isum.byIncomeCategory.every((c) => c.kind === 'income'),
  'it contains only income categories')
ok(!isum.byIncomeCategory.some((c) => c.id === 'food'),
  'expense categories stay out of it')
const wages = isum.byIncomeCategory.find((c) => c.id === 'wages')
ok(wages && near(wages.received, 3000), `Wages received 3000 (got ${wages?.received})`)
const xin = isum.byIncomeCategory.find((c) => c.id === 'xferin')
ok(xin && near(xin.received, 4000), 'an unflagged income category is included')
ok(isum.byIncomeCategory[0].received >= isum.byIncomeCategory[1].received,
  'sorted largest first')

// a flagged income category disappears from the breakdown, like the expense side
await seedTotals(ON)
isum = await db.getMonthSummary('2026-09', 1)
ok(!isum.byIncomeCategory.some((c) => c.id === 'xferin'),
  'an excluded income category is not a slice of the income ring')
ok(isum.byIncomeCategory.some((c) => c.id === 'wages'), 'ordinary income still appears')
ok(near(isum.byIncomeCategory.reduce((s, c) => s + c.received, 0), isum.income),
  'the ring total equals the headline Income figure')

// and the expense ring total still equals Spent
ok(near(isum.byCategory.reduce((s, c) => s + c.spent, 0), isum.spent),
  'the spend ring total equals the headline Spent figure')

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
