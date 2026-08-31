import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { todayLocalDate } from '../db.js'

export default function AddTransaction({ prefill, editingId, onDone }) {
  const { categories, currency, addTransaction, editTransaction, deleteTransactionWithUndo, t } = useApp()
  const [type, setType] = useState(prefill?.type || 'expense')
  const [amount, setAmount] = useState(prefill?.amount ?? '')
  const [categoryId, setCategoryId] = useState(prefill?.categoryId || '')
  const [date, setDate] = useState(prefill?.date || todayLocalDate())
  const [note, setNote] = useState(prefill?.note || '')
  const [error, setError] = useState('')

  const relevantCategories = categories.filter(
    (c) =>
      (type === 'income' ? c.kind === 'income' : c.kind !== 'income') &&
      (!c.archived || c.id === categoryId)
  )

  useEffect(() => {
    if (!relevantCategories.some((c) => c.id === categoryId)) {
      setCategoryId(relevantCategories[0]?.id || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories])

  async function handleSave() {
    const value = parseFloat(amount)
    if (!amount || isNaN(value) || value <= 0) {
      setError(t('enterValidAmount'))
      return
    }
    if (!categoryId) {
      setError(t('chooseCategory'))
      return
    }
    if (editingId) {
      await editTransaction(editingId, { type, amount: value, categoryId, date, note })
    } else {
      await addTransaction({ type, amount: value, categoryId, date, note })
    }
    onDone?.()
  }

  async function handleDelete() {
    await deleteTransactionWithUndo(editingId)
    onDone?.()
  }

  return (
    <div className="screen">
      <div className="card">
        <p className="section-title" style={{ marginBottom: 14 }}>
          {editingId ? t('editTransaction') : t('addTransaction')}
        </p>

        <div className="segmented">
          <button
            type="button"
            className={type === 'expense' ? 'segment-active' : ''}
            onClick={() => setType('expense')}
          >
            {t('expense')}
          </button>
          <button
            type="button"
            className={type === 'income' ? 'segment-active' : ''}
            onClick={() => setType('income')}
          >
            {t('income')}
          </button>
        </div>

        <label className="field-label">
          {t('amount')} ({currency.symbol})
        </label>
        <input
          className="amount-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <label className="field-label">{t('category')}</label>
        <div className="grid-2 category-grid">
          {relevantCategories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={categoryId === c.id ? 'category-chip category-chip-active' : 'category-chip'}
              style={categoryId === c.id ? { '--chip-accent': c.accent, '--chip-tint': c.tint } : undefined}
              onClick={() => setCategoryId(c.id)}
            >
              <i className={`ti ${c.icon}`} aria-hidden="true"></i> {c.name}
            </button>
          ))}
        </div>

        <label className="field-label">{t('date')}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label className="field-label">{t('noteOptional')}</label>
        <input type="text" placeholder="Weekly shop" value={note} onChange={(e) => setNote(e.target.value)} />

        {error && <p className="error-text">{error}</p>}

        <button type="button" className="primary-button" onClick={handleSave}>
          {t('saveTransaction')}
        </button>

        {editingId && (
          <button
            type="button"
            className="secondary-button"
            style={{ width: '100%', marginTop: 10 }}
            onClick={handleDelete}
          >
            {t('deleteTransaction')}
          </button>
        )}
      </div>
    </div>
  )
}
