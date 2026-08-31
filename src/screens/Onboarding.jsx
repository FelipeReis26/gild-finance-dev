import { useEffect, useState } from 'react'
import * as db from '../db.js'
import { languageOptions } from '../i18n.js'
import { t as translate } from '../i18n.js'

const STEPS = ['welcome', 'money', 'categories', 'income', 'finish']

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const [lang, setLang] = useState('en')
  const [currencyCode, setCurrencyCode] = useState('EUR')
  const [payDay, setPayDay] = useState('1')
  const [categories, setCategories] = useState([])
  const [kept, setKept] = useState({})
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeSkipped, setIncomeSkipped] = useState(false)

  const t = (key) => translate(lang, key)

  useEffect(() => {
    db.getCategories().then((cats) => {
      const expense = cats.filter((c) => c.kind !== 'income')
      setCategories(expense)
      setKept(Object.fromEntries(expense.map((c) => [c.id, true])))
    })
  }, [])

  async function handleLanguagePick(code) {
    setLang(code)
    await db.setLanguage(code)
  }

  function next() {
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }
  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function finish(goToImport) {
    await db.setCurrency(db.currencyOptions?.find?.((c) => c.code === currencyCode) || { code: currencyCode, symbol: '€' })
    await db.setPayDay(payDay)
    for (const c of categories) {
      if (!kept[c.id]) await db.deleteCategory(c.id)
    }
    if (!incomeSkipped && incomeAmount && !isNaN(parseFloat(incomeAmount))) {
      await db.addTransaction({
        amount: parseFloat(incomeAmount),
        type: 'income',
        categoryId: 'wages',
        date: db.todayLocalDate(),
        note: 'First income'
      })
    }
    await db.completeOnboarding()
    onDone(goToImport)
  }

  const progress = `${step + 1} / ${STEPS.length}`

  return (
    <div className="app-shell">
      <div className="bg-blobs" aria-hidden="true">
        <span className="blob blob-gold" />
        <span className="blob blob-blue" />
        <span className="blob blob-green" />
      </div>
      <main className="app-main" style={{ paddingTop: 40 }}>
        <div className="screen">
          <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>{progress}</p>

          {STEPS[step] === 'welcome' && (
            <div className="card">
              <p className="section-title" style={{ textAlign: 'center', marginBottom: 6 }}>
                Welcome to Gild
              </p>
              <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>
                Let's set a few things up. This only takes a minute.
              </p>
              <label className="field-label">{t('language')}</label>
              <div className="stack">
                {languageOptions.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className="row between list-row"
                    style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleLanguagePick(l.code)}
                  >
                    <p className="row-title">{l.label}</p>
                    {lang === l.code && <i className="ti ti-check" style={{ color: 'var(--gold)' }} aria-hidden="true"></i>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {STEPS[step] === 'money' && (
            <div className="card">
              <p className="section-title" style={{ marginBottom: 14 }}>{t('currency')} & {t('payDay')}</p>
              <label className="field-label">{t('currency')}</label>
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
              <label className="field-label">{t('payDayField')}</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={payDay}
                onChange={(e) => setPayDay(e.target.value)}
              />
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{t('payDayNote')}</p>
            </div>
          )}

          {STEPS[step] === 'categories' && (
            <div className="card">
              <p className="section-title" style={{ marginBottom: 6 }}>Categories</p>
              <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
                Untick anything you don't need, you can always add more later.
              </p>
              <div className="stack">
                {categories.map((c) => (
                  <label key={c.id} className="row between list-row" style={{ cursor: 'pointer' }}>
                    <span className="row gap">
                      <div className="icon-badge" style={{ background: c.tint, borderColor: c.borderTint }}>
                        <i className={`ti ${c.icon}`} style={{ color: c.accent, fontSize: 16 }} aria-hidden="true"></i>
                      </div>
                      <span className="row-title">{c.name}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!kept[c.id]}
                      onChange={(e) => setKept({ ...kept, [c.id]: e.target.checked })}
                      style={{ width: 'auto', height: 'auto', margin: 0 }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {STEPS[step] === 'income' && (
            <div className="card">
              <p className="section-title" style={{ marginBottom: 6 }}>Your income</p>
              <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
                Optional — add your typical income now, or skip and add it later.
              </p>
              <label className="field-label">{t('amount')}</label>
              <input
                className="amount-input"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={incomeAmount}
                onChange={(e) => {
                  setIncomeAmount(e.target.value)
                  setIncomeSkipped(false)
                }}
              />
              <button
                type="button"
                className="secondary-button"
                style={{ width: '100%' }}
                onClick={() => {
                  setIncomeAmount('')
                  setIncomeSkipped(true)
                  next()
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {STEPS[step] === 'finish' && (
            <div className="card">
              <p className="section-title" style={{ marginBottom: 6 }}>All set</p>
              <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
                Start fresh, or import transactions from a bank statement or screenshots right away.
              </p>
              <button type="button" className="primary-button" onClick={() => finish(true)}>
                Import transactions now
              </button>
              <button
                type="button"
                className="secondary-button"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => finish(false)}
              >
                Start fresh
              </button>
            </div>
          )}

          {STEPS[step] !== 'finish' && (
            <div className="row gap">
              {step > 0 && (
                <button type="button" className="secondary-button" onClick={back}>
                  {t('back')}
                </button>
              )}
              <button type="button" className="primary-button" onClick={next}>
                {t('next')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
