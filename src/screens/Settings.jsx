import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { isNativeApp, saveBackupFile } from '../deviceStore.js'
import { currencyOptions, iconOptions, exportBackup, importBackup, summarizeBackup, findImportDuplicates, getPasscode, setPasscode, clearPasscode, normalizePayRule, accountBalance, anchorFromReal, todayLocalDate, isExcludedFromTotals } from '../db.js'
import { languageOptions, localeFor, formatMoney, tf } from '../i18n.js'
import { changelog } from '../changelog.js'
import { reminderPermission, askReminderPermission } from '../reminders.js'
import { getReminderSettings, setReminderSettings } from '../db.js'
import { tripShare } from '../tripsy.js'

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
    { key: 'cash', label: t('accountsTitle'), icon: 'ti-wallet' },
    { key: 'language', label: t('language'), icon: 'ti-language' },
    { key: 'categories', label: t('categoriesSettings'), icon: 'ti-tag' },
    { key: 'reminders', label: t('reminders'), icon: 'ti-bell' },
    { key: 'tripsy', label: 'Tripsy', icon: 'ti-plane' },
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

// One card per real account. Each keeps its own anchor and reconciles against
// its own statement — a single figure across the current account and Revolut could never tie
// out to either.
function AccountCard({ account, t }) {
  const { accounts, transactions, updateAccount, removeAccount, currency, language } = useApp()
  const anchor = account.anchor
  const [opening, setOpening] = useState(anchor ? String(anchor.openingValue) : '')
  const [openingDate, setOpeningDate] = useState(anchor?.openingDate || todayLocalDate())
  const [reconcile, setReconcile] = useState('')
  const [name, setName] = useState(account.name)
  const money = (v) => formatMoney(language, currency, v, { decimals: 2 })
  const rb = accountBalance(account, transactions, accounts)
  const real = parseFloat(reconcile)
  const diff = rb && !isNaN(real) ? real - rb.balance : null

  const saveAnchor = (enabled) =>
    updateAccount(account.id, {
      anchor: { enabled, openingValue: parseFloat(opening) || 0, openingDate }
    })

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== account.name && updateAccount(account.id, { name: name.trim() })}
          aria-label={t('newAccountName')}
          style={{ marginBottom: 0, fontWeight: 600 }}
        />
        {accounts.length > 1 && !account.primary && (
          <button
            type="button"
            className="mini-button"
            style={{ marginLeft: 8 }}
            aria-label={t('delete')}
            onClick={() => window.confirm(t('deleteAccountConfirm').replace('{name}', account.name)) && removeAccount(account.id)}
          >
            <i className="ti ti-trash" aria-hidden="true"></i>
          </button>
        )}
      </div>

      <label className="row gap checkbox-row" style={{ margin: '0 0 12px', fontSize: 14 }}>
        <input type="checkbox" checked={Boolean(anchor?.enabled)} onChange={(e) => saveAnchor(e.target.checked)} />
        {t('trackBalance')}
      </label>

      <label className="field-label">{t('cashOpeningValue')}</label>
      <input type="number" inputMode="decimal" placeholder="0.00" value={opening} onChange={(e) => setOpening(e.target.value)} />
      <label className="field-label">{t('cashOpeningDate')}</label>
      <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
      <button type="button" className="primary-button" onClick={() => saveAnchor(anchor?.enabled ?? true)}>
        {t('save')}
      </button>

      {rb && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule-soft)' }}>
          <p className="engraved" style={{ marginBottom: 8 }}>{t('cashReconcile')}</p>
          <p className="row-sub" style={{ margin: '0 0 12px' }}>
            {t('cashBalance')}: <strong style={{ color: 'var(--ink)' }}>{money(rb.balance)}</strong>
            <span className="muted"> · {t('cashSince')} {rb.since} · {rb.counted} {t('cashCounted')}</span>
          </p>
          <label className="field-label">{t('cashRealValue')}</label>
          <input type="number" inputMode="decimal" placeholder="0.00" value={reconcile} onChange={(e) => setReconcile(e.target.value)} />
          {diff !== null && (
            <p className="row-sub" style={{ margin: '-6px 0 12px', color: Math.abs(diff) < 0.005 ? 'var(--credit)' : 'var(--danger-text)' }}>
              {Math.abs(diff) < 0.005 ? t('cashMatches') : `${money(Math.abs(diff))} ${t('cashUnaccounted')}`}
            </p>
          )}
          <button
            type="button"
            className="secondary-button"
            style={{ width: '100%' }}
            disabled={isNaN(real)}
            onClick={() => {
              if (isNaN(real)) return
              const next = anchorFromReal(account, real, transactions, accounts)
              setOpening(String(next.openingValue))
              setOpeningDate(next.openingDate)
              setReconcile('')
              updateAccount(account.id, { anchor: next })
            }}
          >
            {t('cashReAnchor')}
          </button>
        </div>
      )}
    </div>
  )
}

function CashScreen({ onBack, t }) {
  const { accounts, cash, addAccount, currency, language } = useApp()
  const [newName, setNewName] = useState('')
  const money = (v) => formatMoney(language, currency, v, { decimals: 2 })

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title">{t('accountsTitle')}</p>
      <p className="muted" style={{ margin: '0 4px', fontSize: 13 }}>{t('accountsNote')}</p>

      {/* The old single figure covered both banks at once, so it cannot be
          split into per-account anchors. Say so rather than drop it silently. */}
      {/* Only until he has set an account up — after that it is just noise. */}
      {cash?.enabled && !accounts.some((a) => a.anchor?.enabled) && (
        <div className="card" style={{ borderColor: 'var(--rule-gold)' }}>
          <p className="row-sub" style={{ margin: 0 }}>
            {t('legacyCashNotice')
              .replace('{value}', money(cash.openingValue))
              .replace(
                '{date}',
                new Date(cash.openingDate + 'T00:00:00').toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' })
              )}
          </p>
        </div>
      )}

      {accounts.map((a) => (
        <AccountCard key={a.id} account={a} t={t} />
      ))}

      <div className="card">
        <label className="field-label">{t('addAccount')}</label>
        <input type="text" placeholder={t('newAccountName')} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          type="button"
          className="secondary-button"
          style={{ width: '100%' }}
          disabled={!newName.trim()}
          onClick={async () => {
            await addAccount({ name: newName.trim() })
            setNewName('')
          }}
        >
          {t('addAccount')}
        </button>
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
  const { categories, transactions, balances, addCategory, editCategory, removeCategory, restoreCategory } = useApp()
  // Only debt accounts can be linked: the idea is "this expense reduces a debt
  // I'm tracking", which does not map onto a savings pot or money owed to you.
  const debtAccounts = balances.filter((a) => a.type === 'debt')
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
      <div key={c.id} className="cat-row" style={{ alignItems: 'flex-start' }}>
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
              {debtAccounts.length > 0 && (
                <>
                  <label className="field-label" style={{ marginTop: 10 }}>
                    {t('linkedBalance')}
                  </label>
                  <select
                    value={c.linkedBalanceAccountId || ''}
                    onChange={(e) => editCategory(c.id, { linkedBalanceAccountId: e.target.value || null })}
                    style={{ marginBottom: c.linkedBalanceAccountId ? 6 : 0 }}
                  >
                    <option value="">{t('linkedBalanceNone')}</option>
                    {debtAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {c.linkedBalanceAccountId && (
                    <p className="row-sub" style={{ margin: 0, color: 'var(--ink-3)', fontSize: 12 }}>
                      {t('linkedBalanceNote')}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* Deliberately on income rows too: money in can be just as unreal
              as money out (a transfer landing, a reimbursement arriving). */}
          <label className="row gap" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={isExcludedFromTotals(c)}
              // A transfer category is excluded by what it is, so the box is
              // locked on rather than springing back after being unticked.
              disabled={!!c.transfer}
              onChange={(e) => editCategory(c.id, { excludeFromTotals: e.target.checked })}
              style={{ width: 'auto', height: 'auto', margin: 0 }}
            />
            {t('excludeFromTotals')}
          </label>
          {isExcludedFromTotals(c) && (
            <p className="row-sub" style={{ margin: '4px 0 0', color: 'var(--ink-3)', fontSize: 12 }}>
              {c.transfer ? t('excludeAlwaysTransfer') : t('excludeFromTotalsNote')}
            </p>
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

// Tripsy: connect with the access key (kept on this phone only), refresh,
// and choose which savings goal follows which trip.
function TripsyScreen({ onBack, t }) {
  const { tripsy, refreshTripsy, disconnectTripsy, linkGoalToTrip, balances, currency, language } = useApp()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const money = (v) => formatMoney(language, currency, v, { decimals: 0 })
  const goals = balances.filter((a) => a.type === 'savings' && a.goal)
  const errorText = { auth: t('tripsyBadKey'), network: t('tripsyOffline'), format: t('tripsyFormat') }[tripsy.error]
  const updated = tripsy.fetchedAt
    ? new Date(tripsy.fetchedAt).toLocaleString(localeFor(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  async function connect() {
    if (!key.trim() || busy) return
    setBusy(true)
    const res = await refreshTripsy({ force: true, token: key.trim() })
    setBusy(false)
    if (res.ok) setKey('')
  }

  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title" style={{ marginTop: 4 }}>
        Tripsy
      </p>
      {!tripsy.connected ? (
        <div className="card">
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            {t('tripsyIntro')}
          </p>
          <label className="field-label">{t('tripsyKey')}</label>
          <input
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="••••••••"
          />
          {errorText && <p className="error-text">{errorText}</p>}
          <button type="button" className="primary-button" onClick={connect} disabled={busy || !key.trim()}>
            {busy ? t('tripsyConnecting') : t('tripsyConnect')}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="row between">
            <span className="row-title">{t('tripsyConnected')}</span>
            <span className="pill-ok">{tf(language, 'tripsyTrips', { n: tripsy.trips.length })}</span>
          </div>
          <p className="row-sub" style={{ marginTop: 4 }}>
            {tf(language, 'tripsyUpdated', { when: updated })}
          </p>
          {errorText && <p className="error-text">{errorText}</p>}
          <div className="row gap" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="mini-button" disabled={tripsy.loading} onClick={() => refreshTripsy({ force: true })}>
              {tripsy.loading ? t('tripsyConnecting') : t('tripsyRefresh')}
            </button>
            <button type="button" className="mini-button" onClick={disconnectTripsy}>
              {t('tripsyDisconnect')}
            </button>
          </div>
        </div>
      )}

      {tripsy.trips.length > 0 && (
        <>
          <p className="section-title" style={{ marginBottom: -4 }}>
            {t('tripsyTripsTitle')}
          </p>
          <div className="stack">
            {tripsy.trips.map((trip) => {
              const share = tripShare(trip)
              // a goal can follow a trip that still has something to pay
              const future = share.remaining > 0 && (!trip.end || trip.end >= new Date().toISOString().slice(0, 10))
              const linked = goals.find((g) => g.goal.tripSlug === trip.slug)
              const sub = future
                ? tf(language, 'tripsyStillToPay', { amount: money(share.remaining) })
                : share.paid
                  ? share.split === 1
                    ? tf(language, 'tripsyPaid', { amount: money(share.paid) })
                    : tf(language, 'tripsyPaidYours', { amount: money(share.paid), mine: money(share.myPaid) })
                  : t('tripsyNoCosts')
              return (
                <div className="list-row" key={trip.slug}>
                  <div className="row between">
                    <div style={{ minWidth: 0 }}>
                      <p className="row-title">
                        {trip.name} {trip.flag}
                      </p>
                      <p className="row-sub">{sub}</p>
                    </div>
                    <span className="pill-muted">{share.split ? `${Math.round(share.split * 100)}%` : '—'}</span>
                  </div>
                  {future && goals.length > 0 && (
                    <label className="field-label" style={{ marginTop: 10 }}>
                      {t('tripsyGoal')}
                      <select
                        value={linked?.id || ''}
                        onChange={(e) => {
                          if (linked && linked.id !== e.target.value) linkGoalToTrip(linked.id, null)
                          if (e.target.value) linkGoalToTrip(e.target.value, trip.slug)
                        }}
                        style={{ marginTop: 6, marginBottom: 0 }}
                      >
                        <option value="">{t('tripsyNoGoal')}</option>
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// Phone reminders and in-app limit warnings. Opening this screen on the
// iPhone is what asks iOS for notification permission, once.
function RemindersScreen({ onBack, t }) {
  const { rescheduleReminders } = useApp()
  const [settings, setSettings] = useState(null)
  const [permission, setPermission] = useState(null)

  useEffect(() => {
    getReminderSettings().then(setSettings)
    ;(async () => {
      let p = await reminderPermission()
      if (p === 'prompt') p = await askReminderPermission()
      setPermission(p)
      if (p === 'granted') rescheduleReminders()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function update(changes) {
    setSettings(await setReminderSettings(changes))
    rescheduleReminders()
  }

  if (!settings) return null
  const rows = [
    ['payday', t('remPayday'), t('remPaydaySub')],
    ['bills', t('remBills'), t('remBillsSub')],
    ['nothingLogged', t('remNothing'), t('remNothingSub')],
    ['goals', t('remGoals'), t('remGoalsSub')],
    ['limits', t('remLimits'), t('remLimitsSub')],
    ['hideAmounts', t('remHide'), t('remHideSub')]
  ]
  return (
    <div className="screen">
      <BackButton onBack={onBack} label={t('back')} />
      <p className="section-title" style={{ marginTop: 4 }}>
        {t('reminders')}
      </p>
      {permission === 'denied' && <p className="error-text">{t('remDenied')}</p>}
      {permission === 'unsupported' && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('remBrowserOnly')}</p>}
      <div className="stack">
        {rows.map(([key, title, sub]) => (
          <label key={key} className="list-row reminder-row">
            <input type="checkbox" checked={!!settings[key]} onChange={(e) => update({ [key]: e.target.checked })} />
            <span style={{ flex: 1 }}>
              <span className="row-title" style={{ display: 'block' }}>{title}</span>
              <span className="row-sub" style={{ display: 'block', marginTop: 2 }}>{sub}</span>
            </span>
          </label>
        ))}
        <label className="list-row reminder-row" style={{ alignItems: 'center' }}>
          <i className="ti ti-clock" style={{ color: 'var(--ink-2)', fontSize: 18 }} aria-hidden="true"></i>
          <span className="row-title" style={{ flex: 1 }}>{t('remTime')}</span>
          <input
            type="time"
            value={settings.time}
            onChange={(e) => e.target.value && update({ time: e.target.value })}
            style={{ width: 'auto', marginBottom: 0 }}
          />
        </label>
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

  // In the iPhone app a download link does nothing, so the file is saved
  // into Gild's folder in the Files app instead (and, for an export, the
  // share sheet opens so it can be sent anywhere).
  async function downloadJson(data, filename, { share = false } = {}) {
    const text = JSON.stringify(data, null, 2)
    if (isNativeApp) {
      await saveBackupFile(filename, text, { share })
      return
    }
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport() {
    const data = await exportBackup()
    try {
      await downloadJson(data, `gild-backup-${new Date().toISOString().slice(0, 10)}.json`, { share: true })
    } catch {
      setBackupMsg(t('backupSaveFailed'))
    }
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
    try {
      await downloadJson(safety, `gild-pre-restore-safety-backup-${new Date().toISOString().slice(0, 10)}.json`)
    } catch {
      // No safety copy, no restore: replacing data without one is the
      // mistake this step exists to prevent.
      setRestorePreview(null)
      setBackupMsg(t('backupSaveFailed'))
      return
    }
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
        <input type="file" ref={fileRef} onChange={handleImportFileSelected} hidden />
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
        <input type="file" ref={importRef} onChange={handleImportFileForTransactions} hidden />
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
  if (view === 'cash')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <CashScreen onBack={back} t={t} />
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
  if (view === 'tripsy')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <TripsyScreen onBack={back} t={t} />
      </SubScreenSwipeWrapper>
    )
  if (view === 'reminders')
    return (
      <SubScreenSwipeWrapper onBack={back}>
        <RemindersScreen onBack={back} t={t} />
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
