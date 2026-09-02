import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { findImportDuplicates, getMerchantMap, rememberMerchantCategory, lookupMerchantCategory } from '../db.js'
import { scanImages, parseReceiptText, learnFromHistory } from '../receipt.js'

export default function ScanImport({ onConfirmed }) {
  const { categories, transactions, addTransaction, t } = useApp()
  const expenseCategories = categories.filter((c) => c.kind !== 'income' && !c.archived)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])
  const [error, setError] = useState('')

  function interpret(rawText, merchantMap, confidence) {
    const parsed = parseReceiptText(rawText)
    // What the person filed this shop under before outranks everything,
    // including the brand table: an explicit correction is a decision.
    const remembered = lookupMerchantCategory(merchantMap, parsed.merchant)
    // Priority: a recognized brand is definitive; otherwise a strong history
    // match on the merchant name; otherwise the keyword guess. History never
    // overrides a known brand.
    const learned = parsed.brandMatched ? null : learnFromHistory(parsed.merchant, transactions)
    const known = learned && expenseCategories.some((c) => c.id === learned.categoryId)
    // With no signal at all, fall back to a neutral catch-all rather than
    // whichever category happens to be first in the list — that made every
    // unrecognised receipt look confidently like "Rent".
    const neutral =
      expenseCategories.find((c) => c.id === 'other')?.id ||
      expenseCategories.find((c) => /other|misc/i.test(c.name))?.id ||
      expenseCategories[expenseCategories.length - 1]?.id
    const rememberedOk = remembered && expenseCategories.some((c) => c.id === remembered)
    const guessed = (rememberedOk && remembered) || (known && learned.categoryId) || parsed.guessedCategoryId
    return {
      ...parsed,
      // Money shows its cents: "3.30", not "3.3".
      amount: parsed.amount ? Number(parsed.amount).toFixed(2) : '',
      id: Math.random().toString(36).slice(2, 9),
      guessedCategoryId: guessed || neutral,
      remembered: Boolean(rememberedOk),
      unclear: typeof confidence === 'number' && confidence > 0 && confidence < 60,
      learned: Boolean(known) && !rememberedOk && Boolean(guessed)
    }
  }

  async function handleFiles(e) {
    const chosen = [...(e.target.files || [])]
    if (!chosen.length) return
    setScanning(true)
    setError('')
    setProgress({ done: 0, total: chosen.length })
    try {
      const scans = await scanImages(chosen, (done, total) => setProgress({ done, total }))
      const merchantMap = await getMerchantMap()
      const parsed = scans
        .map((sc) => interpret(sc.text, merchantMap, sc.confidence))
        .filter((r) => r.amount || r.merchant !== 'Unknown merchant')
      if (!parsed.length) {
        setError(t('couldNotRead'))
      } else {
        setResults(parsed)
        // Tell the person which of these look like something already saved.
        const flagged = await findImportDuplicates(
          parsed.map((r) => ({ date: r.date, amount: parseFloat(r.amount) || 0, note: r.merchant }))
        )
        setResults(parsed.map((r, i) => ({ ...r, isDuplicate: flagged[i]?.isDuplicate })))
      }
    } catch {
      setError(t('couldNotRead'))
    } finally {
      setScanning(false)
      e.target.value = ''
    }
  }

  const patch = (id, changes) => setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  const drop = (id) => setResults((rs) => rs.filter((r) => r.id !== id))

  async function handleConfirmAll() {
    const valid = results.filter((r) => {
      const v = parseFloat(r.amount)
      return !isNaN(v) && v > 0
    })
    if (!valid.length) {
      setError(t('enterValidAmount'))
      return
    }
    for (const r of valid) {
      await addTransaction({
        type: 'expense',
        amount: parseFloat(r.amount),
        categoryId: r.guessedCategoryId,
        date: r.date,
        note: r.merchant
      })
      // Confirming is the teaching moment: whatever category this shop ends
      // up in, that is what it means next time.
      if (r.merchant && r.merchant !== 'Unknown merchant') {
        await rememberMerchantCategory(r.merchant, r.guessedCategoryId)
      }
    }
    setResults([])
    onConfirmed?.()
  }

  if (!scanning && !results.length && !error) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <i className="ti ti-camera scan-icon" aria-hidden="true"></i>
          <p className="section-title">{t('scanTitle')}</p>
          <p className="muted center">{t('scanSubtitle')}</p>
          <p className="muted center" style={{ fontSize: 12 }}>
            {t('scanMultipleHint')}
          </p>
          <label className="primary-button file-button">
            {t('chooseScreenshot')}
            <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
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
          <p className="muted">
            {t('readingScreenshot')}
            {progress.total > 1 ? ` · ${progress.done} / ${progress.total}` : ''}
          </p>
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
      <div className="row between">
        <p className="section-title" style={{ margin: 0 }}>
          {results.length > 1 ? t('confirmTransactions') : t('confirmTransaction')}
        </p>
        {results.length > 1 && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {results.length} {t('receiptsFound')}
          </p>
        )}
      </div>
      <p className="muted" style={{ margin: '-6px 2px 0', fontSize: 13 }}>
        {results.length > 1 ? t('confirmSubtitlePlural') : t('confirmSubtitle')}
      </p>

      {results.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <label className="field-label" style={{ margin: 0 }}>
              {t('amount')}
              {r.isDuplicate && (
                <span style={{ color: 'var(--debit)', marginLeft: 6 }}>· {t('possibleDuplicate')}</span>
              )}
              {r.unclear && <span style={{ color: 'var(--debit)', marginLeft: 6 }}>· {t('unclearScan')}</span>}
            </label>
            <button
              type="button"
              className="mini-button"
              onClick={() => drop(r.id)}
              aria-label={t('discard')}
            >
              <i className="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
          <input
            className="amount-input"
            type="number"
            inputMode="decimal"
            value={r.amount}
            onChange={(e) => {
              patch(r.id, { amount: e.target.value })
              setError('')
            }}
          />

          <label className="field-label">{t('merchant')}</label>
          <input type="text" value={r.merchant} onChange={(e) => patch(r.id, { merchant: e.target.value })} />

          <label className="field-label">
            {t('category')}
            {r.remembered && <span style={{ color: 'var(--credit)', marginLeft: 6 }}>· {t('rememberedShop')}</span>}
            {!r.remembered && r.learned && (
              <span style={{ color: 'var(--credit)', marginLeft: 6 }}>· {t('learnedFromHistory')}</span>
            )}
          </label>
          <select value={r.guessedCategoryId || ''} onChange={(e) => patch(r.id, { guessedCategoryId: e.target.value })}>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="field-label">{t('date')}</label>
          <input
            type="date"
            value={r.date}
            onChange={(e) => patch(r.id, { date: e.target.value })}
            style={{ marginBottom: r.rawText ? 14 : 0 }}
          />

          {r.rawText && (
            <details>
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
                {r.rawText}
              </pre>
            </details>
          )}
        </div>
      ))}

      {error && (
        <p className="error-text" role="alert" style={{ margin: '0 4px' }}>
          {error}
        </p>
      )}

      <div className="row gap">
        <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setResults([])}>
          {t('discard')}
        </button>
        <button type="button" className="primary-button" style={{ flex: 2, width: 'auto' }} onClick={handleConfirmAll}>
          {results.length > 1 ? `${t('confirm')} (${results.length})` : t('confirm')}
        </button>
      </div>

      <label className="secondary-button file-button" style={{ textAlign: 'center', lineHeight: '48px' }}>
        {t('addMoreScreenshots')}
        <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
      </label>
    </div>
  )
}
