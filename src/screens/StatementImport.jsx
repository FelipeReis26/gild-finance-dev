import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { detectStatement, detectPdfStatement, suggestAccount, prepareImport, importCategories } from '../statements.js'
import { pdfLines } from '../pdfText.js'
import { importStatementRows } from '../db.js'
import { formatMoney, localeFor, tf } from '../i18n.js'

// Statement import: pick a file, check what Gild found, then add. The file is
// read on the device; nothing is uploaded, and nothing is saved until Add.
export default function StatementImport({ onDone, onCancel }) {
  const { accounts, transactions, bills, categories, payDay, currency, language, refresh, t } = useApp()
  const money = (v) => formatMoney(language, currency, v, { decimals: 2 })
  const day = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' })
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || id

  const [parsed, setParsed] = useState(null)
  const [accountId, setAccountId] = useState('')
  const [prep, setPrep] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name)
      const p = isPdf ? detectPdfStatement(await pdfLines(await file.arrayBuffer())) : detectStatement(await file.text())
      if (!p) return setError(t('importUnknownFile'))
      if (!p.rows.length) return setError(t('importEmptyFile'))
      setParsed(p)
      setAccountId(suggestAccount(p, accounts) || accounts[0]?.id || '')
    } catch (err) {
      // say what went wrong, so a file that won't read can be reported
      setError(`${t('importCouldNotRead')} (${err?.message || err})`)
    }
  }

  function check() {
    setPrep(prepareImport({ parsed, accountId, transactions, bills, categories, accounts, payDay, currencyCode: currency?.code || 'EUR' }))
    setOverrides({})
  }

  async function add() {
    if (busy) return
    setBusy(true)
    const neutral = (type) => (type === 'income' ? 'other-income' : catById.other ? 'other' : importCategories(categories, 'expense')[0]?.id)
    const rows = prep.rows
      .filter((r) => r.status === 'new')
      .map((r) => ({ ...r, categoryId: overrides[r.key] || r.categoryId || neutral(r.type) }))
    const res = await importStatementRows(rows)
    await refresh()
    setResult(res)
    setBusy(false)
  }

  // --- step 1: choose a file -------------------------------------------------
  if (!parsed) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <i className="ti ti-file-spreadsheet scan-icon" aria-hidden="true"></i>
          <p className="section-title">{t('importTitle')}</p>
          <p className="muted center">{t('importSubtitle')}</p>
          <p className="muted center" style={{ fontSize: 12 }}>
            {t('importFormats')}
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <label className="primary-button file-button">
            {t('importChooseFile')}
            <input type="file" onChange={handleFile} hidden />
          </label>
          <button type="button" className="secondary-button" style={{ width: '100%' }} onClick={onCancel}>
            {t('back')}
          </button>
        </div>
      </div>
    )
  }

  // --- done ------------------------------------------------------------------
  if (result) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <i className="ti ti-circle-check scan-icon" style={{ color: 'var(--credit)' }} aria-hidden="true"></i>
          <p className="section-title">{tf(language, 'importAdded', { n: result.added })}</p>
          {result.billsMarked > 0 && <p className="muted center">{tf(language, 'importBillsMarked', { n: result.billsMarked })}</p>}
          <button type="button" className="primary-button" onClick={onDone}>
            {t('done')}
          </button>
        </div>
      </div>
    )
  }

  // --- step 2: what the file is -----------------------------------------------
  if (!prep) {
    return (
      <div className="screen">
        <div className="card det-card">
          <div className="icon-badge">
            <i className="ti ti-building-bank" style={{ color: 'var(--gold)' }} aria-hidden="true"></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="row-title">
              {parsed.bankName}
              {parsed.product === 'savings' ? ` · ${t('importSavings')}` : parsed.product === 'card' ? ` · ${t('importCard')}` : ''}
            </p>
            <p className="row-sub" style={{ marginTop: 2 }}>
              {day(parsed.from)} – {day(parsed.to)} · {tf(language, 'importRows', { n: parsed.rows.length })}
            </p>
            <label className="field-label" style={{ marginTop: 12 }}>
              {t('importIntoAccount')}
            </label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ marginBottom: 0 }}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="primary-button" onClick={check} disabled={!accountId}>
          {t('importCheck')}
        </button>
        <button type="button" className="secondary-button" onClick={() => setParsed(null)}>
          {t('importOtherFile')}
        </button>
      </div>
    )
  }

  // --- step 3: check, then add --------------------------------------------------
  const bc = prep.balanceCheck
  const byDay = []
  for (const r of [...prep.rows].sort((a, b) => b.date.localeCompare(a.date))) {
    const last = byDay[byDay.length - 1]
    if (last && last.date === r.date) last.rows.push(r)
    else byDay.push({ date: r.date, rows: [r] })
  }

  const chipFor = (r) => {
    if (r.status === 'foreign') return { cls: '', icon: 'ti-currency', text: t('importForeign') }
    if (r.status !== 'new') return { cls: '', icon: 'ti-copy', text: r.status === 'mirror' ? t('importMirror') : t('importAlready') }
    if (overrides[r.key]) return null
    if (r.billId) {
      const b = bills.find((x) => x.id === r.billId)
      return { cls: 'green', icon: 'ti-file-invoice', text: tf(language, 'importMarksPaid', { name: b?.name || '' }) }
    }
    if (r.transfer) {
      const far = r.counterAccountId ? accountName(r.counterAccountId) : null
      return { cls: 'green', icon: 'ti-arrows-exchange', text: far ? tf(language, r.type === 'expense' ? 'importTransferTo' : 'importTransferFrom', { name: far }) : t('importTransfer') }
    }
    if (r.why === 'learned' && catById[r.categoryId]) {
      const c = catById[r.categoryId]
      return { cls: 'gold', icon: c.icon, text: tf(language, 'importLikeLastTime', { name: c.name }) }
    }
    return null
  }

  return (
    <div className="screen import-screen">
      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="tile">
          <p className="label">{t('importNew')}</p>
          <p className="tile-number">{prep.counts.new}</p>
        </div>
        <div className="tile">
          <p className="label">{t('importAlreadyIn')}</p>
          <p className="tile-number">{prep.counts.already}</p>
        </div>
        <div className="tile">
          <p className="label">{t('importTransfers')}</p>
          <p className="tile-number">{prep.counts.transfers}</p>
        </div>
      </div>

      {bc ? (
        <div className={`import-check ${bc.matches ? '' : 'is-off'}`} role="status">
          <i className={`ti ${bc.matches ? 'ti-circle-check' : 'ti-alert-triangle'}`} aria-hidden="true"></i>
          <span>
            {tf(language, bc.matches ? 'importBalanceOk' : 'importBalanceOff', {
              bank: money(bc.bank),
              gild: money(bc.gild),
              date: day(bc.date),
              diff: money(Math.abs(bc.gild - bc.bank))
            })}
          </span>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {t('importNoBalance')}
        </p>
      )}

      <div className="card import-list">
        {byDay.map((g) => (
          <div key={g.date}>
            <p className="import-day">{day(g.date)}</p>
            {g.rows.map((r) => {
              const chip = chipFor(r)
              const skipped = r.status !== 'new'
              const options = importCategories(categories, r.type)
              return (
                <div className={`import-row ${skipped ? 'is-skipped' : ''}`} key={r.key}>
                  <div style={{ minWidth: 0 }}>
                    <p className="import-name">{r.note}</p>
                    {(() => {
                      // The category chip is itself the picker: tapping it opens the
                      // list. Bills and transfers are fixed, so theirs is just a label.
                      const pickable = !skipped && !r.transfer && !r.billId
                      const chosen = overrides[r.key] && catById[overrides[r.key]]
                      const shown = chosen
                        ? { cls: 'gold', icon: chosen.icon, text: chosen.name }
                        : chip || { cls: '', icon: 'ti-tag', text: t('importChooseCategory') }
                      return (
                        <span className={`import-chip ${shown.cls} ${pickable ? 'is-pick' : ''}`}>
                          <i className={`ti ${shown.icon}`} aria-hidden="true"></i>
                          {shown.text}
                          {pickable && <i className="ti ti-chevron-down" aria-hidden="true"></i>}
                          {pickable && (
                            <select
                              value={overrides[r.key] || r.categoryId || ''}
                              onChange={(e) => setOverrides({ ...overrides, [r.key]: e.target.value })}
                              aria-label={`${t('category')}: ${r.note}`}
                            >
                              {!r.categoryId && <option value="">{t('importChooseCategory')}</option>}
                              {options.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </span>
                      )
                    })()}
                  </div>
                  <span className={`import-amt ${r.type === 'income' ? 'is-in' : ''}`}>
                    {r.type === 'income' ? '+' : ''}
                    {money(r.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <button type="button" className="primary-button" onClick={add} disabled={busy || prep.counts.new === 0}>
        {prep.counts.new === 0 ? t('importNothingNew') : tf(language, 'importAddN', { n: prep.counts.new })}
      </button>
      <button type="button" className="secondary-button" onClick={() => setPrep(null)}>
        {t('back')}
      </button>
    </div>
  )
}
