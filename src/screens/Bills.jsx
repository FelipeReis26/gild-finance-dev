import { useApp } from '../context/AppContext.jsx'
import { billDateWithinPeriod } from '../db.js'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function Bills({ onAddBill }) {
  const { bills, categories, currency, selectedMonth, changeMonth, payDay, payBill, unpayBill, removeBill, periodLabel, t } = useApp()
  const s = currency.symbol
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))

  const dueCount = bills.filter((b) => !b.payments[selectedMonth]).length
  const total = bills.reduce((sum, b) => sum + b.amount, 0)

  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay)

  return (
    <div className="screen">
      <div className="card">
        <div className="row between">
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
      </div>

      <div className="grid-2">
        <div className="tile">
          <p className="label">{t('stillDue')}</p>
          <p className="tile-number">{dueCount}</p>
        </div>
        <div className="tile">
          <p className="label">{t('totalMonthly')}</p>
          <p className="tile-number">
            {s}
            {total.toFixed(2)}
          </p>
        </div>
      </div>

      <p className="section-title">{t('bills')}</p>
      <div className="stack">
        {sorted.length === 0 && <p className="muted">{t('noBillsYet')}</p>}
        {sorted.map((b) => {
          const cat = categoryById[b.categoryId]
          const payment = b.payments[selectedMonth]
          const paid = Boolean(payment)
          return (
            <div key={b.id} className="row between list-row">
              <div className="row gap">
                <div className="icon-badge" style={{ background: cat?.tint, borderColor: cat?.borderTint }}>
                  <i
                    className={`ti ${cat?.icon || 'ti-file-invoice'}`}
                    style={{ color: paid ? 'var(--success)' : cat?.accent }}
                    aria-hidden="true"
                  ></i>
                </div>
                <div>
                  <p className="row-title">{b.name}</p>
                  <p className="row-sub">{paid ? `${t('paid')} ${payment.paidDate}` : `${t('dueThe')} ${ordinal(Number(billDateWithinPeriod(selectedMonth, payDay, b.dueDay).split('-')[2]))}`}</p>
                </div>
              </div>
              <div className="col-right">
                <p className="row-amount">
                  {s}
                  {b.amount.toFixed(2)}
                </p>
                <div className="row gap">
                  {paid ? (
                    <button type="button" className="mini-button" onClick={() => unpayBill(b.id, selectedMonth)}>
                      {t('undo')}
                    </button>
                  ) : (
                    <button type="button" className="mini-button" onClick={() => payBill(b.id, selectedMonth)}>
                      {t('markPaid')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => {
                      if (window.confirm(`${t('confirmDeleteBill')} (${b.name})`)) {
                        removeBill(b.id)
                      }
                    }}
                    aria-label="Delete bill"
                  >
                    <i className="ti ti-trash" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" className="primary-button" onClick={onAddBill}>
        <i className="ti ti-plus" aria-hidden="true"></i> {t('addBill')}
      </button>
    </div>
  )
}
