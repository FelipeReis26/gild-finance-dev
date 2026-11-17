import { useApp } from '../context/AppContext.jsx'
import { tripShare, TRIPSY_TRIP_URL } from '../tripsy.js'
import { formatMoney, localeFor, tf } from '../i18n.js'

// One trip as Tripsy has it: what's paid, what's booked but paid later, and
// what isn't booked yet, with your share beside each.
export default function TripDetail({ slug }) {
  const { tripsy, balances, currency, language, t } = useApp()
  const money = (v) => formatMoney(language, currency, v, { decimals: 0 })
  const trip = tripsy.trips.find((x) => x.slug === slug)
  if (!trip) return <p className="muted">{t('tripNotFound')}</p>

  const share = tripShare(trip)
  const pct = Math.round(share.split * 100)
  const d = (iso, opts) => new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(language), opts)
  const when = trip.start
    ? `${d(trip.start, { day: 'numeric', month: 'short' })} – ${d(trip.end || trip.start, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''
  const month = (ym) => (ym ? new Date(ym + '-01T00:00:00').toLocaleDateString(localeFor(language), { month: 'long' }) : '')
  const goalAcct = balances.find((a) => a.goal?.tripSlug === slug)
  const saved = goalAcct ? goalAcct.entries.reduce((latest, e) => (!latest || e.date >= latest.date ? e : latest), null)?.value : null
  const range = (b) => (b.low != null && b.high != null ? `${money(b.low)}–${money(b.high).replace(/^[^\d]*/, '')}` : money(b.estimate))
  const showMine = share.split !== 1

  return (
    <div className="screen trip-screen">
      <div>
        <p className="section-title" style={{ margin: 0 }}>
          {trip.name} {trip.flag}
        </p>
        <p className="row-sub" style={{ marginTop: 2 }}>
          {when}
          {when ? ' · ' : ''}
          {tf(language, 'tripYourShare', { pct })}
        </p>
      </div>

      <div className="card plan-card">
        <div className="trip-row">
          <span>
            <span className="plan-label">{t('tripPaid')}</span>
            {trip.paidItems.length > 0 && <span className="plan-sub">{trip.paidItems.map((p) => p.label).join(', ')}</span>}
          </span>
          <span className="trip-fig">
            {money(share.paid)}
            {showMine && <small>{tf(language, 'tripYou', { amount: money(share.myPaid) })}</small>}
          </span>
        </div>
        {share.booked > 0 && (
          <div className="trip-row">
            <span>
              <span className="plan-label">{t('tripBooked')}</span>
              <span className="plan-sub">
                {trip.booked.length} · {[...new Set(trip.booked.map((b) => month(b.dueMonth)).filter(Boolean))].join(', ')}
              </span>
            </span>
            <span className="trip-fig">
              {money(share.booked)}
              {showMine && <small>{tf(language, 'tripYou', { amount: money(share.myBooked) })}</small>}
            </span>
          </div>
        )}
        {trip.otherCurrency.map((o) => (
          <div className="trip-row" key={o.label}>
            <span className="plan-label">{o.label}</span>
            <span className="trip-fig">
              {o.currency} {o.amount}
            </span>
          </div>
        ))}
      </div>

      {share.toBook.length > 0 && (
        <>
          <p className="section-title plan-heading">{t('tripToBook')}</p>
          <div className="card plan-card">
            {share.toBook.map((b) => (
              <div className="trip-row" key={b.label}>
                <span>
                  <span className="plan-label">{b.label}</span>
                  <span className="plan-sub">
                    {month(b.expectedMonth)}
                    {b.likely != null ? ` · ${tf(language, 'tripLikely', { amount: money(b.likely) })}` : ''}
                  </span>
                </span>
                <span className="trip-fig">
                  {range(b)}
                  {showMine && <small>{tf(language, 'tripYouAbout', { amount: money(b.mine) })}</small>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="plan-left" style={{ marginBottom: 0 }}>
        <span>{showMine ? t('tripYourStillToPay') : t('tripStillToPay')}</span>
        <b>{money(share.remaining)}</b>
      </div>
      <p className="row-sub" style={{ margin: 0 }}>
        {tf(language, 'tripRange', { low: money(share.remainingLow), high: money(share.remainingHigh) })}
        {saved != null ? ` · ${tf(language, 'tripSaved', { amount: money(saved) })}` : ''}
      </p>
      <a className="secondary-button trip-link" href={trip.url || TRIPSY_TRIP_URL(slug)} target="_blank" rel="noreferrer">
        <i className="ti ti-external-link" aria-hidden="true"></i> {t('tripView')}
      </a>
    </div>
  )
}
