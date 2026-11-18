import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { getApplePaySettings } from '../db.js'
import { accountForCard } from '../applePay.js'
import { guessFromHistory, importCategories } from '../statements.js'
import { formatMoney, localeFor, tf } from '../i18n.js'

// Apple Pay payments waiting to be checked, at the top of the dashboard. Each
// is filed like last time where the shop is known; tap the chip to change it,
// × to drop one, "Add all" to save them.
export default function ApplePayCard() {
  const { applePay, confirmApplePay, dismissApplePay, transactions, categories, accounts, currency, language, t } = useApp()
  const [settings, setSettings] = useState({ cards: {} })
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getApplePaySettings().then(setSettings)
  }, [applePay.length])

  if (!applePay.length) return null

  const money = (v) => formatMoney(language, currency, v, { decimals: 2 })
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const appCurrency = currency?.code || 'EUR'
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const when = (p) => {
    const d = new Date(p.at)
    const time = d.toLocaleTimeString(localeFor(language), { hour: '2-digit', minute: '2-digit' })
    return p.date === todayIso ? `${t('today')} ${time}` : d.toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' })
  }

  const rows = applePay.map((p) => {
    const accountId = accountForCard(p.card, accounts, settings.cards)
    const type = p.refund ? 'income' : 'expense'
    const guess = guessFromHistory(p.merchant, transactions, accountId, type)
    const foreign = p.currency && p.currency !== appCurrency
    const categoryId = picked[p.id] || (guess && !guess.transfer ? guess.categoryId : null)
    return { pending: p, accountId, type, guess, foreign, categoryId, note: guess?.note || p.merchant }
  })
  const addable = rows.filter((r) => !r.foreign)
  const neutral = (type) => (type === 'income' ? 'other-income' : catById.other ? 'other' : importCategories(categories, 'expense')[0]?.id)

  async function addAll() {
    if (busy || !addable.length) return
    setBusy(true)
    await confirmApplePay(addable.map((r) => ({ ...r, categoryId: r.categoryId || neutral(r.type) })))
    setPicked({})
    setBusy(false)
  }

  return (
    <div className="card applepay-card">
      <p className="row-title">
        <i className="ti ti-brand-apple" style={{ color: 'var(--gold)' }} aria-hidden="true"></i>{' '}
        {tf(language, applePay.length === 1 ? 'applePayOne' : 'applePayMany', { n: applePay.length })}
      </p>
      {rows.map((r) => {
        const c = r.categoryId && catById[r.categoryId]
        const learned = !picked[r.pending.id] && r.guess && !r.guess.transfer && c
        const options = importCategories(categories, r.type)
        const accountName = r.pending.card || accounts.find((a) => a.id === r.accountId)?.name || ''
        return (
          <div className="applepay-row" key={r.pending.id}>
            <div style={{ minWidth: 0 }}>
              <p className="import-name">{r.note}</p>
              {r.foreign ? (
                <span className="import-chip">
                  <i className="ti ti-currency" aria-hidden="true"></i>
                  {tf(language, 'applePayForeign', { currency: r.pending.currency })}
                </span>
              ) : (
                <span className={`import-chip is-pick ${c ? 'gold' : ''}`}>
                  <i className={`ti ${c ? c.icon : 'ti-tag'}`} aria-hidden="true"></i>
                  {c ? (learned ? tf(language, 'importLikeLastTime', { name: c.name }) : c.name) : t('importChooseCategory')}
                  <i className="ti ti-chevron-down" aria-hidden="true"></i>
                  <select
                    value={r.categoryId || ''}
                    onChange={(e) => setPicked({ ...picked, [r.pending.id]: e.target.value })}
                    aria-label={`${t('category')}: ${r.note}`}
                  >
                    {!r.categoryId && <option value="">{t('importChooseCategory')}</option>}
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </span>
              )}
            </div>
            <div className="applepay-right">
              <p className={`import-amt ${r.type === 'income' ? 'is-in' : ''}`}>
                {r.type === 'income' ? '+' : ''}
                {r.foreign ? `${r.pending.currency} ${r.pending.amount}` : money(r.pending.amount)}
              </p>
              <p className="row-sub">
                {when(r.pending)} · {accountName}
              </p>
            </div>
            <button
              type="button"
              className="applepay-x"
              onClick={() => dismissApplePay([r.pending.id])}
              aria-label={`${t('applePayDismiss')}: ${r.note}`}
            >
              <i className="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
        )
      })}
      {addable.length > 0 && (
        <button type="button" className="primary-button" onClick={addAll} disabled={busy}>
          {addable.length === 1 ? t('applePayAddOne') : tf(language, 'applePayAddAll', { n: addable.length })}
        </button>
      )}
    </div>
  )
}
