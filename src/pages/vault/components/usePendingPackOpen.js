import { useState, useCallback } from 'react'
import { vaultService } from '../../../services/database'

const STORAGE_KEY = 'cc_pending_pack_open'

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function save(result) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch {}
}

function clear() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

export default function usePendingPackOpen() {
  const [openResult, setOpenResultRaw] = useState(() => {
    const saved = load()
    // If resuming from sessionStorage (page refresh mid-animation),
    // mark revealed on server — setOpenResult won't be called for this load.
    if (saved) vaultService.markRevealed().catch(() => {})
    return saved
  })

  const setOpenResult = useCallback((result) => {
    if (result) {
      save(result)
      // Client received the response — mark revealed on server immediately.
      // SessionStorage handles animation replay from here; the server-side
      // pending check is only a safety net for the pre-response race window.
      vaultService.markRevealed().catch(() => {})
    } else {
      clear()
    }
    setOpenResultRaw(result)
  }, [])

  const closeResult = useCallback(() => {
    clear()
    setOpenResultRaw(null)
    // Belt-and-suspenders: ensure server knows this pack is revealed
    vaultService.markRevealed().catch(() => {})
  }, [])

  return { openResult, setOpenResult, closeResult }
}
