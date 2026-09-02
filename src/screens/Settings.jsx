import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { currencyOptions, iconOptions, exportBackup, importBackup, summarizeBackup, findImportDuplicates, getPasscode, setPasscode, clearPasscode, normalizePayRule } from '../db.js'
import { languageOptions, localeFor } from '../i18n.js'
import { changelog } from '../changelog.js'

function BackButton({ onBack, label }) {
  return (
    <button
      type="button"
      className="mini-button"
      onClick={onBack}
      style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <i className="ti ti-chevron-left" aria-hidden="true"></i> {label}
    </button>
  )
}

function MenuScreen({ onOpen, t }) {
  const items = [
    { key: 'currency', label: t('currency'), icon: 'ti-coin' },
    { key: 'payday', label: t('payDay'), icon: 'ti-calendar-dollar' },
    { key: 'language', label: t('language'), icon: 'ti-language' },
    { key: 'categories', label: t('categoriesSettings'), icon: 'ti-tag' },
    { key: 'security', label: t('security'), icon: 'ti-lock' },
    { key: 'data', label: t('dataAndBackup'), icon: 'ti-database' },
    { key: 'about', label: t('about'), icon: 'ti-info-circle' }
  ]
  return (
    <div className="screen">
      <div className="stack">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="row between list-row"
            style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onOpen(item.key)}
          >
            <div className="row gap">
              <div className="icon-badge">
                <i className={`ti ${item.icon}`} aria-hidden="true"></i>
              </div>
              <p className="row-title">{item.label}</p>
            </div>
            <i className="ti ti-chevron-right" style={{ color: 'var(--text-secondary)' }} aria-hidden="true"></i>
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        {t('privacyNote')}
      </p>
    </div>
  )
}

function CurrencyScreen({ onBack, t }) {
  const { currency, changeCurrency } = useApp()
  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('currency')}</p>
      <div className="card">
        <select
          value={currency.code}
          onChange={(e) => {
            const found = currencyOptions.find((c) => c.code === e.target.value)
            if (found) changeCurrency(found)
          }}
          style={{ marginBottom: 0 }}
        >
          {currencyOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function PayDayScreen({ onBack, t }) {
  const { payDay, changePayDay, periodLabel, language } = useApp()
  const rule = normalizePayRule(payDay)
  const [mode, setMode] = useState(rule.type)
  const [value, setValue] = useState(String(rule.day ?? 25))
  const [weekday, setWeekday] = useState(rule.weekday ?? 5)

  // Localized weekday names straight from Intl — 2024-01-01 was a Monday.
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    dow,
    label: new Date(Date.UTC(2024, 0, 1 + ((dow + 6) % 7))).toLocaleDateString(localeFor(language), {
      weekday: 'long',
      timeZone: 'UTC'
    })
  }))

  async function handleSave() {
    if (mode === 'lastWeekday') await changePayDay({ type: 'lastWeekday', weekday: Number(weekday) })
    else if (mode === 'lastWorkingDay') await changePayDay({ type: 'lastWorkingDay' })
    else await changePayDay({ type: 'day', day: value })
  }

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('payDay')}</p>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13 }}>
          {t('payDayNote')}
        </p>
        <label className="field-label">{t('type')}</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="day">{t('payDayModeDay')}</option>
          <option value="lastWeekday">{t('payDayModeLastWeekday')}</option>
          <option value="lastWorkingDay">{t('payDayModeLastWorking')}</option>
        </select>
        {mode === 'day' && (
          <>
            <label className="field-label">{t('payDayField')}</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </>
        )}
        {mode === 'lastWeekday' && (
          <>
            <label className="field-label">{t('weekday')}</label>
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {weekdays.map((w) => (
                <option key={w.dow} value={w.dow}>
                  {w.label}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="button" className="primary-button" onClick={handleSave}>
          {t('save')}
        </button>
        <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: 13 }}>
          {t('payDayCurrent')}: {periodLabel}
        </p>
      </div>
    </div>
  )
}

function LanguageScreen({ onBack, t }) {
  const { language, changeLanguage } = useApp()
  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('language')}</p>
      <div className="stack">
        {languageOptions.map((l) => (
          <button
            key={l.code}
            type="button"
            className="row between list-row"
            style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => changeLanguage(l.code)}
          >
            <p className="row-title">{l.label}</p>
            {language === l.code && <i className="ti ti-check" style={{ color: 'var(--gold)' }} aria-hidden="true"></i>}
          </button>
        ))}
      </div>
    </div>
  )
}

function CategoriesScreen({ onBack, t }) {
  const { categories, transactions, addCategory, editCategory, removeCategory, restoreCategory } = useApp()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(iconOptions[0])
  const [newKind, setNewKind] = useState('expense')
  const [error, setError] = useState('')

  const expenseCategories = categories.filter((c) => c.kind !== 'income' && !c.archived)
  const incomeCategories = categories.filter((c) => c.kind === 'income' && !c.archived)
  const archivedCategories = categories.filter((c) => c.archived)

  async function handleAddCategory() {
    if (!newName.trim()) {
      setError(t('newCategoryName'))
      return
    }
    await addCategory({ name: newName.trim(), icon: newIcon, kind: newKind })
    setNewName('')
    setError('')
  }

  async function handleBudgetChange(cat, value) {
    const num = value === '' ? null : parseFloat(value)
    await editCategory(cat.id, { monthlyBudget: isNaN(num) ? null : num })
  }

  async function handleRemove(cat) {
    const inUse = transactions.some((tx) => tx.categoryId === cat.id)
    if (inUse) {
      const ok = window.confirm(t('archiveCategoryConfirm').replace('{name}', cat.name))
      if (!ok) return
    }
    await removeCategory(cat.id)
  }

  function renderCategoryRow(c, showBudget) {
    return (
      <div key={c.id} className="cat-row">
        <div className="cat-icon" style={{ background: c.tint, borderColor: c.borderTint }}>
          <i className={`ti ${c.icon}`} style={{ color: c.accent, fontSize: 16 }} aria-hidden="true"></i>
        </div>
        <div className="cat-body">
          <p className="row-title" style={{ marginBottom: 6 }}>
            {c.name}
          </p>
          {showBudget && (
            <>
              <input
                type="number"
                inputMode="decimal"
                placeholder={t('noMonthlyLimit')}
                defaultValue={c.monthlyBudget ?? ''}
                onBlur={(e) => handleBudgetChange(c, e.target.value)}
                style={{ marginBottom: c.monthlyBudget != null ? 6 : 0 }}
              />
              {c.monthlyBudget != null && (
                <label className="row gap" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={!!c.rollover}
                    onChange={(e) => editCategory(c.id, { rollover: e.target.checked })}
                    style={{ width: 'auto', height: 'auto', margin: 0 }}
                  />
                  {t('rolloverLabel')}
                </label>
              )}
            </>
          )}
        </div>
        <button type="button" className="mini-button" onClick={() => handleRemove(c)}>
          <i className="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    )
  }

  function renderArchivedRow(c) {
    return (
      <div key={c.id} className="cat-row">
        <div className="cat-icon" style={{ background: c.tint, borderColor: c.borderTint }}>
          <i className={`ti ${c.icon}`} style={{ color: c.accent, fontSize: 16 }} aria-hidden="true"></i>
        </div>
        <div className="cat-body">
          <p className="row-title" style={{ margin: 0 }}>
            {c.name}
          </p>
        </div>
        <button type="button" className="mini-button" onClick={() => restoreCategory(c.id)}>
          {t('restore')}
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />

      <p className="section-title">{t('expenseCategories')}</p>
      <div className="stack">{expenseCategories.map((c) => renderCategoryRow(c, true))}</div>

      <p className="section-title">{t('incomeCategories')}</p>
      <div className="stack">{incomeCategories.map((c) => renderCategoryRow(c, false))}</div>

      {archivedCategories.length > 0 && (
        <>
          <p className="section-title">{t('archivedCategories')}</p>
          <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            {t('archivedCategoriesNote')}
          </p>
          <div className="stack">{archivedCategories.map(renderArchivedRow)}</div>
        </>
      )}

      <div className="card">
        <p className="field-label">{t('newCategoryName')}</p>
        <input type="text" placeholder="e.g. Pets" value={newName} onChange={(e) => setNewName(e.target.value)} />

        <p className="field-label">{t('type')}</p>
        <div className="segmented">
          <button type="button" className={newKind === 'expense' ? 'segment-active' : ''} onClick={() => setNewKind('expense')}>
            {t('expense')}
          </button>
          <button type="button" className={newKind === 'income' ? 'segment-active' : ''} onClick={() => setNewKind('income')}>
            {t('income')}
          </button>
        </div>

        <p className="field-label">{t('icon')}</p>
        <div className="grid-2 category-grid">
          {iconOptions.map((icon) => (
            <button
              type="button"
              key={icon}
              className={newIcon === icon ? 'category-chip category-chip-active' : 'category-chip'}
              onClick={() => setNewIcon(icon)}
            >
              <i className={`ti ${icon}`} aria-hidden="true"></i>
            </button>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="button" className="primary-button" onClick={handleAddCategory}>
          <i className="ti ti-plus" aria-hidden="true"></i> {t('addCategory')}
        </button>
      </div>
    </div>
  )
}

function SecurityScreen({ onBack, t }) {
  const [hasCode, setHasCode] = useState(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getPasscode().then((code) => setHasCode(!!code))
  }, [])

  async function handleSet() {
    if (hasCode) {
      const stored = await getPasscode()
      if (current !== stored) {
        setMsg(t('incorrectPasscode'))
        return
      }
    }
    if (!next || next.length < 4) {
      setMsg(t('passcodeTooShort'))
      return
    }
    if (next !== confirm) {
      setMsg(t('passcodesDontMatch'))
      return
    }
    await setPasscode(next)
    setHasCode(true)
    setCurrent('')
    setNext('')
    setConfirm('')
    setMsg(t('passcodeSet'))
  }

  async function handleRemove() {
    const stored = await getPasscode()
    if (current !== stored) {
      setMsg(t('incorrectPasscode'))
      return
    }
    await clearPasscode()
    setHasCode(false)
    setCurrent('')
    setMsg(t('passcodeRemoved'))
  }

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('security')}</p>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13 }}>
          {t('passcodeNote')}
        </p>

        {hasCode && (
          <>
            <label className="field-label">{t('currentPasscode')}</label>
            <input
              type="password"
              inputMode="numeric"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </>
        )}

        <label className="field-label">{t('newPasscode')}</label>
        <input type="password" inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value)} />

        <label className="field-label">{t('confirmPasscode')}</label>
        <input type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

        {msg && <p className="error-text">{msg}</p>}

        <button type="button" className="primary-button" onClick={handleSet}>
          {hasCode ? t('changePasscode') : t('setPasscode')}
        </button>

        {hasCode && (
          <button
            type="button"
            className="secondary-button"
            style={{ width: '100%', marginTop: 10 }}
            onClick={handleRemove}
          >
            {t('removePasscode')}
          </button>
        )}
      </div>
    </div>
  )
}

function DataScreen({ onBack, t }) {
  const { importTransactions, currency, refresh } = useApp()
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const [backupMsg, setBackupMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [restorePreview, setRestorePreview] = useState(null) // { data, summary }
  const [importPreview, setImportPreview] = useState(null) // { list }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport() {
    const data = await exportBackup()
    downloadJson(data, `gild-backup-${new Date().toISOString().slice(0, 10)}.json`)
  }

  async function handleImportFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const summary = summarizeBackup(data)
      setRestorePreview({ data, summary })
      setBackupMsg('')
    } catch {
      setBackupMsg(t('couldNotReadBackup'))
    }
    e.target.value = ''
  }

  async function handleConfirmRestore() {
    if (!restorePreview) return
    // Safety net: always download a backup of what's currently here,
    // right before it gets overwritten, in case the restore turns out
    // to be a mistake.
    const safety = await exportBackup()
    downloadJson(safety, `gild-pre-restore-safety-backup-${new Date().toISOString().slice(0, 10)}.json`)
    await importBackup(restorePreview.data)
    await refresh()
    setRestorePreview(null)
    setBackupMsg(t('backupRestored'))
  }

  async function handleImportFileForTransactions(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const list = JSON.parse(text)
      const withDuplicateFlags = await findImportDuplicates(list)
      setImportPreview({ list: withDuplicateFlags })
      setImportMsg('')
    } catch {
      setImportMsg(t('couldNotReadFile'))
    }
    e.target.value = ''
  }

  async function handleConfirmImport(includeDuplicates) {
    if (!importPreview) return
    const toImport = includeDuplicates
      ? importPreview.list
      : importPreview.list.filter((t) => !t.isDuplicate)
    const count = await importTransactions(toImport)
    setImportPreview(null)
    setImportMsg(`${t('addedTransactions')} ${count}`)
  }

  const duplicateCount = importPreview ? importPreview.list.filter((t) => t.isDuplicate).length : 0

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />

      <p className="section-title">{t('backup')}</p>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13 }}>
          {t('backupNote')}
        </p>
        <div className="row gap">
          <button type="button" className="secondary-button" onClick={handleExport}>
            {t('exportBackup')}
          </button>
          <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>
            {t('restoreBackup')}
          </button>
        </div>
        <input type="file" accept="application/json" ref={fileRef} onChange={handleImportFileSelected} hidden />
        {backupMsg && <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>{backupMsg}</p>}
      </div>

      {restorePreview && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: 10 }}>
            {t('restorePreviewTitle')}
          </p>
          {restorePreview.summary.valid ? (
            <>
              <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                <li>{restorePreview.summary.transactions} {t('navActivity').toLowerCase()}</li>
                <li>{restorePreview.summary.categories} {t('categoriesSettings').toLowerCase()}</li>
                <li>{restorePreview.summary.bills} {t('bills').toLowerCase()}</li>
                <li>{restorePreview.summary.balances} {t('accounts').toLowerCase()}</li>
                {restorePreview.summary.currency && <li>{t('currency')}: {restorePreview.summary.currency}</li>}
              </ul>
              {restorePreview.summary.issues.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {restorePreview.summary.issues.map((issue, i) => (
                    <p key={i} className="error-text" style={{ marginTop: 0 }}>
                      {t(issue)}
                    </p>
                  ))}
                </div>
              )}
              <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                {t('restoreSafetyNote')}
              </p>
              <div className="row gap">
                <button type="button" className="secondary-button" onClick={() => setRestorePreview(null)}>
                  {t('discard')}
                </button>
                <button type="button" className="primary-button" onClick={handleConfirmRestore}>
                  {t('restoreBackup')}
                </button>
              </div>
            </>
          ) : (
            <>
              {restorePreview.summary.issues.map((issue, i) => (
                <p key={i} className="error-text" style={{ marginTop: 0 }}>
                  {t(issue)}
                </p>
              ))}
              <button
                type="button"
                className="secondary-button"
                style={{ width: '100%' }}
                onClick={() => setRestorePreview(null)}
              >
                {t('discard')}
              </button>
            </>
          )}
        </div>
      )}

      <p className="section-title">{t('importTransactionsTitle')}</p>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13 }}>
          {t('importTransactionsNote')}
        </p>
        <button
          type="button"
          className="secondary-button"
          style={{ width: '100%' }}
          onClick={() => importRef.current?.click()}
        >
          {t('importTransactionsTitle')}
        </button>
        <input type="file" accept="application/json" ref={importRef} onChange={handleImportFileForTransactions} hidden />
        {importMsg && <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>{importMsg}</p>}
      </div>

      {importPreview && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: 10 }}>
            {importPreview.list.length} {t('importReadyTitle')}
          </p>
          {duplicateCount > 0 ? (
            <>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                {duplicateCount} {t('importDuplicatesNote')}
              </p>
              <div className="row gap">
                <button type="button" className="secondary-button" onClick={() => handleConfirmImport(false)}>
                  {t('importSkipDuplicates')} ({importPreview.list.length - duplicateCount})
                </button>
                <button type="button" className="primary-button" onClick={() => handleConfirmImport(true)}>
                  {t('importAllAnyway')}
                </button>
              </div>
              <button
                type="button"
                className="secondary-button"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => setImportPreview(null)}
              >
                {t('discard')}
              </button>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                {t('importNoDuplicates')}
              </p>
              <div className="row gap">
                <button type="button" className="secondary-button" onClick={() => setImportPreview(null)}>
                  {t('discard')}
                </button>
                <button type="button" className="primary-button" onClick={() => handleConfirmImport(true)}>
                  {t('importTransactionsTitle')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AboutScreen({ onBack, t }) {
  // The history is long, so each release is collapsed to its version and
  // one-line summary; tapping one opens what actually changed in it.
  const [openVersion, setOpenVersion] = useState(changelog[0]?.version || null)
  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('versionHistory')}</p>
      <div className="stack">
        {changelog.map((entry) => {
          const isOpen = openVersion === entry.version
          return (
            <div key={entry.version} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpenVersion(isOpen ? null : entry.version)}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  textAlign: 'left',
                  padding: '16px 18px',
                  cursor: 'pointer'
                }}
              >
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                    v{entry.version}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {entry.summary}
                  </span>
                </span>
                <span className="row gap" style={{ gap: 8, flexShrink: 0, paddingTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.changes.length}
                  </span>
                  <i
                    className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`}
                    style={{ color: 'var(--text-secondary)', fontSize: 16 }}
                    aria-hidden="true"
                  ></i>
                </span>
              </button>
              {isOpen && (
                <ul style={{ margin: 0, padding: '0 18px 16px 34px' }}>
                  {entry.changes.map((c, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubScreenSwipeWrapper({ onBack, children }) {
  const startRef = { current: null }
  function onTouchStart(e) {
    const t = e.touches[0]
    if (t.clientX <= 24) startRef.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e) {
    if (!startRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - startRef.current.x
    const dy = t.clientY - startRef.current.y
    startRef.current = null
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      e.stopPropagation()
      onBack()
    }
  }
  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  )
}

export default function Settings({ initialView }) {
  const { t } = useApp()
  const [view, setView] = useState(initialView || 'menu')
  const back = () => setView('menu')

  if (view === 'currency')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <CurrencyScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'payday')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <PayDayScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'language')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <LanguageScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'categories')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <CategoriesScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'security')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <SecurityScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'data')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <DataScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'about')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <AboutScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )

  return <MenuScreen onOpen={setView} t={t} />
}
