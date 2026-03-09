import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-reload when a deploy invalidates old chunk hashes
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  const reloaded = sessionStorage.getItem('chunk-reload')
  if (!reloaded) {
    sessionStorage.setItem('chunk-reload', '1')
    window.location.reload()
  }
})
// Clear the flag on successful load so future deploys can also auto-reload
sessionStorage.removeItem('chunk-reload')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
