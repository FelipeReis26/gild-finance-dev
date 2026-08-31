import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { latestEntry, previousEntry, todayLocalDate } from '../db.js'

export default function Balances() {
  const { balances, currency, addBalanceAccount, addBalanceEntry, removeBalanceAccount, t } = useApp()
  const s = currency.symbol

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('debt')
  const [openingValue, setOpeningValue] = useState('')
  const [error, setError] = useState('')

  const [updatingId, setUpdatingId] = useState(null)
  const [updateValue, setUpdateValue] = useState('')

  const totalDebt = balances
    .filter((a) => a.type === 'debt')
    .reduce((sum, a) => sum + (latestEntry(a)?.value || 0), 0)
  const totalSavings = balances
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + (latestEntry(a)?.value || 0), 0)
  const totalOwed = balances
    .filter((a) => a.type === 'owed')
    .reduce((sum, a) => sum + (latestEntry(a)?.value || 0), 0)

  async function handleAddAccount() {
    const value = parseFloat(openingValue)
    if (!name.trim()) {
      setError(type === 'owed' ? t('theirName') : t('billName'))
      return
    }
    if (isNaN(value)) {
      setError(t('enterValidAmount'))
      return
    }
    await addBalanceAccount({ name: name.trim(), type, openingValue: value })
    setName('')
    setOpeningValue('')
    setError('')
    setShowForm(false)
  }

  async function handleAddEntry(accountId) {
    const value = parseFloat(updateValue)
    if (isNaN(value)) return
    await addBalanceEntry(accountId, { date: todayLocalDate(), value })
    setUpdatingId(null)
    setUpdateValue('')
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="stat-row" style={{ marginBottom: 0 }}>
          <div className="stat-col">
            <p className="stat-label">{t('debt')}</p>
            <p className="stat-value" style={{ color: 'var(--danger)' }}>
              {s}
              {totalDebt.toFixed(0)}
            </p>
          </div>
          <div className="stat-divider" />
          <div className="stat-col">
            <p className="stat-label">{t('savings')}</p>
            <p className="stat-value" style={{ color: 'var(--success)' }}>
              {s}
              {totalSavings.toFixed(0)}
            </p>
          </div>
          <div className="stat-divider" />
          <div className="stat-col">
            <p className="stat-label">{t('owedToYou')}</p>
            <p className="stat-value" style={{ color: 'var(--gold)' }}>
              {s}
              {totalOwed.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <p className="section-title">{t('accounts')}</p>
      <div className="stack">
        {balances.length === 0 && <p className="muted">{t('noAccountsYet')}</p>}
        {balances.map((a) => {
          const latest = latestEntry(a)
          const prev = previousEntry(a)
          const delta = prev ? latest.value - prev.value : 0
          const improving = a.type === 'savings' ? delta > 0 : delta < 0
          return (
            <div key={a.id} className="cat-row" style={{ alignItems: 'flex-start' }}>
              <div className="cat-icon" style={{ background: a.tint, borderColor: a.borderTint }}>
                <i className={`ti ${a.icon}`} style={{ color: a.accent, fontSize: 16 }} aria-hidden="true"></i>
              </div>
              <div className="cat-body">
                <div className="cat-top">
                  <span className="cat-name">{a.name}</span>
                  <span className="cat-figures">
                    {s}
                    {latest.value.toFixed(0)}
                  </span>
                </div>
                {prev && (
                  <p className="row-sub" style={{ color: improving ? 'var(--success)' : 'var(--danger)', margin: '0 0 8px' }}>
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(0)} {t('sinceLastUpdate')}
                  </p>
                )}
                {updatingId === a.id ? (
                  <div className="row gap">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={updateValue}
                      onChange={(e) => setUpdateValue(e.target.value)}
                      style={{ marginBottom: 0 }}
                    />
                    <button type="button" className="mini-button" onClick={() => handleAddEntry(a.id)}>
                      {t('save')}
                    </button>
                  </div>
                ) : (
                  <div className="row gap">
                    <button type="button" className="mini-button" onClick={() => setUpdatingId(a.id)}>
                      {a.type === 'owed' ? t('logRepayment') : t('updateBalance')}
                    </button>
                    <button type="button" className="mini-button" onClick={() => removeBalanceAccount(a.id)}>
                      <i className="ti ti-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showForm ? (
        <div className="card">
          <p className="field-label">{type === 'owed' ? t('theirName') : t('billName')}</p>
          <input
            type="text"
            placeholder={type === 'owed' ? 'Jamie' : 'Car loan'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <p className="field-label">{t('type')}</p>
          <div className="segmented">
            <button type="button" className={type === 'debt' ? 'segment-active' : ''} onClick={() => setType('debt')}>
              {t('debt')}
            </button>
            <button
              type="button"
              className={type === 'savings' ? 'segment-active' : ''}
              onClick={() => setType('savings')}
            >
              {t('savings')}
            </button>
            <button type="button" className={type === 'owed' ? 'segment-active' : ''} onClick={() => setType('owed')}>
              {t('owedToYou')}
            </button>
          </div>

          <p className="field-label">{type === 'owed' ? t('amountTheyOweYou') : t('currentBalance')}</p>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={openingValue}
            onChange={(e) => setOpeningValue(e.target.value)}
          />

          {error && <p className="error-text">{error}</p>}

          <button type="button" className="primary-button" onClick={handleAddAccount}>
            {t('saveAccount')}
          </button>
        </div>
      ) : (
        <button type="button" className="primary-button" onClick={() => setShowForm(true)}>
          <i className="ti ti-plus" aria-hidden="true"></i> {t('addAccount')}
        </button>
      )}
    </div>
  )
}
