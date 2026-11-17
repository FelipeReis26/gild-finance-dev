// Repeat-charge detection: steady rhythm, about the same amount, at least
// three times. Price rises stay one subscription; a €0.99 and a €9.99 from
// the same shop stay two; takeaway, people and transfers are never one.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

let n = 0
const tx = (date, amount, note, categoryId = 'streaming', extra = {}) => ({ id: `t${n++}`, type: 'expense', date, amount, note, categoryId, ...extra })
const cats = [{ id: 'streaming', name: 'Streaming' }, { id: 'food', name: 'Food' }, { id: 'transfers', name: 'Transfers', transfer: true }]
const list = [
  // monthly, with a price rise from 16.99 to 18.99
  tx('2026-07-21', 16.99, 'Netflix'), tx('2026-08-21', 16.99, 'Netflix'), tx('2026-09-22', 18.99, 'Netflix'), tx('2026-10-21', 18.99, 'Netflix'),
  // same shop, two plans
  tx('2026-08-29', 9.99, 'Apple.com/Bill'), tx('2026-09-29', 9.99, 'Apple.com/Bill'), tx('2026-10-29', 9.99, 'Apple.com/Bill'),
  tx('2026-08-12', 0.99, 'Apple.com/Bill'), tx('2026-09-11', 0.99, 'Apple.com/Bill'), tx('2026-10-12', 0.99, 'Apple.com/Bill'),
  // stopped charging after September (EA-style), last one 70 days before today
  tx('2026-07-08', 5.99, 'Electronic Arts'), tx('2026-08-08', 5.99, 'Electronic Arts'), tx('2026-09-08', 5.99, 'Electronic Arts'),
  // a few days overdue
  tx('2026-08-10', 6.99, 'Amazon Prime'), tx('2026-09-10', 6.99, 'Amazon Prime'), tx('2026-10-10', 6.99, 'Amazon Prime'),
  // only twice: not enough to call it
  tx('2026-09-27', 5.99, 'PlayStation'), tx('2026-10-27', 5.99, 'PlayStation'),
  // takeaway, people and transfers are never subscriptions
  tx('2026-08-15', 28.98, 'Just Eat', 'food'), tx('2026-09-15', 28.98, 'Just Eat', 'food'), tx('2026-10-15', 28.98, 'Just Eat', 'food'),
  tx('2026-08-01', 50, 'Transfer to JOHN SMITH', 'other'), tx('2026-09-01', 50, 'Transfer to JOHN SMITH', 'other'), tx('2026-10-01', 50, 'Transfer to JOHN SMITH', 'other'),
  tx('2026-08-03', 100, 'To pocket', 'transfers', { transfer: true }), tx('2026-09-03', 100, 'To pocket', 'transfers', { transfer: true }), tx('2026-10-03', 100, 'To pocket', 'transfers', { transfer: true }),
  // irregular amounts from one shop: not a subscription
  tx('2026-08-04', 12.5, 'Amazon', 'other'), tx('2026-09-04', 258.07, 'Amazon', 'other'), tx('2026-10-04', 33.1, 'Amazon', 'other')
]
const bills = [{ id: 'bn', name: 'Netflix', amount: 18.99, categoryId: 'streaming', dueDay: 21, payments: {} }]
const subs = db.findSubscriptions(list, bills, '2026-11-17', cats)
const by = (name, amount) => subs.find((s) => s.name === name && (amount == null || s.amount === amount))

ok(by('Netflix') && by('Netflix').amount === 18.99 && by('Netflix').count === 4, 'a price rise stays one subscription, at the latest price')
ok(by('Netflix')?.billId === 'bn', 'matched to its bill by name')
ok(by('Netflix')?.status === 'active', `Netflix active (${by('Netflix')?.status})`)
ok(by('Apple.com/Bill', 9.99) && by('Apple.com/Bill', 0.99), 'two plans from one shop stay two')
ok(by('Electronic Arts')?.status === 'stopped', `EA stopped (${by('Electronic Arts')?.status})`)
ok(by('Amazon Prime')?.status === 'late', `Prime late (${by('Amazon Prime')?.status})`)
ok(!by('PlayStation'), 'two charges is not enough')
ok(!by('Just Eat'), 'takeaway is not a subscription')
ok(!subs.some((s) => /JOHN|pocket/i.test(s.name)), 'people and transfers are not subscriptions')
ok(!by('Amazon'), 'irregular amounts are not a subscription')
ok(subs[0].status === 'active' && subs[subs.length - 1].status !== 'active', 'active first')

// a stopped one more than ~3 months ago drops off
ok(!db.findSubscriptions(list, bills, '2027-01-20', cats).some((s) => s.name === 'Electronic Arts'), 'old stops drop off')

// bill match by a payment's transaction id, even with a different name
const linked = [{ id: 'bi', name: 'Internet', amount: 80, categoryId: 'utilities', dueDay: 21, payments: { '2026-10': { transactionId: 'v3' } } }]
const vm = [tx('2026-08-21', 80, 'Virgin Media', 'utilities', { id: 'v1' }), tx('2026-09-21', 80, 'Virgin Media', 'utilities', { id: 'v2' }), tx('2026-10-21', 80, 'Virgin Media', 'utilities', { id: 'v3' })]
ok(db.findSubscriptions(vm, linked, '2026-11-01', [])[0]?.billId === 'bi', 'matched to a bill through its paid transaction')

// hidden list round trip
await db.setSubscriptionHidden('ea|599', true)
ok((await db.getHiddenSubscriptions()).includes('ea|599'), 'hide')
await db.setSubscriptionHidden('ea|599', false)
ok(!(await db.getHiddenSubscriptions()).includes('ea|599'), 'unhide')

console.log(`subscriptions: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
