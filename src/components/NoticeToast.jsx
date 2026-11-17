import { useApp } from '../context/AppContext.jsx'
import { toastShell } from './Toast.jsx'

// Confirms something the app did without being asked (an auto-linked debt
// brought down when an expense was filed under a linked category), and
// carries the limit warnings: a category past 80% of its limit (with a bar),
// or over it. There is nothing to undo, so unlike UndoToast it has no action.
export default function NoticeToast() {
  const { notice, dismissNotice } = useApp()

  if (!notice) return null

  const icon =
    notice.kind === 'over' ? 'ti-alert-triangle' : notice.kind === 'near' ? 'ti-gauge' : 'ti-arrows-exchange'
  const iconColor = notice.kind === 'over' ? 'var(--danger-text)' : 'var(--gold-light)'

  return (
    <div style={toastShell} role="status">
      <i className={`ti ${icon}`} style={{ fontSize: 18, color: iconColor }} aria-hidden="true"></i>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, margin: 0, color: 'var(--text-primary)', fontWeight: notice.kind ? 700 : 400 }}>
          {notice.text}
        </p>
        {notice.sub && <p style={{ fontSize: 12, margin: '2px 0 0', color: 'var(--ink-3)' }}>{notice.sub}</p>}
        {notice.kind === 'near' && notice.fraction != null && (
          <div style={{ height: 4, borderRadius: 99, background: 'var(--rule-soft)', marginTop: 8, overflow: 'hidden' }}>
            <div
              style={{ width: `${Math.min(100, notice.fraction * 100)}%`, height: '100%', background: 'var(--gold)', borderRadius: 99 }}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={dismissNotice}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer', padding: 4 }}
      >
        <i className="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>
  )
}
