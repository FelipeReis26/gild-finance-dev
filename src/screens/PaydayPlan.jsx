import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { planOverview, setPlanState, currentPeriodKey, periodLabel, getPeriodLimits, setPeriodLimit } from '../db.js'
import { formatMoney, localeFor, tf } from '../i18n.js'

// The payday plan: one screen that splits the pay across bills, what's set
// aside (savings, a trip pot, the card payment) and the spending limits, with
// "Left to plan" updating as amounts change. Saving writes the new amounts to
// the bills and the category limits, so later periods start from them too.
export default function PaydayPlan({ onDone }) {
  const { bills, categories, balances, transactions, payDay, currency, language, updateBill, editCategory, t } = useApp()
  const money = (v, decimals = 0) => formatMoney(language, currency, v, { decimals })
  const periodKey = currentPeriodKey(payDay)
  const shortDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' })

  const plan = useMemo(
    () => planOverview({ periodKey, payDay, bills, categories, balances, transactions }),
    // the starting figures are taken once, when the plan opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [income, setIncome] = useState(String(Math.round(plan.income)))
  const [aside, setAside] = useState(() => Object.fromEntries(plan.setAside.map(({ bill }) => [bill.id, String(bill.amount)])))
  const [limits, setLimits] = useState(() =>
    Object.fromEntries(plan.limits.map((c) => [c.id, c.monthlyBudget == null ? '' : String(c.monthlyBudget)]))
  )
  const [saving, setSaving] = useState(false)
  // limits ticked "just this period": category id → true
  const [once, setOnce] = useState({})
  useEffect(() => {
    getPeriodLimits(periodKey).then((existing) => {
      if (!Object.keys(existing).length) return
      setOnce(Object.fromEntries(Object.keys(existing).map((id) => [id, true])))
      setLimits((l) => ({ ...l, ...Object.fromEntries(Object.entries(existing).map(([id, v]) => [id, String(v)])) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const asideTotal = Object.values(aside).reduce((sum, v) => sum + num(v), 0)
  const limitsTotal = Object.values(limits).reduce((sum, v) => sum + num(v), 0)
  const left = Math.round((num(income) - plan.billsTotal - asideTotal - limitsTotal) * 100) / 100
  const belowMin = plan.setAside.filter(({ bill }) => bill.minAmount && num(aside[bill.id]) < bill.minAmount)

  async function save() {
    if (belowMin.length || saving) return
    setSaving(true)
    for (const { bill } of plan.setAside) {
      const v = num(aside[bill.id])
      if (v !== bill.amount) await updateBill(bill.id, { amount: v })
    }
    for (const c of plan.limits) {
      const raw = limits[c.id]
      const v = raw === '' ? null : num(raw)
      if (once[c.id]) {
        // this period only: the usual limit stays as it is
        await setPeriodLimit(periodKey, c.id, v ?? 0)
      } else {
        await setPeriodLimit(periodKey, c.id, null)
        if (v !== c.monthlyBudget) await editCategory(c.id, { monthlyBudget: v })
      }
    }
    await setPlanState(periodKey, 'saved')
    onDone?.()
  }

  function asideHint({ bill, goal }) {
    if (bill.flexible) return t('planAsMuch')
    const p = goal?.progress
    if (!p) return null
    const by = shortDate(p.by)
    if (p.kind === 'debt') {
      const per = money(p.neededPerPayday)
      const enough = num(aside[bill.id]) * p.paydaysLeft >= p.remaining
      return `${money(p.remaining)} ${t('leftToPay')} · ${tf(language, enough ? 'planGoneByOk' : 'planGoneBy', { date: by, amount: per })}`
    }
    if (p.reached) return t('goalReached')
    const enough = num(aside[bill.id]) * p.paydaysLeft >= p.target - p.current
    return enough
      ? tf(language, 'planOnTrack', { n: p.paydaysLeft })
      : tf(language, 'planNeeds', { amount: money(p.neededPerPayday), date: by })
  }

  const topBills = plan.bills
    .slice(0, 3)
    .map((b) => `${b.name} ${money(b.amount)}`)
    .join(', ')

  return (
    <div className="screen plan-screen">
      <p className="section-title" style={{ margin: 0 }}>
        {tf(language, 'planTitle', { period: periodLabel(periodKey, payDay, language) })}
      </p>

      <div className="card plan-card">
        <label className="plan-row">
          <span>
            <span className="plan-label">{t('planIncome')}</span>
            <span className="plan-sub">{plan.incomeIsEstimate ? t('planIncomeEstimate') : t('planIncomeActual')}</span>
          </span>
          <input className="plan-input" type="number" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} />
        </label>
      </div>

      <div className="card plan-card">
        <div className="plan-row">
          <span>
            <span className="plan-label">{t('planBills')}</span>
            <span className="plan-sub">
              {tf(language, 'planBillsSub', { n: plan.bills.length })}
              {topBills ? ` · ${topBills}${plan.bills.length > 3 ? ' …' : ''}` : ''}
            </span>
          </span>
          <span className="plan-fig">−{money(plan.billsTotal)}</span>
        </div>
      </div>

      {plan.setAside.length > 0 && (
        <>
          <p className="section-title plan-heading">{t('planSetAside')}</p>
          <div className="card plan-card">
            {plan.setAside.map((item) => {
              const { bill } = item
              const hint = asideHint(item)
              const low = bill.minAmount && num(aside[bill.id]) < bill.minAmount
              return (
                <div className="plan-row" key={bill.id}>
                  <span style={{ minWidth: 0 }}>
                    <span className="plan-label">{bill.name}</span>
                    {hint && <span className="plan-sub">{hint}</span>}
                    {low && <span className="plan-sub plan-warn">{tf(language, 'planMin', { amount: money(bill.minAmount) })}</span>}
                    {bill.flexible && left > 0 && (
                      <button
                        type="button"
                        className="plan-link"
                        onClick={() => setAside({ ...aside, [bill.id]: String(Math.round((num(aside[bill.id]) + left) * 100) / 100) })}
                      >
                        {tf(language, 'planPutLeft', { amount: money(left, 2) })}
                      </button>
                    )}
                  </span>
                  <input
                    className="plan-input"
                    type="number"
                    inputMode="decimal"
                    value={aside[bill.id]}
                    onChange={(e) => setAside({ ...aside, [bill.id]: e.target.value })}
                    aria-label={bill.name}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      <p className="section-title plan-heading">{t('planLimits')}</p>
      <div className="card plan-card">
        {plan.limits.map((c) => (
          <div className="plan-row" key={c.id}>
            <span>
              <span className="plan-label">{c.name}</span>
              {once[c.id] && c.monthlyBudget != null && (
                <span className="plan-sub">{tf(language, 'planUsually', { amount: money(c.monthlyBudget) })}</span>
              )}
              <label className={`plan-once ${once[c.id] ? 'is-on' : ''}`}>
                <input type="checkbox" checked={!!once[c.id]} onChange={(e) => setOnce({ ...once, [c.id]: e.target.checked })} />
                {t('planJustThisPeriod')}
              </label>
            </span>
            <input
              className="plan-input"
              type="number"
              inputMode="decimal"
              placeholder="—"
              value={limits[c.id]}
              onChange={(e) => setLimits({ ...limits, [c.id]: e.target.value })}
              aria-label={c.name}
            />
          </div>
        ))}
      </div>

      <div className="plan-footer">
        <div className={`plan-left ${left < 0 ? 'is-over' : ''}`}>
          <span>{left < 0 ? t('planOver') : t('planLeft')}</span>
          <b>{money(Math.abs(left), 2)}</b>
        </div>
        <button type="button" className="primary-button" onClick={save} disabled={saving || belowMin.length > 0}>
          {t('planSave')}
        </button>
      </div>
    </div>
  )
}
