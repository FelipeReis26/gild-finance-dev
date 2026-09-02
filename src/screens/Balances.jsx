import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { latestEntry, previousEntry, todayLocalDate } from '../db.js'
import { formatMoney } from '../i18n.js'

export default function Balances() {
  const { balances, categories, currency, language, addBalanceAccount, addBalanceEntry, addTransaction, removeBalanceAccount, t } =
    useApp()
  const money = (v) => formatMoney(language, currency, v)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('debt')
  const [openingValue, setOpeningValue] = useState('')
  const [error, setError] = useState('')

  // { id, mode } — 'reading' records a new balance, 'movement' records money
  // actually moving (a repayment in, a payment out, a savings contribution).
  const [updating, setUpdating] = useState(null)
  const [updateValue, setUpdateValue] = useState('')
  // Money moving is a real transaction, so it is logged as one by default.
  const [alsoLog, setAlsoLog] = useState(true)
  const [moveCategory, setMoveCategory] = useState('')

  const expenseCats = categories.filter((c) => c.kind !== 'income' && !c.archived)
  const incomeCats = categories.filter((c) => c.kind === 'income' && !c.archived)

  // A sensible default category per account: match the account name first
  // (an account called "Car loan" has a matching category), then the
  // obvious one for the type, then a neutral catch-all.
  function defaultCategoryFor(account) {
    if (!account) return ''
    if (account.type === 'owed') {
      return (incomeCats.find((c) => c.id === 'other-income') || incomeCats[0])?.id || ''
    }
    const byName = expenseCats.find(
      (c) => c.name.toLowerCase() === account.name.toLowerCase() || c.id === account.name.toLowerCase().replace(/\s+/g, '-')
    )
    if (byName) return byName.id
    if (account.type === 'savings') {
      const sav = expenseCats.find((c) => c.id === 'savings' || /saving/i.test(c.name))
      if (sav) return sav.id
    }
    return (expenseCats.find((c) => c.id === 'other') || expenseCats[expenseCats.length - 1])?.id || ''
  }

  function beginUpdate(account, mode) {
    setUpdating({ id: account.id, mode })
    setUpdateValue('')
    setAlsoLog(true)
    setMoveCategory(defaultCategoryFor(account))
  }

  // What a movement does to the balance, per account type.
  function projectedBalance(account, amount) {
    const current = latestEntry(account)?.value || 0
    if (!(amount > 0)) return current
    return account.type === 'savings' ? current + amount : Math.max(0, current - amount)
  }

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

  async function handleAddEntry(accountId, mode) {
    const entered = parseFloat(updateValue)
    if (isNaN(entered)) return
    const account = balances.find((a) => a.id === accountId)
    const today = todayLocalDate()

    if (mode === 'reading' || !account) {
      // A reading is just the new balance: no money moved that the budget
      // should know about (a card balance rises from new spending too).
      await addBalanceEntry(accountId, { date: today, value: entered })
    } else {
      if (entered <= 0) return
      await addBalanceEntry(accountId, { date: today, value: projectedBalance(account, entered) })
      if (alsoLog) {
        // Owed money coming back is income; paying a debt or putting money
        // into savings is money leaving the pay period, so an expense.
        const isIncome = account.type === 'owed'
        await addTransaction({
          type: isIncome ? 'income' : 'expense',
          amount: entered,
          categoryId: moveCategory || defaultCategoryFor(account),
          date: today,
          note: `${isIncome ? t('fromRepayment') : t('fromAccountPayment')} — ${account.name}`,
          balanceAccountId: accountId,
          ...(isIncome ? { owedAccountId: accountId } : {})
        })
      }
    }
    setUpdating(null)
    setUpdateValue('')
    setAlsoLog(true)
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="stat-row" style={{ marginBottom: 0 }}>
          <div className="stat-col">
            <p className="stat-label">{t('debt')}</p>
            <p className="stat-value" style={{ color: 'var(--debit)' }}>
              {money(totalDebt)}
            </p>
          </div>
          <div className="stat-divider" />
          <div className="stat-col">
            <p className="stat-label">{t('savings')}</p>
            <p className="stat-value" style={{ color: 'var(--credit)' }}>
              {money(totalSavings)}
            </p>
          </div>
          <div className="stat-divider" />
          <div className="stat-col">
            <p className="stat-label">{t('owedToYou')}</p>
            <p className="stat-value" style={{ color: 'var(--ink)' }}>
              {money(totalOwed)}
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
                  <span className="cat-figures">{money(latest.value)}</span>
                </div>
                {prev && (
                  <p className="row-sub" style={{ color: improving ? 'var(--credit)' : 'var(--danger-text)', margin: '0 0 8px' }}>
                    {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                    {money(Math.abs(delta))} {t('sinceLastUpdate')}
                  </p>
                )}
                {updating?.id === a.id ? (
                  <>
                    <label className="field-label">
                      {updating.mode === 'reading'
                        ? t('currentBalance')
                        : a.type === 'owed'
                          ? t('amountRepaid')
                          : a.type === 'savings'
                            ? t('amountAdded')
                            : t('amountPaid')}
                    </label>
                    <div className="row gap">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={updateValue}
                        onChange={(e) => setUpdateValue(e.target.value)}
                        style={{ marginBottom: 0 }}
                      />
                      <button type="button" className="mini-button" onClick={() => handleAddEntry(a.id, updating.mode)}>
                        {t('save')}
                      </button>
                      <button type="button" className="mini-button" onClick={() => setUpdating(null)}>
                        <i className="ti ti-x" aria-hidden="true"></i>
                      </button>
                    </div>
                    {updating.mode === 'movement' && (
                      <>
                        <label className="row gap checkbox-row" style={{ margin: '10px 0 0', fontSize: 13 }}>
                          <input type="checkbox" checked={alsoLog} onChange={(e) => setAlsoLog(e.target.checked)} />
                          {a.type === 'owed' ? t('alsoLogAsIncome') : t('alsoLogAsExpense')}
                        </label>
                        {alsoLog && (
                          <select
                            value={moveCategory}
                            onChange={(e) => setMoveCategory(e.target.value)}
                            style={{ marginTop: 8, marginBottom: 0 }}
                          >
                            {(a.type === 'owed' ? incomeCats : expenseCats).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {parseFloat(updateValue) > 0 && (
                          <p className="row-sub" style={{ margin: '8px 0 0', color: 'var(--credit)' }}>
                            {money(latest.value)} → {money(projectedBalance(a, parseFloat(updateValue)))}{' '}
                            {a.type === 'savings'
                              ? t('savedLabel')
                              : projectedBalance(a, parseFloat(updateValue)) === 0
                                ? t('settledUp')
                                : t('stillOwed')}
                          </p>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="row gap" style={{ flexWrap: 'wrap' }}>
                    <button type="button" className="mini-button" onClick={() => beginUpdate(a, 'movement')}>
                      {a.type === 'owed' ? t('logRepayment') : a.type === 'savings' ? t('addToSavings') : t('logPayment')}
                    </button>
                    {a.type !== 'owed' && (
                      <button type="button" className="mini-button" onClick={() => beginUpdate(a, 'reading')}>
                        {t('updateBalance')}
                      </button>
                    )}
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
