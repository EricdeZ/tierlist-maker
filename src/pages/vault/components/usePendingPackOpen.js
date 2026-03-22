import { useState, useCallback } from 'react'
import { vaultService } from '../../../services/database'

const STORAGE_KEY = 'cc_pending_pack_open'

function save(result) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch {}
}

function clear() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

export default function usePendingPackOpen() {
  const [openResult, setOpenResultRaw] = useState(null)

  const setOpenResult = useCallback((result) => {
    if (result) {
      save(result)
    } else {
      clear()
    }
    setOpenResultRaw(result)
  }, [])

  const closeResult = useCallback(() => {
    clear()
    setOpenResultRaw(null)
    // Mark server-side as revealed (fire-and-forget)
    vaultService.markRevealed().catch(() => {})
  }, [])

  return { openResult, setOpenResult, closeResult }
}
