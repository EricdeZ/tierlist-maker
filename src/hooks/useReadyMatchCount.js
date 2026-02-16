import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAuthHeaders } from '../services/adminApi'

const API = import.meta.env.VITE_API_URL || '/api'
const POLL_INTERVAL = 60_000

export function useReadyMatchCount() {
    const { user, permissions } = useAuth()
    const [count, setCount] = useState(0)

    const hasReportPermission = useMemo(() => {
        if (!user) return false
        if (permissions.global.includes('match_report')) return true
        return Object.values(permissions.byLeague).some(perms => perms.includes('match_report'))
    }, [user, permissions])

    const fetchCount = useCallback(async () => {
        if (!hasReportPermission) return
        try {
            const res = await fetch(
                `${API}/discord-queue?action=ready-matches`,
                { headers: getAuthHeaders() },
            )
            if (!res.ok) return
            const data = await res.json()
            setCount(data.matches?.length ?? 0)
        } catch { /* silent */ }
    }, [hasReportPermission])

    useEffect(() => {
        if (!hasReportPermission) {
            setCount(0)
            return
        }
        fetchCount()
        const interval = setInterval(fetchCount, POLL_INTERVAL)
        return () => clearInterval(interval)
    }, [hasReportPermission, fetchCount])

    return { count, hasReportPermission }
}
