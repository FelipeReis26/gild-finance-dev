// Tripsy link: the feed is checked and trimmed, the owner's share of a trip is
// worked out (paid, booked, still to book), a goal that follows a trip takes
// its target from it, and the access key never ends up in a backup.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
const tr = await import('../src/tripsy.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
const near = (a, b) => Math.abs(a - b) < 0.005

const feed = {
  version: 1,
  trips: [
    {
      slug: 'trip-a', name: 'Trip A', flag: '🏖️', start: '2027-03-03', end: '2027-03-26', currency: 'EUR', url: 'https://example.test/a', split: 0.5,
      paid: 800, paidItems: [{ label: 'Flights out', amount: 800 }],
      booked: [{ label: 'Hotel 1', amount: 414, dueMonth: '2027-03' }, { label: 'Hotel 2', amount: 886, dueMonth: '2027-03' }],
      toBook: [
        { label: 'Flight home', low: 1106, high: 1183, expectedMonth: '2026-11' },
        { label: 'Nights', low: 520, high: 1120, expectedMonth: '2027-03' },
        { label: 'Car', low: 450, high: 800 },
        { label: 'Transfer', low: 0, high: 65 },
        { label: 'Spending', low: 1380, high: 2760, likely: 2070 },
        { label: 'Unpriced', low: null, high: null }
      ],
      secret: 'not kept'
    },
    { slug: 'trip-b', name: 'Trip B', split: 0.25, paid: 4000, booked: [], toBook: [] },
    { name: 'no slug' }
  ]
}
const trips = tr.normaliseFeed(feed)
ok(trips.length === 2 && !('secret' in trips[0]), 'feed trimmed to what Gild uses')
let threw = null
try { tr.normaliseFeed({ version: 2, trips: [] }) } catch (e) { threw = e }
ok(threw && threw.kind === 'format', 'unknown version refused')

const a = tr.tripShare(trips[0])
ok(near(a.myPaid, 400) && a.booked === 1300 && a.myBooked === 650, `paid and booked shares (${a.myPaid}, ${a.myBooked})`)
ok(near(a.remaining, 2996), `still to pay, his half: 1,300 + estimates (${a.remaining})`)
ok(near(a.remainingLow, 2378) && near(a.remainingHigh, 3614), `range (${a.remainingLow}–${a.remainingHigh})`)
ok(a.toBook.find((b) => b.label === 'Spending').mine === 1035, 'likely beats the middle of the range')
ok(a.toBook.find((b) => b.label === 'Unpriced').estimate === 0, 'an unpriced item counts as nothing yet')
const b = tr.tripShare(trips[1])
ok(b.myPaid === 1000 && b.remaining === 0, 'a paid package, his quarter')

// fetching
const fakeFetch = (status, body) => async (url, opts) => {
  fakeFetch.last = { url, auth: opts?.headers?.Authorization }
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}
const got = await tr.fetchTrips('k3y', fakeFetch(200, feed))
ok(got.length === 2 && fakeFetch.last.auth === 'Bearer k3y' && fakeFetch.last.url === tr.TRIPSY_URL, 'reads the feed with the key')
for (const [status, kind] of [[401, 'auth'], [500, 'network']]) {
  let e = null
  try { await tr.fetchTrips('k', fakeFetch(status, {})) } catch (err) { e = err }
  ok(e && e.kind === kind, `${status} → ${kind}`)
}
let net = null
try { await tr.fetchTrips('k', async () => { throw new Error('offline') }) } catch (e) { net = e }
ok(net && net.kind === 'network', 'offline → network')

ok(tr.isStale(null) && !tr.isStale(new Date().toISOString()) && tr.isStale(new Date(Date.now() - 2 * 3600e3).toISOString()), 'refresh at most hourly')

// a goal following a trip
await db.importBackup({ schemaVersion: 2, ft_balances: [{ id: 'pot', name: 'Pot', type: 'savings', entries: [{ date: '2026-11-19', value: 82024 }], goal: { target: 296000, by: '2027-02-19' } }] })
await db.linkGoalToTrip('pot', 'trip-a')
const changed = await db.syncTripGoals(trips, (t) => tr.tripShare(t).remaining)
let pot = (await db.getBalances())[0]
ok(changed === 1 && pot.goal.target === 2996 && pot.goal.tripSlug === 'trip-a', `goal target follows the trip (${pot.goal.target})`)
await db.setBalanceGoal('pot', { target: 3000, by: '2027-02-19' })
pot = (await db.getBalances())[0]
ok(pot.goal.tripSlug === 'trip-a', 'editing the goal keeps its trip')
await db.linkGoalToTrip('pot', null)
ok(!(await db.getBalances())[0].goal.tripSlug, 'unlink')

// the key stays out of backups
tr.setTripsyToken('super-secret-key')
await db.saveTripsyCache(trips)
const backup = JSON.stringify(await db.exportBackup())
ok(!backup.includes('super-secret-key') && backup.includes('trip-a'), 'backup has the trips but never the key')
ok(tr.getTripsyToken() === 'super-secret-key', 'key kept on the device')
tr.setTripsyToken('')
ok(tr.getTripsyToken() === '', 'disconnect clears it')

console.log(`tripsy: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
