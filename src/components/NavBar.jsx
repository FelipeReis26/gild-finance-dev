import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

// App chrome: a fixed top bar (hamburger + wordmark) and a slide-in
// drawer holding all six destinations. The drawer is the collapsable
// menu this app always wanted: out of the way until asked for, then
// every screen one tap away.
export default function NavBar({ active, onChange }) {
  const { t } = useApp()
  const [open, setOpen] = useState(false)
  const burgerRef = useRef(null)
  const drawerRef = useRef(null)

  const items = [
    { key: 'dashboard', label: t('navDashboard'), icon: 'ti-home' },
    { key: 'transactions', label: t('navActivity'), icon: 'ti-list' },
    { key: 'bills', label: t('navBills'), icon: 'ti-file-invoice' },
    { key: 'balances', label: t('navBalances'), icon: 'ti-scale' },
    { key: 'scan', label: t('navScan'), icon: 'ti-camera' },
    { key: 'settings', label: t('navSettings'), icon: 'ti-settings' }
  ]

  // While open: focus moves into the drawer, Escape closes and returns
  // focus to the hamburger, so the menu is fully keyboard-operable.
  useEffect(() => {
    if (!open) return
    drawerRef.current?.querySelector('.drawer-item')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        burgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function select(key) {
    onChange(key)
    setOpen(false)
  }

  return (
    <>
      <header className="topbar">
        <button
          ref={burgerRef}
          type="button"
          className="burger"
          aria-label={t('navigation')}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <i className="ti ti-menu-2" aria-hidden="true"></i>
        </button>
        <span className="wordmark">GILD</span>
      </header>

      {open && (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <nav className="drawer" aria-label={t('navigation')} ref={drawerRef}>
            <div className="drawer-head">
              <span className="wordmark">GILD</span>
            </div>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={active === item.key ? 'drawer-item drawer-item-active' : 'drawer-item'}
                aria-current={active === item.key ? 'page' : undefined}
                onClick={() => select(item.key)}
              >
                <i className={`ti ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </>
  )
}
