import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import { useApp } from '../context/AppContext.jsx'
import { todayLocalDate } from '../db.js'

// Real on-device text recognition, no server or API key needed.
// Runs entirely in the browser via tesseract.js, then a few rules
// guess the amount, merchant, and category from the raw text.
async function scanImage(file) {
  const worker = await createWorker('eng')
  const {
    data: { text }
  } = await worker.recognize(file)
  await worker.terminate()
  return parseReceiptText(text)
}

const NOISE_WORDS = [
  'receipt', 'subtotal', 'total', 'tax', 'vat', 'change', 'cash', 'card',
  'visa', 'mastercard', 'thank you', 'balance', 'tel:', 'www.', 'http',
  'auth code', 'approved', 'terminal', 'merchant id', 'contactless'
]
const TOTAL_KEYWORDS = ['total', 'amount', 'amount due', 'balance due', 'paid', 'subtotal', 'grand total']

function looksLikeDate(line) {
  return /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(line) || /\d{4}-\d{2}-\d{2}/.test(line)
}

function parseReceiptText(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Amount: prefer a line that explicitly says "total"/"amount"/etc, since
  // that's far more reliable than just grabbing the biggest number on the
  // page (which can be a phone number, loyalty points, or a card number).
  const moneyPattern = /(\d{1,4}[.,]\d{2})/g
  let amount = ''
  const totalLine = lines.find((l) => TOTAL_KEYWORDS.some((k) => l.toLowerCase().includes(k)))
  if (totalLine) {
    const m = [...totalLine.matchAll(moneyPattern)].map((x) => parseFloat(x[1].replace(',', '.')))
    if (m.length) amount = Math.max(...m)
  }
  if (!amount) {
    const all = [...text.matchAll(moneyPattern)].map((m) => parseFloat(m[1].replace(',', '.')))
    if (all.length) amount = Math.max(...all)
  }

  // Merchant: the longest remaining line made mostly of letters, after
  // filtering out dates, pure numbers, and common receipt boilerplate.
  const merchantLine = lines
    .filter((l) => {
      if (!/[a-zA-Z]{3,}/.test(l)) return false
      if (/^\d/.test(l)) return false
      if (looksLikeDate(l)) return false
      const lower = l.toLowerCase()
      if (NOISE_WORDS.some((w) => lower.includes(w))) return false
      return true
    })
    .sort((a, b) => b.length - a.length)[0]

  // Category guess from keywords in the recognized text.
  const lower = text.toLowerCase()
  const keywordMap = [
    { keywords: ['netflix', 'spotify', 'disney', 'prime video', 'patreon'], categoryId: 'streaming' },
    { keywords: ['tesco', 'supermarket', 'grocery', 'lidl', 'aldi', 'spar', 'dunnes', 'mcdonald', 'coffee'], categoryId: 'food' },
    { keywords: ['shell', 'esso', 'circle k', 'fuel', 'petrol', 'freenow', 'taxi', 'uber', 'eflow', 'toll'], categoryId: 'fuel-insurance' },
    { keywords: ['rent', 'landlord'], categoryId: 'rent' },
    { keywords: ['vodafone', 'three', 'eir', 'internet', 'broadband', 'virgin media', 'apple.com'], categoryId: 'utilities' }
  ]
  const match = keywordMap.find((k) => k.keywords.some((word) => lower.includes(word)))

  return {
    amount,
    merchant: merchantLine || 'Unknown merchant',
    date: todayLocalDate(),
    guessedCategoryId: match?.categoryId || null,
    rawText: text.trim()
  }
}

export default function ScanImport({ onConfirmed }) {
  const { categories, addTransaction, t } = useApp()
  const expenseCategories = categories.filter((c) => c.kind !== 'income')
  const [file, setFile] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const chosen = e.target.files?.[0]
    if (!chosen) return
    setFile(chosen)
    setScanning(true)
    setError('')
    try {
      const parsed = await scanImage(chosen)
      setResult({ ...parsed, guessedCategoryId: parsed.guessedCategoryId || expenseCategories[0]?.id })
    } catch {
      setError(t('couldNotRead'))
      setFile(null)
    } finally {
      setScanning(false)
    }
  }

  async function handleConfirm() {
    if (!result) return
    const value = parseFloat(result.amount)
    if (isNaN(value) || value <= 0) {
      setError(t('enterValidAmount'))
      return
    }
    await addTransaction({
      type: 'expense',
      amount: value,
      categoryId: result.guessedCategoryId,
      date: result.date,
      note: result.merchant
    })
    setFile(null)
    setResult(null)
    onConfirmed?.()
  }

  if (!file) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <i className="ti ti-camera scan-icon" aria-hidden="true"></i>
          <p className="section-title">{t('scanTitle')}</p>
          <p className="muted center">{t('scanSubtitle')}</p>
          <label className="primary-button file-button">
            {t('chooseScreenshot')}
            <input type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
        </div>
      </div>
    )
  }

  if (scanning) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <p className="muted">{t('readingScreenshot')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <p className="error-text">{error}</p>
          <button
            type="button"
            className="secondary-button"
            style={{ width: '100%' }}
            onClick={() => setError('')}
          >
            {t('tryAnother')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="card">
        <p className="section-title" style={{ marginBottom: 4 }}>
          {t('confirmTransaction')}
        </p>
        <p className="muted" style={{ marginTop: 0, marginBottom: 18, fontSize: 13 }}>
          {t('confirmSubtitle')}
        </p>

        <label className="field-label">{t('amount')}</label>
        <input
          className="amount-input"
          type="number"
          inputMode="decimal"
          value={result.amount}
          onChange={(e) => setResult({ ...result, amount: e.target.value })}
        />

        <label className="field-label">{t('merchant')}</label>
        <input
          type="text"
          value={result.merchant}
          onChange={(e) => setResult({ ...result, merchant: e.target.value })}
        />

        <label className="field-label">{t('category')}</label>
        <select
          value={result.guessedCategoryId || ''}
          onChange={(e) => setResult({ ...result, guessedCategoryId: e.target.value })}
        >
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="field-label">{t('date')}</label>
        <input
          type="date"
          value={result.date}
          onChange={(e) => setResult({ ...result, date: e.target.value })}
        />

        {result.rawText && (
          <details style={{ marginBottom: 14 }}>
            <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Raw recognized text
            </summary>
            <pre
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                marginTop: 8,
                maxHeight: 140,
                overflowY: 'auto'
              }}
            >
              {result.rawText}
            </pre>
          </details>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="row gap" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setFile(null)
              setResult(null)
            }}
          >
            {t('discard')}
          </button>
          <button type="button" className="primary-button" onClick={handleConfirm}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
