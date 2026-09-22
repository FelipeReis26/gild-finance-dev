import { useApp } from '../context/AppContext.jsx'
import { toastShell } from './Toast.jsx'

export default function UndoToast() {
  const { undoState, undoDelete, dismissUndo, t, currency } = useApp()

  if (!undoState) return null

  const s = currency.symbol

  return (
    <div style={toastShell}>
      <i className="ti ti-trash" style={{ fontSize: 18, color: 'var(--text-secondary)' }} aria-hidden="true"></i>
      <p style={{ flex: 1, fontSize: 13, margin: 0, color: 'var(--text-primary)' }}>
        {t('transactionDeleted')} ({s}
        {undoState.tx.amount.toFixed(2)})
      </p>
      <button
        type="button"
        onClick={undoDelete}
        style={{ background: 'none', border: 'none', color: 'var(--gold-light)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 4 }}
      >
        {t('undo')}
      </button>
      <button
        type="button"
        onClick={dismissUndo}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer', padding: 4 }}
      >
        <i className="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>
  )
}
