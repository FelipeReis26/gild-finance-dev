import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as db from '../db.js'
import { formatMoney, localeFor, t as translate, tf } from '../i18n.js'
import { syncReminders } from '../reminders.js'
import { fetchTrips, getTripsyToken, setTripsyToken, tripShare, isStale, TripsyError } from '../tripsy.js'
import { takeInbox, toPending } from '../applePay.js'

const AppContext = createContext(null)

// Pure integer arithmetic, no Date/timezone conversion involved, so this
// can't be thrown off by the browser's local timezone offset the way
// constructing a Date object and reading it back via toISOString can.
function shiftMonth(monthStr, delta) {
  let [y, m] = monthStr.split('-').map(Number)
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

export function AppProvider({ children }) {
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [bills, setBills] = useState([])
  const [balances, setBalances] = useState([])
  const [summary, setSummary] = useState(null)
  const [currency, setCurrencyState] = useState({ code: 'EUR', symbol: '€' })
  const [language, setLanguageState] = useState('en')
  const [payDay, setPayDayState] = useState(1)
  const [monthTrend, setMonthTrend] = useState([])
  const [cash, setCash] = useState({ enabled: false, openingValue: 0, openingDate: '' })
  const [accounts, setAccounts] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null) // null until pay day is known
  const [ready, setReady] = useState(false)
  // A one-off confirmation for something the app did on its own — currently
  // only an auto-linked balance being brought down. Separate from undoState
  // because there is nothing to undo, it just should not happen invisibly.
  // Also carries limit warnings: { text, sub?, kind?: 'near' | 'over', fraction? }.
  const [notice, setNotice] = useState(null) // { text, ... } | null
  const noticeTimer = useRef(null)
  const showNotice = useCallback((text, extra = {}) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice({ text, ...extra })
    noticeTimer.current = setTimeout(() => setNotice(null), extra.kind ? 6500 : 5000)
  }, [])
  const dismissNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(null)
  }, [])

  const refresh = useCallback(
    async (monthOverride, payDayOverride) => {
      const pd = payDayOverride ?? payDay
      const month = monthOverride || selectedMonth || db.currentPeriodKey(pd)
      const [cats, txs, billList, sum, curr, bals, lang, trend, pdFromStore, cashRec, accts] = await Promise.all([
        db.getCategories(),
        db.getTransactions(),
        db.getBills(),
        db.getMonthSummary(month, pd),
        db.getCurrency(),
        db.getBalances(),
        db.getLanguage(),
        db.getRecentMonthTotals(month, 3, pd),
        db.getPayDay(),
        db.getCash(),
        db.getAccounts()
      ])
      setCategories(cats)
      setTransactions(txs)
      setBills(billList)
      setSummary(sum)
      setCurrencyState(curr)
      setBalances(bals)
      setLanguageState(lang)
      setPayDayState(pdFromStore)
      setMonthTrend(trend)
      setCash(cashRec)
      setAccounts(accts)
      setSelectedMonth(month)
      setReady(true)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selectedMonth, payDay]
  )

  useEffect(() => {
    // On first load, figure out which pay period "now" falls into before
    // fetching anything else, so the very first render already shows the
    // right period rather than a plain calendar month.
    ;(async () => {
      const pd = await db.getPayDay()
      const initial = db.currentPeriodKey(pd)
      await refresh(initial, pd)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function changeMonth(delta) {
    const next = shiftMonth(selectedMonth, delta)
    setSelectedMonth(next)
    refresh(next)
  }

  function goToMonth(monthKey) {
    setSelectedMonth(monthKey)
    refresh(monthKey)
  }

  const announceAutoBalance = useCallback(
    (saved) => {
      const fx = saved?._autoBalance
      if (!fx) return
      showNotice(
        translate(language, 'autoBalanceUpdated')
          .replace('{name}', fx.accountName)
          .replace('{value}', formatMoney(language, currency, fx.value, { decimals: 2 }))
      )
    },
    [language, currency, showNotice]
  )

  // Limit warnings: the current period's summary before and after a change;
  // if the change pushed a category past 80% of its limit, or over it, say
  // so straight away. A balance notice wins if both apply (it's rarer and
  // says something the app did by itself).
  const periodSnapshot = useCallback(async () => {
    const settings = await db.getReminderSettings()
    if (!settings.limits) return null
    const key = db.currentPeriodKey(payDay)
    return { key, summary: await db.getMonthSummary(key, payDay) }
  }, [payDay])

  const announceLimit = useCallback(
    async (before, categoryId) => {
      if (!before || !categoryId) return
      const after = await db.getMonthSummary(before.key, payDay)
      const c = db.budgetCrossing(before.summary, after, categoryId)
      if (!c) return
      const { end } = db.periodBounds(before.key, payDay)
      const [y, m, d] = db.todayLocalDate().split('-').map(Number)
      const days = Math.max(1, Math.round((end.getTime() - Date.UTC(y, m - 1, d)) / 86400000) + 1)
      const money = (v, decimals = 0) => formatMoney(language, currency, v, { decimals })
      const vars = { name: c.name, spent: money(c.spent), budget: money(c.budget), days }
      if (c.level === 'over') {
        showNotice(tf(language, 'limitOver', vars), { sub: tf(language, 'limitOverSub', vars), kind: 'over' })
      } else {
        const perDay = Math.max(0, c.budget - c.spent) / days
        showNotice(tf(language, 'limitNear', vars), {
          sub: tf(language, 'limitNearSub', { ...vars, pct: Math.round(c.fraction * 100), perDay: money(perDay) }),
          kind: 'near',
          fraction: c.fraction
        })
      }
    },
    [payDay, language, currency, showNotice]
  )

  const addTransaction = useCallback(
    async (tx) => {
      const before = await periodSnapshot()
      const saved = await db.addTransaction(tx)
      await refresh()
      if (saved?._autoBalance) announceAutoBalance(saved)
      else await announceLimit(before, saved?.categoryId)
    },
    [refresh, announceAutoBalance, periodSnapshot, announceLimit]
  )

  const editTransaction = useCallback(
    async (txId, updates) => {
      const before = await periodSnapshot()
      const saved = await db.updateTransaction(txId, updates)
      await refresh()
      if (saved?._autoBalance) announceAutoBalance(saved)
      else await announceLimit(before, saved?.categoryId)
    },
    [refresh, announceAutoBalance, periodSnapshot, announceLimit]
  )

  const removeTransaction = useCallback(
    async (txId) => {
      await db.deleteTransaction(txId)
      await refresh()
    },
    [refresh]
  )

  // Delete-with-undo: the delete happens immediately, but the deleted
  // transaction's data is kept around for a few seconds so it can be
  // put back exactly as it was if the person taps Undo.
  //
  // The timer lives in a ref and every mutation happens outside the state
  // updaters on purpose. React invokes updaters twice in development, so a
  // db call inside one ran twice: Undo restored the transaction twice over,
  // and once a category could auto-adjust a balance it applied the payment
  // twice too.
  const [undoState, setUndoState] = useState(null) // { tx, links } | null
  const undoTimer = useRef(null)

  const deleteTransactionWithUndo = useCallback(
    async (txId) => {
      const txToDelete = transactions.find((t) => t.id === txId)
      const links = await db.deleteTransaction(txId)
      await refresh()
      if (!txToDelete) return
      if (undoTimer.current) clearTimeout(undoTimer.current)
      setUndoState({ tx: txToDelete, links })
      undoTimer.current = setTimeout(() => setUndoState(null), 6000)
    },
    [refresh, transactions]
  )

  const undoDelete = useCallback(async () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    const pending = undoState?.tx
    setUndoState(null)
    if (!pending) return
    // Put back exactly what the delete took away: the row, any bill it paid,
    // and the Balances card it moved (a fresh entry, not the removed one).
    const saved = await db.restoreTransaction(pending, undoState.links)
    await refresh()
    announceAutoBalance(saved)
  }, [undoState, refresh, announceAutoBalance])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoState(null)
  }, [])

  const importTransactions = useCallback(
    async (list) => {
      const count = await db.importTransactions(list)
      await refresh()
      return count
    },
    [refresh]
  )

  const addBill = useCallback(
    async (bill) => {
      await db.addBill(bill)
      await refresh()
    },
    [refresh]
  )

  const updateBill = useCallback(
    async (billId, updates) => {
      await db.updateBill(billId, updates)
      await refresh()
    },
    [refresh]
  )

  const payBill = useCallback(
    async (billId, month) => {
      await db.markBillPaid(billId, month || selectedMonth)
      await refresh()
    },
    [refresh, selectedMonth]
  )

  const unpayBill = useCallback(
    async (billId, month) => {
      await db.markBillUnpaid(billId, month || selectedMonth)
      await refresh()
    },
    [refresh, selectedMonth]
  )

  const removeBill = useCallback(
    async (billId) => {
      await db.deleteBill(billId)
      await refresh()
    },
    [refresh]
  )

  const addCategory = useCallback(
    async (category) => {
      await db.addCategory(category)
      await refresh()
    },
    [refresh]
  )

  const editCategory = useCallback(
    async (categoryId, updates) => {
      await db.updateCategory(categoryId, updates)
      await refresh()
    },
    [refresh]
  )

  const removeCategory = useCallback(
    async (categoryId) => {
      await db.deleteCategory(categoryId)
      await refresh()
    },
    [refresh]
  )

  const restoreCategory = useCallback(
    async (categoryId) => {
      await db.restoreCategory(categoryId)
      await refresh()
    },
    [refresh]
  )

  const changeCurrency = useCallback(
    async (curr) => {
      await db.setCurrency(curr)
      await refresh()
    },
    [refresh]
  )

  const changeLanguage = useCallback(
    async (lang) => {
      await db.setLanguage(lang)
      await refresh()
    },
    [refresh]
  )

  const updateAccount = useCallback(
    async (accountId, updates) => {
      await db.updateAccount(accountId, updates)
      await refresh()
    },
    [refresh]
  )

  const addAccount = useCallback(
    async (account) => {
      await db.addAccount(account)
      await refresh()
    },
    [refresh]
  )

  const removeAccount = useCallback(
    async (accountId) => {
      await db.deleteAccount(accountId)
      await refresh()
    },
    [refresh]
  )

  const changeCash = useCallback(
    async (next) => {
      await db.setCash(next)
      await refresh()
    },
    [refresh]
  )

  const changePayDay = useCallback(
    async (day) => {
      const newPayDay = await db.setPayDay(day)
      // Re-anchor to whichever period "now" falls into under the new
      // payday, rather than keeping the old period key, since its
      // meaning has just changed.
      const newSelected = db.currentPeriodKey(newPayDay)
      await refresh(newSelected, newPayDay)
    },
    [refresh]
  )

  const addBalanceAccount = useCallback(
    async (account) => {
      await db.addBalanceAccount(account)
      await refresh()
    },
    [refresh]
  )

  const addBalanceEntry = useCallback(
    async (accountId, entry) => {
      await db.addBalanceEntry(accountId, entry)
      await refresh()
    },
    [refresh]
  )

  const setBalanceGoal = useCallback(
    async (accountId, goal) => {
      await db.setBalanceGoal(accountId, goal)
      await refresh()
    },
    [refresh]
  )

  const removeBalanceAccount = useCallback(
    async (accountId) => {
      await db.deleteBalanceAccount(accountId)
      await refresh()
    },
    [refresh]
  )

  // Phone reminders follow the data: whenever anything they depend on
  // changes (and on every launch), the whole set is worked out again and
  // rescheduled, a moment later so a burst of edits reschedules once.
  const rescheduleReminders = useCallback(async () => {
    const settings = await db.getReminderSettings()
    const [txs, billList, cats, bals] = await Promise.all([db.getTransactions(), db.getBills(), db.getCategories(), db.getBalances()])
    const plan = db.planReminders({
      bills: billList,
      categories: cats,
      balances: bals,
      transactions: txs,
      payDay,
      settings,
      text: (key, vars) => tf(language, key, vars),
      money: (v) => formatMoney(language, currency, v, { decimals: Number.isInteger(v) ? 0 : 2 }),
      weekday: (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(language), { weekday: 'long' })
    })
    try {
      return await syncReminders(plan)
    } catch (err) {
      console.error('Gild: scheduling reminders failed', err)
      return 0
    }
  }, [payDay, language, currency])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => rescheduleReminders(), 1500)
    return () => clearTimeout(timer)
  }, [ready, transactions, bills, balances, categories, payDay, language, currency, rescheduleReminders])

  // Tripsy: the trips last read (kept for offline), and a refresh that reads
  // them again, saves them and moves any goal that follows a trip.
  const [tripsy, setTripsy] = useState({ trips: [], fetchedAt: null, connected: false, error: null, loading: false })
  // the latest refresh, so a Tripsy read that finishes later doesn't refresh
  // with the month that was showing when it started
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const refreshTripsy = useCallback(
    async ({ force = false, token } = {}) => {
      const key = token ?? getTripsyToken()
      const cache = await db.getTripsyCache()
      if (!key) {
        setTripsy({ trips: [], fetchedAt: null, connected: false, error: null, loading: false })
        return { ok: false, kind: 'none' }
      }
      if (!force && cache && !isStale(cache.fetchedAt)) {
        setTripsy({ trips: cache.trips, fetchedAt: cache.fetchedAt, connected: true, error: null, loading: false })
        return { ok: true, cached: true }
      }
      setTripsy((t) => ({ ...t, loading: true }))
      try {
        const trips = await fetchTrips(key)
        const saved = await db.saveTripsyCache(trips)
        await db.syncTripGoals(trips, (trip) => tripShare(trip).remaining)
        if (token) setTripsyToken(token)
        setTripsy({ trips, fetchedAt: saved.fetchedAt, connected: true, error: null, loading: false })
        await refreshRef.current()
        return { ok: true }
      } catch (err) {
        const kind = err instanceof TripsyError ? err.kind : 'network'
        // a refused key on connect isn't kept; a failed refresh keeps what was read before
        setTripsy({
          trips: token ? [] : cache?.trips || [],
          fetchedAt: token ? null : cache?.fetchedAt || null,
          connected: !token && Boolean(getTripsyToken()),
          error: kind,
          loading: false
        })
        return { ok: false, kind }
      }
    },
    []
  )

  const disconnectTripsy = useCallback(async () => {
    setTripsyToken('')
    await db.clearTripsyCache()
    setTripsy({ trips: [], fetchedAt: null, connected: false, error: null, loading: false })
  }, [])

  const linkGoalToTrip = useCallback(
    async (accountId, slug) => {
      await db.linkGoalToTrip(accountId, slug)
      const cache = await db.getTripsyCache()
      if (slug && cache) await db.syncTripGoals(cache.trips, (trip) => tripShare(trip).remaining)
      await refresh()
    },
    [refresh]
  )

  // Apple Pay payments from the Shortcuts automation: picked up from the inbox
  // on launch and whenever Gild comes back to the front, then held until
  // confirmed or dismissed.
  const [applePay, setApplePay] = useState([])
  const collectApplePay = useCallback(async () => {
    const fresh = toPending(await takeInbox())
    setApplePay(fresh.length ? await db.addApplePayPending(fresh) : await db.getApplePayPending())
  }, [])
  useEffect(() => {
    if (!ready) return
    collectApplePay()
    const onShow = () => document.visibilityState === 'visible' && collectApplePay()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [ready, collectApplePay])

  // rows: [{ pending, categoryId, note, accountId }]
  const confirmApplePay = useCallback(
    async (rows) => {
      if (!rows.length) return 0
      await db.importTransactions(
        rows.map(({ pending: p, categoryId, note, accountId }) => ({
          type: p.refund ? 'income' : 'expense',
          amount: p.amount,
          categoryId,
          date: p.date,
          note: note || p.merchant,
          bankNote: p.merchant,
          cardName: p.card || undefined,
          accountId,
          source: 'applepay'
        }))
      )
      setApplePay(await db.removeApplePayPending(rows.map((r) => r.pending.id)))
      await refreshRef.current()
      return rows.length
    },
    []
  )

  const dismissApplePay = useCallback(async (ids) => {
    setApplePay(await db.removeApplePayPending(ids))
  }, [])

  // On launch (and at most hourly), read Tripsy again if it's connected.
  useEffect(() => {
    if (!ready) return
    refreshTripsy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const periodLabel = selectedMonth ? db.periodLabel(selectedMonth, payDay, language) : ''

  return (
    <AppContext.Provider
      value={{
        ready,
        categories,
        transactions,
        bills,
        balances,
        summary,
        currency,
        language,
        changeLanguage,
        payDay,
        changePayDay,
        periodLabel,
        monthTrend,
        cash,
        changeCash,
        accounts,
        updateAccount,
        addAccount,
        removeAccount,
        t: (key) => translate(language, key),
        selectedMonth,
        changeMonth,
        goToMonth,
        addTransaction,
        editTransaction,
        removeTransaction,
        deleteTransactionWithUndo,
        undoState,
        undoDelete,
        dismissUndo,
        notice,
        dismissNotice,
        importTransactions,
        addBill,
        updateBill,
        payBill,
        unpayBill,
        removeBill,
        addCategory,
        editCategory,
        removeCategory,
        restoreCategory,
        changeCurrency,
        addBalanceAccount,
        addBalanceEntry,
        setBalanceGoal,
        rescheduleReminders,
        tripsy,
        refreshTripsy,
        applePay,
        confirmApplePay,
        dismissApplePay,
        disconnectTripsy,
        linkGoalToTrip,
        removeBalanceAccount,
        refresh
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
