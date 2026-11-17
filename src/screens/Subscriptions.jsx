import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { findSubscriptions, getHiddenSubscriptions, setSubscriptionHidden, todayLocalDate, isHiddenSubscription } from '../db.js'
import { formatMoney, localeFor } from '../i18n.js'

// Repeat charges Gild found in the transactions: what's still running, what
// looks late (often a cancellation that worked), and what stopped recently.
// Found from logged and imported data only; nothing is fetched.
export default function Subscriptions() {
  const { transactions, bills, categories, currency, language, addBill, t } = useApp()
  const money = (v) => formatMoney(language, currency, v, { decimals: 2 })
  const shortDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' })
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))

  const [hidden, setHidden] = useState([])
  const [open, setOpen] = useState(null)
  const [showHidden, setShowHidden] = useState(false)
  useEffect(() => {
    getHiddenSubscriptions().then(setHidden)
  }, [])

  const all = useMemo(
    () => findSubscriptions(transactions, bills, todayLocalDate(), categories),
    [transactions, bills, categories]
  )
  const isHidden = (s) => isHiddenSubscription(s, hidden)
  const visible = all.filter((s) => !isHidden(s))
  const active = visible.filter((s) => s.status === 'active')
  const late = visible.filter((s) => s.status === 'late')
  const stopped = visible.filter((s) => s.status === 'stopped')
  const hiddenOnes = all.filter(isHidden)

  const monthly = active.reduce((sum, s) => sum + Math.round(s.monthly * 100), 0) / 100

  async function toggleHidden(s, hide) {
    if (hide) setHidden(await setSubscriptionHidden(s.key, true))
    else {
      // un-hide every stored entry that matches it (its price may have moved since)
      let list = hidden
      for (const h of hidden.filter((h) => isHiddenSubscription(s, [h]))) list = await setSubscriptionHidden(h, false)
      setHidden(list)
    }
    setOpen(null)
  }

  async function makeBill(s) {
    // Due on the day of the month it last charged; the category it was filed under.
    await addBill({
      name: s.name,
      amount: s.amount,
      categoryId: s.categoryId || 'other',
      dueDay: parseInt(s.lastDate.slice(8, 10), 10)
    })
    setOpen(null)
  }

  // A render helper, not a component: a component defined in here would be a
  // new type each render and remount (dropping focus) whenever a row opens.
  function renderRow(s, isHidden = false) {
    const cat = categoryById[s.categoryId]
    const warn = s.status !== 'active'
    const sub =
      s.status === 'active' ? (
        <>
          {t('nextAround')}
          {shortDate(s.nextExpected)} · {s.billId ? <span className="pill-muted">{t('inBills')}</span> : t('notABill')}
        </>
      ) : (
        <>
          {t('expectedOn')} {shortDate(s.nextExpected)} · {t('notChargedYet')}
        </>
      )
    const isOpen = open === s.key
    return (
      <div className="list-row sub-row" key={s.key}>
        <button type="button" className="row between sub-main" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.key)}>
          <span className="row gap" style={{ minWidth: 0 }}>
            <span className="icon-badge" style={{ background: cat?.tint, borderColor: cat?.borderTint }}>
              <i
                className={`ti ${cat?.icon || 'ti-repeat'}`}
                style={{ color: warn ? 'var(--danger-text)' : cat?.accent || 'var(--gold)' }}
                aria-hidden="true"
              ></i>
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="row-title" style={{ display: 'block' }}>{s.name}</span>
              <span className="row-sub" style={{ display: 'block' }}>{sub}</span>
            </span>
          </span>
          <span className="col-right">
            <span className="row-amount">{money(s.amount)}</span>
            {warn && <span className="pill-warn">{s.status === 'late' ? t('latePill') : t('stoppedPill')}</span>}
          </span>
        </button>
        {isOpen && (
          <div className="sub-actions">
            <p className="row-sub" style={{ margin: 0 }}>
              {s.cadence === 'weekly' ? t('weekly') : t('monthly')} · {s.count} {t('timesCharged')} · {t('lastChargedOn')}{' '}
              {shortDate(s.lastDate)}
            </p>
            <div className="row gap" style={{ flexWrap: 'wrap' }}>
              {!s.billId && !isHidden && (
                <button type="button" className="mini-button" onClick={() => makeBill(s)}>
                  {t('addAsBill')}
                </button>
              )}
              <button type="button" className="mini-button" onClick={() => toggleHidden(s, !isHidden)}>
                {isHidden ? t('unhideSub') : t('hideSub')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const section = (title, list) =>
    list.length > 0 && (
      <>
        <p className="section-title">
          {title} · {list.length}
        </p>
        <div className="stack">
          {list.map((s) => renderRow(s))}
        </div>
      </>
    )

  return (
    <div className="screen">
      <div className="grid-2">
        <div className="tile">
          <p className="label">{t('subsAMonth')}</p>
          <p className="tile-number">{money(monthly)}</p>
        </div>
        <div className="tile">
          <p className="label">{t('subsAYear')}</p>
          <p className="tile-number">{formatMoney(language, currency, monthly * 12, { decimals: 0 })}</p>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {t('subsHint')}
      </p>

      {all.length === 0 && <p className="muted">{t('subsEmpty')}</p>}
      {section(t('subsActive'), active)}
      {section(t('subsLate'), late)}
      {section(t('subsStopped'), stopped)}

      {hiddenOnes.length > 0 && (
        <>
          <button type="button" className="disclosure" aria-expanded={showHidden} onClick={() => setShowHidden((v) => !v)}>
            <span>
              {t('subsHidden')} · {hiddenOnes.length}
            </span>
            <i className={`ti ${showHidden ? 'ti-chevron-up' : 'ti-chevron-down'}`} aria-hidden="true"></i>
          </button>
          {showHidden && (
            <div className="stack">
              {hiddenOnes.map((s) => renderRow(s, true))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
