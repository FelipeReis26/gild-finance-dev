import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function AddBill({ prefill, editingId, onDone }) {
  const { categories, currency, addBill, updateBill, t } = useApp()
  const expenseCategories = categories.filter((c) => c.kind !== 'income' && !c.archived)
  const [name, setName] = useState(prefill?.name || '')
  const [amount, setAmount] = useState(prefill?.amount != null ? String(prefill.amount) : '')
  const [dueDay, setDueDay] = useState(String(prefill?.dueDay ?? 1))
  // An edited bill keeps its own category even if that category has since been
  // archived, so opening the form does not silently move it.
  const [categoryId, setCategoryId] = useState(prefill?.categoryId || expenseCategories[0]?.id || '')
  const [error, setError] = useState('')
  const clear = () => setError('')
  const current = categories.find((c) => c.id === categoryId)
  const pickableCategories =
    current && !expenseCategories.some((c) => c.id === current.id) ? [...expenseCategories, current] : expenseCategories

  async function handleSave() {
    const value = parseFloat(amount)
    const day = parseInt(dueDay, 10)
    if (!name.trim()) {
      setError(t('billName'))
      return
    }
    if (!amount || isNaN(value) || value <= 0) {
      setError(t('enterValidAmount'))
      return
    }
    if (!day || day < 1 || day > 31) {
      setError(t('dueDayOfMonth'))
      return
    }
    if (editingId) {
      await updateBill(editingId, { name, amount: value, dueDay: day, categoryId })
    } else {
      await addBill({ name, amount: value, dueDay: day, categoryId })
    }
    onDone?.()
  }

  return (
    <div className="screen">
      <p className="section-title">{editingId ? t('editBill') : t('addBill')}</p>

      {/* Setting the instrument: what it is called, and the figure. */}
      <div className="card">
        <label className="field-label">{t('billName')}</label>
        <input
          type="text"
          placeholder={t('billNamePlaceholder')}
          autoFocus={!editingId}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            clear()
          }}
        />

        <label className="field-label">
          {t('amount')} ({currency.symbol})
        </label>
        <input
          className="amount-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            clear()
          }}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* The details */}
      <div className="card">
        <label className="field-label">{t('dueDayOfMonth')}</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="31"
          placeholder="1"
          value={dueDay}
          onChange={(e) => {
            setDueDay(e.target.value)
            clear()
          }}
        />

        <label className="field-label">{t('category')}</label>
        <div className="grid-2 category-grid" style={{ marginBottom: 0 }}>
          {pickableCategories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={categoryId === c.id ? 'category-chip category-chip-active' : 'category-chip'}
              style={categoryId === c.id ? { '--chip-accent': c.accent, '--chip-tint': c.tint } : undefined}
              onClick={() => setCategoryId(c.id)}
            >
              <i className={`ti ${c.icon}`} style={{ color: c.accent }} aria-hidden="true"></i> {c.name}
            </button>
          ))}
        </div>
      </div>

      <p className="muted" style={{ margin: '-6px 4px 0', fontSize: 12 }}>
        {t('billsRecurNote')}
      </p>

      {error && (
        <p className="error-text" role="alert" style={{ margin: '0 4px' }}>
          {error}
        </p>
      )}

      <button type="button" className="primary-button" onClick={handleSave}>
        {editingId ? t('saveChanges') : t('saveBill')}
      </button>
    </div>
  )
}
