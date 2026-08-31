import { useEffect, useState } from 'react'
import { AppProvider } from './context/AppContext.jsx'
import NavBar from './components/NavBar.jsx'
import Dashboard from './screens/Dashboard.jsx'
import AddTransaction from './screens/AddTransaction.jsx'
import Transactions from './screens/Transactions.jsx'
import Bills from './screens/Bills.jsx'
import AddBill from './screens/AddBill.jsx'
import ScanImport from './screens/ScanImport.jsx'
import Settings from './screens/Settings.jsx'
import Balances from './screens/Balances.jsx'
import Lock from './screens/Lock.jsx'
import Onboarding from './screens/Onboarding.jsx'
import { getPasscode, isFirstRun } from './db.js'
import { useEdgeSwipeBack } from './useSwipe.js'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [navStack, setNavStack] = useState(['dashboard'])
  const [overlay, setOverlay] = useState(null) // 'addTransaction' | 'addBill' | null
  const [editingTx, setEditingTx] = useState(null)
  const [categoryDrillDown, setCategoryDrillDown] = useState(null)
  const [locked, setLocked] = useState(null) // null = checking, true/false after
  const [needsOnboarding, setNeedsOnboarding] = useState(null)

  useEffect(() => {
    getPasscode().then((code) => setLocked(!!code))
    isFirstRun().then(setNeedsOnboarding)
  }, [])

  function openEditTransaction(tx) {
    setEditingTx(tx)
    setOverlay('addTransaction')
  }

  function closeOverlay() {
    setOverlay(null)
    setEditingTx(null)
  }

  function openCategory(categoryId) {
    setCategoryDrillDown(categoryId)
    setTab('transactions')
    setNavStack((s) => (s[s.length - 1] === 'transactions' ? s : [...s, 'transactions']))
  }

  function handleTabChange(nextTab) {
    setCategoryDrillDown(null)
    setNavStack((s) => (s[s.length - 1] === nextTab ? s : [...s, nextTab]))
    setTab(nextTab)
  }

  function goBack() {
    if (overlay) {
      closeOverlay()
      return
    }
    setNavStack((s) => {
      if (s.length <= 1) return s
      const next = s.slice(0, -1)
      setTab(next[next.length - 1])
      return next
    })
  }

  const edgeSwipe = useEdgeSwipeBack(goBack)

  if (locked === null || needsOnboarding === null) return null
  if (locked) return <Lock onUnlock={() => setLocked(false)} />
  if (needsOnboarding) return <Onboarding onDone={(goToImport) => { setNeedsOnboarding(false); if (goToImport) setTab('settings') }} />

  return (
    <AppProvider>
      <div className="app-shell" {...edgeSwipe}>
        <div className="bg-blobs" aria-hidden="true">
          <span className="blob blob-gold" />
          <span className="blob blob-blue" />
          <span className="blob blob-green" />
        </div>
        <main className="app-main">
          {overlay === 'addTransaction' && (
            <AddTransaction prefill={editingTx} editingId={editingTx?.id} onDone={closeOverlay} />
          )}
          {overlay === 'addBill' && <AddBill onDone={closeOverlay} />}

          {!overlay && tab === 'dashboard' && (
            <Dashboard onAddTransaction={() => setOverlay('addTransaction')} onSelectCategory={openCategory} />
          )}
          {!overlay && tab === 'transactions' && (
            <Transactions
              onEditTransaction={openEditTransaction}
              initialCategory={categoryDrillDown}
              initialScope={categoryDrillDown ? 'month' : 'all'}
            />
          )}
          {!overlay && tab === 'bills' && (
            <Bills onAddBill={() => setOverlay('addBill')} />
          )}
          {!overlay && tab === 'scan' && <ScanImport onConfirmed={() => setTab('dashboard')} />}
          {!overlay && tab === 'settings' && <Settings />}
          {!overlay && tab === 'balances' && <Balances />}
        </main>

        {!overlay && <NavBar active={tab} onChange={handleTabChange} />}
        {overlay && (
          <button className="close-overlay" onClick={closeOverlay}>
            Cancel
          </button>
        )}
      </div>
    </AppProvider>
  )
}
