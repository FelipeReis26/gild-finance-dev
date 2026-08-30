import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as db from '../db.js'
import { t as translate } from '../i18n.js'

const AppContext = createContext(null)

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
  const [monthTrend, setMonthTrend] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())

  const refresh = useCallback(async (monthOverride) => {
    const month = monthOverride || selectedMonth
    const [cats, txs, billList, sum, curr, bals, lang, trend] = await Promise.all([
      db.getCategories(),
      db.getTransactions(),
      db.getBills(),
      db.getMonthSummary(month),
      db.getCurrency(),
      db.getBalances(),
      db.getLanguage(),
      db.getRecentMonthTotals(month, 6)
    ])
    setCategories(cats)
    setTransactions(txs)
    setBills(billList)
    setSummary(sum)
    setCurrencyState(curr)
    setBalances(bals)
    setLanguageState(lang)
    setMonthTrend(trend)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  useEffect(() => {
    refresh()
  }, [refresh])

  function changeMonth(delta) {
    const next = shiftMonth(selectedMonth, delta)
    setSelectedMonth(next)
    refresh(next)
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

  return (
    <AppContext.Provider
      value={{
        categories,
        transactions,
        bills,
        balances,
        summary,
        currency,
        language,
        changeLanguage,
        monthTrend,
        t: (key) => translate(language, key),
        selectedMonth,
        changeMonth,
        addTransaction,
        editTransaction,
        removeTransaction,
        importTransactions,
        addBill,
        payBill,
        unpayBill,
        removeBill,
        addCategory,
        editCategory,
        removeCategory,
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
