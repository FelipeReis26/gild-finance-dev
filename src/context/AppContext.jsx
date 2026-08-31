import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as db from '../db.js'
import { t as translate } from '../i18n.js'

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
  const [selectedMonth, setSelectedMonth] = useState(null) // null until pay day is known
  const [ready, setReady] = useState(false)

  const refresh = useCallback(
    async (monthOverride, payDayOverride) => {
      const pd = payDayOverride ?? payDay
      const month = monthOverride || selectedMonth || db.currentPeriodKey(pd)
      const [cats, txs, billList, sum, curr, bals, lang, trend, pdFromStore] = await Promise.all([
        db.getCategories(),
        db.getTransactions(),
        db.getBills(),
        db.getMonthSummary(month, pd),
        db.getCurrency(),
        db.getBalances(),
        db.getLanguage(),
        db.getRecentMonthTotals(month, 3, pd),
        db.getPayDay()
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

  const addTransaction = useCallback(
    async (tx) => {
      await db.addTransaction(tx)
      await refresh()
    },
    [refresh]
  )

  const editTransaction = useCallback(
    async (txId, updates) => {
      await db.updateTransaction(txId, updates)
      await refresh()
    },
    [refresh]
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
  const [undoState, setUndoState] = useState(null) // { tx, timerId } | null

  const deleteTransactionWithUndo = useCallback(
    async (txId) => {
      const txToDelete = transactions.find((t) => t.id === txId)
      await db.deleteTransaction(txId)
      await refresh()
      if (txToDelete) {
        setUndoState((prev) => {
          if (prev?.timerId) clearTimeout(prev.timerId)
          const timerId = setTimeout(() => setUndoState(null), 6000)
          return { tx: txToDelete, timerId }
        })
      }
    },
    [refresh, transactions]
  )

  const undoDelete = useCallback(async () => {
    setUndoState((prev) => {
      if (prev?.timerId) clearTimeout(prev.timerId)
      if (prev?.tx) {
        const { id, ...rest } = prev.tx
        db.addTransaction(rest).then(() => refresh())
      }
      return null
    })
  }, [refresh])

  const dismissUndo = useCallback(() => {
    setUndoState((prev) => {
      if (prev?.timerId) clearTimeout(prev.timerId)
      return null
    })
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

  const removeBalanceAccount = useCallback(
    async (accountId) => {
      await db.deleteBalanceAccount(accountId)
      await refresh()
    },
    [refresh]
  )

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
        importTransactions,
        addBill,
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
