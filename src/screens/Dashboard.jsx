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
  // Dial ticks: one per day of the period. Days already spent are faint,
  // days remaining are gold (the power reserve), today is long and bright.
  const elapsedDays = isCurrent ? dayIndex - 1 : isFuture ? 0 : totalDays
  const todayIdx = isCurrent ? dayIndex - 1 : -1

  const left = summary.left
  const over = left < 0
  const perDay = isCurrent && daysRemaining > 0 ? left / daysRemaining : null
  const daysWord = daysRemaining === 1 ? t('dayLeft') : t('daysLeft')
  // Past periods have ended; a period that hasn't started yet is upcoming —
  // never label a future period "ended".
  const periodState = isCurrent ? `${daysRemaining} ${daysWord}` : isFuture ? t('upcoming') : t('periodEnded')
  // The dial's accessible story leads with the focal fact — what's left —
  // then the pace, matching what the sighted eye reads at center.
  const dialLabel = `${over ? t('overspent') : t('leftToSpend')}: ${money(Math.abs(left))} · ${periodState}${
    isCurrent && perDay != null && !over ? ` · ${money(perDay)}/${t('perDay')}` : ''
  } · ${t('income')} ${money(summary.income)} · ${t('spent')} ${money(summary.spent)}`

  const activeCats = summary.byCategory.filter((c) => c.spent > 0 || c.monthlyBudget != null)
  const unusedCats = summary.byCategory.filter((c) => !(c.spent > 0 || c.monthlyBudget != null))
  const hasSpend = summary.byCategory.some((c) => c.spent > 0)

  return (
    <div className="screen" {...swipe}>
      <div className="period-row">
        <p className="period-label">{periodLabel}</p>
        <div className="period-nav">
          <button type="button" className="mini-button" onClick={() => changeMonth(-1)} aria-label={t('previousMonth')}>
            <i className="ti ti-chevron-left" aria-hidden="true"></i>
          </button>
          <button type="button" className="mini-button" onClick={() => changeMonth(1)} aria-label={t('nextMonth')}>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div className="hero">
        <div className="dial-wrap" role="img" aria-label={dialLabel}>
          <svg className="dial" viewBox="0 0 296 296" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <circle
                key={`g${i}`}
                cx="148"
                cy="148"
                r={22 + i * 11}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity="0.035"
                strokeWidth="1"
              />
            ))}
            <circle cx="148" cy="148" r="112" fill="none" stroke="var(--rule-soft)" strokeWidth="1" />
            {Array.from({ length: totalDays }, (_, i) => {
              const a = ((i / totalDays) * 360 - 90) * (Math.PI / 180)
              const isToday = i === todayIdx
              const r1 = isToday ? 121 : 127
              const r2 = isToday ? 143 : 138
              const past = i < elapsedDays
              return (
                <line
                  key={i}
                  x1={148 + Math.cos(a) * r1}
                  y1={148 + Math.sin(a) * r1}
                  x2={148 + Math.cos(a) * r2}
                  y2={148 + Math.sin(a) * r2}
                  stroke={isToday ? 'var(--gold-light)' : past ? 'var(--ink)' : 'var(--gold)'}
                  strokeOpacity={isToday ? 1 : past ? 0.16 : 0.8}
                  strokeWidth={isToday ? 3 : 1.5}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          <div className="dial-center">
            <p className="engraved">{over ? t('overspent') : t('leftToSpend')}</p>
            <p className="hero-amount" style={{ color: over ? 'var(--danger)' : 'var(--gold)' }}>
              {money(Math.abs(left))}
            </p>
            <p className="dial-sub">
              {periodState}
              {isCurrent && perDay != null && !over ? ` · ${money(perDay)}/${t('perDay')}` : ''}
            </p>
          </div>
        </div>

          <div className="hero-stats">
            <span className="hero-stat">
              <span className="dot" style={{ background: 'var(--credit)' }} aria-hidden="true" />
              <span className="hero-stat-label">{t('income')}</span>
              <span className="hero-stat-value">{money(summary.income)}</span>
            </span>
            <span className="hero-stat">
              <span className="dot" style={{ background: 'var(--debit)' }} aria-hidden="true" />
              <span className="hero-stat-label">{t('spent')}</span>
              <span className="hero-stat-value">{money(summary.spent)}</span>
            </span>
          </div>
      </div>

      {(() => {
        // Complications: the three most-consumed budgets as chronograph subdials.
        const subs = activeCats
          .filter((c) => c.monthlyBudget != null && c.effectiveBudget > 0)
          .sort((a, b) => b.spent / b.effectiveBudget - a.spent / a.effectiveBudget)
          .slice(0, 3)
        if (!subs.length) return null
        const r = 26
        const circ = 2 * Math.PI * r
        return (
          <div className="subdials">
            {subs.map((c) => {
              const frac = Math.min(1, c.spent / c.effectiveBudget)
              const isOver = c.spent > c.effectiveBudget
              return (
                <button
                  key={c.id}
                  type="button"
                  className="subdial"
                  onClick={() => onSelectCategory?.(c.id)}
                  aria-label={`${c.name}: ${money(c.spent)} / ${money(c.effectiveBudget)}`}
                >
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r={r} fill="none" stroke="var(--rule-soft)" strokeWidth="4" />
                    <circle
                      cx="32"
                      cy="32"
                      r={r}
                      fill="none"
                      stroke={isOver ? 'var(--danger)' : 'var(--gold)'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${circ * frac} ${circ}`}
                      transform="rotate(-90 32 32)"
                    />
                    <text x="32" y="36.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--ink)">
                      {Math.round((c.spent / c.effectiveBudget) * 100)}%
                    </text>
                  </svg>
                  <span className="subdial-name">{c.name}</span>
                  <span className="subdial-fig">{money(c.spent)}</span>
                </button>
              )
            })}
          </div>
        )
      })()}

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
                    <span className="dot-sq" style={{ background: 'var(--credit)' }} />
                    {t('income')}
                  </span>
                  <span className="row gap" style={{ gap: 4 }}>
                    <span className="dot-sq" style={{ background: 'var(--debit)' }} />
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
                          style={{ width: 14, height: hIncome, background: 'var(--credit)', opacity: isSel ? 1 : 0.5, borderRadius: 2 }}
                        />
                        <div
                          style={{ width: 14, height: hExpense, background: 'var(--debit)', opacity: isSel ? 1 : 0.5, borderRadius: 2 }}
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
              {(() => {
                const withSpend = summary.byCategory.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
                const total = withSpend.reduce((sum, c) => sum + c.spent, 0)
                const pct = (c) => Math.round((c.spent / total) * 100)
                // Watch geometry: the tick bezel hugs the band (3.5px), a
                // hairline rehaut frames the center, and the total fills
                // the hole instead of floating in it.
                const r = 86
                const circ = 2 * Math.PI * r
                let cum = 0
                return (
                  <>
                    <p className="section-title" style={{ marginBottom: 4 }}>
                      {t('categoryBreakdown')}
                    </p>
                    <div
                      className="gauge-wrap"
                      role="img"
                      style={{ margin: '4px 0 8px' }}
                      aria-label={`${t('categoryBreakdown')}: ${money(total)} — ${withSpend.map((c) => `${c.name} ${pct(c)}%`).join(', ')}`}
                    >
                      <svg width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
                        {Array.from({ length: 60 }, (_, i) => {
                          const a = (i / 60) * 2 * Math.PI - Math.PI / 2
                          return (
                            <line
                              key={`t${i}`}
                              x1={105 + Math.cos(a) * 96}
                              y1={105 + Math.sin(a) * 96}
                              x2={105 + Math.cos(a) * 101}
                              y2={105 + Math.sin(a) * 101}
                              stroke="var(--ink)"
                              strokeOpacity={i % 5 === 0 ? 0.22 : 0.1}
                              strokeWidth="1"
                            />
                          )
                        })}
                        {withSpend.map((c) => {
                          // Every joint is identical: a constant gap centered on
                          // each boundary, so the 12 o'clock closure between the
                          // last and first segments matches all the others.
                          const GAP = withSpend.length > 1 ? 3 : 0
                          const arcLen = (c.spent / total) * circ
                          const drawn = Math.max(1.5, arcLen - GAP)
                          const offset = -(cum + GAP / 2)
                          cum += arcLen
                          return (
                            <circle
                              key={c.id}
                              cx="105"
                              cy="105"
                              r={r}
                              fill="none"
                              stroke={c.accent}
                              strokeWidth="13"
                              strokeDasharray={`${drawn} ${circ - drawn}`}
                              strokeDashoffset={offset}
                              transform="rotate(-90 105 105)"
                            />
                          )
                        })}
                        <circle cx="105" cy="105" r="72" fill="none" stroke="var(--ink)" strokeOpacity="0.08" strokeWidth="1" />
                        <text
                          x="105"
                          y="103"
                          textAnchor="middle"
                          fontSize="25"
                          fontFamily="var(--ui)"
                          fontWeight="700"
                          fill="var(--ink)"
                        >
                          {money(total)}
                        </text>
                        <text
                          x="105"
                          y="123"
                          textAnchor="middle"
                          fontSize="9"
                          letterSpacing="2"
                          fill="var(--ink-3)"
                        >
                          {`${withSpend.length} ${withSpend.length === 1 ? t('categorySingular') : t('categoriesPlural')}`.toUpperCase()}
                        </text>
                      </svg>
                    </div>
                    <div className="stack" style={{ gap: 9, marginTop: 4 }}>
                      {withSpend.map((c) => (
                        <div key={c.id} className="row between" style={{ fontSize: 14 }}>
                          <span className="row gap" style={{ gap: 9 }}>
                            <span className="dot" style={{ background: c.accent }} />
                            {c.name}
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontWeight: 600 }}>{money(c.spent)}</span>
                            <span className="muted" style={{ marginLeft: 9, fontSize: 12, display: 'inline-block', width: 32, textAlign: 'right' }}>
                              {pct(c)}%
                            </span>
                          </span>
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

      <div className="ledger">
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
            <div className="ledger">
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
          <span className="cat-name" style={{ color: over ? 'var(--danger-text)' : 'var(--text-primary)' }}>
            {c.name}
          </span>
          <span className="cat-figures" style={{ color: over ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
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
