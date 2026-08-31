// Data layer. Every function is async so the storage backend can be
// swapped for @capacitor-community/sqlite later without touching
// any screen code.

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
  a2hsDismissed: 'ft_a2hs_dismissed'
}

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

function fmtUtcDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// The period identified by `periodKey` (e.g. '2026-07') starts on
// min(payDay, days in that month) of that month, and ends the day
// before the next period starts. With payDay=1 this is exactly a
// plain calendar month.
export function periodBounds(periodKey, payDay) {
  const [y, m] = periodKey.split('-').map(Number)
  const startDay = Math.min(payDay, daysInMonth(periodKey))
  const start = utcDate(y, m, startDay)
  const nextKey = shiftMonthPrefix(periodKey, 1)
  const [ny, nm] = nextKey.split('-').map(Number)
  const nextStartDay = Math.min(payDay, daysInMonth(nextKey))
  const end = new Date(utcDate(ny, nm, nextStartDay).getTime() - 86400000)
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
  const clampedPayDay = Math.min(payDay, daysInMonth(thisMonthKey))
  return d >= clampedPayDay ? thisMonthKey : shiftMonthPrefix(thisMonthKey, -1)
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function periodLabel(periodKey, payDay) {
  if (payDay <= 1) {
    const [y, m] = periodKey.split('-').map(Number)
    return `${MONTH_FULL[m - 1]} ${y}`
  }
  const { start, end } = periodBounds(periodKey, payDay)
  const label = (d) => `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`
  return `${label(start)} – ${label(end)} ${end.getUTCFullYear()}`
}

// Where a bill's due day actually falls within a given pay period —
// if the due day is on or after payday it's in the period's own
// starting month, otherwise it's in the following calendar month
// (e.g. payday the 19th, rent due the 5th, falls in the second half
// of the period).
export function billDateWithinPeriod(periodKey, payDay, dueDay) {
  const ownDays = daysInMonth(periodKey)
  if (dueDay >= payDay) {
    const day = Math.min(dueDay, ownDays)
    return `${periodKey}-${String(day).padStart(2, '0')}`
  }
  const nextKey = shiftMonthPrefix(periodKey, 1)
  const day = Math.min(dueDay, daysInMonth(nextKey))
  return `${nextKey}-${String(day).padStart(2, '0')}`
}

// monthlyBudget is optional. A category with no budget is tracked but
// never flagged as over spent, and doesn't count toward the overall gauge.
const defaultCategories = [
  { id: 'rent', name: 'Rent', icon: 'ti-home', monthlyBudget: null, accent: '#6FBFA0', tint: 'rgba(111, 191, 160, 0.16)', borderTint: 'rgba(111, 191, 160, 0.35)', kind: 'expense' },
  { id: 'fuel-insurance', name: 'Fuel & insurance', icon: 'ti-gas-station', monthlyBudget: null, accent: '#7C93D6', tint: 'rgba(124, 147, 214, 0.16)', borderTint: 'rgba(124, 147, 214, 0.35)', kind: 'expense' },
  { id: 'streaming', name: 'Streaming', icon: 'ti-device-tv', monthlyBudget: null, accent: '#B67CC9', tint: 'rgba(182, 124, 201, 0.16)', borderTint: 'rgba(182, 124, 201, 0.35)', kind: 'expense' },
  { id: 'utilities', name: 'Utilities', icon: 'ti-wifi', monthlyBudget: null, accent: '#8FA8C9', tint: 'rgba(143, 168, 201, 0.16)', borderTint: 'rgba(143, 168, 201, 0.35)', kind: 'expense' },
  { id: 'car-loan', name: 'Car loan', icon: 'ti-car', monthlyBudget: null, accent: '#D6935F', tint: 'rgba(214, 147, 95, 0.16)', borderTint: 'rgba(214, 147, 95, 0.35)', kind: 'expense' },
  { id: 'savings', name: 'Savings', icon: 'ti-pig-money', monthlyBudget: null, accent: '#6FA8BF', tint: 'rgba(111, 168, 191, 0.16)', borderTint: 'rgba(111, 168, 191, 0.35)', kind: 'expense' },
  { id: 'food', name: 'Food', icon: 'ti-tools-kitchen-2', monthlyBudget: null, accent: '#D6A57C', tint: 'rgba(214, 165, 124, 0.16)', borderTint: 'rgba(214, 165, 124, 0.35)', kind: 'expense' },
  { id: 'purchases', name: 'Purchases', icon: 'ti-shopping-bag', monthlyBudget: null, accent: '#9F8FD6', tint: 'rgba(159, 143, 214, 0.16)', borderTint: 'rgba(159, 143, 214, 0.35)', kind: 'expense' },
  { id: 'gifts', name: 'Gifts', icon: 'ti-gift', monthlyBudget: null, accent: '#D67CC0', tint: 'rgba(214, 124, 192, 0.16)', borderTint: 'rgba(214, 124, 192, 0.35)', kind: 'expense' },
  { id: 'holidays', name: 'Holidays', icon: 'ti-plane', monthlyBudget: null, accent: '#7CC9B0', tint: 'rgba(124, 201, 176, 0.16)', borderTint: 'rgba(124, 201, 176, 0.35)', kind: 'expense' },
  { id: 'health', name: 'Health', icon: 'ti-heart', monthlyBudget: null, accent: '#D67C7C', tint: 'rgba(214, 124, 124, 0.16)', borderTint: 'rgba(214, 124, 124, 0.35)', kind: 'expense' },
  { id: 'other', name: 'Other / misc', icon: 'ti-receipt', monthlyBudget: null, accent: '#9A9EA6', tint: 'rgba(154, 158, 166, 0.16)', borderTint: 'rgba(154, 158, 166, 0.35)', kind: 'expense' },
  { id: 'wages', name: 'Wages', icon: 'ti-briefcase', monthlyBudget: null, accent: '#8FDBB5', tint: 'rgba(143, 219, 181, 0.16)', borderTint: 'rgba(143, 219, 181, 0.35)', kind: 'income' },
  { id: 'overtime', name: 'Overtime', icon: 'ti-clock', monthlyBudget: null, accent: '#F0D190', tint: 'rgba(240, 209, 144, 0.16)', borderTint: 'rgba(240, 209, 144, 0.35)', kind: 'income' },
  { id: 'other-income', name: 'Other income', icon: 'ti-cash', monthlyBudget: null, accent: '#8FA8C9', tint: 'rgba(143, 168, 201, 0.16)', borderTint: 'rgba(143, 168, 201, 0.35)', kind: 'income' }
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
  return load(KEYS.payDay, 1)
}

export async function setPayDay(day) {
  const clamped = Math.min(31, Math.max(1, parseInt(day, 10) || 1))
  save(KEYS.payDay, clamped)
  return clamped
}

// Onboarding only runs on a genuinely fresh install — if any storage
// key already exists (an existing user updating to a newer version),
// it's skipped automatically so nobody who's already using the app
// gets interrupted by a first-run wizard.
export async function isFirstRun() {
  const anyExisting = Object.values(KEYS).some((k) => localStorage.getItem(k) !== null)
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

export async function getCategories() {
  return load(KEYS.categories, defaultCategories)
}

export async function addCategory({ name, icon, kind }) {
  const categories = load(KEYS.categories, defaultCategories)
  const palette = accentPalette[categories.length % accentPalette.length]
  const record = {
    id: id(),
    name,
    icon: icon || 'ti-tag',
    monthlyBudget: null,
    kind: kind || 'expense',
    ...palette
  }
  categories.push(record)
  save(KEYS.categories, categories)
  return record
}

export async function updateCategory(categoryId, updates) {
  const categories = load(KEYS.categories, defaultCategories)
  const cat = categories.find((c) => c.id === categoryId)
  if (!cat) return null
  Object.assign(cat, updates)
  save(KEYS.categories, categories)
  return cat
}

export async function deleteCategory(categoryId) {
  const categories = load(KEYS.categories, defaultCategories)
  save(
    KEYS.categories,
    categories.filter((c) => c.id !== categoryId)
  )
}

export async function getTransactions() {
  const list = load(KEYS.transactions, [])
  return list.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function addTransaction(tx) {
  const list = load(KEYS.transactions, [])
  const record = { id: id(), ...tx }
  list.push(record)
  save(KEYS.transactions, list)
  return record
}

// Bulk import: adds a batch of transactions on top of what's already
// there, rather than replacing anything, so a bank statement or
// screenshot batch can be merged in safely.
export async function importTransactions(list) {
  const existing = load(KEYS.transactions, [])
  const added = list.map((t) => ({ id: id(), ...t }))
  save(KEYS.transactions, [...existing, ...added])
  return added.length
}

export async function updateTransaction(txId, updates) {
  const list = load(KEYS.transactions, [])
  const tx = list.find((t) => t.id === txId)
  if (!tx) return null
  Object.assign(tx, updates)
  save(KEYS.transactions, list)
  return tx
}

export async function deleteTransaction(txId) {
  const list = load(KEYS.transactions, [])
  save(
    KEYS.transactions,
    list.filter((t) => t.id !== txId)
  )
}

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

export async function getBills() {
  const raw = load(KEYS.bills, [])
  const migrated = raw.map(migrateBill)
  const changed = JSON.stringify(raw) !== JSON.stringify(migrated)
  if (changed) save(KEYS.bills, migrated)
  return migrated
}

export async function addBill({ name, amount, categoryId, dueDay }) {
  const list = load(KEYS.bills, [])
  const record = {
    id: id(),
    name,
    amount,
    categoryId,
    dueDay: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)),
    payments: {}
  }
  list.push(record)
  save(KEYS.bills, list)
  return record
}

export async function deleteBill(billId) {
  const list = load(KEYS.bills, [])
  save(
    KEYS.bills,
    list.filter((b) => b.id !== billId)
  )
}

export async function markBillPaid(billId, monthPrefix) {
  const bills = (await getBills())
  const bill = bills.find((b) => b.id === billId)
  if (!bill) return null

  const payDay = await getPayDay()
  const isCurrentPeriod = monthPrefix === currentPeriodKey(payDay)
  const paidDate = isCurrentPeriod ? todayLocal() : billDateWithinPeriod(monthPrefix, payDay, bill.dueDay)

  const record = await addTransaction({
    amount: bill.amount,
    categoryId: bill.categoryId,
    date: paidDate,
    note: bill.name,
    type: 'expense',
    source: 'bill'
  })

  bill.payments[monthPrefix] = { paidDate, transactionId: record.id }
  save(KEYS.bills, bills)

  return bill
}

export async function markBillUnpaid(billId, monthPrefix) {
  const bills = await getBills()
  const bill = bills.find((b) => b.id === billId)
  if (!bill) return null
  const payment = bill.payments[monthPrefix]
  if (payment?.transactionId) {
    await deleteTransaction(payment.transactionId)
  }
  delete bill.payments[monthPrefix]
  save(KEYS.bills, bills)
  return bill
}

export async function getMonthSummary(monthPrefix, payDayOverride) {
  const payDay = payDayOverride ?? (await getPayDay())
  const periodKey = monthPrefix || currentPeriodKey(payDay)
  const [transactions, categories] = [await getTransactions(), await getCategories()]
  const inMonth = transactions.filter((t) => inPeriod(t.date, periodKey, payDay))
  const prevMonthPrefix = shiftMonthPrefix(periodKey, -1)
  const inPrevMonth = transactions.filter((t) => inPeriod(t.date, prevMonthPrefix, payDay))

  const spent = inMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const income = inMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)

  const catSpentIn = (list, categoryId) =>
    list.filter((t) => t.type === 'expense' && t.categoryId === categoryId).reduce((sum, t) => sum + t.amount, 0)

  // Rollover: a category can carry an underspent amount from last month
  // into this month's effective budget, one month back only.
  const effectiveBudget = (c) => {
    if (c.monthlyBudget == null) return null
    if (!c.rollover) return c.monthlyBudget
    const prevSpent = catSpentIn(inPrevMonth, c.id)
    const leftover = Math.max(0, c.monthlyBudget - prevSpent)
    return c.monthlyBudget + leftover
  }

  const budgeted = categories.filter((c) => c.kind !== 'income' && c.monthlyBudget != null)
  const budget = budgeted.length ? budgeted.reduce((sum, c) => sum + effectiveBudget(c), 0) : income

  const byCategory = categories
    .filter((c) => c.kind !== 'income')
    .map((c) => {
      const catSpent = catSpentIn(inMonth, c.id)
      const prevSpent = catSpentIn(inPrevMonth, c.id)
      return { ...c, spent: catSpent, prevSpent, effectiveBudget: effectiveBudget(c) }
    })

  return { spent, income, budget, left: income - spent, byCategory }
}

// Total expense spend per month for the last `count` months (including
// the given month), oldest first, for a simple trend chart.
export async function getRecentMonthTotals(monthPrefix, count = 3, payDayOverride) {
  const payDay = payDayOverride ?? (await getPayDay())
  const periodKey = monthPrefix || currentPeriodKey(payDay)
  const transactions = await getTransactions()
  const months = []
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonthPrefix(periodKey, -i))
  }
  return months.map((m) => {
    const inThisPeriod = transactions.filter((t) => inPeriod(t.date, m, payDay))
    return {
      month: m,
      total: inThisPeriod.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      income: inThisPeriod.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    }
  })
}

// Balances: named accounts (debts or savings pots) with a history of
// dated entries, so a running total can be tracked over time, the
// same way the spreadsheet tracks car loan and credit union balances.
export async function getBalances() {
  return load(KEYS.balances, [])
}

export async function addBalanceAccount({ name, type, icon, openingValue, date }) {
  const accounts = load(KEYS.balances, [])
  const palette = accentPalette[accounts.length % accentPalette.length]
  const defaultIcon = type === 'debt' ? 'ti-credit-card' : type === 'owed' ? 'ti-user' : 'ti-pig-money'
  const record = {
    id: id(),
    name,
    type, // 'debt' | 'savings' | 'owed'
    icon: icon || defaultIcon,
    ...palette,
    entries: [{ date: date || todayLocal(), value: openingValue }]
  }
  accounts.push(record)
  save(KEYS.balances, accounts)
  return record
}

export async function addBalanceEntry(accountId, { date, value }) {
  const accounts = load(KEYS.balances, [])
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return null
  account.entries.push({ date, value })
  save(KEYS.balances, accounts)
  return account
}

export async function deleteBalanceAccount(accountId) {
  const accounts = load(KEYS.balances, [])
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

// Backup and restore. Exports every stored key as one JSON file the
// person can save, and restores it wholesale on another device or
// after clearing browser data.
export async function exportBackup() {
  const data = {}
  for (const key of Object.values(KEYS)) {
    const raw = localStorage.getItem(key)
    if (raw) data[key] = JSON.parse(raw)
  }
  return data
}

export async function importBackup(data) {
  for (const key of Object.values(KEYS)) {
    if (data[key] !== undefined) {
      save(key, data[key])
    }
  }
}
