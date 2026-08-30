import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function NavBar({ active, onChange }) {
  const { t } = useApp()
  const [open, setOpen] = useState(false)

  const TABS = [
    { key: 'dashboard', label: t('navDashboard'), icon: 'ti-home' },
    { key: 'transactions', label: t('navActivity'), icon: 'ti-list' },
    { key: 'bills', label: t('navBills'), icon: 'ti-file-invoice' },
    { key: 'balances', label: t('navBalances'), icon: 'ti-scale' },
    { key: 'scan', label: t('navScan'), icon: 'ti-camera' },
    { key: 'settings', label: t('navSettings'), icon: 'ti-settings' }
  ]

  function select(key) {
    onChange(key)
    setOpen(false)
  }

  return (
    <>
      {open && (
        <div className="nav-menu-backdrop" onClick={() => setOpen(false)}>
          <div className="nav-menu" onClick={(e) => e.stopPropagation()}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={active === tab.key ? 'nav-menu-item nav-menu-item-active' : 'nav-menu-item'}
                onClick={() => select(tab.key)}
              >
                <i className={`ti ${tab.icon}`} aria-hidden="true"></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="nav-fab" onClick={() => setOpen((o) => !o)} aria-label="Menu">
        <i className={`ti ${open ? 'ti-x' : 'ti-menu-2'}`} aria-hidden="true"></i>
      </button>
    </>
  )
}
