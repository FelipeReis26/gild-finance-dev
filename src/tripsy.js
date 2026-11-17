// Tripsy link: reads your trips (costs paid, booked and still to book)
// from the Tripsy trip planner, so a trip's savings goal follows the real
// numbers. Read-only: Gild never sends anything to Tripsy. The access key is
// kept on this device only (not in backups, not in the code).
export const TRIPSY_URL = 'https://tripsyapp.vercel.app/api/trips-summary'
export const TRIPSY_TRIP_URL = (slug) => `https://tripsyapp.vercel.app/trips/${encodeURIComponent(slug)}.html`
const TOKEN_KEY = 'ft_tripsy_token' // ft_ so the device copy keeps it; not a backup key
const MAX_AGE_MS = 60 * 60 * 1000

export function getTripsyToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setTripsyToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token.trim())
  else localStorage.removeItem(TOKEN_KEY)
}

export class TripsyError extends Error {
  constructor(kind, message) {
    super(message || kind)
    this.kind = kind // 'auth' | 'network' | 'format'
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// Checks the feed's shape and keeps only what Gild uses.
export function normaliseFeed(json) {
  if (!json || json.version !== 1 || !Array.isArray(json.trips)) throw new TripsyError('format', 'Unexpected Tripsy feed')
  return json.trips
    .filter((t) => t && typeof t.slug === 'string')
    .map((t) => ({
      slug: t.slug,
      name: String(t.name || t.slug),
      flag: typeof t.flag === 'string' ? t.flag : '',
      start: t.start || null,
      end: t.end || null,
      currency: t.currency || 'EUR',
      url: typeof t.url === 'string' ? t.url : null,
      split: num(t.split) ?? 1,
      paid: num(t.paid) ?? 0,
      paidItems: Array.isArray(t.paidItems) ? t.paidItems.map((p) => ({ label: String(p.label || ''), amount: num(p.amount) ?? 0 })) : [],
      booked: Array.isArray(t.booked)
        ? t.booked.map((b) => ({ label: String(b.label || ''), amount: num(b.amount) ?? 0, dueMonth: b.dueMonth || null }))
        : [],
      toBook: Array.isArray(t.toBook)
        ? t.toBook.map((b) => ({ label: String(b.label || ''), low: num(b.low), high: num(b.high), likely: num(b.likely), expectedMonth: b.expectedMonth || null }))
        : [],
      otherCurrency: Array.isArray(t.otherCurrency) ? t.otherCurrency.map((o) => ({ label: String(o.label || ''), amount: num(o.amount) ?? 0, currency: o.currency || '' })) : []
    }))
}

export async function fetchTrips(token, fetchImpl = globalThis.fetch) {
  let res
  try {
    res = await fetchImpl(TRIPSY_URL, { headers: { Authorization: `Bearer ${token}` } })
  } catch (err) {
    throw new TripsyError('network', err?.message)
  }
  if (res.status === 401 || res.status === 403) throw new TripsyError('auth')
  if (!res.ok) throw new TripsyError('network', `HTTP ${res.status}`)
  let json
  try {
    json = await res.json()
  } catch {
    throw new TripsyError('format')
  }
  return normaliseFeed(json)
}

const round2 = (v) => Math.round(v * 100) / 100
// The figure used for something not booked yet: Tripsy's "likely" if it
// gives one, else the middle of the range, else whichever end is known.
export const estimate = (b) => b.likely ?? (b.low != null && b.high != null ? (b.low + b.high) / 2 : b.low ?? b.high ?? 0)

// One trip from your side: your share of what's paid, booked and still to
// book, and what he still has to find (booked + still to book, his share).
export function tripShare(trip) {
  const s = trip.split ?? 1
  const toBook = trip.toBook.map((b) => ({
    ...b,
    estimate: estimate(b),
    mine: round2(estimate(b) * s),
    mineLow: round2((b.low ?? estimate(b)) * s),
    mineHigh: round2((b.high ?? estimate(b)) * s)
  }))
  const booked = trip.booked.reduce((sum, b) => sum + b.amount, 0)
  const toBookEst = toBook.reduce((sum, b) => sum + b.estimate, 0)
  const toBookLow = trip.toBook.reduce((sum, b) => sum + (b.low ?? estimate(b)), 0)
  const toBookHigh = trip.toBook.reduce((sum, b) => sum + (b.high ?? estimate(b)), 0)
  return {
    split: s,
    paid: trip.paid,
    myPaid: round2(trip.paid * s),
    booked,
    myBooked: round2(booked * s),
    toBook,
    remaining: round2((booked + toBookEst) * s),
    remainingLow: round2((booked + toBookLow) * s),
    remainingHigh: round2((booked + toBookHigh) * s)
  }
}

export const isStale = (fetchedAt, now = Date.now()) => !fetchedAt || now - Date.parse(fetchedAt) > MAX_AGE_MS
