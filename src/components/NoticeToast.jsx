import { useApp } from '../context/AppContext.jsx'
import { toastShell } from './Toast.jsx'

// Confirms something the app did without being asked — currently only an
// auto-linked debt being brought down when an expense was filed under a
// linked category. There is nothing to undo here, so unlike UndoToast it
// carries no action: it exists so a balance never changes invisibly.
export default function NoticeToast() {
  const { notice, dismissNotice } = useApp()

  if (!notice) return null

  return (
    <div style={toastShell} role="status">
      <i className="ti ti-arrows-exchange" style={{ fontSize: 18, color: 'var(--gold-light)' }} aria-hidden="true"></i>
      <p style={{ flex: 1, fontSize: 13, margin: 0, color: 'var(--text-primary)' }}>{notice.text}</p>
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
