import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { currencyOptions, iconOptions, exportBackup, importBackup, getPasscode, setPasscode, clearPasscode } from '../db.js'
import { languageOptions } from '../i18n.js'
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
  const { categories, transactions, addCategory, editCategory, removeCategory } = useApp()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(iconOptions[0])
  const [newKind, setNewKind] = useState('expense')
  const [error, setError] = useState('')

  const expenseCategories = categories.filter((c) => c.kind !== 'income')
  const incomeCategories = categories.filter((c) => c.kind === 'income')

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
      const ok = window.confirm(
        `"${cat.name}" has existing transactions. Deleting it won't remove those, they'll just show as uncategorized. Delete anyway?`
      )
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

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />

      <p className="section-title">{t('expenseCategories')}</p>
      <div className="stack">{expenseCategories.map((c) => renderCategoryRow(c, true))}</div>

      <p className="section-title">{t('incomeCategories')}</p>
      <div className="stack">{incomeCategories.map((c) => renderCategoryRow(c, false))}</div>

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
  const { importTransactions, refresh } = useApp()
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const [backupMsg, setBackupMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')

  async function handleExport() {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gild-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importBackup(data)
      await refresh()
      setBackupMsg(t('backupRestored'))
    } catch {
      setBackupMsg(t('couldNotReadBackup'))
    }
    e.target.value = ''
  }

  async function handleTransactionImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const list = JSON.parse(text)
      const count = await importTransactions(list)
      setImportMsg(`${t('addedTransactions')} ${count}`)
    } catch {
      setImportMsg(t('couldNotReadFile'))
    }
    e.target.value = ''
  }

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
        <input type="file" accept="application/json" ref={fileRef} onChange={handleImport} hidden />
        {backupMsg && <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>{backupMsg}</p>}
      </div>

      <p className="section-title">{t('importTransactionsTitle')}</p>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13 }}>
          {t('importTransactionsNote')}
        </p>
        <button type="button" className="secondary-button" style={{ width: '100%' }} onClick={() => importRef.current?.click()}>
          {t('importTransactionsTitle')}
        </button>
        <input type="file" accept="application/json" ref={importRef} onChange={handleTransactionImport} hidden />
        {importMsg && <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>{importMsg}</p>}
      </div>
    </div>
  )
}

function AboutScreen({ onBack, t }) {
  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('versionHistory')}</p>
      <div className="stack">
        {changelog.map((entry) => (
          <div key={entry.version} className="card">
            <div className="row between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold-light)' }}>v{entry.version}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{entry.summary}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {entry.changes.map((c, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Settings() {
  const { t } = useApp()
  const [view, setView] = useState('menu')

  if (view === 'currency') return <CurrencyScreen onBack={() => setView('menu')} t={t} />
  if (view === 'language') return <LanguageScreen onBack={() => setView('menu')} t={t} />
  if (view === 'categories') return <CategoriesScreen onBack={() => setView('menu')} t={t} />
  if (view === 'security') return <SecurityScreen onBack={() => setView('menu')} t={t} />
  if (view === 'data') return <DataScreen onBack={() => setView('menu')} t={t} />
  if (view === 'about') return <AboutScreen onBack={() => setView('menu')} t={t} />

  return <MenuScreen onOpen={setView} t={t} />
}
