import { useApp } from '../context/AppContext.jsx'

const RADIUS = 90
const CIRC = Math.PI * RADIUS

const DONUT_R = 70
const DONUT_CIRC = 2 * Math.PI * DONUT_R

function DonutBreakdown({ byCategory, total, symbol, onSelect }) {
  const segments = byCategory
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.accent,
      pct: total > 0 ? (c.spent / total) * 100 : 0,
      spent: c.spent
    }))

  let cursor = 0
  const arcs = segments.map((seg) => {
    const length = (seg.pct / 100) * DONUT_CIRC
    const arc = { ...seg, length, offset: cursor }
    cursor += length
    return arc
  })

  return (
    <div>
      <div className="donut-wrap">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={DONUT_R} fill="none" stroke="var(--glass-border)" strokeWidth="22" />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx="90"
              cy="90"
              r={DONUT_R}
              fill="none"
              stroke={arc.color}
              strokeWidth="22"
              strokeDasharray={`${arc.length} ${DONUT_CIRC - arc.length}`}
              strokeDashoffset={-arc.offset}
              transform="rotate(-90 90 90)"
              strokeLinecap="butt"
            />
          ))}
          <text x="90" y="84" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text-primary)">
            {symbol}
            {total.toFixed(0)}
          </text>
          <text x="90" y="104" textAnchor="middle" fontSize="11" fill="var(--text-secondary)">
            {segments.length} categories
          </text>
        </svg>
      </div>
      <div className="donut-legend">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="legend-row"
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(seg.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSelect?.(seg.id)
            }}
          >
            <span className="legend-dot" style={{ background: seg.color }} />
            <span className="legend-name">{seg.name}</span>
            <span className="legend-pct">{Math.round(seg.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ onAddTransaction, onSelectCategory }) {
  const { summary, currency, selectedMonth, changeMonth, monthTrend, t } = useApp()

  if (!summary) return <p className="muted">Loading</p>

  const s = currency.symbol
  const pct = summary.budget ? Math.min(100, Math.round((summary.spent / summary.budget) * 100)) : 0
  const dashOffset = CIRC * (1 - pct / 100)
  const gaugeLabel = summary.byCategory.some((c) => c.monthlyBudget != null) ? t('ofBudgetUsed') : t('ofIncomeSpent')
  const monthLabel = new Date(selectedMonth + '-02').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="screen">
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
            {monthLabel}
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
              stroke="var(--gold)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
            />
            <text x="110" y="88" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--text-primary)">
              {pct}%
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
          <p className="section-title" style={{ marginBottom: 12 }}>
            {t('spendTrend')}
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
            {monthTrend.map((m) => {
              const max = Math.max(...monthTrend.map((x) => x.total), 1)
              const h = Math.max(4, Math.round((m.total / max) * 80))
              const isCurrent = m.month === selectedMonth
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: '100%',
                      height: h,
                      background: isCurrent ? 'var(--gold)' : 'var(--glass-border)',
                      borderRadius: 4
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    {new Date(m.month + '-02').toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {summary.byCategory.some((c) => c.spent > 0) && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: 12 }}>
            {t('categoryBreakdown')}
          </p>
          <DonutBreakdown byCategory={summary.byCategory} total={summary.spent} symbol={s} onSelect={onSelectCategory} />
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
