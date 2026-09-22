// The shared look for the transient bar that sits above the bottom of the
// screen. Two things use it: the undo bar after deleting a transaction, and
// the confirmation after the app changes a balance on its own.
export const toastShell = {
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
}
