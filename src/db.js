// Data layer. Every function is async so the storage backend can be
// swapped for @capacitor-community/sqlite later without touching
// any screen code.
//
// Money is stored internally as integer cents (e.g. 1099 = €10.99),
// never as a float, so repeated summing across many transactions
// can't drift the way decimal floating-point addition can. Every
// exported function still accepts and returns plain decimal amounts
// (9.99, not 999) — the cents conversion happens at the read/write
// boundary inside this file, so nothing outside db.js needs to know
// about it or change.

import { localeFor } from './i18n.js'

const KEYS = {
  transactions: 'ft_transactions',
  categories: 'ft_categories',
  bills: 'ft_bills',
  currency: 'ft_currency',
  balances: 'ft_balances',
  language: 'ft_language',
  passcode: 'ft_passcode',
  payDay: 'ft_payday',
  onboarded: 'ft_onboarded',
  merchantMap: 'ft_merchant_map',
  a2hsDismissed: 'ft_a2hs_dismissed',
  schemaVersion: 'ft_schema_version'
}

const SCHEMA_VERSION = 2
const APP_VERSION = '2.1.0'

function load(key, fallback) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function toCents(value) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

function fromCents(cents) {
  if (cents == null) return cents
  return Math.round(cents) / 100
}

// One-time migration from decimal-float money storage (schema 1, every
// deploy before this one) to integer cents (schema 2). Runs once, the
// moment this module is first loaded, before any exported function can
// touch storage. Idempotent — does nothing once the version flag is set.
function migrateMoneyToCentsIfNeeded() {
  const currentVersion = parseInt(localStorage.getItem(KEYS.schemaVersion) || '1', 10)
  if (currentVersion >= SCHEMA_VERSION) return

  const txs = load(KEYS.transactions, null)
  let txSumBefore = 0
  if (txs) {
    txSumBefore = txs.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0)
    txs.forEach((t) => {
      if (typeof t.amount === 'number') t.amount = toCents(t.amount)
    })
    save(KEYS.transactions, txs)
  }

  const cats = load(KEYS.categories, null)
  if (cats) {
    cats.forEach((c) => {
      if (typeof c.monthlyBudget === 'number') c.monthlyBudget = toCents(c.monthlyBudget)
    })
    save(KEYS.categories, cats)
  }

  const bills = load(KEYS.bills, null)
  if (bills) {
    bills.forEach((b) => {
      if (typeof b.amount === 'number') b.amount = toCents(b.amount)
    })
    save(KEYS.bills, bills)
  }

  const balances = load(KEYS.balances, null)
  if (balances) {
    balances.forEach((a) => {
      (a.entries || []).forEach((e) => {
        if (typeof e.value === 'number') e.value = toCents(e.value)
      })
    })
    save(KEYS.balances, balances)
  }

  localStorage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION))

  // Verify: the migrated cents total, converted back to decimal, should
  // match the original decimal total to within a rounding tolerance of
  // half a cent per record. If not, something about this migration is
  // wrong — logged so it's visible in the console rather than silently
  // corrupting figures.
  if (txs && txs.length) {
    const txSumAfter = txs.reduce((sum, t) => sum + t.amount, 0) / 100
    const tolerance = 0.005 * txs.length
    if (Math.abs(txSumAfter - txSumBefore) > tolerance) {
      // eslint-disable-next-line no-console
      console.error(
        'Money migration total mismatch — before:',
        txSumBefore,
        'after:',
        txSumAfter
      )
    }
  }
}

migrateMoneyToCentsIfNeeded()

function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function currentMonthLocal() {
  return todayLocal().slice(0, 7)
}

// Pure integer arithmetic month shifting, mirroring the fix already
// applied on the frontend, so bill dates and trend lookups can't be
// thrown off by timezone conversion either.
function shiftMonthPrefix(monthPrefix, delta) {
  let [y, m] = monthPrefix.split('-').map(Number)
  m += delta
  while (m > 12) {
    m -= 12
    y += 1
  }
  while (m < 1) {
    m += 12
    y -= 1
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

function daysInMonth(monthPrefix) {
  const [y, m] = monthPrefix.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function clampDueDay(dueDay, monthPrefix) {
  return Math.min(dueDay, daysInMonth(monthPrefix))
}

export function todayLocalDate() {
  return todayLocal()
}

// Pay periods: instead of a plain calendar month, a "period" can start
// on any day of the month (the person's payday) and run to the day
// before that same day next month. Everything below works in pure
// UTC-constructed dates so it's immune to the local timezone pitfalls
// that caused an earlier bug — never mixed with local Date getters.
function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d))
}

// Banks typically settle a salary on the nearest working day before a
// payday that falls on a weekend, rather than the weekend date itself.
// Saturday shifts back one day, Sunday shifts back two, landing on the
// preceding Friday (possibly rolling into the previous month, which
// plain millisecond subtraction on a UTC Date handles correctly).
function adjustToWorkingDay(date) {
  const dow = date.getUTCDay() // 0 = Sunday, 6 = Saturday
  if (dow === 6) return new Date(date.getTime() - 86400000)
  if (dow === 0) return new Date(date.getTime() - 2 * 86400000)
  return date
}

// Pay rules. A rule is one of:
//   { type: 'day', day: 1-31 }          — a fixed day of the month (day <= 1
//                                         is the plain-calendar-months sentinel)
//   { type: 'lastWeekday', weekday: 0-6 } — e.g. the last Friday of the month
//   { type: 'lastWorkingDay' }           — the last Mon–Fri of the month
// Older installs stored a bare integer; normalization converts it on read,
// so nothing existing breaks and every helper below accepts either form.
export function normalizePayRule(raw) {
  if (raw && typeof raw === 'object') {
    if (raw.type === 'lastWeekday' && Number.isInteger(raw.weekday) && raw.weekday >= 0 && raw.weekday <= 6) {
      return { type: 'lastWeekday', weekday: raw.weekday }
    }
    if (raw.type === 'lastWorkingDay') return { type: 'lastWorkingDay' }
    if (raw.type === 'day') {
      const day = Math.min(31, Math.max(1, parseInt(raw.day, 10) || 1))
      return { type: 'day', day }
    }
    return { type: 'day', day: 1 }
  }
  const n = parseInt(raw, 10)
  return { type: 'day', day: Number.isNaN(n) ? 1 : Math.min(31, Math.max(1, n)) }
}

export function isCalendarRule(rule) {
  const r = normalizePayRule(rule)
  return r.type === 'day' && r.day <= 1
}

// The actual date a given month's payday lands on. Fixed-day rules are
// weekend-adjusted backward (a salary due on a weekend settles the Friday
// before); the day <= 1 sentinel is deliberately left unadjusted — the 1st
// of the month should never shift just because a plain calendar-month user
// happens to have a weekend at the start of a month. Weekday rules land on
// their weekday by construction and need no adjustment.
function actualPayDate(y, m, rule) {
  const r = normalizePayRule(rule)
  const monthKey = `${y}-${String(m).padStart(2, '0')}`
  const dim = daysInMonth(monthKey)
  if (r.type === 'lastWeekday') {
    let d = utcDate(y, m, dim)
    while (d.getUTCDay() !== r.weekday) d = new Date(d.getTime() - 86400000)
    return d
  }
  if (r.type === 'lastWorkingDay') {
    let d = utcDate(y, m, dim)
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - 86400000)
    return d
  }
  const day = Math.min(r.day, dim)
  const date = utcDate(y, m, day)
  return r.day <= 1 ? date : adjustToWorkingDay(date)
}

// The period identified by `periodKey` (e.g. '2026-07') starts on
// min(payDay, days in that month) of that month — moved to the
// nearest working day before if that lands on a weekend — and ends
// the day before the next period starts. With payDay=1 this is
// exactly a plain calendar month.
export function periodBounds(periodKey, payDay) {
  const [y, m] = periodKey.split('-').map(Number)
  const start = actualPayDate(y, m, payDay)
  const nextKey = shiftMonthPrefix(periodKey, 1)
  const [ny, nm] = nextKey.split('-').map(Number)
  const nextStart = actualPayDate(ny, nm, payDay)
  const end = new Date(nextStart.getTime() - 86400000)
  return { start, end }
}

export function inPeriod(dateStr, periodKey, payDay) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = utcDate(y, m, d).getTime()
  const { start, end } = periodBounds(periodKey, payDay)
  return target >= start.getTime() && target <= end.getTime()
}

// Which period key today falls inside, given a payday.
export function currentPeriodKey(payDay) {
  const [y, m, d] = todayLocal().split('-').map(Number)
  const thisMonthKey = `${y}-${String(m).padStart(2, '0')}`
  const todayTs = utcDate(y, m, d).getTime()
  const thisPayDate = actualPayDate(y, m, payDay)
  return todayTs >= thisPayDate.getTime() ? thisMonthKey : shiftMonthPrefix(thisMonthKey, -1)
}

// Localized period label. Dates here are UTC-constructed, so formatting
// pins timeZone: 'UTC' to avoid a local-offset day shift.
export function periodLabel(periodKey, payDay, lang = 'en') {
  const locale = localeFor(lang)
  if (isCalendarRule(payDay)) {
    const [y, m] = periodKey.split('-').map(Number)
    return utcDate(y, m, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  const { start, end } = periodBounds(periodKey, payDay)
  const label = (d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${label(start)} – ${label(end)} ${end.getUTCFullYear()}`
}

// Where a bill's due day actually falls within a given pay period. A
// period spans parts of two calendar months, so the due day has two
// candidate dates; the one inside the period's real bounds wins. With
// weekday rules ("last Friday") the anchor shifts month to month, and a
// due day can genuinely not occur inside a given period — then the date
// clamps to the nearer bound so a recorded payment always stays inside
// the period it belongs to (the old nominal-day comparison could book
// those payments into the wrong period).
export function billDateWithinPeriod(periodKey, payDay, dueDay) {
  const { start, end } = periodBounds(periodKey, payDay)
  const isoOf = (d) => d.toISOString().slice(0, 10)
  for (const k of [periodKey, shiftMonthPrefix(periodKey, 1)]) {
    const day = Math.min(dueDay, daysInMonth(k))
    const candidate = `${k}-${String(day).padStart(2, '0')}`
    if (inPeriod(candidate, periodKey, payDay)) return candidate
  }
  const ownDay = Math.min(dueDay, daysInMonth(periodKey))
  const [cy, cm] = periodKey.split('-').map(Number)
  const ownTs = utcDate(cy, cm, ownDay).getTime()
  return ownTs < start.getTime() ? isoOf(start) : isoOf(end)
}

// monthlyBudget is optional. A category with no budget is tracked but
// never flagged as over spent, and doesn't count toward the overall gauge.
// `archived` categories are hidden from pickers for new transactions but
// keep their name/icon/color so old transactions still display correctly,
// and can be restored later.
const defaultCategories = [
  { id: 'rent', name: 'Rent', icon: 'ti-home', monthlyBudget: null, accent: '#6FBFA0', tint: 'rgba(111, 191, 160, 0.16)', borderTint: 'rgba(111, 191, 160, 0.35)', kind: 'expense', archived: false },
  { id: 'fuel-insurance', name: 'Fuel & insurance', icon: 'ti-gas-station', monthlyBudget: null, accent: '#7C93D6', tint: 'rgba(124, 147, 214, 0.16)', borderTint: 'rgba(124, 147, 214, 0.35)', kind: 'expense', archived: false },
  { id: 'streaming', name: 'Streaming', icon: 'ti-device-tv', monthlyBudget: null, accent: '#B67CC9', tint: 'rgba(182, 124, 201, 0.16)', borderTint: 'rgba(182, 124, 201, 0.35)', kind: 'expense', archived: false },
  { id: 'utilities', name: 'Utilities', icon: 'ti-wifi', monthlyBudget: null, accent: '#8FA8C9', tint: 'rgba(143, 168, 201, 0.16)', borderTint: 'rgba(143, 168, 201, 0.35)', kind: 'expense', archived: false },
  { id: 'car-loan', name: 'Car loan', icon: 'ti-car', monthlyBudget: null, accent: '#D6935F', tint: 'rgba(214, 147, 95, 0.16)', borderTint: 'rgba(214, 147, 95, 0.35)', kind: 'expense', archived: false },
  { id: 'savings', name: 'Savings', icon: 'ti-pig-money', monthlyBudget: null, accent: '#6FA8BF', tint: 'rgba(111, 168, 191, 0.16)', borderTint: 'rgba(111, 168, 191, 0.35)', kind: 'expense', archived: false },
  { id: 'food', name: 'Food', icon: 'ti-tools-kitchen-2', monthlyBudget: null, accent: '#D6A57C', tint: 'rgba(214, 165, 124, 0.16)', borderTint: 'rgba(214, 165, 124, 0.35)', kind: 'expense', archived: false },
  { id: 'purchases', name: 'Purchases', icon: 'ti-shopping-bag', monthlyBudget: null, accent: '#9F8FD6', tint: 'rgba(159, 143, 214, 0.16)', borderTint: 'rgba(159, 143, 214, 0.35)', kind: 'expense', archived: false },
  { id: 'gifts', name: 'Gifts', icon: 'ti-gift', monthlyBudget: null, accent: '#D67CC0', tint: 'rgba(214, 124, 192, 0.16)', borderTint: 'rgba(214, 124, 192, 0.35)', kind: 'expense', archived: false },
  { id: 'holidays', name: 'Holidays', icon: 'ti-plane', monthlyBudget: null, accent: '#7CC9B0', tint: 'rgba(124, 201, 176, 0.16)', borderTint: 'rgba(124, 201, 176, 0.35)', kind: 'expense', archived: false },
  { id: 'health', name: 'Health', icon: 'ti-heart', monthlyBudget: null, accent: '#D67C7C', tint: 'rgba(214, 124, 124, 0.16)', borderTint: 'rgba(214, 124, 124, 0.35)', kind: 'expense', archived: false },
  { id: 'other', name: 'Other / misc', icon: 'ti-receipt', monthlyBudget: null, accent: '#9A9EA6', tint: 'rgba(154, 158, 166, 0.16)', borderTint: 'rgba(154, 158, 166, 0.35)', kind: 'expense', archived: false },
  { id: 'wages', name: 'Wages', icon: 'ti-briefcase', monthlyBudget: null, accent: '#8FDBB5', tint: 'rgba(143, 219, 181, 0.16)', borderTint: 'rgba(143, 219, 181, 0.35)', kind: 'income', archived: false },
  { id: 'overtime', name: 'Overtime', icon: 'ti-clock', monthlyBudget: null, accent: '#F0D190', tint: 'rgba(240, 209, 144, 0.16)', borderTint: 'rgba(240, 209, 144, 0.35)', kind: 'income', archived: false },
  { id: 'other-income', name: 'Other income', icon: 'ti-cash', monthlyBudget: null, accent: '#8FA8C9', tint: 'rgba(143, 168, 201, 0.16)', borderTint: 'rgba(143, 168, 201, 0.35)', kind: 'income', archived: false }
]

const iconChoices = [
  'ti-home', 'ti-car', 'ti-gas-station', 'ti-device-tv', 'ti-wifi', 'ti-pig-money',
  'ti-tools-kitchen-2', 'ti-shopping-bag', 'ti-gift', 'ti-plane', 'ti-heart',
  'ti-receipt', 'ti-credit-card', 'ti-briefcase', 'ti-paw', 'ti-book', 'ti-tag',
  'ti-clock', 'ti-cash'
]

const accentPalette = [
  { accent: '#6FBFA0', tint: 'rgba(111, 191, 160, 0.16)', borderTint: 'rgba(111, 191, 160, 0.35)' },
  { accent: '#7C93D6', tint: 'rgba(124, 147, 214, 0.16)', borderTint: 'rgba(124, 147, 214, 0.35)' },
  { accent: '#B67CC9', tint: 'rgba(182, 124, 201, 0.16)', borderTint: 'rgba(182, 124, 201, 0.35)' },
  { accent: '#8FA8C9', tint: 'rgba(143, 168, 201, 0.16)', borderTint: 'rgba(143, 168, 201, 0.35)' },
  { accent: '#D6935F', tint: 'rgba(214, 147, 95, 0.16)', borderTint: 'rgba(214, 147, 95, 0.35)' },
  { accent: '#6FA8BF', tint: 'rgba(111, 168, 191, 0.16)', borderTint: 'rgba(111, 168, 191, 0.35)' },
  { accent: '#D6A57C', tint: 'rgba(214, 165, 124, 0.16)', borderTint: 'rgba(214, 165, 124, 0.35)' },
  { accent: '#9F8FD6', tint: 'rgba(159, 143, 214, 0.16)', borderTint: 'rgba(159, 143, 214, 0.35)' },
  { accent: '#D67CC0', tint: 'rgba(214, 124, 192, 0.16)', borderTint: 'rgba(214, 124, 192, 0.35)' },
  { accent: '#7CC9B0', tint: 'rgba(124, 201, 176, 0.16)', borderTint: 'rgba(124, 201, 176, 0.35)' },
  { accent: '#D67C7C', tint: 'rgba(214, 124, 124, 0.16)', borderTint: 'rgba(214, 124, 124, 0.35)' },
  { accent: '#9A9EA6', tint: 'rgba(154, 158, 166, 0.16)', borderTint: 'rgba(154, 158, 166, 0.35)' },
]

export const iconOptions = iconChoices

export const currencyOptions = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' }
]

function id() {
  return Math.random().toString(36).slice(2, 10)
}

export async function getCurrency() {
  return load(KEYS.currency, currencyOptions[0])
}

export async function setCurrency(currency) {
  save(KEYS.currency, currency)
  return currency
}

export async function getLanguage() {
  return load(KEYS.language, 'en')
}

export async function setLanguage(lang) {
  save(KEYS.language, lang)
  return lang
}

export async function getPasscode() {
  return load(KEYS.passcode, null)
}

export async function setPasscode(code) {
  save(KEYS.passcode, code)
  return code
}

export async function clearPasscode() {
  localStorage.removeItem(KEYS.passcode)
}

export async function getPayDay() {
  return normalizePayRule(load(KEYS.payDay, 1))
}

export async function setPayDay(dayOrRule) {
  const rule = normalizePayRule(dayOrRule)
  save(KEYS.payDay, rule)
  return rule
}

// Onboarding only runs on a genuinely fresh install — if any storage
// key already exists (an existing user updating to a newer version),
// it's skipped automatically so nobody who's already using the app
// gets interrupted by a first-run wizard.
export async function isFirstRun() {
  // The schema-version flag gets set by the money migration on every
  // load, including a genuinely fresh install with nothing to convert,
  // so it doesn't count as evidence of prior real use.
  const anyExisting = Object.values(KEYS)
    .filter((k) => k !== KEYS.schemaVersion)
    .some((k) => localStorage.getItem(k) !== null)
  if (anyExisting) return false
  return true
}

export async function completeOnboarding() {
  save(KEYS.onboarded, true)
}

export async function getA2HSDismissed() {
  return load(KEYS.a2hsDismissed, false)
}

export async function dismissA2HS() {
  save(KEYS.a2hsDismissed, true)
}

// --- Learned merchants -------------------------------------------------
// Which category the person actually filed a given shop under. Written
// when a scanned receipt is confirmed, so the next receipt from that shop
// is already right. Stays on the device like everything else.

function merchantKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export async function getMerchantMap() {
  return load(KEYS.merchantMap, {})
}

export async function rememberMerchantCategory(name, categoryId) {
  const key = merchantKey(name)
  if (!key || key.length < 3 || !categoryId) return
  const map = load(KEYS.merchantMap, {})
  map[key] = categoryId
  save(KEYS.merchantMap, map)
}

export function lookupMerchantCategory(map, name) {
  const key = merchantKey(name)
  if (!key || !map) return null
  if (map[key]) return map[key]
  // A remembered shop still matches when OCR adds or drops a word
  // ("Tesco" vs "Tesco Ireland").
  const words = key.split(' ').filter((w) => w.length >= 4)
  for (const [k, v] of Object.entries(map)) {
    const kw = k.split(' ').filter((w) => w.length >= 4)
    if (!kw.length || !words.length) continue
    if (kw.every((w) => words.includes(w)) || words.every((w) => kw.includes(w))) return v
  }
  return null
}

// --- Categories -------------------------------------------------------

function loadCategoriesRaw() {
  return load(KEYS.categories, defaultCategories)
}

function toDisplayCategory(c) {
  return { ...c, monthlyBudget: c.monthlyBudget == null ? null : fromCents(c.monthlyBudget) }
}

export async function getCategories() {
  return loadCategoriesRaw().map(toDisplayCategory)
}

export async function addCategory({ name, icon, kind }) {
  const categories = loadCategoriesRaw()
  const palette = accentPalette[categories.length % accentPalette.length]
  const record = {
    id: id(),
    name,
    icon: icon || 'ti-tag',
    monthlyBudget: null,
    kind: kind || 'expense',
    archived: false,
    ...palette
  }
  categories.push(record)
  save(KEYS.categories, categories)
  return toDisplayCategory(record)
}

export async function updateCategory(categoryId, updates) {
  const categories = loadCategoriesRaw()
  const cat = categories.find((c) => c.id === categoryId)
  if (!cat) return null
  const finalUpdates = { ...updates }
  if ('monthlyBudget' in finalUpdates) {
    finalUpdates.monthlyBudget = finalUpdates.monthlyBudget == null ? null : toCents(finalUpdates.monthlyBudget)
  }
  Object.assign(cat, finalUpdates)
  save(KEYS.categories, categories)
  return toDisplayCategory(cat)
}

// Archives a category instead of deleting it outright: it disappears
// from pickers for new transactions, but keeps its name/icon/color so
// existing transactions that reference it still display correctly, and
// it can be brought back with restoreCategory.
export async function deleteCategory(categoryId) {
  const categories = loadCategoriesRaw()
  const cat = categories.find((c) => c.id === categoryId)
  if (!cat) return
  cat.archived = true
  save(KEYS.categories, categories)
}

export async function restoreCategory(categoryId) {
  const categories = loadCategoriesRaw()
  const cat = categories.find((c) => c.id === categoryId)
  if (!cat) return null
  cat.archived = false
  save(KEYS.categories, categories)
  return toDisplayCategory(cat)
}

// --- Transactions -------------------------------------------------------

function loadTransactionsRaw() {
  return load(KEYS.transactions, [])
}

function toDisplayTransaction(t) {
  return { ...t, amount: fromCents(t.amount) }
}

export async function getTransactions() {
  const list = loadTransactionsRaw()
  return list.map(toDisplayTransaction).sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function addTransaction(tx) {
  const list = loadTransactionsRaw()
  const record = { id: id(), ...tx, amount: toCents(tx.amount) }
  list.push(record)
  save(KEYS.transactions, list)
  return toDisplayTransaction(record)
}

// Bulk import: adds a batch of transactions on top of what's already
// there, rather than replacing anything, so a bank statement or
// screenshot batch can be merged in safely.
export async function importTransactions(list) {
  const existing = loadTransactionsRaw()
  const added = list.map((t) => ({ id: id(), ...t, amount: toCents(t.amount) }))
  save(KEYS.transactions, [...existing, ...added])
  return added.length
}

// A normalized fingerprint (date + amount + note, case/space-insensitive)
// used to flag likely duplicates before a bulk import actually commits.
function transactionFingerprint(t) {
  const amount = typeof t.amount === 'number' ? t.amount.toFixed(2) : parseFloat(t.amount || 0).toFixed(2)
  const note = (t.note || '').trim().toLowerCase().replace(/\s+/g, ' ')
  return `${t.date}|${amount}|${note}`
}

// Checks a candidate batch of transactions (decimal amounts, as they'd
// come from an import file) against what's already stored, and marks
// each one as a likely duplicate or not. Never removes or blocks
// anything itself — just reports, so the person can choose to skip or
// deliberately keep legitimate duplicates (e.g. two identical coffees).
export async function findImportDuplicates(list) {
  const existing = await getTransactions()
  const existingFingerprints = new Set(existing.map(transactionFingerprint))
  return list.map((t) => ({ ...t, isDuplicate: existingFingerprints.has(transactionFingerprint(t)) }))
}

export async function updateTransaction(txId, updates) {
  const list = loadTransactionsRaw()
  const tx = list.find((t) => t.id === txId)
  if (!tx) return null
  const finalUpdates = { ...updates }
  if ('amount' in finalUpdates && finalUpdates.amount != null) {
    finalUpdates.amount = toCents(finalUpdates.amount)
  }
  Object.assign(tx, finalUpdates)
  save(KEYS.transactions, list)
  return toDisplayTransaction(tx)
}

export async function deleteTransaction(txId) {
  const list = loadTransactionsRaw()
  save(
    KEYS.transactions,
    list.filter((t) => t.id !== txId)
  )
}

// --- Bills -------------------------------------------------------

// Bills are recurring fixed expenses: a bill has one due day of the
// month, and a separate paid/unpaid status per calendar month, so
// paying August's rent doesn't mark September's rent as paid too.
function migrateBill(bill) {
  if (bill.payments) return bill
  // Convert an older one-off-style bill record into the recurring shape.
  const dueDay = bill.dueDate ? parseInt(bill.dueDate.split('-')[2], 10) : 1
  const payments = {}
  if (bill.status === 'paid' && bill.paidDate) {
    payments[bill.paidDate.slice(0, 7)] = { paidDate: bill.paidDate, transactionId: bill.transactionId }
  }
  return {
    id: bill.id,
    name: bill.name,
    amount: bill.amount,
    categoryId: bill.categoryId,
    dueDay,
    payments
  }
}

function loadBillsRaw() {
  const raw = load(KEYS.bills, [])
  const migrated = raw.map(migrateBill)
  const changed = JSON.stringify(raw) !== JSON.stringify(migrated)
  if (changed) save(KEYS.bills, migrated)
  return migrated
}

function toDisplayBill(b) {
  return { ...b, amount: fromCents(b.amount) }
}

export async function getBills() {
  return loadBillsRaw().map(toDisplayBill)
}

export async function addBill({ name, amount, categoryId, dueDay }) {
  const list = loadBillsRaw()
  const record = {
    id: id(),
    name,
    amount: toCents(amount),
    categoryId,
    dueDay: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)),
    payments: {}
  }
  list.push(record)
  save(KEYS.bills, list)
  return toDisplayBill(record)
}

export async function deleteBill(billId) {
  const list = loadBillsRaw()
  save(
    KEYS.bills,
    list.filter((b) => b.id !== billId)
  )
}

export async function markBillPaid(billId, monthPrefix) {
  const bills = loadBillsRaw()
  const bill = bills.find((b) => b.id === billId)
  if (!bill) return null

  const payDay = await getPayDay()
  const isCurrentPeriod = monthPrefix === currentPeriodKey(payDay)
  const paidDate = isCurrentPeriod ? todayLocal() : billDateWithinPeriod(monthPrefix, payDay, bill.dueDay)

  const record = await addTransaction({
    amount: fromCents(bill.amount),
    categoryId: bill.categoryId,
    date: paidDate,
    note: bill.name,
    type: 'expense',
    source: 'bill'
  })

  bill.payments[monthPrefix] = { paidDate, transactionId: record.id }
  save(KEYS.bills, bills)

  return toDisplayBill(bill)
}

export async function markBillUnpaid(billId, monthPrefix) {
  const bills = loadBillsRaw()
  const bill = bills.find((b) => b.id === billId)
  if (!bill) return null
  const payment = bill.payments[monthPrefix]
  if (payment?.transactionId) {
    await deleteTransaction(payment.transactionId)
  }
  delete bill.payments[monthPrefix]
  save(KEYS.bills, bills)
  return toDisplayBill(bill)
}

// --- Summaries -------------------------------------------------------
// All internal arithmetic here runs in integer cents; only the final
// numbers handed back to the UI are converted to decimal, so summing
// dozens of transactions can't accumulate float rounding drift.

export async function getMonthSummary(monthPrefix, payDayOverride) {
  const payDay = payDayOverride ?? (await getPayDay())
  const periodKey = monthPrefix || currentPeriodKey(payDay)
  const transactions = loadTransactionsRaw()
  const categories = loadCategoriesRaw()
  const inMonth = transactions.filter((t) => inPeriod(t.date, periodKey, payDay))
  const prevMonthPrefix = shiftMonthPrefix(periodKey, -1)
  const inPrevMonth = transactions.filter((t) => inPeriod(t.date, prevMonthPrefix, payDay))

  const spentCents = inMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const incomeCents = inMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)

  const catSpentInCents = (list, categoryId) =>
    list.filter((t) => t.type === 'expense' && t.categoryId === categoryId).reduce((sum, t) => sum + t.amount, 0)

  // Rollover: a category can carry an underspent amount from last month
  // into this month's effective budget, one month back only.
  const effectiveBudgetCents = (c) => {
    if (c.monthlyBudget == null) return null
    if (!c.rollover) return c.monthlyBudget
    const prevSpentCents = catSpentInCents(inPrevMonth, c.id)
    const leftover = Math.max(0, c.monthlyBudget - prevSpentCents)
    return c.monthlyBudget + leftover
  }

  const budgeted = categories.filter((c) => c.kind !== 'income' && c.monthlyBudget != null)
  const budgetCents = budgeted.length
    ? budgeted.reduce((sum, c) => sum + effectiveBudgetCents(c), 0)
    : incomeCents

  const byCategory = categories
    .filter((c) => c.kind !== 'income')
    .map((c) => {
      const catSpentCents = catSpentInCents(inMonth, c.id)
      const prevSpentCents = catSpentInCents(inPrevMonth, c.id)
      const effBudgetCents = effectiveBudgetCents(c)
      return {
        ...c,
        monthlyBudget: c.monthlyBudget == null ? null : fromCents(c.monthlyBudget),
        spent: fromCents(catSpentCents),
        prevSpent: fromCents(prevSpentCents),
        effectiveBudget: effBudgetCents == null ? null : fromCents(effBudgetCents),
        _spentCents: catSpentCents
      }
    })
    // Archived categories drop out of the list once they have no spend
    // left in this period, so they don't clutter the dashboard forever —
    // but stay visible for any period where they still have real history.
    .filter((c) => !c.archived || c._spentCents > 0)
    .map(({ _spentCents, ...rest }) => rest)

  return {
    spent: fromCents(spentCents),
    income: fromCents(incomeCents),
    budget: fromCents(budgetCents),
    left: fromCents(incomeCents - spentCents),
    byCategory
  }
}

// Total expense spend per month for the last `count` months (including
// the given month), oldest first, for a simple trend chart.
export async function getRecentMonthTotals(monthPrefix, count = 3, payDayOverride) {
  const payDay = payDayOverride ?? (await getPayDay())
  const periodKey = monthPrefix || currentPeriodKey(payDay)
  const transactions = loadTransactionsRaw()
  const months = []
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonthPrefix(periodKey, -i))
  }
  return months.map((m) => {
    const inThisPeriod = transactions.filter((t) => inPeriod(t.date, m, payDay))
    const totalCents = inThisPeriod.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const incomeCents = inThisPeriod.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    return { month: m, total: fromCents(totalCents), income: fromCents(incomeCents) }
  })
}

// --- Balances -------------------------------------------------------
// Named accounts (debts, savings pots, or money owed to you) with a
// history of dated entries, so a running total can be tracked over
// time, the same way the spreadsheet tracks car loan and credit union
// balances.

function loadBalancesRaw() {
  return load(KEYS.balances, [])
}

function toDisplayBalanceAccount(a) {
  return { ...a, entries: a.entries.map((e) => ({ ...e, value: fromCents(e.value) })) }
}

export async function getBalances() {
  return loadBalancesRaw().map(toDisplayBalanceAccount)
}

export async function addBalanceAccount({ name, type, icon, openingValue, date }) {
  const accounts = loadBalancesRaw()
  const palette = accentPalette[accounts.length % accentPalette.length]
  const defaultIcon = type === 'debt' ? 'ti-credit-card' : type === 'owed' ? 'ti-user' : 'ti-pig-money'
  const record = {
    id: id(),
    name,
    type, // 'debt' | 'savings' | 'owed'
    icon: icon || defaultIcon,
    ...palette,
    entries: [{ date: date || todayLocal(), value: toCents(openingValue) }]
  }
  accounts.push(record)
  save(KEYS.balances, accounts)
  return toDisplayBalanceAccount(record)
}

export async function addBalanceEntry(accountId, { date, value }) {
  const accounts = loadBalancesRaw()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return null
  account.entries.push({ date, value: toCents(value) })
  save(KEYS.balances, accounts)
  return toDisplayBalanceAccount(account)
}

export async function deleteBalanceAccount(accountId) {
  const accounts = loadBalancesRaw()
  save(
    KEYS.balances,
    accounts.filter((a) => a.id !== accountId)
  )
}

// Sorted most-recent-first. When two entries share the same date (e.g.
// two updates logged the same day), the one added later in the array
// is the more recent one, so ties break on original position, not just
// the date string.
function sortedEntries(account) {
  return account.entries
    .map((e, i) => ({ ...e, _i: i }))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b._i - a._i)
}

export function latestEntry(account) {
  return sortedEntries(account)[0]
}

export function previousEntry(account) {
  return sortedEntries(account)[1]
}

// --- Backup and restore -------------------------------------------------------
// Exports every stored key as one JSON file the person can save, and
// restores it wholesale on another device or after clearing browser
// data. Every export is tagged with a schema version, export date, and
// app version, so a restore of an older backup (still in decimal money
// format, from before this version) is detected and converted rather
// than silently corrupting figures.

export async function exportBackup() {
  const data = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString()
  }
  for (const key of Object.values(KEYS)) {
    const raw = localStorage.getItem(key)
    if (raw) data[key] = JSON.parse(raw)
  }
  return data
}

// A human-readable summary of what a backup file contains, for showing
// a preview before actually restoring anything.
export function summarizeBackup(data) {
  const issues = []
  if (!data || typeof data !== 'object') {
    return { issues: ['backupNotGild'], valid: false }
  }
  const version = data.schemaVersion || 1
  const hasAnyData = Object.values(KEYS).some((k) => data[k] !== undefined)
  if (!hasAnyData) {
    // Nothing to restore, so notes about conversion would only confuse.
    return { valid: false, version, exportedAt: data.exportedAt || null, appVersion: data.appVersion || null, issues: ['backupNoData'] }
  }
  if (!data.schemaVersion) {
    issues.push('backupOlderVersion')
  }
  if (version > SCHEMA_VERSION) {
    issues.push('backupNewerVersion')
  }
  return {
    valid: hasAnyData,
    version,
    exportedAt: data.exportedAt || null,
    appVersion: data.appVersion || null,
    transactions: (data[KEYS.transactions] || []).length,
    categories: (data[KEYS.categories] || []).length,
    bills: (data[KEYS.bills] || []).length,
    balances: (data[KEYS.balances] || []).length,
    currency: data[KEYS.currency]?.code || null,
    language: data[KEYS.language] || null,
    issues
  }
}

export async function importBackup(data) {
  const importedVersion = data.schemaVersion || 1
  const payload = { ...data }
  delete payload.schemaVersion
  delete payload.appVersion
  delete payload.exportedAt

  if (importedVersion < SCHEMA_VERSION) {
    // The backup predates the cents migration — its money fields are
    // still plain decimals, so convert them the same way a first
    // load of old data would.
    if (payload[KEYS.transactions]) {
      payload[KEYS.transactions].forEach((t) => {
        if (typeof t.amount === 'number') t.amount = toCents(t.amount)
      })
    }
    if (payload[KEYS.categories]) {
      payload[KEYS.categories].forEach((c) => {
        if (typeof c.monthlyBudget === 'number') c.monthlyBudget = toCents(c.monthlyBudget)
      })
    }
    if (payload[KEYS.bills]) {
      payload[KEYS.bills].forEach((b) => {
        if (typeof b.amount === 'number') b.amount = toCents(b.amount)
      })
    }
    if (payload[KEYS.balances]) {
      payload[KEYS.balances].forEach((a) => {
        (a.entries || []).forEach((e) => {
          if (typeof e.value === 'number') e.value = toCents(e.value)
        })
      })
    }
  }

  for (const key of Object.values(KEYS)) {
    if (payload[key] !== undefined) {
      save(key, payload[key])
    }
  }
  localStorage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION))
}
