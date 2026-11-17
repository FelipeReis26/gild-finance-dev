import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import BreakdownRing from '../components/BreakdownRing.jsx'
import { useSwipe } from '../useSwipe.js'
import { formatMoney, formatMonthShort, localeFor, tf } from '../i18n.js'
import { periodBounds, currentPeriodKey, todayLocalDate, accountBalance, safeToSpend, goalProgress, getPlanState, setPlanState } from '../db.js'

const DAY_MS = 86400000

export default function Dashboard({ onAddTransaction, onSelectCategory, onPlan, onOpenTrip }) {
  const { summary, currency, language, payDay, selectedMonth, changeMonth, goToMonth, monthTrend, periodLabel, accounts, transactions, bills, balances, categories, tripsy, t } =
    useApp()
  const swipe = useSwipe({ onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) })
  const [showInsights, setShowInsights] = useState(false)
  const [showUnused, setShowUnused] = useState(false)
  // Payday card: the first three days of a period, until planned or put off.
  const [planState, setPlanStateLocal] = useState(undefined)
  const nowKey = currentPeriodKey(payDay)
  useEffect(() => {
    getPlanState(nowKey).then((st) => setPlanStateLocal(st))
  }, [nowKey])

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

  // Safe to spend: the current period subtracts the bills still due and the
  // money set aside for savings, so the dial answers "what can I still spend"
  // rather than "income minus spending". Other periods keep the plain figure:
  // an ended period's bills are history, and a coming one has no pay in yet.
  const safe = isCurrent ? safeToSpend(summary, bills, categories, selectedMonth) : null
  const left = safe ? safe.safe : summary.left
  const over = left < 0
  const perDay = isCurrent && daysRemaining > 0 ? left / daysRemaining : null
  const endLabel = end.toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const goals = (balances || [])
    .filter((a) => (a.type === 'savings' || a.type === 'debt') && a.goal)
    .map((a) => ({ account: a, p: goalProgress(a, bills, payDay) }))
    .filter((g) => g.p)
  const daysWord = daysRemaining === 1 ? t('dayLeft') : t('daysLeft')
  // Past periods have ended; a period that hasn't started yet is upcoming —
  // never label a future period "ended".
  const periodState = isCurrent ? `${daysRemaining} ${daysWord}` : isFuture ? t('upcoming') : t('periodEnded')
  // The dial's accessible story leads with the focal fact — what's left —
  // then the pace, matching what the sighted eye reads at center.
  const showDaily = Boolean(safe) && isCurrent && perDay != null && !over
  const dialLabel = safe
    ? `${showDaily ? `${t('safeToSpendToday')}: ${money(perDay)} · ` : ''}${over ? t('overBy') : t('safeToSpend')}: ${money(
        Math.abs(left)
      )} · ${periodState} · ${t('income')} ${money(safe.income)} · ${t('billsDue')} ${money(safe.billsDue)} · ${t(
        'setAside'
      )} ${money(safe.setAside)} · ${t('spent')} ${money(safe.spent)}`
    : `${over ? t('overspent') : t('leftToSpend')}: ${money(Math.abs(left))} · ${periodState}${
        isCurrent && perDay != null && !over ? ` · ${money(perDay)}/${t('perDay')}` : ''
      } · ${t('income')} ${money(summary.income)} · ${t('spent')} ${money(summary.spent)}`

  const activeCats = summary.byCategory.filter((c) => c.spent > 0 || c.monthlyBudget != null)
  const unusedCats = summary.byCategory.filter((c) => !(c.spent > 0 || c.monthlyBudget != null))
  const hasSpend = summary.byCategory.some((c) => c.spent > 0)
  const incomeRows = (summary.byIncomeCategory || [])
    .filter((c) => c.received > 0)
    .map((c) => ({ id: c.id, name: c.name, accent: c.accent, value: c.received }))
  const hasIncome = incomeRows.length > 0

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

      {isCurrent && dayIndex <= 3 && planState === null && onPlan && (
        <div className="card plan-prompt">
          <div className="row gap" style={{ alignItems: 'flex-start' }}>
            <div className="icon-badge">
              <i className="ti ti-calendar-dollar" style={{ color: 'var(--gold)' }} aria-hidden="true"></i>
            </div>
            <div style={{ flex: 1 }}>
              <p className="row-title" style={{ fontSize: 15 }}>{t('planPromptTitle')}</p>
              <p className="row-sub" style={{ marginTop: 3 }}>{t('planPromptSub')}</p>
              <div className="row gap" style={{ marginTop: 12 }}>
                <button type="button" className="mini-button is-gold" onClick={onPlan}>
                  {t('planIt')}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={async () => setPlanStateLocal(await setPlanState(nowKey, 'dismissed'))}
                >
                  {t('notNow')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hero">
        <div className="dial-wrap" role="img" aria-label={dialLabel}>
          <svg className="dial" viewBox="0 0 296 296" aria-hidden="true" key={selectedMonth}>
            {/* Engine turning: tight concentric rings crossed by radial spokes,
                kept at etching opacity — texture, never glow. */}
            {Array.from({ length: 12 }, (_, i) => (
              <circle
                key={`g${i}`}
                cx="148"
                cy="148"
                r={16 + i * 7}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity="0.03"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 36 }, (_, i) => {
              const a = ((i / 36) * 360 - 90) * (Math.PI / 180)
              return (
                <line
                  key={`s${i}`}
                  x1={148 + Math.cos(a) * 20}
                  y1={148 + Math.sin(a) * 20}
                  x2={148 + Math.cos(a) * 95}
                  y2={148 + Math.sin(a) * 95}
                  stroke="var(--ink)"
                  strokeOpacity="0.02"
                  strokeWidth="1"
                />
              )
            })}
            {/* Rehaut: a two-line register channel between the face and the ticks */}
            <circle cx="148" cy="148" r="104" fill="none" stroke="var(--ink)" strokeOpacity="0.06" strokeWidth="1" />
            <circle cx="148" cy="148" r="112" fill="none" stroke="var(--rule-soft)" strokeWidth="1" />
            {(() => {
              // Structural weight marks the period's quarters (and the pay day
              // itself, index 0); color still carries past/remaining/today.
              const q = new Set([0, Math.round(totalDays / 4), Math.round(totalDays / 2), Math.round((3 * totalDays) / 4)])
              return Array.from({ length: totalDays }, (_, i) => {
                const a = ((i / totalDays) * 360 - 90) * (Math.PI / 180)
                const isToday = i === todayIdx
                const isQuarter = q.has(i)
                const isStart = i === 0
                const r1 = isToday ? 121 : isQuarter ? 123 : 127
                const r2 = isToday ? 143 : isQuarter ? 140 : 138
                const past = i < elapsedDays
                return (
                  <line
                    key={i}
                    className="dial-tick"
                    style={{ animationDelay: `${(i / totalDays) * 0.45}s` }}
                    x1={148 + Math.cos(a) * r1}
                    y1={148 + Math.sin(a) * r1}
                    x2={148 + Math.cos(a) * r2}
                    y2={148 + Math.sin(a) * r2}
                    stroke={isToday ? 'var(--gold-light)' : past ? 'var(--ink)' : 'var(--gold)'}
                    strokeOpacity={isToday ? 1 : past ? 0.16 : 0.8}
                    strokeWidth={isToday ? 3 : isStart ? 2.5 : isQuarter ? 2 : 1.5}
                    strokeLinecap="round"
                  />
                )
              })
            })()}
          </svg>
          {safe ? (
            <div className="dial-center">
              <p className="engraved">{over ? t('overBy') : showDaily ? t('safeToSpendToday') : t('safeToSpend')}</p>
              <p className="hero-amount" style={{ color: over ? 'var(--danger)' : 'var(--gold)' }}>
                {money(showDaily ? perDay : Math.abs(left))}
              </p>
              <p className="dial-sub">
                {showDaily
                  ? `${money(left)} ${t('untilDate')} ${endLabel} · ${daysRemaining} ${daysWord}`
                  : over
                    ? `${money(safe.billsDue + safe.setAside)} ${t('stillToCome')}`
                    : `${t('untilDate')} ${endLabel} · ${periodState}`}
              </p>
            </div>
          ) : (
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
          )}
        </div>

          {safe ? (
            <div className="stat-grid">
              {[
                ['var(--credit)', t('income'), safe.income],
                ['var(--ink-3)', t('billsDue'), safe.billsDue],
                ['var(--gold)', t('setAside'), safe.setAside],
                ['var(--debit)', t('spent'), safe.spent]
              ].map(([color, label, value]) => (
                <span className="hero-stat" key={label}>
                  <span className="hero-stat-label">
                    <span className="dot" style={{ background: color }} aria-hidden="true" />
                    {label}
                  </span>
                  <span className="hero-stat-value">{money(value)}</span>
                </span>
              ))}
            </div>
          ) : (
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
          )}
      </div>

      {goals.map(({ account: a, p }) => {
        const r = 26
        const circ = 2 * Math.PI * r
        const byLabel = new Date(p.by + 'T00:00:00').toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' })
        const status = p.reached ? t('goalReached') : p.onTrack ? t('onTrack') : t('behind')
        const trip = a.goal?.tripSlug && tripsy?.trips?.find((x) => x.slug === a.goal.tripSlug)
        const synced =
          trip && tripsy.fetchedAt
            ? new Date(tripsy.fetchedAt).toLocaleString(localeFor(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : ''
        const open = trip && onOpenTrip ? () => onOpenTrip(trip.slug) : undefined
        return (
          <div
            className={`card goal-card ${open ? 'is-link' : ''}`}
            key={a.id}
            role={open ? 'button' : 'group'}
            tabIndex={open ? 0 : undefined}
            onClick={open}
            onKeyDown={open ? (e) => (e.key === 'Enter' || e.key === ' ') && open() : undefined}
            aria-label={`${t('goal')} ${a.name}: ${money(p.current)} / ${money(p.target)} · ${status}`}
          >
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r={r} fill="none" stroke="var(--rule-soft)" strokeWidth="4" />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${circ * p.fraction} ${circ}`}
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="36.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--ink)">
                {Math.round(p.fraction * 100)}%
              </text>
            </svg>
            <div className="goal-body">
              <div className="goal-head">
                <span className="engraved">
                  {t('goal')} · {a.name}
                </span>
                <span className={p.onTrack ? 'pill-ok' : 'pill-warn'}>{status}</span>
              </div>
              <p className="goal-amt">
                {p.kind === 'debt' ? (
                  <>
                    {money(p.remaining)} <span>{t('leftToPay')}</span>
                  </>
                ) : (
                  <>
                    {money(p.current)} <span>{t('ofAmount')} {money(p.target)}</span>
                  </>
                )}
              </p>
              <p className="goal-line">
                {p.reached
                  ? `${t('byDate')} ${byLabel}`
                  : p.hasBill && p.onTrack
                    ? `${money(p.perPayday)} ${t('eachPayday')} · ${p.paydaysLeft} ${t('toGo')} · ${t('byDate')} ${byLabel}`
                    : `${t('needs')} ${money(p.neededPerPayday)} ${t('eachPayday')} · ${p.paydaysLeft} ${t('toGo')} · ${t('byDate')} ${byLabel}`}
              </p>
              {trip && (
                <p className="goal-src">
                  <i className="ti ti-plane" aria-hidden="true"></i>
                  {tf(language, 'tripTargetFrom', { when: synced })}
                </p>
              )}
            </div>
          </div>
        )
      })}

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
                    {Array.from({ length: 12 }, (_, i) => {
                      const a = ((i / 12) * 360 - 90) * (Math.PI / 180)
                      return (
                        <line
                          key={`t${i}`}
                          x1={32 + Math.cos(a) * 29.5}
                          y1={32 + Math.sin(a) * 29.5}
                          x2={32 + Math.cos(a) * 31.5}
                          y2={32 + Math.sin(a) * 31.5}
                          stroke="var(--ink)"
                          strokeOpacity="0.15"
                          strokeWidth="1"
                        />
                      )
                    })}
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

      {/* One figure per tracked account. A single combined balance could never
          match either bank statement, so each account reconciles on its own. */}
      {accounts
        .map((a) => accountBalance(a, transactions, accounts))
        .filter(Boolean)
        .map((rb) => (
          <div className="card" key={rb.accountId}>
            <div className="row between">
              <span>
                <span className="engraved" style={{ display: 'block' }}>{rb.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  {money(rb.opening, 2)} + {money(rb.income, 2)} − {money(rb.spent, 2)}
                </span>
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {money(rb.balance, 2)}
              </span>
            </div>
            <p className="row-sub" style={{ margin: '10px 0 0', color: 'var(--ink-3)' }}>
              {t('cashSince')} {new Date(rb.since + 'T00:00:00').toLocaleDateString(localeFor(language), {
                day: 'numeric',
                month: 'short'
              })}{' '}
              · {rb.counted} {t('cashCounted')}
            </p>
          </div>
        ))}

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
              <BreakdownRing
                title={t('categoryBreakdown')}
                rows={summary.byCategory
                  .filter((c) => c.spent > 0)
                  .sort((a, b) => b.spent - a.spent)
                  .map((c) => ({ id: c.id, name: c.name, accent: c.accent, value: c.spent }))}
                money={money}
                t={t}
              />
            </div>
          )}

          {/* Where the money came from. Same instrument as the spend ring, so
              the two read as a pair rather than two different charts. */}
          {showInsights && hasIncome && (
            <div className="card">
              <BreakdownRing
                title={t('incomeBreakdown')}
                rows={incomeRows}
                money={money}
                t={t}
              />
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
