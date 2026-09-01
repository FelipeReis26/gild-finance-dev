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
  return text
}

// What the person has actually saved before beats any keyword table: if
// "SPAR" was filed under Food last time, it is Food this time. Built from
// the local transaction history, so it stays on the device and gets more
// accurate the longer the app is used.
function learnFromHistory(text, transactions) {
  const lower = text.toLowerCase()
  const scores = new Map()
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.note || !tx.categoryId) continue
    // Match on the distinctive words of past notes, not the whole string.
    const words = tx.note
      .toLowerCase()
      .split(/[^a-z0-9&]+/)
      .filter((w) => w.length >= 4)
    for (const w of words) {
      if (lower.includes(w)) {
        scores.set(tx.categoryId, (scores.get(tx.categoryId) || 0) + w.length)
      }
    }
  }
  if (!scores.size) return null
  const [best] = [...scores.entries()].sort((a, b) => b[1] - a[1])
  return { categoryId: best[0], learned: true }
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

  // Amount. Ranked strategies, best first, because grabbing the biggest
  // number on the page picks up phone numbers, loyalty points, and card
  // digits. Handles thousands separators (1.234,56 and 1,234.56) and
  // OCR's habit of reading 0 as O.
  const moneyPattern = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}|\d{1,5}[.,]\d{2})/g
  // OCR reads 0 as O. Only swap where the letter sits against digits or a
  // decimal point, so merchant names keep their real spelling.
  const fixDigits = (str) => str.replace(/(?<=[\d.,])[Oo]|[Oo](?=[\d.,])/g, '0')
  const toNumber = (raw) => {
    let s = raw.replace(/\s/g, '')
    // The last separator is the decimal one; anything earlier is grouping.
    const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
    if (lastSep === -1) return parseFloat(s)
    const intPart = s.slice(0, lastSep).replace(/[.,]/g, '')
    return parseFloat(`${intPart}.${s.slice(lastSep + 1)}`)
  }
  const amountsIn = (str) =>
    [...fixDigits(str).matchAll(moneyPattern)].map((m) => toNumber(m[1])).filter((n) => !isNaN(n) && n > 0)

  let amount = ''
  // 1. A line naming the grand total wins outright, and the strongest
  //    keyword wins over a mere "subtotal".
  const ranked = [...lines].sort((a, b) => {
    const score = (l) => {
      const t = l.toLowerCase()
      if (/grand total|amount due|balance due|total due/.test(t)) return 3
      if (/\btotal\b/.test(t) && !/sub/.test(t)) return 2
      if (/subtotal|amount|paid/.test(t)) return 1
      return 0
    }
    return score(b) - score(a)
  })
  for (const line of ranked) {
    if (!TOTAL_KEYWORDS.some((k) => line.toLowerCase().includes(k))) break
    const found = amountsIn(line)
    if (found.length) {
      amount = Math.max(...found)
      break
    }
  }
  // 2. Otherwise the largest plausible money value anywhere, ignoring
  //    values that are clearly not prices.
  if (!amount) {
    const all = amountsIn(text).filter((n) => n < 100000)
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

  // Date: use the receipt's own date when one is legible and sane, rather
  // than always stamping today — a receipt scanned days later belongs to
  // the day it happened, which is what the pay-period maths reads.
  let date = todayLocalDate()
  const dm =
    text.match(/(\d{4})-(\d{2})-(\d{2})/) ||
    text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/) ||
    text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?!\d)/)
  if (dm) {
    let y, mo, d
    if (dm[1].length === 4) {
      ;[, y, mo, d] = dm
    } else {
      // Day-first (European receipts); fall back to month-first when the
      // first number cannot be a day.
      const a = parseInt(dm[1], 10)
      const b = parseInt(dm[2], 10)
      d = a > 12 || b <= 12 ? a : b
      mo = a > 12 || b <= 12 ? b : a
      y = dm[3].length === 2 ? `20${dm[3]}` : dm[3]
    }
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const parsed = new Date(iso + 'T00:00:00')
    const now = new Date()
    // Only trust it if it is a real date, not in the future, and recent.
    if (
      !isNaN(parsed) &&
      parsed <= now &&
      now - parsed < 400 * 86400000 &&
      Number(mo) >= 1 &&
      Number(mo) <= 12 &&
      Number(d) >= 1 &&
      Number(d) <= 31
    ) {
      date = iso
    }
  }

  // Merchant: strip trailing punctuation and OCR debris, and title-case
  // the shouty all-caps that receipts are printed in.
  let merchant = (merchantLine || '').replace(/[^\w&'.\- ]/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (merchant && merchant === merchant.toUpperCase()) {
    merchant = merchant
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
      .join(' ')
  }

  return {
    amount,
    merchant: merchant || 'Unknown merchant',
    date,
    guessedCategoryId: match?.categoryId || null,
    rawText: text.trim()
  }
}

export default function ScanImport({ onConfirmed }) {
  const { categories, transactions, addTransaction, t } = useApp()
  const expenseCategories = categories.filter((c) => c.kind !== 'income' && !c.archived)
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
      const rawText = await scanImage(chosen)
      const parsed = parseReceiptText(rawText)
      // Your own filing history outranks the built-in keyword table.
      const learned = learnFromHistory(rawText, transactions)
      const known = learned && expenseCategories.some((c) => c.id === learned.categoryId)
      setResult({
        ...parsed,
        guessedCategoryId: (known && learned.categoryId) || parsed.guessedCategoryId || expenseCategories[0]?.id,
        learned: Boolean(known)
      })
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
          {/* A sweeping hand: the world's own way of saying "working". */}
          <svg className="sweep" viewBox="0 0 64 64" role="img" aria-label={t('readingScreenshot')}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = ((i / 12) * 360 - 90) * (Math.PI / 180)
              return (
                <line
                  key={i}
                  x1={32 + Math.cos(a) * 27}
                  y1={32 + Math.sin(a) * 27}
                  x2={32 + Math.cos(a) * 30}
                  y2={32 + Math.sin(a) * 30}
                  stroke="var(--ink)"
                  strokeOpacity="0.18"
                  strokeWidth="1.5"
                />
              )
            })}
            <g className="sweep-hand">
              <line x1="32" y1="32" x2="32" y2="9" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle cx="32" cy="32" r="2.5" fill="var(--gold)" />
          </svg>
          <p className="muted">{t('readingScreenshot')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <p className="error-text" role="alert">{error}</p>
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
          onChange={(e) => {
            setResult({ ...result, amount: e.target.value })
            setError('')
          }}
        />

        <label className="field-label">{t('merchant')}</label>
        <input
          type="text"
          value={result.merchant}
          onChange={(e) => setResult({ ...result, merchant: e.target.value })}
        />

        <label className="field-label">
          {t('category')}
          {result.learned && (
            <span style={{ color: 'var(--credit)', marginLeft: 6 }}>· {t('learnedFromHistory')}</span>
          )}
        </label>
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
              {t('rawRecognizedText')}
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

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="row gap" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="secondary-button"
            style={{ flex: 1 }}
            onClick={() => {
              setFile(null)
              setResult(null)
            }}
          >
            {t('discard')}
          </button>
          <button type="button" className="primary-button" style={{ flex: 2, width: 'auto' }} onClick={handleConfirm}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
