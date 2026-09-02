import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { inPeriod } from '../db.js'
import { formatMoney, localeFor } from '../i18n.js'

function groupByDay(transactions) {
  const groups = {}
  for (const t of transactions) {
    groups[t.date] = groups[t.date] || []
    groups[t.date].push(t)
  }
  return groups
}

export default function Transactions({ onEditTransaction, initialCategory, initialScope }) {
  const { transactions, categories, currency, language, deleteTransactionWithUndo, selectedMonth, changeMonth, payDay, periodLabel, t } =
    useApp()
  const [filter, setFilter] = useState(initialCategory || 'all')
  const [scope, setScope] = useState(initialScope || 'month')
  const [search, setSearch] = useState('')
  const money = (v) => formatMoney(language, currency, v, { decimals: 2 })
  const dayLabel = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(language), { weekday: 'short', day: 'numeric', month: 'short' })

  async function handleDelete(e, txId) {
    e.stopPropagation()
    await deleteTransactionWithUndo(txId)
  }

  const filtered = useMemo(() => {
    let list = scope === 'month' ? transactions.filter((tx) => inPeriod(tx.date, selectedMonth, payDay)) : transactions
    if (filter !== 'all') list = list.filter((tx) => tx.categoryId === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((tx) => (tx.note || '').toLowerCase().includes(q))
    }
    return list
  }, [transactions, filter, scope, selectedMonth, search])

  const groups = groupByDay(filtered)
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))

  return (
    <div className="screen">
      <div className="card">
        <div className="segmented" style={{ marginBottom: scope === 'month' ? 14 : 0 }}>
          <button type="button" className={scope === 'month' ? 'segment-active' : ''} onClick={() => setScope('month')}>
            {t('thisMonth')}
          </button>
          <button type="button" className={scope === 'all' ? 'segment-active' : ''} onClick={() => setScope('all')}>
            {t('allTime')}
          </button>
        </div>
        {scope === 'month' && (
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
        )}
      </div>

      <input
        type="text"
        placeholder={t('searchTransactions')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 0 }}
      />

      <div className="chip-row" style={{ marginTop: 2 }}>
        <button type="button" className={filter === 'all' ? 'chip chip-active' : 'chip'} onClick={() => setFilter('all')}>
          {t('all')}
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            className={filter === c.id ? 'chip chip-active' : 'chip'}
            onClick={() => setFilter(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {Object.keys(groups).length === 0 && <p className="muted">{t('noTransactionsHere')}</p>}

      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <p className="day-label">{dayLabel(date)}</p>
          <div className="stack">
            {items.map((tx) => {
              const cat = categoryById[tx.categoryId]
              return (
                <div key={tx.id} className="row between list-row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="row gap"
                    style={{ flex: 1, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, minWidth: 0 }}
                    onClick={() => onEditTransaction?.(tx)}
                  >
                    <div className="icon-badge" style={{ background: cat?.tint, borderColor: cat?.borderTint }}>
                      <i className={`ti ${cat?.icon || 'ti-tag'}`} style={{ color: cat?.accent }} aria-hidden="true"></i>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="row-title">{cat?.name || t('uncategorized')}</p>
                      <p className="row-sub">{tx.note || (tx.source === 'bill' ? t('billPayment') : '')}</p>
                    </div>
                  </button>
                  <p
                    className="row-amount"
                    style={{ whiteSpace: 'nowrap', color: tx.type === 'income' ? 'var(--credit)' : 'var(--ink)' }}
                  >
                    {tx.type === 'income' ? '+' : '−'}
                    {money(tx.amount)}
                  </p>
                  <button type="button" className="mini-button" onClick={(e) => handleDelete(e, tx.id)} aria-label={t('deleteTransaction')}>
                    <i className="ti ti-trash" aria-hidden="true"></i>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
