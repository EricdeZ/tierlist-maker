import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-reload once when a deploy invalidates old chunk hashes.
// The flag persists for the session tab — prevents infinite reload loops
// while still allowing one retry per tab.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  if (!sessionStorage.getItem('chunk-reload')) {
    sessionStorage.setItem('chunk-reload', '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
