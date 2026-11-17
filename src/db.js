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
  cash: 'ft_cash',
  accounts: 'ft_accounts',
  a2hsDismissed: 'ft_a2hs_dismissed',
  hiddenSubscriptions: 'ft_hidden_subscriptions',
  reminders: 'ft_reminders',
  plans: 'ft_plans',
  tripsy: 'ft_tripsy',
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

// --- Running cash balance ---------------------------------------------
// An anchor (a balance you know was true on a date) plus every transaction
// since. Reconciling re-anchors it to the real figure, so drift is
// correctable rather than permanent: the app can only be as right as what
// has been logged, and the anchor is how you tell it the truth again.

// --- Accounts ---------------------------------------------------------
// A cash figure only means something against ONE real account. Felipe banks
// through two (a current account and Revolut), so a single combined
// balance could never tie out to either statement — it summed both plus
// anything untagged.
//
// Each account therefore carries its own anchor: a figure he knows was true on
// a date, and a running total from the transactions belonging to that account
// alone.
//
// Note what does NOT apply here: the exclude-from-totals / transfer rule.
// That exists so moving money between his own accounts does not read as
// spending on the budget dashboard. But a top-up genuinely left the current account and
// genuinely arrived in Revolut, so for cash it must count on both sides.

const DEFAULT_ACCOUNTS = [
  { id: 'main', name: 'Current account', primary: true },
  { id: 'revolut', name: 'Revolut' },
  // Revolut's Flexible Cash Funds vault. Money swept into it has left the
  // Revolut current account but is still his, so it gets its own figure.
  { id: 'revolut-savings', name: 'Revolut Savings' }
]

function loadAccountsRaw() {
  const raw = load(KEYS.accounts, null)
  if (raw && raw.length) return raw
  const seeded = DEFAULT_ACCOUNTS.map((a) => ({ ...a, anchor: null }))
  save(KEYS.accounts, seeded)
  return seeded
}

const toDisplayAccount = (a) => ({
  ...a,
  anchor: a.anchor ? { ...a.anchor, openingValue: fromCents(a.anchor.openingValue || 0) } : null
})

export async function getAccounts() {
  return loadAccountsRaw().map(toDisplayAccount)
}

export function primaryAccountId(accounts) {
  const list = accounts || []
  return (list.find((a) => a.primary) || list[0])?.id || 'main'
}

// Which account a transaction belongs to. Rows written before accounts
// existed have no accountId and are treated as the primary account, which is
// where his salary lands and most things leave from.
export function accountOf(tx, accounts) {
  const list = accounts || []
  // An account that has since been deleted hands its rows to the primary
  // account rather than leaving them attributed to something that no longer
  // exists — which would make them vanish from every balance.
  if (tx?.accountId && list.some((a) => a.id === tx.accountId)) return tx.accountId
  return primaryAccountId(list)
}

export async function addAccount({ name }) {
  const accounts = loadAccountsRaw()
  const record = { id: id(), name: (name || '').trim() || 'Account', anchor: null }
  accounts.push(record)
  save(KEYS.accounts, accounts)
  return toDisplayAccount(record)
}

export async function updateAccount(accountId, updates) {
  const accounts = loadAccountsRaw()
  const acct = accounts.find((a) => a.id === accountId)
  if (!acct) return null
  const next = { ...updates }
  if ('anchor' in next) {
    next.anchor = next.anchor
      ? {
          enabled: Boolean(next.anchor.enabled),
          openingValue: toCents(next.anchor.openingValue || 0),
          openingDate: next.anchor.openingDate || todayLocal()
        }
      : null
  }
  Object.assign(acct, next)
  save(KEYS.accounts, accounts)
  return toDisplayAccount(acct)
}

export async function deleteAccount(accountId) {
  const accounts = loadAccountsRaw()
  if (accounts.length <= 1) return null          // never leave zero accounts
  const remaining = accounts.filter((a) => a.id !== accountId)
  if (!remaining.some((a) => a.primary)) remaining[0].primary = true
  save(KEYS.accounts, remaining)
  return remaining.map(toDisplayAccount)
}

// How one row moves ONE account's money, in cents: positive in, negative out,
// zero if the row does not touch it.
//
// A row lives on accountOf(t). A move between two of his own accounts also
// names the other end in counterAccountId, so a single row keeps both right:
// an expense here is money arriving there; an income here is money that left
// there. That is what lets "Revolut**551 top-up" debit the current account and credit
// Revolut without a second row that could be double-counted.
function movementFor(t, id, accounts) {
  const amt = toCents(t.amount)
  if (accountOf(t, accounts) === id) return t.type === 'income' ? amt : -amt
  if (t.counterAccountId === id) return t.type === 'income' ? -amt : amt
  return 0
}

// The running figure for ONE account: its anchor, plus everything that moved
// in or out of that account since.
export function accountBalance(account, transactions, accounts) {
  const anchor = account?.anchor
  if (!anchor?.enabled) return null
  const id = account.id
  const since = (transactions || []).filter((t) => t.date >= anchor.openingDate)
  let inCents = 0
  let outCents = 0
  let counted = 0
  for (const t of since) {
    const m = movementFor(t, id, accounts)
    if (!m && accountOf(t, accounts) !== id) continue
    if (m > 0) inCents += m
    else outCents -= m
    counted++
  }
  const openingCents = toCents(anchor.openingValue)
  return {
    accountId: id,
    name: account.name,
    balance: fromCents(openingCents + inCents - outCents),
    opening: fromCents(openingCents),
    income: fromCents(inCents),
    spent: fromCents(outCents),
    since: anchor.openingDate,
    counted
  }
}

// The anchor to store when reconciling against what the bank says right now.
//
// An anchor means "the balance at the START of openingDate" — everything dated
// that day or later is counted on top of it. A bank figure read today already
// includes today's movements, so storing it as-is dated today would count
// those twice and the account could never read "matches". Backing today's own
// movements out of it makes the running figure land exactly on what the bank
// says, and still counts anything logged later in the day.
export function anchorFromReal(account, realValue, transactions, accounts, date = todayLocal()) {
  const id = account.id
  let todayNetCents = 0
  for (const t of transactions || []) {
    if (t.date === date) todayNetCents += movementFor(t, id, accounts)
  }
  return {
    enabled: true,
    openingValue: fromCents(toCents(realValue) - todayNetCents),
    openingDate: date
  }
}

export async function getCash() {
  const raw = load(KEYS.cash, null)
  if (!raw) return { enabled: false, openingValue: 0, openingDate: todayLocal() }
  return { ...raw, openingValue: fromCents(raw.openingValue || 0) }
}

export async function setCash({ enabled, openingValue, openingDate }) {
  const record = {
    enabled: Boolean(enabled),
    openingValue: toCents(openingValue || 0),
    openingDate: openingDate || todayLocal()
  }
  save(KEYS.cash, record)
  return { ...record, openingValue: fromCents(record.openingValue) }
}

// A transfer moves money between the person's own accounts — from the current
// account into Revolut, into a savings pot, into an investment balance. It is
// recorded so the ledger stays complete and reconcilable against a statement,
// but it is NOT spending and it is NOT income: counting it would inflate both
// totals and misrepresent where the money actually went. Every aggregation
// below therefore filters transfers out; only the screens that *list*
// transactions still show them.
export const isTransfer = (t) => t?.transfer === true
const counts = (t) => !isTransfer(t)

// A category can be kept out of the headline figures without being hidden.
// "Transfers" moves money between his own accounts; a reimbursement category
// is spending someone else ultimately pays back. Either way the transactions
// stay completely normal in Activity — editable, searchable, deletable — they
// just should not read as spending or income.
//
// Driven by the CATEGORY rather than the stored row, so unticking the box puts
// old transactions back into the totals on the next refresh with nothing
// rewritten. A transfer category implies exclusion: it is the same idea with a
// narrower name.
export const isExcludedFromTotals = (cat) => cat?.excludeFromTotals === true || cat?.transfer === true
const excludedCategoryIds = (categories) =>
  new Set((categories || []).filter(isExcludedFromTotals).map((c) => c.id))

// Filing something under a transfer category IS declaring it a transfer, so the
// row-level flag is derived from the category rather than trusted separately.
// Without this, picking "Transfers" in Add transaction would create a row that
// counts as spending under a category that means the opposite.
function withTransferFlag(record, categories) {
  const cat = (categories || []).find((c) => c.id === record.categoryId)
  if (cat?.transfer) return { ...record, transfer: true }
  if (record.transfer && !cat?.transfer) {
    const { transfer, ...rest } = record
    return rest
  }
  return record
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

// Rows written before accounts existed carry only a provenance `source` tag.
// That tag does say which bank they came from, so it is read once into a real
// accountId — after which the account is the thing of record and `source` goes
// back to being provenance.
//
// The other end of an own-account move is filled in only from literal
// descriptors on his own statements, never from merchant guessing:
//   - "Revolut**55x top-up" left the current account for Revolut
//   - "To / From EUR Flexible Cash Funds" moved money between Revolut and its
//     savings vault
// Anything unrecognised stays one-sided and surfaces on Reconcile, which is
// exactly what Reconcile is for.
const TOP_UP_TO_REVOLUT = /revolut\*\*55\d/i
const REVOLUT_TOP_UP_CREDIT = /apple pay top-up/i
const VAULT_MOVE = /eur flexible cash funds/i

const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

function migrateTransactionAccounts(list) {
  if (list.every((t) => t.accountId)) return list
  const out = list.map((t) => {
    if (t.accountId) return t
    const src = t.source || ''
    // The descriptor decides, not the provenance tag: three of his top-ups were
    // merged with rows he typed into the app and so carry no source at all.
    const isTopUp = t.type === 'expense' && TOP_UP_TO_REVOLUT.test(t.note || '')
    let accountId
    if (src === 'bank-main' || isTopUp) accountId = 'main'
    // pocket movements belong to the vault, not the Revolut current account —
    // the statement's current-account section reconciles without them
    else if (src === 'bank-revolut-pocket') accountId = 'revolut-savings'
    else if (src.startsWith('bank-revolut')) accountId = 'revolut'
    if (!accountId) return t
    const next = { ...t, accountId }
    if (accountId === 'revolut' && VAULT_MOVE.test(t.note || '')) next.counterAccountId = 'revolut-savings'
    return next
  })

  // A top-up only needs its far end filled in when Revolut's own record of the
  // credit is missing. Where both legs survived — the current-account side dated by the
  // card terminal, the Revolut side a day later — crediting Revolut from the
  // current-account row as well would count the money twice. Matched one-to-one, nearest
  // date first, so two EUR 20 top-ups cannot both claim one EUR 20 credit.
  const credits = out
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.accountId === 'revolut' && t.type === 'income' && REVOLUT_TOP_UP_CREDIT.test(t.note || ''))
  const topUps = out
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => !list[i].accountId && t.accountId === 'main' && t.type === 'expense' && TOP_UP_TO_REVOLUT.test(t.note || ''))
  // Every plausible pairing, closest first, assigned globally. Greedy per
  // top-up in list order could let a later top-up take a credit that belongs
  // to an earlier, nearer one — totals still right, but a EUR 20 on the wrong
  // date, which is enough to throw off a reconcile run in between.
  const pairs = []
  for (const u of topUps) {
    for (const c of credits) {
      const gap = Math.abs(dayNumber(c.t.date) - dayNumber(u.t.date))
      if (c.t.amount === u.t.amount && gap <= 4) pairs.push({ u: u.i, c: c.i, gap })
    }
  }
  pairs.sort((a, b) => a.gap - b.gap)
  const matchedTopUps = new Set()
  const claimed = new Set()
  for (const p of pairs) {
    if (matchedTopUps.has(p.u) || claimed.has(p.c)) continue
    matchedTopUps.add(p.u)
    claimed.add(p.c)
  }
  // Revolut has no record of the credit for these, so the current-account row supplies it.
  for (const u of topUps) {
    if (!matchedTopUps.has(u.i)) out[u.i] = { ...out[u.i], counterAccountId: 'revolut' }
  }
  return out
}

function loadTransactionsRaw() {
  const raw = load(KEYS.transactions, [])
  const migrated = migrateTransactionAccounts(raw)
  if (migrated !== raw) save(KEYS.transactions, migrated)
  return migrated
}

function toDisplayTransaction(t) {
  return { ...t, amount: fromCents(t.amount) }
}

export async function getTransactions() {
  const list = loadTransactionsRaw()
  return list.map(toDisplayTransaction).sort((a, b) => new Date(b.date) - new Date(a.date))
}

// --- Category -> balance auto-link --------------------------------------
// Some recurring expenses are really debt repayments: the monthly instalment
// on a TV bought on a payment plan is a payment against a debt, not ordinary
// spending. A
// category can name one debt account, set once in Settings, and every expense
// filed under it then writes the matching balance entry by itself instead of
// needing a second manual visit to Balances.
//
// The entry created this way carries its own id, and the transaction stores
// that id. Reversing on delete or edit is then an exact lookup. The obvious
// alternative — find the entry by date and check its value is "previous minus
// this amount" — is ambiguous exactly when it matters most: two entries
// sharing a date is the normal case here (an auto entry landing the same day
// as a manual reading), and a wrong guess corrupts a balance rather than
// merely leaving it stale.
//
// Deliberately NOT wired into importTransactions: a statement import would
// rewrite a debt's history in bulk with no way to see what it did.

function applyAutoBalance(record) {
  // A bill or import that already moved its Balances card says so; moving a
  // category-linked debt as well would take the same payment off twice.
  if (record.autoBalanceEntryId) return { record }
  if (record.type !== 'expense') return { record }
  const cat = loadCategoriesRaw().find((c) => c.id === record.categoryId)
  if (!cat?.linkedBalanceAccountId) return { record }
  const accounts = loadBalancesRaw()
  const account = accounts.find((a) => a.id === cat.linkedBalanceAccountId)
  // Account deleted, or no longer a debt: skip silently. The transaction is
  // still a perfectly good transaction.
  if (!account || account.type !== 'debt') return { record }
  const latest = latestEntry(account)
  const entry = { id: id(), date: record.date, value: (latest?.value ?? 0) - record.amount, auto: true }
  account.entries.push(entry)
  save(KEYS.balances, accounts)
  return {
    record: { ...record, autoBalanceAccountId: account.id, autoBalanceEntryId: entry.id },
    effect: { accountId: account.id, accountName: account.name, value: fromCents(entry.value) }
  }
}

// Removes the entry a transaction created, if it is still there. Returns true
// when something was removed, so callers can tell "nothing to undo" from
// "undone".
function reverseAutoBalance(record) {
  if (!record?.autoBalanceEntryId) return false
  const accounts = loadBalancesRaw()
  const account = accounts.find((a) => a.id === record.autoBalanceAccountId)
  if (!account) return false
  const before = account.entries.length
  account.entries = account.entries.filter((e) => e.id !== record.autoBalanceEntryId)
  if (account.entries.length === before) return false
  save(KEYS.balances, accounts)
  return true
}

export async function addTransaction(tx) {
  const list = loadTransactionsRaw()
  const { record, effect } = applyAutoBalance(
    withTransferFlag({ id: id(), ...tx, amount: toCents(tx.amount) }, loadCategoriesRaw())
  )
  list.push(record)
  save(KEYS.transactions, list)
  // `_autoBalance` is on the returned object only, never stored — it exists so
  // the screen that saved can confirm the balance it quietly changed.
  return effect ? { ...toDisplayTransaction(record), _autoBalance: effect } : toDisplayTransaction(record)
}

// Statement import (see statements.js): saves the rows marked new, links any
// bill a row pays (and moves its Balances card, like tapping Paid does), and
// keeps the bank's own text in bankNote so the next import recognises the
// shop even after the note has been tidied.
export async function importStatementRows(rows) {
  const list = loadTransactionsRaw()
  const cats = loadCategoriesRaw()
  const bills = loadBillsRaw()
  const balances = loadBalancesRaw()
  let added = 0
  let billsMarked = 0
  for (const r of rows || []) {
    if (r.status && r.status !== 'new') continue
    const record = withTransferFlag(
      {
        id: id(),
        type: r.type,
        amount: toCents(r.amount),
        categoryId: r.categoryId,
        date: r.date,
        note: r.note,
        ...(r.bankNote ? { bankNote: r.bankNote } : {}),
        accountId: r.accountId,
        source: 'import',
        ...(r.transfer ? { transfer: true } : {}),
        ...(r.counterAccountId ? { counterAccountId: r.counterAccountId } : {})
      },
      cats
    )
    const bill = r.billId && bills.find((b) => b.id === r.billId)
    if (bill && r.billPeriod && !bill.payments?.[r.billPeriod]) {
      bill.payments = bill.payments || {}
      bill.payments[r.billPeriod] = { paidDate: r.date, transactionId: record.id }
      billsMarked++
      const pot = bill.balanceAccountId && balances.find((a) => a.id === bill.balanceAccountId)
      if (pot && (pot.type === 'savings' || pot.type === 'debt')) {
        const entry = addPotEntry(pot, record.amount, r.date)
        record.autoBalanceAccountId = pot.id
        record.autoBalanceEntryId = entry.id
      }
    }
    list.push(record)
    added++
  }
  save(KEYS.transactions, list)
  save(KEYS.bills, bills)
  save(KEYS.balances, balances)
  return { added, billsMarked }
}

// Bulk import: adds a batch of transactions on top of what's already
// there, rather than replacing anything, so a bank statement or
// screenshot batch can be merged in safely.
export async function importTransactions(list) {
  const existing = loadTransactionsRaw()
  const cats = loadCategoriesRaw()
  const added = list.map((t) => withTransferFlag({ id: id(), ...t, amount: toCents(t.amount) }, cats))
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
  const touchesAutoLink = 'amount' in finalUpdates || 'categoryId' in finalUpdates
  if (touchesAutoLink) reverseAutoBalance(tx)
  Object.assign(tx, finalUpdates)
  // re-derive, so recategorising into (or out of) a transfer category keeps the
  // flag and the category telling the same story
  const flagged = withTransferFlag(tx, loadCategoriesRaw())
  delete tx.transfer
  Object.assign(tx, flagged)
  let effect
  if (touchesAutoLink) {
    // The old entry is gone; work out the new one from scratch so an edited
    // amount or a move to a different linked category both land correctly.
    delete tx.autoBalanceAccountId
    delete tx.autoBalanceEntryId
    const applied = applyAutoBalance(tx)
    Object.assign(tx, applied.record)
    effect = applied.effect
  }
  save(KEYS.transactions, list)
  return effect ? { ...toDisplayTransaction(tx), _autoBalance: effect } : toDisplayTransaction(tx)
}

// Deleting a row that paid a bill also un-pays that bill (otherwise the bill
// would stay ticked off by a row that no longer exists, and safe to spend
// would stop counting it). Returns what it unlinked, so Undo can put it back.
export async function deleteTransaction(txId) {
  const list = loadTransactionsRaw()
  const record = list.find((t) => t.id === txId)
  reverseAutoBalance(record)
  const bills = loadBillsRaw()
  const billLinks = []
  for (const b of bills) {
    for (const [period, p] of Object.entries(b.payments || {})) {
      if (p?.transactionId === txId) {
        billLinks.push({ billId: b.id, period, paidDate: p.paidDate })
        delete b.payments[period]
      }
    }
  }
  if (billLinks.length) save(KEYS.bills, bills)
  save(
    KEYS.transactions,
    list.filter((t) => t.id !== txId)
  )
  return { billLinks, potAccountId: record?.autoBalanceAccountId || null }
}

// Undo of a delete: the same row back with its id, its bill payments
// re-linked, and its Balances card moved again (by the bill/import route, or
// by a category link, exactly as the first time).
export async function restoreTransaction(tx, { billLinks = [], potAccountId = null } = {}) {
  const list = loadTransactionsRaw()
  const { autoBalanceAccountId, autoBalanceEntryId, ...rest } = tx
  let record = withTransferFlag({ ...rest, amount: toCents(tx.amount) }, loadCategoriesRaw())
  if (list.some((t) => t.id === record.id)) record.id = id()
  let effect = null
  if (potAccountId) {
    const balances = loadBalancesRaw()
    const pot = balances.find((a) => a.id === potAccountId)
    if (pot && (pot.type === 'savings' || pot.type === 'debt')) {
      const entry = addPotEntry(pot, record.amount, record.date)
      save(KEYS.balances, balances)
      record = { ...record, autoBalanceAccountId: pot.id, autoBalanceEntryId: entry.id }
    }
  } else {
    const applied = applyAutoBalance(record)
    record = applied.record
    effect = applied.effect
  }
  list.push(record)
  save(KEYS.transactions, list)
  if (billLinks.length) {
    const bills = loadBillsRaw()
    for (const l of billLinks) {
      const b = bills.find((x) => x.id === l.billId)
      if (b && !b.payments?.[l.period]) {
        b.payments = b.payments || {}
        b.payments[l.period] = { paidDate: l.paidDate, transactionId: record.id }
      }
    }
    save(KEYS.bills, bills)
  }
  return effect ? { ...toDisplayTransaction(record), _autoBalance: effect } : toDisplayTransaction(record)
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
  // minAmount: the least a set-aside bill may be planned at (a card payment).
  return { ...b, amount: fromCents(b.amount), ...(b.minAmount != null ? { minAmount: fromCents(b.minAmount) } : {}) }
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

// Edits a bill in place. Deliberately does not touch `payments`, nor any
// transaction a past payment already created: those copied the amount and
// category at the moment they were marked paid and are frozen historical
// records, the same way renaming a category does not rewrite the name inside
// old transactions. Changing a bill today only affects the next time it is
// marked paid.
export async function updateBill(billId, updates) {
  const bills = loadBillsRaw()
  const bill = bills.find((b) => b.id === billId)
  if (!bill) return null
  const finalUpdates = { ...updates }
  if ('amount' in finalUpdates && finalUpdates.amount != null) {
    finalUpdates.amount = toCents(finalUpdates.amount)
  }
  if ('dueDay' in finalUpdates) {
    finalUpdates.dueDay = Math.min(31, Math.max(1, parseInt(finalUpdates.dueDay, 10) || 1))
  }
  Object.assign(bill, finalUpdates)
  save(KEYS.bills, bills)
  return toDisplayBill(bill)
}

export async function deleteBill(billId) {
  const list = loadBillsRaw()
  save(
    KEYS.bills,
    list.filter((b) => b.id !== billId)
  )
}

// Moves a Balances savings or debt card by a payment: savings go up, a debt
// comes down. The entry is dated no earlier than the card's newest reading,
// so a back-dated payment (last month's bill paid today, an older row in an
// import) still becomes the latest figure instead of hiding behind it.
function addPotEntry(pot, cents, date) {
  const latest = latestEntry(pot)
  const value = pot.type === 'savings' ? (latest?.value ?? 0) + cents : Math.max(0, (latest?.value ?? 0) - cents)
  const when = latest && latest.date > date ? latest.date : date
  const entry = { id: id(), date: when, value, auto: true }
  pot.entries.push(entry)
  return entry
}

export async function markBillPaid(billId, monthPrefix) {
  const bills = loadBillsRaw()
  const bill = bills.find((b) => b.id === billId)
  if (!bill) return null

  const payDay = await getPayDay()
  const isCurrentPeriod = monthPrefix === currentPeriodKey(payDay)
  const paidDate = isCurrentPeriod ? todayLocal() : billDateWithinPeriod(monthPrefix, payDay, bill.dueDay)

  // A bill can be a standing transfer into a savings pot (money set aside each
  // payday). It then names the account the money leaves, the account it lands
  // in, and optionally the Balances savings card it adds to. The new card
  // entry is recorded on the transaction the same way an auto-balance is, so
  // marking the bill unpaid (which deletes the transaction) takes it back off.
  const extra = {}
  if (bill.accountId) extra.accountId = bill.accountId
  const cat = loadCategoriesRaw().find((c) => c.id === bill.categoryId)
  if (cat?.transfer && bill.counterAccountId && bill.counterAccountId !== bill.accountId) {
    extra.counterAccountId = bill.counterAccountId
  }
  if (bill.balanceAccountId) {
    const balances = loadBalancesRaw()
    const pot = balances.find((a) => a.id === bill.balanceAccountId)
    if (pot && (pot.type === 'savings' || pot.type === 'debt')) {
      const entry = addPotEntry(pot, bill.amount, paidDate)
      save(KEYS.balances, balances)
      extra.autoBalanceAccountId = pot.id
      extra.autoBalanceEntryId = entry.id
    }
  }

  const record = await addTransaction({
    amount: fromCents(bill.amount),
    categoryId: bill.categoryId,
    date: paidDate,
    note: bill.name,
    type: 'expense',
    source: 'bill',
    ...extra
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

// A bill can start partway through the history (a new savings transfer set
// up today shouldn't read as missed in every earlier period). `startPeriod`
// is the first period key it applies to; bills without one always apply.
export function billAppliesTo(bill, periodKey) {
  return !bill?.startPeriod || periodKey >= bill.startPeriod
}

// --- Safe to spend ---------------------------------------------------
// What can still be spent this period without missing a bill or the money
// set aside: income in, minus what's been spent, minus bills not paid yet,
// minus every transfer bill (money moved into savings). A paid ordinary bill
// is already inside `spent`; a transfer bill never is, paid or not, because
// transfers stay out of spending, so it is taken off separately.
// Takes and returns display units (decimal money), like the summary.
export function safeToSpend({ income, spent }, bills, categories, periodKey) {
  const transferCat = new Set((categories || []).filter((c) => c.transfer).map((c) => c.id))
  let billsDueCents = 0
  let billsDueCount = 0
  let setAsideCents = 0
  for (const b of bills || []) {
    if (!billAppliesTo(b, periodKey)) continue
    const amount = toCents(b.amount)
    if (transferCat.has(b.categoryId)) setAsideCents += amount
    else if (!b.payments?.[periodKey]) {
      billsDueCents += amount
      billsDueCount++
    }
  }
  const safeCents = toCents(income) - toCents(spent) - billsDueCents - setAsideCents
  return {
    income,
    spent,
    billsDue: fromCents(billsDueCents),
    billsDueCount,
    setAside: fromCents(setAsideCents),
    safe: fromCents(safeCents)
  }
}

// --- Tripsy -------------------------------------------------------------
// The last trips read from Tripsy (see tripsy.js), kept so the app works
// offline, and the goals that follow a trip: their target is your share
// of what's still to pay for it, updated whenever the trips are read.
export async function getTripsyCache() {
  return load(KEYS.tripsy, null)
}

export async function saveTripsyCache(trips) {
  const cache = { fetchedAt: new Date().toISOString(), trips }
  save(KEYS.tripsy, cache)
  return cache
}

export async function clearTripsyCache() {
  localStorage.removeItem(KEYS.tripsy)
}

export async function linkGoalToTrip(accountId, slug) {
  const accounts = loadBalancesRaw()
  const account = accounts.find((a) => a.id === accountId)
  if (!account?.goal) return null
  if (slug) account.goal.tripSlug = slug
  else delete account.goal.tripSlug
  save(KEYS.balances, accounts)
  return toDisplayBalanceAccount(account)
}

// remainingFor(trip) → euros still to pay (his share). Returns how many goal
// targets changed.
export async function syncTripGoals(trips, remainingFor) {
  const accounts = loadBalancesRaw()
  let changed = 0
  for (const a of accounts) {
    const slug = a.goal?.tripSlug
    if (!slug) continue
    const trip = (trips || []).find((t) => t.slug === slug)
    if (!trip) continue
    const target = toCents(remainingFor(trip))
    if (target > 0 && target !== a.goal.target) {
      a.goal.target = target
      changed++
    }
    a.goal.syncedAt = new Date().toISOString()
  }
  save(KEYS.balances, accounts)
  return changed
}

// --- Payday plan -----------------------------------------------------
// The figures the payday planner starts from, for one period:
//  - income: wages already in this period, else the last period's wages
//    (the salary often lands after payday morning);
//  - setAside: savings and transfer bills (Credit Union, a trip pot, a card
//    payment), each with its goal's needs where it has one;
//  - bills: every other bill;
//  - limits: spending categories that have no bill.
// Display units in and out, like the summary.
const SET_ASIDE_CATEGORY = /saving|invest/i

export function isSetAsideBill(bill, categories) {
  const cat = (categories || []).find((c) => c.id === bill.categoryId)
  return Boolean(cat?.transfer) || SET_ASIDE_CATEGORY.test(cat?.name || '') || SET_ASIDE_CATEGORY.test(bill.categoryId || '')
}

export function planOverview({ periodKey, payDay, bills, categories, balances, transactions }) {
  const wagesIn = (key) =>
    (transactions || [])
      .filter((t) => t.type === 'income' && !isTransfer(t) && t.categoryId === 'wages' && inPeriod(t.date, key, payDay))
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  const thisWages = wagesIn(periodKey)
  const lastWages = wagesIn(shiftMonthPrefix(periodKey, -1))
  const applying = (bills || []).filter((b) => billAppliesTo(b, periodKey))
  const goalFor = (b) => {
    const acct = (balances || []).find((a) => a.id === b.balanceAccountId)
    return acct?.goal ? { account: acct, progress: goalProgress(acct, bills, payDay) } : null
  }
  const setAside = applying
    .filter((b) => isSetAsideBill(b, categories))
    .sort((a, b) => b.amount - a.amount)
    .map((b) => ({ bill: b, goal: goalFor(b) }))
  const fixed = applying.filter((b) => !isSetAsideBill(b, categories)).sort((a, b) => b.amount - a.amount)
  const billCats = new Set(applying.map((b) => b.categoryId))
  const limits = (categories || []).filter(
    (c) => c.kind !== 'income' && !c.archived && !isExcludedFromTotals(c) && !billCats.has(c.id)
  )
  return {
    income: fromCents(thisWages || lastWages),
    incomeIsEstimate: !thisWages,
    bills: fixed,
    billsTotal: fromCents(fixed.reduce((sum, b) => sum + toCents(b.amount), 0)),
    setAside,
    limits
  }
}

// Whether a period's plan has been made or put off, so the payday card
// shows until one of those happens and then leaves it alone.
export async function getPlanState(periodKey) {
  return load(KEYS.plans, {})[periodKey] || null
}

export async function setPlanState(periodKey, status) {
  const all = load(KEYS.plans, {})
  all[periodKey] = { status, at: new Date().toISOString() }
  save(KEYS.plans, all)
  return all[periodKey]
}

// --- Limit warnings --------------------------------------------------
// Compares a period's summary before and after a change, and reports the
// category the change pushed past 80% of its limit, or past the limit
// itself. Only an upward crossing counts, so the same warning doesn't
// repeat on every later coffee.
export const LIMIT_NEAR = 0.8

export function budgetCrossing(before, after, categoryId) {
  const b = before?.byCategory?.find((c) => c.id === categoryId)
  const a = after?.byCategory?.find((c) => c.id === categoryId)
  const budget = a?.effectiveBudget
  if (!a || !(budget > 0)) return null
  const was = (b?.spent || 0) / budget
  const now = a.spent / budget
  let level = null
  if (now > 1 && was <= 1) level = 'over'
  else if (now >= LIMIT_NEAR && was < LIMIT_NEAR) level = 'near'
  if (!level) return null
  return { categoryId, name: a.name, spent: a.spent, budget, fraction: now, level }
}

// --- Reminders --------------------------------------------------------
// Settings for the phone reminders and the in-app limit warnings. All on
// by default except hiding amounts on the lock screen.
const REMINDER_DEFAULTS = {
  payday: true,
  bills: true,
  nothingLogged: true,
  goals: true,
  limits: true,
  hideAmounts: false,
  time: '09:00'
}

export async function getReminderSettings() {
  return { ...REMINDER_DEFAULTS, ...load(KEYS.reminders, {}) }
}

export async function setReminderSettings(updates) {
  const next = { ...REMINDER_DEFAULTS, ...load(KEYS.reminders, {}), ...updates }
  if (!/^\d{2}:\d{2}$/.test(next.time)) next.time = REMINDER_DEFAULTS.time
  save(KEYS.reminders, next)
  return next
}

// A stable positive 31-bit id per reminder, so rescheduling replaces rather
// than duplicates.
function reminderId(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 1) || 1
}

const isoAddDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const utcIso = (d) => d.toISOString().slice(0, 10)

// Works out every reminder for the next couple of months from what's on the
// device. Pure: takes plain data (display units) and returns
// [{ id, at: Date, title, body }]; the native layer does the scheduling.
// Texts come from `text(key, vars)` so this stays language-free, and
// `money(v)` formats amounts. With hideAmounts, no name or figure is used.
export function planReminders({ bills, categories, balances, transactions, payDay, settings, now = new Date(), text, money, weekday }) {
  const s = { ...REMINDER_DEFAULTS, ...(settings || {}) }
  const [hh, mm] = s.time.split(':').map(Number)
  const at = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d, hh, mm, 0, 0)
  }
  const horizon = new Date(now.getTime() + 62 * 86400000)
  const inWindow = (d) => d > now && d <= horizon
  const transferCat = new Set((categories || []).filter((c) => c.transfer).map((c) => c.id))
  const out = []
  const push = (key, when, title, body) => out.push({ id: reminderId(key), at: when, title, body })

  const firstKey = currentPeriodKey(payDay)
  const keys = [0, 1, 2, 3].map((i) => shiftMonthPrefix(firstKey, i))

  if (s.payday) {
    for (const key of keys) {
      const start = utcIso(periodBounds(key, payDay).start)
      const when = at(start)
      if (!inWindow(when)) continue
      const moves = (bills || []).filter((b) => transferCat.has(b.categoryId) && billAppliesTo(b, key) && !b.payments?.[key])
      let body
      if (!moves.length) body = text('remPaydayBody')
      else if (s.hideAmounts) body = text('remPaydayBodyHidden')
      else {
        const total = moves.reduce((sum, b) => sum + toCents(b.amount), 0)
        body = text('remPaydayBodyMove', { amount: money(fromCents(total)), name: moves.length === 1 ? moves[0].name : text('remYourSavings') })
      }
      push(`payday|${key}`, when, text('remPaydayTitle'), body)
    }
  }

  if (s.bills) {
    const byDay = new Map()
    for (const key of keys) {
      for (const b of bills || []) {
        if (transferCat.has(b.categoryId) || !billAppliesTo(b, key) || b.payments?.[key]) continue
        const due = billDateWithinPeriod(key, payDay, b.dueDay)
        const day = isoAddDays(due, -1)
        if (!inWindow(at(day))) continue
        if (!byDay.has(day)) byDay.set(day, [])
        byDay.get(day).push(b)
      }
    }
    for (const [day, list] of byDay) {
      list.sort((a, b) => b.amount - a.amount)
      if (s.hideAmounts) {
        push(`bills|${day}`, at(day), list.length === 1 ? text('remBillTitleHidden') : text('remBillsTitleHidden', { n: list.length }), text('remBillBodyHidden'))
      } else {
        const first = `${list[0].name}, ${money(list[0].amount)}`
        const body = list.length === 1 ? first : list.length === 2 ? text('remTwoBills', { a: first, b: `${list[1].name}, ${money(list[1].amount)}` }) : text('remMoreBills', { a: first, n: list.length - 1 })
        push(`bills|${day}`, at(day), text('remBillTitle'), body)
      }
    }
  }

  if (s.nothingLogged && transactions?.length) {
    const last = transactions.reduce((m, t) => (t.date > m ? t.date : m), '')
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const remindDay = [isoAddDays(last, 3), isoAddDays(todayIso, 1)].sort().pop()
    const when = at(remindDay)
    if (inWindow(when)) push(`log|${last}`, when, text('remLogTitle', { day: weekday(last) }), text('remLogBody'))
  }

  if (s.goals) {
    const nextStart = utcIso(periodBounds(keys[1], payDay).start)
    const when = at(isoAddDays(nextStart, 1))
    for (const a of balances || []) {
      if ((a.type !== 'savings' && a.type !== 'debt') || !a.goal) continue
      const p = goalProgress(a, bills, payDay)
      if (!p || p.reached || p.onTrack || !inWindow(when)) continue
      const body = s.hideAmounts
        ? text('remGoalBodyHidden')
        : text('remGoalBody', { left: money(p.remaining), per: money(p.neededPerPayday), n: p.paydaysLeft })
      push(`goal|${a.id}|${nextStart}`, when, s.hideAmounts ? text('remGoalTitleHidden') : text('remGoalTitle', { name: a.name }), body)
    }
  }

  // iOS keeps at most 64 pending; the soonest matter most.
  return out.sort((a, b) => a.at - b.at).slice(0, 60)
}

// --- Repeat charges (subscriptions) ----------------------------------
// Finds charges that come back at a steady rhythm for about the same amount:
// subscriptions, plans, memberships. Works on what's already been logged or
// imported, nothing else. Same shop, same-ish amount (within 12% or 50c, so a
// price rise stays one subscription while a €0.99 and a €9.99 from the same
// shop stay two), at least three times, mostly monthly or weekly apart.
// "Stopped" means the next charge is more than 10 days late.
const SUB_GENERIC = new Set(['card', 'purchase', 'payment', 'fee', 'transfer', 'to', 'from', 'the', 'pos', 'dd', 'so'])

function subscriptionKey(note) {
  const words = merchantKey(note).split(' ').filter(Boolean)
  const first = words.findIndex((w) => !SUB_GENERIC.has(w) && w.length >= 3 && !/^\d+$/.test(w))
  if (first < 0) return null
  // A fee or plan line keeps its next word, so "Metal plan fee" and
  // "Fee: maintaining account" don't merge with unrelated rows.
  return words[first] === 'plan' || first > 0 ? words.slice(first, first + 2).join(' ') : words[first]
}

const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)

// Categories whose repeats are habits or commitments, not subscriptions:
// takeaway every few weeks, fuel, travel, rent, savings, card repayments.
const SUB_SKIP_CATEGORY = /food|grocer|restaurant|takeaway|holiday|travel|transport|fuel|rent|saving|invest|credit card|loan/i

export function findSubscriptions(transactions, bills = [], today = todayLocal(), categories = []) {
  const skipCats = new Set((categories || []).filter((c) => SUB_SKIP_CATEGORY.test(c.name || '') || SUB_SKIP_CATEGORY.test(c.id || '')).map((c) => c.id))
  const groups = new Map()
  for (const t of transactions || []) {
    if (t.type !== 'expense' || isTransfer(t) || !t.note || skipCats.has(t.categoryId)) continue
    // Money sent to a person is a person, not a subscription.
    if (/^\s*(transfer|payment) (to|from)\b/i.test(t.note)) continue
    const key = subscriptionKey(t.note)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ date: t.date, cents: toCents(t.amount), note: t.note, id: t.id, categoryId: t.categoryId })
  }

  const found = []
  for (const [key, rows] of groups) {
    rows.sort((a, b) => a.date.localeCompare(b.date))
    // Cluster by amount, comparing against the cluster's latest charge so a
    // gradual price rise stays one subscription.
    const clusters = []
    for (const r of rows) {
      const c = clusters.find((cl) => {
        const ref = cl[cl.length - 1].cents
        return Math.abs(r.cents - ref) <= Math.max(Math.round(ref * 0.12), 50)
      })
      if (c) c.push(r)
      else clusters.push([r])
    }
    for (const cl of clusters) {
      // One charge per day: a same-day pair is a split payment, not a cadence.
      const charges = cl.filter((r, i) => i === 0 || r.date !== cl[i - 1].date)
      if (charges.length < 3) continue
      const gaps = charges.slice(1).map((r, i) => daysBetween(charges[i].date, r.date))
      const sorted = [...gaps].sort((a, b) => a - b)
      const median = sorted[Math.floor((sorted.length - 1) / 2)]
      let cadence = null
      if (median >= 26 && median <= 38) cadence = 'monthly'
      else if (median >= 6 && median <= 8) cadence = 'weekly'
      if (!cadence) continue
      const [lo, hi] = cadence === 'monthly' ? [20, 45] : [5, 10]
      // Mostly regular: gaps a month or two long (a skipped month) still count.
      const regular = gaps.filter((g) => (g >= lo && g <= hi) || (cadence === 'monthly' && g >= 50 && g <= 70)).length
      if (regular / gaps.length < 0.6) continue
      const last = charges[charges.length - 1]
      const step = cadence === 'monthly' ? Math.min(median, 31) : 7
      const nextExpected = addDays(last.date, step)
      const lateBy = daysBetween(nextExpected, today)
      const stopped = lateBy > 10
      // A stopped one is only worth showing while it's news: the last
      // charge within about three months (did that cancellation work?).
      if (stopped && daysBetween(last.date, today) > 100) continue
      const ids = new Set(cl.map((r) => r.id))
      const bill =
        (bills || []).find((b) => Object.values(b.payments || {}).some((p) => p?.transactionId && ids.has(p.transactionId))) ||
        (bills || []).find((b) => {
          const bk = merchantKey(b.name)
          return bk && (bk.split(' ').some((w) => w.length >= 4 && key.includes(w)) || key.split(' ').some((w) => w.length >= 4 && bk.includes(w)))
        })
      found.push({
        key: `${key}|${cl[0].cents}`,
        name: last.note,
        amount: fromCents(last.cents),
        cadence,
        monthly: fromCents(cadence === 'monthly' ? last.cents : Math.round((last.cents * 52) / 12)),
        count: charges.length,
        firstDate: charges[0].date,
        lastDate: last.date,
        nextExpected,
        // late: the next charge is a few days overdue, often the first sign
        // a cancellation worked
        status: stopped ? 'stopped' : lateBy > 2 ? 'late' : 'active',
        billId: bill?.id || null,
        categoryId: cl[cl.length - 1].categoryId || null,
        transactionIds: cl.map((r) => r.id)
      })
    }
  }
  const rank = { active: 0, late: 1, stopped: 2 }
  return found.sort((a, b) => rank[a.status] - rank[b.status] || b.monthly - a.monthly)
}

// Repeat charges the person has said aren't subscriptions. Keyed by the
// detector's key (shop + first amount), kept on the device and in backups.
export async function getHiddenSubscriptions() {
  return load(KEYS.hiddenSubscriptions, [])
}

export async function setSubscriptionHidden(key, hidden) {
  const list = new Set(load(KEYS.hiddenSubscriptions, []))
  if (hidden) list.add(key)
  else list.delete(key)
  save(KEYS.hiddenSubscriptions, [...list])
  return [...list]
}

// --- Savings goals ----------------------------------------------------
// A savings card can carry a goal: a target and the date it's needed by.
// Stored as { target: cents, by: 'YYYY-MM-DD' }; null removes it.
export async function setBalanceGoal(accountId, goal) {
  const accounts = loadBalancesRaw()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return null
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(goal?.by || '')
  if (goal && validDate && account.type === 'debt') {
    // A debt's goal is paying it off: target 0 by a date. Remembering where it
    // started lets the ring show how much of it is gone.
    const startValue = account.goal?.startValue ?? (latestEntry(account)?.value || 0)
    account.goal = { target: 0, by: goal.by, startValue }
  } else if (goal && goal.target > 0 && validDate) {
    const tripSlug = goal.tripSlug !== undefined ? goal.tripSlug : account.goal?.tripSlug
    account.goal = { target: toCents(goal.target), by: goal.by, ...(tripSlug ? { tripSlug } : {}) }
  } else {
    delete account.goal
  }
  save(KEYS.balances, accounts)
  return toDisplayBalanceAccount(account)
}

// How a goal is doing. Counts the paydays still to come up to the goal date
// (the current period counts too while its transfer bill is unpaid), and
// checks whether the linked transfer bill, paid each of those times, gets
// there. Without a linked bill it reports what each payday would need.
export function goalProgress(account, bills, payDay, today = todayLocal()) {
  if (!account?.goal) return null
  const current = toCents(latestEntry(account)?.value || 0)
  const target = toCents(account.goal.target)
  const bill = (bills || []).find((b) => b.balanceAccountId === account.id)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayTs = utcDate(ty, tm, td).getTime()
  const [by, bm, bd] = account.goal.by.split('-').map(Number)
  const byTs = utcDate(by, bm, bd).getTime()

  let paydaysLeft = 0
  let key = currentPeriodKey(payDay)
  for (let guard = 0; guard < 240; guard++, key = shiftMonthPrefix(key, 1)) {
    const startTs = periodBounds(key, payDay).start.getTime()
    if (startTs > byTs) break
    if (bill && !billAppliesTo(bill, key)) continue
    const pending = startTs > todayTs || (bill && !bill.payments?.[key])
    if (pending) paydaysLeft++
  }

  const isDebt = account.type === 'debt'
  // Savings count up to the target; a debt counts down to it (zero). Interest
  // isn't modelled, so a debt's figure is what's owed now, paid down evenly.
  const remaining = isDebt ? Math.max(0, current - target) : Math.max(0, target - current)
  const perPayday = bill ? toCents(bill.amount) : 0
  const neededPerPayday = paydaysLeft > 0 ? Math.ceil(remaining / paydaysLeft) : remaining
  const reached = isDebt ? current <= target : current >= target
  const onTrack = reached || (paydaysLeft > 0 && perPayday * paydaysLeft >= remaining)
  const start = isDebt ? toCents(account.goal.startValue ?? 0) : 0
  const fraction = isDebt
    ? start > 0
      ? Math.min(1, Math.max(0, (start - current) / start))
      : reached
        ? 1
        : 0
    : target > 0
      ? Math.min(1, current / target)
      : 0
  return {
    kind: isDebt ? 'debt' : 'savings',
    remaining: fromCents(remaining),
    current: fromCents(current),
    target: fromCents(target),
    by: account.goal.by,
    fraction,
    paydaysLeft,
    perPayday: fromCents(perPayday),
    neededPerPayday: fromCents(neededPerPayday),
    hasBill: Boolean(bill),
    reached,
    onTrack
  }
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

  const excluded = excludedCategoryIds(categories)
  const counted = (t) => !excluded.has(t.categoryId)

  const spentCents = inMonth.filter((t) => counted(t) && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const incomeCents = inMonth.filter((t) => counted(t) && t.type === 'income').reduce((sum, t) => sum + t.amount, 0)

  const catSpentInCents = (list, categoryId) =>
    list.filter((t) => counted(t) && t.type === 'expense' && t.categoryId === categoryId).reduce((sum, t) => sum + t.amount, 0)

  const catReceivedInCents = (list, categoryId) =>
    list.filter((t) => counted(t) && t.type === 'income' && t.categoryId === categoryId).reduce((sum, t) => sum + t.amount, 0)

  // Rollover: a category can carry an underspent amount from last month
  // into this month's effective budget, one month back only.
  const effectiveBudgetCents = (c) => {
    if (c.monthlyBudget == null) return null
    if (!c.rollover) return c.monthlyBudget
    const prevSpentCents = catSpentInCents(inPrevMonth, c.id)
    const leftover = Math.max(0, c.monthlyBudget - prevSpentCents)
    return c.monthlyBudget + leftover
  }

  // An excluded category's budget has nothing to be spent against, so it must
  // not inflate the overall budget figure either.
  const budgeted = categories.filter((c) => c.kind !== 'income' && c.monthlyBudget != null && !excluded.has(c.id))
  const budgetCents = budgeted.length
    ? budgeted.reduce((sum, c) => sum + effectiveBudgetCents(c), 0)
    : incomeCents

  const byCategory = categories
    // out of the totals means out of the breakdown and the donut: no slice of
    // a pie it is not part of
    .filter((c) => c.kind !== 'income' && !excluded.has(c.id))
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

  // Where the money came from, mirroring byCategory. Income has no budget or
  // rollover, so a category is just itself plus what it brought in — this
  // period and last, for the same comparison the expense rows show.
  const byIncomeCategory = categories
    .filter((c) => c.kind === 'income' && !excluded.has(c.id))
    .map((c) => {
      const receivedCents = catReceivedInCents(inMonth, c.id)
      return {
        ...c,
        received: fromCents(receivedCents),
        prevReceived: fromCents(catReceivedInCents(inPrevMonth, c.id)),
        _receivedCents: receivedCents
      }
    })
    .filter((c) => !c.archived || c._receivedCents > 0)
    .sort((a, b) => b._receivedCents - a._receivedCents)
    .map(({ _receivedCents, ...rest }) => rest)

  return {
    spent: fromCents(spentCents),
    income: fromCents(incomeCents),
    budget: fromCents(budgetCents),
    left: fromCents(incomeCents - spentCents),
    byCategory,
    byIncomeCategory
  }
}

// Total expense spend per month for the last `count` months (including
// the given month), oldest first, for a simple trend chart.
export async function getRecentMonthTotals(monthPrefix, count = 3, payDayOverride) {
  const payDay = payDayOverride ?? (await getPayDay())
  const periodKey = monthPrefix || currentPeriodKey(payDay)
  const transactions = loadTransactionsRaw()
  const excluded = excludedCategoryIds(loadCategoriesRaw())
  const counted = (t) => !excluded.has(t.categoryId)
  const months = []
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonthPrefix(periodKey, -i))
  }
  return months.map((m) => {
    const inThisPeriod = transactions.filter((t) => inPeriod(t.date, m, payDay))
    const totalCents = inThisPeriod.filter((t) => counted(t) && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const incomeCents = inThisPeriod.filter((t) => counted(t) && t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
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
  return {
    ...a,
    entries: a.entries.map((e) => ({ ...e, value: fromCents(e.value) })),
    ...(a.goal
      ? {
          goal: {
            ...a.goal,
            target: fromCents(a.goal.target),
            ...(a.goal.startValue != null ? { startValue: fromCents(a.goal.startValue) } : {})
          }
        }
      : {})
  }
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
