import React from 'react'
import ReactDOM from 'react-dom/client'
import { loadDeviceData } from './deviceStore.js'
import './styles.css'

// On the iPhone app, saved data has to be back in localStorage before db.js
// loads (it reads and migrates it on import), so App is imported only after.
// In a browser loadDeviceData does nothing.
loadDeviceData()
  .catch((err) => console.error('Gild: loading data on the device failed', err))
  .then(() => import('./App.jsx'))
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
