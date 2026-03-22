import { useState, useCallback } from 'react'

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
  const [openResult, setOpenResultRaw] = useState(() => load())

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
  }, [])

  return { openResult, setOpenResult, closeResult }
}
