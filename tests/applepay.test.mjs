// Apple Pay drafts and one-period limits.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
const ap = await import('../src/applePay.js')
const st = await import('../src/statements.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// amounts as the Wallet trigger sends them
ok(eq(ap.parseAmount('€31.20'), { amount: 31.2, currency: 'EUR', refund: false }), '€31.20')
ok(ap.parseAmount('31,20 €').amount === 31.2, '31,20 €')
ok(ap.parseAmount('EUR 1,031.20').amount === 1031.2 && ap.parseAmount('EUR 1,031.20').currency === 'EUR', 'EUR 1,031.20')
ok(ap.parseAmount('1.031,20 €').amount === 1031.2, '1.031,20 €')
ok(ap.parseAmount('$12').currency === 'USD' && ap.parseAmount('$12').amount === 12, '$12')
ok(ap.parseAmount('R$ 1.073,72').currency === 'BRL', 'reais')
ok(ap.parseAmount('-€5.00').refund === true, 'a refund')
ok(ap.parseAmount('') === null && ap.parseAmount('free') === null && ap.parseAmount('€0.00') === null, 'nothing to log')

// card → account
const accounts = [
  { id: 'main', name: 'Current account', primary: true },
  { id: 'revolut', name: 'Revolut' },
  { id: 'revolut-savings', name: 'Trip pot (Revolut Savings)' },
  { id: 'avant', name: 'Credit card (Avant)' }
]
ok(ap.accountForCard('Revolut Visa', accounts) === 'revolut', 'Revolut card → Revolut, not the savings pot')
ok(ap.accountForCard('Avant Money', accounts) === 'avant', 'Avant')
ok(ap.accountForCard('BOI Debit', accounts) === 'main' && ap.accountForCard('Something', accounts) === 'main', 'BOI and unknown → the main account')
ok(ap.accountForCard('Something', accounts, { Something: 'revolut' }) === 'revolut', 'a chosen mapping wins')

// inbox entries → pending, local date
const pend = ap.toPending([
  { id: 'a', at: '2026-11-18T13:04:00Z', amount: '€31.20', merchant: "McDonald's", card: 'BOI Debit' },
  { id: 'b', at: '2026-11-18T08:12:00Z', amount: 'not a number', merchant: 'X', card: '' }
])
ok(pend.length === 1 && pend[0].amount === 31.2 && pend[0].merchant === "McDonald's" && /^\d{4}-\d{2}-\d{2}$/.test(pend[0].date), 'parsed, unparseable dropped')

// stored once, removable
await db.addApplePayPending(pend)
await db.addApplePayPending(pend)
ok((await db.getApplePayPending()).length === 1, 'the same payment is only held once')
ok((await db.getApplePaySettings()).last?.merchant === "McDonald's", 'last received remembered')
await db.removeApplePayPending(['a'])
ok((await db.getApplePayPending()).length === 0, 'confirmed or dismissed → gone')

// category like last time
const history = [{ id: 'h', type: 'expense', amount: 30, date: '2026-10-20', note: "McDonald's", categoryId: 'food', accountId: 'main' }]
ok(st.guessFromHistory("MCDONALD'S DUBLIN", history, 'main')?.categoryId === 'food', 'shop filed like last time')

// one-period limits
await db.importBackup({
  schemaVersion: 2, ft_payday: 19,
  ft_categories: [{ id: 'holidays', name: 'Holidays', kind: 'expense', monthlyBudget: 0 }, { id: 'food', name: 'Food', kind: 'expense', monthlyBudget: 20000 }],
  ft_transactions: [{ id: 't', type: 'expense', amount: 10000, categoryId: 'holidays', date: '2026-11-27' }]
})
await db.setPeriodLimit('2026-11', 'holidays', 225)
let nov = await db.getMonthSummary('2026-11', 19)
let dec = await db.getMonthSummary('2026-12', 19)
const h = (s) => s.byCategory.find((c) => c.id === 'holidays')
ok(h(nov).effectiveBudget === 225 && h(nov).periodOnly && h(nov).usualBudget === 0, `November uses the one-off €225 (${h(nov).effectiveBudget})`)
ok(h(dec).effectiveBudget === 0 && !h(dec).periodOnly, 'December is back to the usual €0')
ok(nov.budget === 425 && dec.budget === 200, `period totals (${nov.budget}, ${dec.budget})`)
ok((await db.getPeriodLimits('2026-11')).holidays === 225, 'read back')
await db.setPeriodLimit('2026-11', 'holidays', null)
nov = await db.getMonthSummary('2026-11', 19)
ok(h(nov).effectiveBudget === 0, 'removed → usual limit again')

console.log(`applepay: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
