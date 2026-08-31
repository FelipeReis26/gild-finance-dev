import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useSwipe } from '../useSwipe.js'
import { formatMoney, formatMonthShort } from '../i18n.js'
import { periodBounds, currentPeriodKey, todayLocalDate } from '../db.js'

const DAY_MS = 86400000

export default function Dashboard({ onAddTransaction, onSelectCategory }) {
  const { summary, currency, language, payDay, selectedMonth, changeMonth, goToMonth, monthTrend, periodLabel, t } =
    useApp()
  const swipe = useSwipe({ onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) })
  const [showInsights, setShowInsights] = useState(false)
  const [showUnused, setShowUnused] = useState(false)

  if (!summary) return <p className="muted">Loading</p>

  const money = (v, decimals = 0) => formatMoney(language, currency, v, { decimals })

  // --- Pay-period burn-down -------------------------------------------
  // How a family actually thinks between paychecks: what's left, and how
  // long it has to last. The bar shows spend pace against time elapsed —
  // if the gold fill runs ahead of the time marker, money is going faster
  // than the period.
  const periodKeyNow = currentPeriodKey(payDay)
  const isCurrent = selectedMonth === periodKeyNow
  const isFuture = selectedMonth > periodKeyNow
  const { start, end } = periodBounds(selectedMonth, payDay)
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1
  const [ty, tm, td] = todayLocalDate().split('-').map(Number)
  const todayTs = Date.UTC(ty, tm - 1, td)
  let dayIndex = Math.round((todayTs - start.getTime()) / DAY_MS) + 1
  dayIndex = Math.min(totalDays, Math.max(1, dayIndex))
  // Days remaining includes today — money is still spendable today, so
  // the per-day allowance divides by it (day 1 of a 31-day period shows
  // 31 days left; the final day shows 1, not 0).
  const daysRemaining = isCurrent ? totalDays - dayIndex + 1 : 0
  const elapsedFraction = totalDays ? Math.min(1, Math.max(0, dayIndex / totalDays)) : 1
  const spentFraction =
    summary.income > 0 ? Math.min(1, summary.spent / summary.income) : summary.spent > 0 ? 1 : 0

  const left = summary.left
  const over = left < 0
  const perDay = isCurrent && daysRemaining > 0 ? left / daysRemaining : null
  const daysWord = daysRemaining === 1 ? t('dayLeft') : t('daysLeft')
  // Past periods have ended; a period that hasn't started yet is upcoming —
  // never label a future period "ended".
  const periodState = isCurrent ? `${daysRemaining} ${daysWord}` : isFuture ? t('upcoming') : t('periodEnded')
  const burndownLabel = `${money(summary.spent)} ${t('spentOfIncome')} ${money(summary.income)}${
    isCurrent ? ` · ${daysRemaining} ${daysWord}` : ''
  }`

  const activeCats = summary.byCategory.filter((c) => c.spent > 0 || c.monthlyBudget != null)
  const unusedCats = summary.byCategory.filter((c) => !(c.spent > 0 || c.monthlyBudget != null))
  const hasSpend = summary.byCategory.some((c) => c.spent > 0)

  return (
    <div className="screen" {...swipe}>
      <div className="card">
        <div className="row between" style={{ marginBottom: 18 }}>
          <button type="button" className="mini-button" onClick={() => changeMonth(-1)} aria-label={t('previousMonth')}>
            <i className="ti ti-chevron-left" aria-hidden="true"></i>
          </button>
          <p className="section-title" style={{ margin: 0 }}>
            {periodLabel}
          </p>
          <button type="button" className="mini-button" onClick={() => changeMonth(1)} aria-label={t('nextMonth')}>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
          </button>
        </div>

        <div className="hero">
          <p className="hero-amount" style={{ color: over ? 'var(--danger)' : 'var(--text-primary)' }}>
            {money(Math.abs(left))}
          </p>
          <p className="hero-label">{over ? t('overspent') : t('leftToSpend')}</p>

          <div className="burndown" role="img" aria-label={burndownLabel}>
            <div className="burndown-track">
              <div
                className="burndown-fill"
                style={{ width: `${spentFraction * 100}%`, background: over ? 'var(--danger)' : 'var(--gold)' }}
              />
              {isCurrent && totalDays > 0 && (
                <div className="burndown-marker" style={{ left: `${elapsedFraction * 100}%` }} aria-hidden="true" />
              )}
            </div>
            <div className="row between burndown-caption">
              <span>{periodState}</span>
              {isCurrent && perDay != null && !over && (
                <span>
                  {money(perDay)}/{t('perDay')}
                </span>
              )}
            </div>
          </div>

          <div className="hero-stats">
            <span className="hero-stat">
              <span className="dot" style={{ background: 'var(--success)' }} aria-hidden="true" />
              <span className="hero-stat-label">{t('income')}</span>
              <span className="hero-stat-value">{money(summary.income)}</span>
            </span>
            <span className="hero-stat">
              <span className="dot" style={{ background: 'var(--gold)' }} aria-hidden="true" />
              <span className="hero-stat-label">{t('spent')}</span>
              <span className="hero-stat-value">{money(summary.spent)}</span>
            </span>
          </div>
        </div>
      </div>

      <button type="button" className="primary-button" onClick={onAddTransaction}>
        <i className="ti ti-plus" aria-hidden="true"></i> {t('addTransaction')}
      </button>

      {(monthTrend.length > 1 || hasSpend) && (
        <>
          <button
            type="button"
            className="disclosure"
            aria-expanded={showInsights}
            onClick={() => setShowInsights((v) => !v)}
          >
            <span>{t('insights')}</span>
            <i className={`ti ${showInsights ? 'ti-chevron-up' : 'ti-chevron-down'}`} aria-hidden="true"></i>
          </button>

          {showInsights && monthTrend.length > 1 && (
            <div className="card" role="group" aria-label={t('spendTrend')}>
              <div className="row between" style={{ marginBottom: 12 }}>
                <p className="section-title" style={{ margin: 0 }}>
                  {t('spendTrend')}
                </p>
                <div className="row gap legend">
                  <span className="row gap" style={{ gap: 4 }}>
                    <span className="dot-sq" style={{ background: 'var(--success)' }} />
                    {t('income')}
                  </span>
                  <span className="row gap" style={{ gap: 4 }}>
                    <span className="dot-sq" style={{ background: 'var(--gold)' }} />
                    {t('spent')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
                {monthTrend.map((m) => {
                  const max = Math.max(...monthTrend.map((x) => Math.max(x.total, x.income)), 1)
                  const hExpense = Math.max(4, Math.round((m.total / max) * 80))
                  const hIncome = Math.max(4, Math.round((m.income / max) * 80))
                  const isSel = m.month === selectedMonth
                  return (
                    <button
                      type="button"
                      key={m.month}
                      className="trend-bar"
                      onClick={() => goToMonth(m.month)}
                      aria-label={`${formatMonthShort(language, m.month)}: ${t('income')} ${money(m.income)}, ${t(
                        'spent'
                      )} ${money(m.total)}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                        <div
                          style={{ width: 14, height: hIncome, background: 'var(--success)', opacity: isSel ? 1 : 0.55, borderRadius: 3 }}
                        />
                        <div
                          style={{ width: 14, height: hExpense, background: 'var(--gold)', opacity: isSel ? 1 : 0.55, borderRadius: 3 }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: isSel ? 600 : 400
                        }}
                      >
                        {formatMonthShort(language, m.month)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {showInsights && hasSpend && (
            <div className="card">
              <p className="section-title" style={{ marginBottom: 16 }}>
                {t('categoryBreakdown')}
              </p>
              {(() => {
                const withSpend = summary.byCategory.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
                const total = withSpend.reduce((sum, c) => sum + c.spent, 0)
                const r = 80
                const circumference = 2 * Math.PI * r
                let cumulative = 0
                return (
                  <>
                    <div className="gauge-wrap" role="img" aria-label={`${t('categoryBreakdown')}: ${money(total)}`}>
                      <svg width="200" height="200" viewBox="0 0 200 200">
                        {withSpend.map((c) => {
                          const fraction = c.spent / total
                          const arcLen = fraction * circumference
                          const gap = withSpend.length > 1 ? Math.min(3, arcLen * 0.06) : 0
                          const offset = -cumulative
                          cumulative += arcLen
                          return (
                            <circle
                              key={c.id}
                              cx="100"
                              cy="100"
                              r={r}
                              fill="none"
                              stroke={c.accent}
                              strokeWidth="26"
                              strokeDasharray={`${Math.max(0, arcLen - gap)} ${circumference - arcLen + gap}`}
                              strokeDashoffset={offset}
                              transform="rotate(-90 100 100)"
                            />
                          )
                        })}
                        <text x="100" y="96" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text-primary)">
                          {money(total)}
                        </text>
                        <text x="100" y="118" textAnchor="middle" fontSize="12" fill="var(--text-secondary)">
                          {withSpend.length} {withSpend.length === 1 ? t('categorySingular') : t('categoriesPlural')}
                        </text>
                      </svg>
                    </div>
                    <div className="stack" style={{ marginTop: 8 }}>
                      {withSpend.map((c) => (
                        <div key={c.id} className="row between" style={{ fontSize: 14 }}>
                          <span className="row gap" style={{ gap: 8 }}>
                            <span className="dot" style={{ background: c.accent }} />
                            {c.name}
                          </span>
                          <span className="muted">{Math.round((c.spent / total) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </>
      )}

      <p className="section-title">{t('categories')}</p>

      <div className="stack">
        {activeCats.map((c) => (
          <CategoryRow key={c.id} c={c} money={money} t={t} onSelectCategory={onSelectCategory} />
        ))}
      </div>

      {unusedCats.length > 0 && (
        <>
          <button
            type="button"
            className="disclosure disclosure-sub"
            aria-expanded={showUnused}
            onClick={() => setShowUnused((v) => !v)}
          >
            <span>
              {showUnused ? t('hideUnused') : t('showUnused')} ({unusedCats.length})
            </span>
            <i className={`ti ${showUnused ? 'ti-chevron-up' : 'ti-chevron-down'}`} aria-hidden="true"></i>
          </button>
          {showUnused && (
            <div className="stack">
              {unusedCats.map((c) => (
                <CategoryRow key={c.id} c={c} money={money} t={t} onSelectCategory={onSelectCategory} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CategoryRow({ c, money, t, onSelectCategory }) {
  const hasBudget = c.monthlyBudget != null
  const catPct =
    hasBudget && c.effectiveBudget > 0 ? Math.min(100, Math.round((c.spent / c.effectiveBudget) * 100)) : 0
  const over = hasBudget && c.spent > c.effectiveBudget
  const barColor = over ? 'var(--danger)' : c.accent

  function activate() {
    onSelectCategory?.(c.id)
  }

  return (
    <div
      className="cat-row"
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="cat-icon" style={{ background: c.tint, borderColor: c.borderTint }}>
        <i className={`ti ${c.icon}`} style={{ color: c.accent, fontSize: 16 }} aria-hidden="true"></i>
      </div>
      <div className="cat-body">
        <div className="cat-top">
          <span className="cat-name" style={{ color: over ? 'var(--danger)' : 'var(--text-primary)' }}>
            {c.name}
          </span>
          <span className="cat-figures" style={{ color: over ? 'var(--danger)' : 'var(--text-secondary)' }}>
            {over && (
              <i
                className="ti ti-alert-triangle"
                style={{ fontSize: 13, marginRight: 4, verticalAlign: '-1px' }}
                aria-label={t('overspent')}
              ></i>
            )}
            {money(c.spent)}
            {hasBudget ? ` / ${money(c.effectiveBudget)}` : ''}
          </span>
        </div>
        {c.prevSpent > 0 && (
          <p className="row-sub cat-prev">
            {money(c.prevSpent)} {t('lastMonthWas')}
          </p>
        )}
        {hasBudget && (
          <div className="cat-bar-track">
            <div className="cat-bar-fill" style={{ width: `${catPct}%`, background: barColor }} />
          </div>
        )}
      </div>
    </div>
  )
}
