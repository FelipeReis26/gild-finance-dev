import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function AddBill({ onDone }) {
  const { categories, addBill, t } = useApp()
  const expenseCategories = categories.filter((c) => c.kind !== 'income')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id || '')
  const [error, setError] = useState('')

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
    await addBill({ name, amount: value, dueDay: day, categoryId })
    onDone?.()
  }

  return (
    <div className="screen">
      <div className="card">
        <p className="section-title" style={{ marginBottom: 6 }}>
          {t('addBill')}
        </p>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          {t('billsRecurNote')}
        </p>

        <label className="field-label">{t('billName')}</label>
        <input type="text" placeholder="Rent" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="field-label">{t('amount')}</label>
        <input
          className="amount-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <label className="field-label">{t('dueDayOfMonth')}</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="31"
          placeholder="1"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
        />

        <label className="field-label">{t('category')}</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {error && <p className="error-text">{error}</p>}

        <button type="button" className="primary-button" onClick={handleSave}>
          {t('saveBill')}
        </button>
      </div>
    </div>
  )
}
