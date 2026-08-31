import { useApp } from '../context/AppContext.jsx'
import { useSwipe } from '../useSwipe.js'

const RADIUS = 90
const CIRC = Math.PI * RADIUS

export default function Dashboard({ onAddTransaction, onSelectCategory }) {
  const { summary, currency, selectedMonth, changeMonth, goToMonth, monthTrend, periodLabel, t } = useApp()
  const swipe = useSwipe({ onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) })

  if (!summary) return <p className="muted">Loading</p>

  const s = currency.symbol
  const rawPct = summary.budget ? Math.round((summary.spent / summary.budget) * 100) : 0
  const overBudget = rawPct > 100
  const arcPct = Math.min(100, Math.max(0, rawPct))
  const dashOffset = CIRC * (1 - arcPct / 100)
  const gaugeLabel = summary.byCategory.some((c) => c.monthlyBudget != null) ? t('ofBudgetUsed') : t('ofIncomeSpent')

  return (
    <div className="screen" {...swipe}>
      <div className="card">
        <div className="row between" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className="mini-button"
            onClick={() => changeMonth(-1)}
            aria-label={t('previousMonth')}
          >
            <i className="ti ti-chevron-left" aria-hidden="true"></i>
          </button>
          <p className="section-title" style={{ margin: 0 }}>
            {periodLabel}
          </p>
          <button type="button" className="mini-button" onClick={() => changeMonth(1)} aria-label={t('nextMonth')}>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
          </button>
        </div>

        <div className="gauge-wrap">
          <svg width="220" height="130" viewBox="0 0 220 130">
            <path
              d="M 20 110 A 90 90 0 0 1 200 110"
              fill="none"
              stroke="var(--glass-border)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 20 110 A 90 90 0 0 1 200 110"
              fill="none"
              stroke={overBudget ? 'var(--danger)' : 'var(--gold)'}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
            />
            <text x="110" y="88" textAnchor="middle" fontSize="30" fontWeight="700" fill={overBudget ? 'var(--danger)' : 'var(--text-primary)'}>
              {rawPct}%
            </text>
            <text x="110" y="108" textAnchor="middle" fontSize="12" fill="var(--text-secondary)">
              {gaugeLabel}
            </text>
          </svg>
        </div>

        <div className="stat-row" style={{ marginBottom: 0 }}>
          <div className="stat-col">
            <p className="stat-label">{t('income')}</p>
            <p className="stat-value" style={{ color: 'var(--success)' }}>
              {s}
              {summary.income.toFixed(0)}
            </p>
          </div>
          <div className="stat-divider" />
          <div className="stat-col">
            <p className="stat-label">{t('spent')}</p>
            <p className="stat-value" style={{ color: 'var(--danger)' }}>
              {s}
              {summary.spent.toFixed(0)}
            </p>
          </div>
          <div className="stat-divider" />
          <div className="stat-col">
            <p className="stat-label">{t('left')}</p>
            <p className="stat-value" style={{ color: 'var(--gold)' }}>
              {s}
              {summary.left.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <button type="button" className="primary-button" onClick={onAddTransaction}>
        <i className="ti ti-plus" aria-hidden="true"></i> {t('addTransaction')}
      </button>

      {monthTrend.length > 1 && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <p className="section-title" style={{ margin: 0 }}>
              {t('spendTrend')}
            </p>
            <div className="row gap" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <span className="row gap" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)', display: 'inline-block' }} />
                {t('income')}
              </span>
              <span className="row gap" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--gold)', display: 'inline-block' }} />
                {t('spent')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
            {monthTrend.map((m) => {
              const max = Math.max(...monthTrend.map((x) => Math.max(x.total, x.income)), 1)
              const hExpense = Math.max(4, Math.round((m.total / max) * 80))
              const hIncome = Math.max(4, Math.round((m.income / max) * 80))
              const isCurrent = m.month === selectedMonth
              return (
                <button
                  type="button"
                  key={m.month}
                  onClick={() => goToMonth(m.month)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                    <div
                      style={{
                        width: 14,
                        height: hIncome,
                        background: 'var(--success)',
                        opacity: isCurrent ? 1 : 0.55,
                        borderRadius: 3
                      }}
                    />
                    <div
                      style={{
                        width: 14,
                        height: hExpense,
                        background: 'var(--gold)',
                        opacity: isCurrent ? 1 : 0.55,
                        borderRadius: 3
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isCurrent ? 600 : 400 }}>
                    {new Date(m.month + '-02').toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {summary.byCategory.some((c) => c.spent > 0) && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: 16 }}>
            {t('categoryBreakdown')}
          </p>
          {(() => {
            const withSpend = summary.byCategory
              .filter((c) => c.spent > 0)
              .sort((a, b) => b.spent - a.spent)
            const total = withSpend.reduce((sum, c) => sum + c.spent, 0)
            const r = 80
            const circumference = 2 * Math.PI * r
            let cumulative = 0
            return (
              <>
                <div className="gauge-wrap">
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
                    <text x="100" y="96" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--text-primary)">
                      {s}
                      {total.toFixed(0)}
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
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.accent, display: 'inline-block' }} />
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

      <p className="section-title">{t('categories')}</p>

      <div className="stack">
        {summary.byCategory.map((c) => {
          const hasBudget = c.monthlyBudget != null
          const catPct = hasBudget ? Math.min(100, Math.round((c.spent / c.effectiveBudget) * 100)) : 100
          const over = hasBudget && c.spent > c.effectiveBudget
          const trendDelta = c.spent - c.prevSpent
          const trendPct = c.prevSpent > 0 ? Math.round((trendDelta / c.prevSpent) * 100) : null
          const color = over ? 'var(--danger)' : c.accent
          return (
            <div
              key={c.id}
              className="cat-row"
              role="button"
              tabIndex={0}
              onClick={() => onSelectCategory?.(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelectCategory?.(c.id)
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
                    {s}
                    {c.spent.toFixed(0)}
                    {hasBudget ? ` / ${s}${c.effectiveBudget.toFixed(0)}` : ''}
                  </span>
                </div>
                {trendPct !== null && Math.abs(trendPct) >= 5 && (
                  <p
                    className="row-sub"
                    style={{ margin: '2px 0 6px', color: trendPct > 0 ? 'var(--danger)' : 'var(--success)' }}
                  >
                    {trendPct > 0 ? '+' : ''}
                    {trendPct}% {t('vsLastMonth')}
                  </p>
                )}
                {hasBudget && (
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${catPct}%`, background: color }} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
