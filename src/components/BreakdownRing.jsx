// The segmented dial that breaks a period's total down by category, with a
// legend underneath. Used twice on the dashboard — once for where the money
// went, once for where it came from — so the geometry lives in one place and
// both read as the same instrument.
//
// `rows` are already filtered and sorted by the caller: { id, name, accent,
// value }, largest first.
export default function BreakdownRing({ title, rows, money, t }) {
  const total = rows.reduce((sum, c) => sum + c.value, 0)
  if (!rows.length || total <= 0) return null

  const pct = (c) => Math.round((c.value / total) * 100)
  // Watch geometry: the tick bezel hugs the band (3.5px), a hairline rehaut
  // frames the center, and the total fills the hole instead of floating in it.
  const r = 86
  const circ = 2 * Math.PI * r
  let cum = 0

  return (
    <>
      <p className="section-title" style={{ marginBottom: 4 }}>
        {title}
      </p>
      <div
        className="gauge-wrap"
        role="img"
        style={{ margin: '4px 0 8px' }}
        aria-label={`${title}: ${money(total)} — ${rows.map((c) => `${c.name} ${pct(c)}%`).join(', ')}`}
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
          {rows.map((c) => {
            // Every joint is identical: a constant gap centered on each
            // boundary, so the 12 o'clock closure between the last and first
            // segments matches all the others.
            const GAP = rows.length > 1 ? 3 : 0
            const arcLen = (c.value / total) * circ
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
          <text x="105" y="103" textAnchor="middle" fontSize="25" fontFamily="var(--ui)" fontWeight="700" fill="var(--ink)">
            {money(total)}
          </text>
          <text x="105" y="123" textAnchor="middle" fontSize="9" letterSpacing="2" fill="var(--ink-3)">
            {`${rows.length} ${rows.length === 1 ? t('categorySingular') : t('categoriesPlural')}`.toUpperCase()}
          </text>
        </svg>
      </div>
      <div className="stack" style={{ gap: 9, marginTop: 4 }}>
        {rows.map((c) => (
          <div key={c.id} className="row between" style={{ fontSize: 14 }}>
            <span className="row gap" style={{ gap: 9 }}>
              <span className="dot" style={{ background: c.accent }} />
              {c.name}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontWeight: 600 }}>{money(c.value)}</span>
              <span className="muted" style={{ marginLeft: 9, fontSize: 12, display: 'inline-block', width: 32, textAlign: 'right' }}>
                {pct(c)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
