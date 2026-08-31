import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

// Bottom tab bar: the four primary destinations sit as thumb-reachable
// tabs, and the two secondary ones (Balances, Settings) live behind a
// "More" sheet so the bar stays at five items and follows the mobile
// convention, rather than hiding all navigation behind a single button.
export default function NavBar({ active, onChange }) {
  const { t } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtnRef = useRef(null)
  const sheetRef = useRef(null)

  // When the More sheet opens, move focus into it and let Escape close it
  // (returning focus to the button), so it is operable without a pointer.
  useEffect(() => {
    if (!moreOpen) return
    sheetRef.current?.querySelector('.more-item')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMoreOpen(false)
        moreBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const primary = [
    { key: 'dashboard', label: t('navDashboard'), icon: 'ti-home' },
    { key: 'transactions', label: t('navActivity'), icon: 'ti-list' },
    { key: 'bills', label: t('navBills'), icon: 'ti-file-invoice' },
    { key: 'scan', label: t('navScan'), icon: 'ti-camera' }
  ]
  const more = [
    { key: 'balances', label: t('navBalances'), icon: 'ti-scale' },
    { key: 'settings', label: t('navSettings'), icon: 'ti-settings' }
  ]
  const moreActive = more.some((m) => m.key === active)

  function select(key) {
    onChange(key)
    setMoreOpen(false)
  }

  return (
    <>
      {moreOpen && <div className="more-backdrop" onClick={() => setMoreOpen(false)} />}
      <nav className="tab-bar" aria-label={t('navigation')}>
        {primary.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={active === tab.key ? 'tab-item tab-item-active' : 'tab-item'}
            aria-current={active === tab.key ? 'page' : undefined}
            onClick={() => select(tab.key)}
          >
            <i className={`ti ${tab.icon}`} aria-hidden="true"></i>
            <span>{tab.label}</span>
          </button>
        ))}

        <div className="tab-more-wrap">
          {moreOpen && (
            <div className="more-sheet" role="menu" ref={sheetRef}>
              {more.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="menuitem"
                  className={active === m.key ? 'more-item more-item-active' : 'more-item'}
                  onClick={() => select(m.key)}
                >
                  <i className={`ti ${m.icon}`} aria-hidden="true"></i>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            ref={moreBtnRef}
            type="button"
            className={moreActive || moreOpen ? 'tab-item tab-item-active' : 'tab-item'}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <i className={`ti ${moreOpen ? 'ti-x' : 'ti-dots'}`} aria-hidden="true"></i>
            <span>{t('more')}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
