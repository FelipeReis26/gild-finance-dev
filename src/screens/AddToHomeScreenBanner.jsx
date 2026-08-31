import { useEffect, useState } from 'react'
import * as db from '../db.js'
import { t as translate } from '../i18n.js'

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  )
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export default function AddToHomeScreenBanner() {
  const [show, setShow] = useState(false)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    if (isStandalone() || !isIOS()) return
    Promise.all([db.getA2HSDismissed(), db.getLanguage()]).then(([dismissed, storedLang]) => {
      setLang(storedLang)
      if (!dismissed) setShow(true)
    })
  }, [])

  if (!show) return null

  const t = (key) => translate(lang, key)

  async function handleDismiss() {
    await db.dismissA2HS()
    setShow(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'rgba(24, 27, 33, 0.97)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '14px 16px',
        paddingTop: 'calc(14px + env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <i className="ti ti-square-rounded-plus" style={{ fontSize: 22, color: 'var(--text-secondary)', flexShrink: 0 }} aria-hidden="true"></i>
      <p style={{ flex: 1, fontSize: 13, margin: 0, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {t('a2hsMessage')}
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 18,
          padding: 4,
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        <i className="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>
  )
}
