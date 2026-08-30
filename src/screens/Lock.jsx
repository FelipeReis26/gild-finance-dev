import { useEffect, useState } from 'react'
import { getPasscode, getLanguage } from '../db.js'
import { t as translate } from '../i18n.js'

export default function Lock({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [lang, setLang] = useState('en')

  useEffect(() => {
    getLanguage().then(setLang)
  }, [])

  const t = (key) => translate(lang, key)

  async function handleUnlock() {
    const stored = await getPasscode()
    if (code === stored) {
      onUnlock()
    } else {
      setError(t('incorrectPasscode'))
      setCode('')
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-blobs" aria-hidden="true">
        <span className="blob blob-gold" />
        <span className="blob blob-blue" />
        <span className="blob blob-green" />
      </div>
      <main className="app-main" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card">
          <p className="section-title" style={{ textAlign: 'center', marginBottom: 16 }}>
            {t('enterPasscode')}
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUnlock()
            }}
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: 4 }}
          />
          {error && <p className="error-text" style={{ textAlign: 'center' }}>{error}</p>}
          <button type="button" className="primary-button" onClick={handleUnlock}>
            {t('unlock')}
          </button>
        </div>
      </main>
    </div>
  )
}
