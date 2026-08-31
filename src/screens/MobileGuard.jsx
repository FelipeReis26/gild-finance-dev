import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getLanguage } from '../db.js'
import { t as translate } from '../i18n.js'

export default function MobileGuard({ onContinue }) {
  const [qrUrl, setQrUrl] = useState(null)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    getLanguage().then(setLang)
    QRCode.toDataURL(window.location.href, {
      width: 240,
      margin: 1,
      color: { dark: '#12141A', light: '#F0EEE8' }
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null))
  }, [])

  const t = (key) => translate(lang, key)

  return (
    <div className="app-shell">
      <main
        className="app-main"
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}
      >
        <div className="screen" style={{ maxWidth: 380, margin: '0 auto' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <i className="ti ti-device-mobile" style={{ fontSize: 36, color: 'var(--text-secondary)' }} aria-hidden="true"></i>
            <p className="section-title" style={{ marginTop: 12, marginBottom: 6 }}>
              {t('openOnPhone')}
            </p>
            <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
              {t('openOnPhoneNote')}
            </p>
            {qrUrl && (
              <img
                src={qrUrl}
                alt="QR code to open on your phone"
                style={{ width: 200, height: 200, borderRadius: 12, marginBottom: 20 }}
              />
            )}
            <button type="button" className="secondary-button" style={{ width: '100%' }} onClick={onContinue}>
              {t('continueAnyway')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
