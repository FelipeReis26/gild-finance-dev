import { useApp } from '../context/AppContext.jsx'

export default function UndoToast() {
  const { undoState, undoDelete, dismissUndo, t, currency } = useApp()

  if (!undoState) return null

  const s = currency.symbol

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        maxWidth: 448,
        margin: '0 auto',
        background: 'rgba(24, 27, 33, 0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.5)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 20
      }}
    >
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
