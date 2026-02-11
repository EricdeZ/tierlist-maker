// src/pages/admin/AdminDashboard.jsx
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { MatchReportHelp } from '../../components/admin/AdminHelp'
import DraggablePanel from '../../components/admin/DraggablePanel'
import ScheduledMatchPanel from '../../components/admin/ScheduledMatchPanel'
import DiscordImagesPanel from '../../components/admin/DiscordImagesPanel'
import { getAuthHeaders } from '../../services/adminApi.js'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'
const STORAGE_KEY = 'smite2_admin_pending'

// ─── Persistence helpers ───
function loadStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] }
    catch { return [] }
}
function saveStorage(items) {
    // Strip non-serializable fields (File objects, blob URLs)
    const clean = items.map(mr => ({
        ...mr,
        images: mr.images?.map(img => ({ id: img.id, name: img.name })) || [],
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
}

let _uid = Date.now()
const uid = () => `mr_${_uid++}`

// ─── Discord queue helpers ───
function groupDiscordItems(items) {
    const sorted = [...items].sort((a, b) => new Date(a.message_timestamp) - new Date(b.message_timestamp))
    const groups = []
    let cur = null

    for (const item of sorted) {
        const ts = new Date(item.message_timestamp).getTime()
        const sameAuthor = cur?.author_id === item.author_id
        const withinWindow = cur && (ts - cur.lastTs < 10 * 60 * 1000)

        if (sameAuthor && withinWindow) {
            cur.items.push(item)
            cur.lastTs = ts
            if (item.message_content) cur.texts.add(item.message_content)
        } else {
            cur = {
                id: `grp_${item.id}`,
                author_id: item.author_id,
                author_name: item.author_name,
                division_name: item.division_name,
                league_name: item.league_name,
                channel_name: item.channel_name,
                firstTs: ts,
                lastTs: ts,
                texts: new Set(item.message_content ? [item.message_content] : []),
                items: [item],
            }
            groups.push(cur)
        }
    }

    return groups.reverse()
}

function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - ts
    const mins = Math.round(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
}

// ═══════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════
export default function AdminDashboard() {
    const [matchReports, setMatchReports] = useState(() => loadStorage())
    const [submitting, setSubmitting] = useState({}) // { [mrId]: true }
    const [submitResults, setSubmitResults] = useState({}) // { [mrId]: { success, error, data } }
    const [selected, setSelected] = useState({}) // checkboxes for bulk submit
    const [bulkSubmitting, setBulkSubmitting] = useState(false)

    // Discord queue state (shared across all cards)
    const [discordItems, setDiscordItems] = useState([])
    const [discordPolling, setDiscordPolling] = useState(false)

    // Floating panel state
    const [showScheduledPanel, setShowScheduledPanel] = useState(false)
    const [showDiscordPanel, setShowDiscordPanel] = useState(false)
    const [activeCardId, setActiveCardId] = useState(null)

    // Live image refs (File objects can't go in localStorage)
    const liveImagesRef = useRef({}) // { [mrId]: [{ id, file, preview }] }

    // Admin metadata
    const [adminData, setAdminData] = useState(null)
    const [adminError, setAdminError] = useState(null)
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
        try { return parseInt(localStorage.getItem('smite2_admin_season')) || null }
        catch { return null }
    })

    useEffect(() => {
        fetch(`${API}/admin-data`, { headers: getAuthHeaders() })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
            .then(data => {
                setAdminData(data)
                // Auto-select if only one season or if saved season is no longer valid
                if (data.seasons?.length === 1 && !selectedSeasonId) {
                    setSelectedSeasonId(data.seasons[0].season_id)
                }
            })
            .catch(e => setAdminError(e.message))
    }, [])

    // Persist on change
    useEffect(() => { saveStorage(matchReports) }, [matchReports])

    // Persist selected season
    const handleSeasonChange = (id) => {
        const parsed = id ? parseInt(id) : null
        setSelectedSeasonId(parsed)
        if (parsed) localStorage.setItem('smite2_admin_season', String(parsed))
        else localStorage.removeItem('smite2_admin_season')
    }

    // ─── Discord queue management ───
    const fetchDiscordQueue = useCallback(async () => {
        try {
            const res = await fetch(`${API}/discord-queue?action=queue`, { headers: getAuthHeaders() })
            if (!res.ok) return
            const data = await res.json()
            setDiscordItems(data.items || [])
        } catch { /* silent */ }
    }, [])

    useEffect(() => { fetchDiscordQueue() }, [fetchDiscordQueue])

    const pollDiscord = useCallback(async () => {
        setDiscordPolling(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'poll-now' }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `HTTP ${res.status}`)
            }
            await fetchDiscordQueue()
        } finally {
            setDiscordPolling(false)
        }
    }, [fetchDiscordQueue])

    const skipDiscordItems = useCallback(async (itemIds) => {
        try {
            await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'update-status', queue_item_ids: itemIds, status: 'skipped' }),
            })
            await fetchDiscordQueue()
        } catch { /* silent */ }
    }, [fetchDiscordQueue])

    // ─── Floating panel handlers ───
    const handleScheduledMatchConfirm = (sm) => {
        const mrId = activeCardId
        if (!mrId) return
        updateReport(mrId, prev => ({
            ...prev,
            editData: {
                ...(prev.editData || {}),
                season_id: sm.season_id,
                team1_id: sm.team1_id,
                team2_id: sm.team2_id,
                team1_name: sm.team1_name,
                team2_name: sm.team2_name,
                week: sm.week || null,
                date: sm.scheduled_date ? sm.scheduled_date.slice(0, 10) : new Date().toISOString().split('T')[0],
                best_of: sm.best_of || 3,
                scheduled_match_id: sm.id,
                games: prev.editData?.games || [],
            },
        }))
    }

    const handleDiscordImagesConfirm = ({ images, text, queueItemIds }) => {
        const mrId = activeCardId
        if (!mrId) return

        const newLiveImages = (images || []).map((img, i) => {
            const byteString = atob(img.data)
            const ab = new ArrayBuffer(byteString.length)
            const ia = new Uint8Array(ab)
            for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j)
            const blob = new Blob([ab], { type: img.media_type || 'image/png' })
            const file = new File([blob], img.filename || `discord_${i}.jpg`, { type: img.media_type || 'image/png' })
            return { id: `img_${Date.now()}_${i}`, name: file.name, file, preview: URL.createObjectURL(blob) }
        })

        if (!liveImagesRef.current[mrId]) liveImagesRef.current[mrId] = []
        liveImagesRef.current[mrId].push(...newLiveImages)

        updateReport(mrId, prev => ({
            ...prev,
            text: prev.text ? prev.text + '\n' + (text || '') : (text || ''),
            images: [...prev.images, ...newLiveImages.map(img => ({ id: img.id, name: img.name }))],
            discordQueueItemIds: [...(prev.discordQueueItemIds || []), ...queueItemIds],
        }))
    }

    // ─── Helpers to update a report ───
    const updateReport = useCallback((mrId, updater) => {
        setMatchReports(prev => prev.map(mr =>
            mr.id === mrId ? (typeof updater === 'function' ? updater(mr) : { ...mr, ...updater }) : mr
        ))
    }, [])

    // ─── Add new match report ───
    const addMatchReport = () => {
        const id = uid()
        liveImagesRef.current[id] = []
        setMatchReports(prev => [...prev, {
            id,
            text: '',
            images: [],
            status: 'pending',
            result: null,
            editData: null, // populated after extraction
            error: null,
        }])
    }

    // ─── Add manual match (no screenshots) ───
    const addManualMatch = () => {
        const id = uid()
        liveImagesRef.current[id] = []
        setMatchReports(prev => [...prev, {
            id,
            text: '',
            images: [],
            status: 'review',
            result: null,
            editData: {
                season_id: selectedSeasonId,
                team1_id: null,
                team2_id: null,
                team1_name: null,
                team2_name: null,
                week: null,
                date: new Date().toISOString().split('T')[0],
                best_of: 3,
                games: [],
            },
            error: null,
        }])
    }

    // ─── Add Discord images to a report (called from inline picker) ───
    const addDiscordImages = useCallback(async (mrId, selectedItemIds) => {
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'fetch-images', queue_item_ids: selectedItemIds }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

            const images = (data.images || []).filter(img => img.data)
            if (!images.length) throw new Error('No images could be fetched')

            const newLiveImages = images.map((img, i) => {
                const byteString = atob(img.data)
                const ab = new ArrayBuffer(byteString.length)
                const ia = new Uint8Array(ab)
                for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j)
                const blob = new Blob([ab], { type: img.media_type || 'image/png' })
                const file = new File([blob], img.filename || `discord_${i}.jpg`, { type: img.media_type || 'image/png' })
                return { id: `img_${Date.now()}_${i}`, name: file.name, file, preview: URL.createObjectURL(blob) }
            })

            if (!liveImagesRef.current[mrId]) liveImagesRef.current[mrId] = []
            liveImagesRef.current[mrId].push(...newLiveImages)

            const selectedItems = discordItems.filter(q => selectedItemIds.includes(q.id))
            const texts = [...new Set(selectedItems.map(q => q.message_content).filter(Boolean))]
            const text = texts.join('\n').trim()

            updateReport(mrId, prev => ({
                ...prev,
                text: prev.text ? prev.text + '\n' + text : text,
                images: [...prev.images, ...newLiveImages.map(img => ({ id: img.id, name: img.name }))],
                discordQueueItemIds: [...(prev.discordQueueItemIds || []), ...selectedItemIds],
            }))

            await fetchDiscordQueue()
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [discordItems, updateReport, fetchDiscordQueue])

    // ─── Add images to a report ───
    const addImages = useCallback((mrId, files) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (!imageFiles.length) return

        const newImgs = imageFiles.map((file, i) => ({
            id: `img_${Date.now()}_${i}`,
            name: file.name,
            file,
            preview: URL.createObjectURL(file),
        }))

        if (!liveImagesRef.current[mrId]) liveImagesRef.current[mrId] = []
        liveImagesRef.current[mrId].push(...newImgs)

        setMatchReports(prev => prev.map(mr =>
            mr.id === mrId ? { ...mr, images: [...mr.images, ...newImgs.map(img => ({ id: img.id, name: img.name }))] } : mr
        ))
    }, [])

    const removeImage = useCallback((mrId, imgId) => {
        const live = liveImagesRef.current[mrId] || []
        const img = live.find(i => i.id === imgId)
        if (img?.preview) URL.revokeObjectURL(img.preview)
        liveImagesRef.current[mrId] = live.filter(i => i.id !== imgId)

        setMatchReports(prev => prev.map(mr =>
            mr.id === mrId ? { ...mr, images: mr.images.filter(i => i.id !== imgId) } : mr
        ))
    }, [])

    const [confirmDelete, setConfirmDelete] = useState(null) // mrId pending confirmation

    const removeReport = useCallback((mrId) => {
        setConfirmDelete(prev => prev === mrId ? null : mrId)
    }, [])

    const confirmRemoveReport = useCallback((mrId) => {
        const live = liveImagesRef.current[mrId] || []
        live.forEach(img => { if (img.preview) URL.revokeObjectURL(img.preview) })
        delete liveImagesRef.current[mrId]
        setMatchReports(prev => prev.filter(m => m.id !== mrId))
        setSelected(prev => { const n = { ...prev }; delete n[mrId]; return n })
        setConfirmDelete(null)
    }, [])

    // ─── Compress & convert image to base64 ───
    // Resizes to max 1400px wide (plenty for scoreboard OCR) and uses JPEG 0.85
    // This prevents "Stream body too big" crashes in Netlify CLI dev proxy
    const compressImage = (file, maxWidth = 1400, quality = 0.85) => new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            let { width, height } = img
            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width))
                width = maxWidth
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            const dataUrl = canvas.toDataURL('image/jpeg', quality)
            resolve(dataUrl.split(',')[1])
        }
        img.onerror = reject
        img.src = url
    })

    // ─── Process a single match report (AI extraction) ───
    const processOne = useCallback(async (mrId) => {
        const mr = matchReports.find(m => m.id === mrId)
        const live = liveImagesRef.current[mrId] || []
        if (!mr || live.length === 0) return

        updateReport(mrId, { status: 'processing', error: null })

        try {
            const imageData = await Promise.all(live.map(async img => ({
                data: await compressImage(img.file),
                media_type: 'image/jpeg',
            })))

            const res = await fetch(`${API}/extract-scoreboard`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ images: imageData, match_text: mr.text || null }),
            })

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
                throw new Error(errBody.error || `Extraction failed: ${res.status}`)
            }

            const result = await res.json()

            // Build editable data from extraction result
            const editData = buildEditData(result)

            // Apply the selected season if the AI didn't infer one or to override
            if (selectedSeasonId) {
                editData.season_id = selectedSeasonId
            }

            // Preserve pre-linked scheduled match data through extraction
            if (mr.editData?.scheduled_match_id) {
                editData.scheduled_match_id = mr.editData.scheduled_match_id
                editData.team1_id = mr.editData.team1_id || editData.team1_id
                editData.team2_id = mr.editData.team2_id || editData.team2_id
                editData.week = mr.editData.week || editData.week
                editData.date = mr.editData.date || editData.date
                editData.best_of = mr.editData.best_of || editData.best_of
            }

            const allGamesOk = result.games?.every(g => g.success)
            const status = allGamesOk ? 'review' : 'error'

            updateReport(mrId, { status, result, editData, error: allGamesOk ? null : 'Some games failed to extract' })
        } catch (err) {
            updateReport(mrId, { status: 'error', error: err.message })
        }
    }, [matchReports, updateReport, selectedSeasonId])



    // ─── Submit one match to DB ───
    const submitOne = useCallback(async (mr) => {
        const id = mr.id
        const ed = mr.editData
        if (!ed) return

        setSubmitting(prev => ({ ...prev, [id]: true }))
        setSubmitResults(prev => ({ ...prev, [id]: null }))

        try {
            if (!ed.season_id) throw new Error('Season is required')
            if (!ed.team1_id) throw new Error('Team 1 is required')
            if (!ed.team2_id) throw new Error('Team 2 is required')
            if (!ed.games.length) throw new Error('No games to submit')

            for (let i = 0; i < ed.games.length; i++) {
                if (!ed.games[i].winning_team_id) throw new Error(`Game ${i + 1}: Winner not set`)
            }

            const payload = {
                action: 'submit-match',
                season_id: ed.season_id,
                team1_id: ed.team1_id,
                team2_id: ed.team2_id,
                week: ed.week || null,
                date: ed.date || new Date().toISOString().split('T')[0],
                best_of: ed.best_of || 3,
                scheduled_match_id: ed.scheduled_match_id || null,
                games: ed.games.map(g => {
                    // Forfeit games: no player stats needed
                    if (g.is_forfeit) {
                        return {
                            winning_team_id: g.winning_team_id,
                            is_forfeit: true,
                            team1_players: [],
                            team2_players: [],
                        }
                    }

                    // Detect if teams swapped sides (SMITE 2 alternates Order/Chaos each game)
                    const rosterPlayers = adminData?.players || []
                    const leftTeamIds = g.left_players
                        .filter(p => p.matched_lp_id)
                        .map(p => rosterPlayers.find(r => r.league_player_id === p.matched_lp_id)?.team_id)
                        .filter(Boolean)
                    let leftTeamId = null
                    if (leftTeamIds.length) {
                        const counts = {}
                        for (const id of leftTeamIds) counts[id] = (counts[id] || 0) + 1
                        leftTeamId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
                    }
                    const swapped = leftTeamId && String(leftTeamId) === String(ed.team2_id)
                    const team1Players = swapped ? g.right_players : g.left_players
                    const team2Players = swapped ? g.left_players : g.right_players

                    // Send null for non-KDA stats when value is 0 or missing (partial stats)
                    // This preserves the distinction between "0 damage" and "no data"
                    const optionalStat = (v) => (v != null && v !== '' && v !== 0) ? parseInt(v) : null

                    const mapPlayer = p => ({
                        player_name: p.player_name,
                        god_played: p.god_played,
                        kills: p.kills || 0,
                        deaths: p.deaths || 0,
                        assists: p.assists || 0,
                        damage: optionalStat(p.player_damage),
                        mitigated: optionalStat(p.mitigated),
                        structure_damage: optionalStat(p.structure_damage),
                        gpm: optionalStat(p.gpm),
                        league_player_id: p.matched_lp_id || null,
                    })

                    return {
                        winning_team_id: g.winning_team_id,
                        is_forfeit: false,
                        team1_players: team1Players.map(mapPlayer),
                        team2_players: team2Players.map(mapPlayer),
                    }
                }),
            }

            const res = await fetch(`${API}/admin-write`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

            setSubmitResults(prev => ({ ...prev, [id]: { success: true, data } }))
            updateReport(id, { status: 'submitted', error: null })

            // If this match report came from Discord Queue, mark items as used
            if (mr.discordQueueItemIds?.length) {
                fetch(`${API}/discord-queue`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        action: 'mark-used',
                        queue_item_ids: mr.discordQueueItemIds,
                        match_id: data.match_id || null,
                    }),
                }).catch(err => console.error('Failed to mark Discord queue items:', err))
            }
        } catch (err) {
            setSubmitResults(prev => ({ ...prev, [id]: { success: false, error: err.message } }))
            updateReport(id, { error: err.message })
        } finally {
            setSubmitting(prev => ({ ...prev, [id]: false }))
        }
    }, [updateReport, adminData])

    // ─── Bulk submit selected ───
    const submitSelected = async () => {
        const ids = Object.keys(selected).filter(id => selected[id])
        const reviews = matchReports.filter(r => ids.includes(r.id) && r.status === 'review')
        if (!reviews.length) return

        setBulkSubmitting(true)
        for (const r of reviews) await submitOne(r)
        setBulkSubmitting(false)
    }

    // ─── Selection ───
    const toggleSelect = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }))
    const reviewable = matchReports.filter(r => r.status === 'review')
    const selectAll = () => {
        const allSelected = reviewable.every(r => selected[r.id])
        const next = {}
        reviewable.forEach(r => { next[r.id] = !allSelected })
        setSelected(next)
    }
    const selectedCount = Object.values(selected).filter(Boolean).length

    // ─── Clear submitted ───
    const clearSubmitted = () => {
        setMatchReports(prev => prev.filter(r => r.status !== 'submitted'))
    }

    // ─── Stats ───
    const counts = {
        total: matchReports.length,
        pending: matchReports.filter(m => m.status === 'pending').length,
        review: matchReports.filter(m => m.status === 'review').length,
        error: matchReports.filter(m => m.status === 'error').length,
        submitted: matchReports.filter(m => m.status === 'submitted').length,
    }

    // ─── Season / scheduled matches ───
    const selectedSeason = adminData?.seasons?.find(s => String(s.season_id) === String(selectedSeasonId)) || null
    const scheduledForSeason = (adminData?.scheduledMatches || []).filter(
        sm => String(sm.season_id) === String(selectedSeasonId)
    )
    // Track which scheduled matches already have a report in progress
    const linkedScheduledIds = new Set(
        matchReports.map(r => r.editData?.scheduled_match_id).filter(Boolean)
    )

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                        <Link to="/admin" className="hover:text-[var(--color-accent)] transition-colors">Admin</Link>
                    </p>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Match Report</h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        Paste match text + DETAILS screenshots → AI extracts → Review & submit
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/admin" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        ← Dashboard
                    </Link>
                    <Link to="/admin/schedule" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Schedule
                    </Link>
                    <Link to="/admin/matches" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Match Manager
                    </Link>
                    <Link to="/admin/rosters" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Rosters
                    </Link>
                    <Link to="/admin/players" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Players
                    </Link>
                    <Link to="/admin/leagues" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                        Leagues
                    </Link>
                    <Link to="/" className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors" title="Home">
                        <Home className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            <MatchReportHelp />

            {adminError && <ErrorBanner message={`Admin data: ${adminError}`} className="mb-4" />}

            <div>
            {/* Action bar */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Season selector */}
                    <select
                        value={selectedSeasonId || ''}
                        onChange={e => handleSeasonChange(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold border"
                        style={{
                            backgroundColor: 'var(--color-bg, #121212)',
                            color: selectedSeasonId ? 'var(--color-text, #e0e0e0)' : 'var(--color-text-secondary, #999)',
                            borderColor: selectedSeasonId ? 'var(--color-accent, #d4a843)' : 'var(--color-border, #333)',
                        }}
                    >
                        <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— Season —</option>
                        {(adminData?.seasons || []).map(s => (
                            <option key={s.season_id} value={s.season_id} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>
                                {s.league_name} / {s.division_name}
                            </option>
                        ))}
                    </select>

                    <button onClick={addMatchReport} disabled={!selectedSeasonId}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                        New Match Report
                    </button>

                    <button onClick={addManualMatch} disabled={!selectedSeasonId}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-[var(--color-text)] hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--color-border)]">
                        Manual Match Report
                    </button>

                    {reviewable.length > 0 && (
                        <>
                            <button onClick={selectAll}
                                    className="px-3 py-2 rounded-lg text-xs bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                                {reviewable.every(r => selected[r.id]) ? 'Deselect All' : 'Select All'}
                            </button>
                            {selectedCount > 0 && (
                                <button onClick={submitSelected} disabled={bulkSubmitting}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                                    {bulkSubmitting ? 'Submitting…' : `Submit ${selectedCount} Selected`}
                                </button>
                            )}
                        </>
                    )}

                    {counts.submitted > 0 && (
                        <button onClick={clearSubmitted}
                                className="px-3 py-2 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-red-400 transition-colors">
                            Clear {counts.submitted} Submitted
                        </button>
                    )}

                    {/* Floating panel toggles */}
                    {selectedSeasonId && (
                        <>
                            <button onClick={() => setShowScheduledPanel(v => !v)}
                                    className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                                        showScheduledPanel
                                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                                            : 'bg-white/5 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                    }`}>
                                Schedule Panel
                            </button>
                            <button onClick={() => setShowDiscordPanel(v => !v)}
                                    className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                                        showDiscordPanel
                                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                                            : 'bg-white/5 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                    }`}>
                                Discord Panel
                            </button>
                        </>
                    )}

                    <div className="ml-auto flex items-center gap-3 text-xs">
                        {counts.total > 0 && <span className="text-[var(--color-text-secondary)]">{counts.total} total</span>}
                        {counts.review > 0 && <span className="text-yellow-400">{counts.review} review</span>}
                        {counts.error > 0 && <span className="text-red-400">{counts.error} error</span>}
                        {counts.submitted > 0 && <span className="text-green-400">{counts.submitted} done</span>}
                    </div>
                </div>
            </div>

            {/* Match Reports */}
            <div className="space-y-6">
                {matchReports.map(mr => (
                    <MatchReportCard
                        key={mr.id}
                        report={mr}
                        liveImages={liveImagesRef.current[mr.id] || []}
                        adminData={adminData}
                        isSelected={!!selected[mr.id]}
                        onToggleSelect={() => toggleSelect(mr.id)}
                        onUpdateText={(text) => updateReport(mr.id, { text })}
                        onUpdateEditData={(updater) => updateReport(mr.id, prev => ({
                            ...prev,
                            editData: typeof updater === 'function' ? updater(prev.editData) : { ...prev.editData, ...updater },
                        }))}
                        onAddImages={(files) => addImages(mr.id, files)}
                        onRemoveImage={(imgId) => removeImage(mr.id, imgId)}
                        onRemove={() => removeReport(mr.id)}
                        confirmDelete={confirmDelete === mr.id}
                        onConfirmRemove={() => confirmRemoveReport(mr.id)}
                        onCancelRemove={() => setConfirmDelete(null)}
                        onProcess={() => processOne(mr.id)}
                        onRetry={() => updateReport(mr.id, { status: 'pending', error: null })}
                        onSubmit={() => submitOne(mr)}
                        isSubmitting={!!submitting[mr.id]}
                        submitResult={submitResults[mr.id]}
                        scheduledMatches={scheduledForSeason}
                        linkedScheduledIds={linkedScheduledIds}
                        discordItems={discordItems}
                        discordPolling={discordPolling}
                        selectedSeason={selectedSeason}
                        onPollDiscord={pollDiscord}
                        onAddDiscordImages={(selectedItemIds) => addDiscordImages(mr.id, selectedItemIds)}
                        onSkipDiscordItems={skipDiscordItems}
                        onSetActiveCard={() => setActiveCardId(mr.id)}
                    />
                ))}
            </div>

            {/* Empty state */}
            {matchReports.length === 0 && (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4 opacity-50">📋</div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">No match reports</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm mb-6">
                        {selectedSeasonId
                            ? 'Add a match, paste the Discord text and DETAILS tab screenshots, then extract & submit.'
                            : 'Select a season above to get started.'}
                    </p>
                    <button onClick={addMatchReport} disabled={!selectedSeasonId}
                            className="px-6 py-3 rounded-xl font-semibold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                        New Match Report
                    </button>
                </div>
            )}
            </div>

            {/* ─── Floating panels (toggled from action bar) ─── */}
            {selectedSeasonId && showScheduledPanel && (
                <DraggablePanel
                    title="Scheduled Matches"
                    initialPosition={{ x: Math.max(0, window.innerWidth - 720), y: 120 }}
                    defaultWidth={340}
                    defaultHeight={360}
                    minimized={false}
                    onToggleMinimize={() => setShowScheduledPanel(false)}
                >
                    <ScheduledMatchPanel
                        scheduledMatches={scheduledForSeason}
                        linkedScheduledIds={linkedScheduledIds}
                        onConfirm={handleScheduledMatchConfirm}
                        hasTarget={!!activeCardId}
                    />
                </DraggablePanel>
            )}
            {selectedSeasonId && showDiscordPanel && (
                <DraggablePanel
                    title="Discord Images"
                    initialPosition={{ x: Math.max(0, window.innerWidth - 370), y: 120 }}
                    defaultWidth={360}
                    defaultHeight={420}
                    minimized={false}
                    onToggleMinimize={() => setShowDiscordPanel(false)}
                >
                    <DiscordImagesPanel
                        onConfirmSelection={handleDiscordImagesConfirm}
                        hasTarget={!!activeCardId}
                    />
                </DraggablePanel>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// BUILD EDITABLE DATA FROM AI EXTRACTION RESULT
// ═══════════════════════════════════════════════════
function buildEditData(result) {
    const pm0 = result.player_matches?.[0]
    const meta = result.match_meta

    const games = (result.games || []).map((game, idx) => {
        if (!game.success) return null
        const pm = result.player_matches?.[idx]
        const gw = result.game_winners?.games?.[idx]

        const mapPlayers = (players, side) => players.map(p => {
            const m = pm?.matched?.find(x => x.extracted_name === p.player_name && x.side === side)
            const sub = pm?.unmatched?.find(x => x.extracted_name === p.player_name && x.side === side)
            return {
                ...p,
                matched_name: m?.db_player?.name || null,
                matched_lp_id: m?.db_player?.league_player_id || null,
                match_source: m?.match_source || null,
                matched_alias: m?.matched_alias || null,
                is_sub: !!sub,
                sub_type: sub?.sub_type || null,
            }
        })

        return {
            game_index: idx,
            winning_team_id: gw?.winning_team_id || null,
            is_forfeit: false,
            left_players: mapPlayers(game.data.left_players, 'left'),
            right_players: mapPlayers(game.data.right_players, 'right'),
        }
    }).filter(Boolean)

    return {
        season_id: pm0?.inferred?.season_id || null,
        team1_id: pm0?.inferred?.left_team_id || null,
        team2_id: pm0?.inferred?.right_team_id || null,
        team1_name: pm0?.inferred?.left_team_name || null,
        team2_name: pm0?.inferred?.right_team_name || null,
        week: null,
        date: new Date().toISOString().split('T')[0],
        best_of: 3,
        games,
    }
}


// ═══════════════════════════════════════════════════
// MATCH REPORT CARD (one card = one BO series)
// ═══════════════════════════════════════════════════
function MatchReportCard({
                             report, liveImages, adminData,
                             isSelected, onToggleSelect,
                             onUpdateText, onUpdateEditData,
                             onAddImages, onRemoveImage, onRemove, onProcess, onRetry, onSubmit,
                             isSubmitting, submitResult,
                             confirmDelete, onConfirmRemove, onCancelRemove,
                             scheduledMatches, linkedScheduledIds,
                             discordItems, discordPolling, selectedSeason,
                             onPollDiscord, onAddDiscordImages, onSkipDiscordItems,
                             onSetActiveCard,
                         }) {
    const [expanded, setExpanded] = useState(true)
    const [pasteFlash, setPasteFlash] = useState(false)
    const hasScheduledLink = !!report.editData?.scheduled_match_id
    // Match source: 'scheduled' or 'textbox'
    const [matchSource, setMatchSource] = useState(hasScheduledLink ? 'scheduled' : 'textbox')
    // Image source: 'paste' (default) or 'discord'
    const [imageSource, setImageSource] = useState('paste')
    // Inline picker state
    const [scheduleSearch, setScheduleSearch] = useState('')
    const [discordSelectedImages, setDiscordSelectedImages] = useState({})
    const [discordFetching, setDiscordFetching] = useState(false)
    const [discordError, setDiscordError] = useState(null)
    const [discordShowAll, setDiscordShowAll] = useState(false)
    const cardRef = useRef(null)
    const ed = report.editData
    const isSubmitted = report.status === 'submitted'
    const isReview = report.status === 'review'
    const isPending = report.status === 'pending'
    const isProcessing = report.status === 'processing'

    // Ctrl+V paste handler for this card
    const handlePaste = useCallback((e) => {
        if (!isPending) return
        const items = Array.from(e.clipboardData?.items || [])
        const imageItems = items.filter(i => i.type.startsWith('image/'))
        if (!imageItems.length) return

        e.preventDefault()
        e.stopPropagation()
        const files = imageItems.map(i => i.getAsFile()).filter(Boolean)
        if (files.length) {
            onAddImages(files)
            setPasteFlash(true)
            setTimeout(() => setPasteFlash(false), 600)
        }
    }, [isPending, onAddImages])

    useEffect(() => {
        const card = cardRef.current
        if (!card) return
        card.addEventListener('paste', handlePaste)
        return () => card.removeEventListener('paste', handlePaste)
    }, [handlePaste])

    const handleDrop = (e) => { e.preventDefault(); onAddImages(e.dataTransfer.files) }

    // ─── Inline scheduled match picker helpers ───
    const handleLinkScheduled = (sm) => {
        onUpdateEditData(prev => ({
            ...(prev || {}),
            season_id: sm.season_id,
            team1_id: sm.team1_id,
            team2_id: sm.team2_id,
            team1_name: sm.team1_name,
            team2_name: sm.team2_name,
            week: sm.week || null,
            date: sm.scheduled_date ? sm.scheduled_date.slice(0, 10) : new Date().toISOString().split('T')[0],
            best_of: sm.best_of || 3,
            scheduled_match_id: sm.id,
            games: prev?.games || [],
        }))
    }

    const filteredScheduled = useMemo(() => {
        if (!scheduledMatches?.length) return []
        const q = scheduleSearch.trim().toLowerCase()
        if (!q) return scheduledMatches
        return scheduledMatches.filter(sm =>
            sm.team1_name?.toLowerCase().includes(q) ||
            sm.team2_name?.toLowerCase().includes(q) ||
            (sm.week && `w${sm.week}`.includes(q)) ||
            (sm.week && `week ${sm.week}`.includes(q))
        )
    }, [scheduledMatches, scheduleSearch])

    // ─── Inline Discord picker helpers ───
    const filteredDiscordItems = useMemo(() => {
        if (!discordItems?.length) return []
        if (discordShowAll || !selectedSeason) return discordItems
        return discordItems.filter(item =>
            item.division_name === selectedSeason.division_name &&
            item.league_name === selectedSeason.league_name
        )
    }, [discordItems, discordShowAll, selectedSeason])

    const discordGroups = useMemo(() => groupDiscordItems(filteredDiscordItems), [filteredDiscordItems])

    const discordSelectedIds = Object.keys(discordSelectedImages).filter(k => discordSelectedImages[k]).map(Number)
    const discordSelectedCount = discordSelectedIds.length

    const toggleDiscordImage = (id) => setDiscordSelectedImages(prev => ({ ...prev, [id]: !prev[id] }))
    const toggleDiscordGroup = (group) => {
        const allSelected = group.items.every(item => discordSelectedImages[item.id])
        const next = { ...discordSelectedImages }
        for (const item of group.items) next[item.id] = !allSelected
        setDiscordSelectedImages(next)
    }
    const isDiscordGroupSelected = (group) => group.items.every(item => discordSelectedImages[item.id])
    const isDiscordGroupPartial = (group) => group.items.some(item => discordSelectedImages[item.id]) && !isDiscordGroupSelected(group)

    const handleLoadDiscordImages = async () => {
        if (!discordSelectedCount) return
        setDiscordFetching(true)
        setDiscordError(null)
        try {
            const result = await onAddDiscordImages(discordSelectedIds)
            if (!result.success) throw new Error(result.error)
            setDiscordSelectedImages({})
        } catch (err) {
            setDiscordError(err.message)
        } finally {
            setDiscordFetching(false)
        }
    }

    const handleSkipDiscordImages = async () => {
        if (!discordSelectedCount) return
        await onSkipDiscordItems(discordSelectedIds)
        setDiscordSelectedImages({})
    }

    // Display info
    const meta = report.result?.match_meta
    const team1 = adminData?.teams?.find(t => String(t.team_id) === String(ed?.team1_id))
    const team2 = adminData?.teams?.find(t => String(t.team_id) === String(ed?.team2_id))
    const t1Wins = ed?.games?.filter(g => g.winning_team_id && g.winning_team_id === ed?.team1_id).length || 0
    const t2Wins = ed?.games?.filter(g => g.winning_team_id && g.winning_team_id === ed?.team2_id).length || 0

    const statusStyle = {
        pending: 'border-[var(--color-border)]',
        processing: 'border-blue-500/40',
        review: 'border-yellow-500/30',
        error: 'border-red-500/30',
        submitted: 'border-green-500/30 opacity-60',
    }

    return (
        <div
            ref={cardRef}
            tabIndex={-1}
            data-match-card
            onClick={onSetActiveCard}
            className={`rounded-lg border outline-none transition-colors duration-300 ${
                pasteFlash ? 'border-green-400/60' : statusStyle[report.status] || statusStyle.pending
            }`}
        >
            {/* ─── Header ─── */}
            <div className="bg-[var(--color-card)] px-4 py-3 flex items-center gap-3 border-b border-[var(--color-border)]">
                {isReview && (
                    <input type="checkbox" checked={isSelected} onChange={onToggleSelect}
                           className="w-4 h-4 rounded accent-[var(--color-accent)] cursor-pointer shrink-0" />
                )}

                <StatusBadge status={report.status} />

                <div className="flex-1 min-w-0">
                    {ed ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--color-text)]" style={team1?.color ? { color: team1.color } : undefined}>
                                {team1?.team_name || ed.team1_name || 'Team 1'}
                            </span>
                            <span className="text-[var(--color-text-secondary)] text-sm font-mono">{t1Wins} - {t2Wins}</span>
                            <span className="font-semibold text-[var(--color-text)]" style={team2?.color ? { color: team2.color } : undefined}>
                                {team2?.team_name || ed.team2_name || 'Team 2'}
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)]">
                                · {ed.games.length}G Bo{ed.best_of} · {ed.date}
                            </span>
                        </div>
                    ) : meta ? (
                        <span className="text-sm text-[var(--color-text)]">
                            <strong>{meta.team1_name}</strong>
                            <span className="text-[var(--color-text-secondary)] mx-1">{meta.team1_wins}-{meta.team2_wins}</span>
                            <strong>{meta.team2_name}</strong>
                        </span>
                    ) : (
                        <span className="text-sm text-[var(--color-text-secondary)]">New match report</span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {report.status === 'error' && !ed && (
                        <button onClick={onRetry}
                                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                            ↻ Retry
                        </button>
                    )}
                    {report.status === 'error' && ed && (
                        <>
                            <button onClick={onRetry}
                                    className="px-3 py-1.5 text-xs rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors">
                                ↻ Re-extract
                            </button>
                            <button onClick={onSubmit} disabled={isSubmitting}
                                    className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                                {isSubmitting ? 'Submitting…' : 'Submit Anyway'}
                            </button>
                        </>
                    )}
                    {isReview && (
                        <button onClick={onSubmit} disabled={isSubmitting}
                                className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                            {isSubmitting ? 'Submitting…' : 'Submit'}
                        </button>
                    )}
                    <button onClick={() => setExpanded(!expanded)}
                            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                        {expanded ? '▾' : '▸'}
                    </button>
                    {confirmDelete ? (
                        <div className="flex items-center gap-1">
                            <button onClick={onConfirmRemove}
                                    className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500 transition-colors">Remove</button>
                            <button onClick={onCancelRemove}
                                    className="px-2 py-1 text-xs rounded bg-white/10 text-[var(--color-text-secondary)] hover:bg-white/20 transition-colors">Cancel</button>
                        </div>
                    ) : (
                        <button onClick={onRemove}
                                className="text-[var(--color-text-secondary)] hover:text-red-400 transition-colors text-sm">✕</button>
                    )}
                </div>
            </div>

            {/* ─── Error / Success banners ─── */}
            {report.error && <ErrorBanner message={report.error} className="border-t border-red-500/20" />}
            {submitResult?.error && <ErrorBanner message={submitResult.error} className="border-t border-red-500/20" />}
            {submitResult?.success && (() => {
                const season = adminData?.seasons?.find(s => String(s.season_id) === String(report.editData?.season_id))
                const matchUrl = season
                    ? `/${season.league_slug}/${season.division_slug}/matches/${submitResult.data?.match_id}`
                    : null
                return (
                    <div className="px-4 py-2 bg-green-500/10 border-t border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                        <span>✓ Submitted (Match ID: {submitResult.data?.match_id})</span>
                        {matchUrl && (
                            <Link to={matchUrl} className="underline hover:text-green-300 ml-2">
                                View Match →
                            </Link>
                        )}
                    </div>
                )
            })()}

            {/* ─── Body ─── */}
            {expanded && !isSubmitted && (
                <div className="bg-[var(--color-bg)]">
                    {/* PENDING / PROCESSING: 2 radio groups + inline pickers */}
                    {(isPending || isProcessing) && (
                        <div className="p-4 space-y-4">
                            {isPending && (
                                <div className="space-y-3">
                                    {/* Row 1: Match source */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] w-14 shrink-0">Match</span>
                                        <div className="flex gap-1">
                                            <RadioOption
                                                label="Scheduled"
                                                active={matchSource === 'scheduled'}
                                                onClick={() => setMatchSource('scheduled')}
                                            />
                                            <RadioOption
                                                label="New Match"
                                                active={matchSource === 'textbox'}
                                                onClick={() => setMatchSource('textbox')}
                                            />
                                        </div>
                                    </div>
                                    {/* Row 2: Image source */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] w-14 shrink-0">Images</span>
                                        <div className="flex gap-1">
                                            <RadioOption
                                                label="Discord"
                                                active={imageSource === 'discord'}
                                                onClick={() => setImageSource('discord')}
                                            />
                                            <RadioOption
                                                label="Paste"
                                                active={imageSource === 'paste'}
                                                onClick={() => setImageSource('paste')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── Inline Scheduled Match Picker ─── */}
                            {matchSource === 'scheduled' && isPending && (
                                <div className="border border-cyan-500/20 rounded-lg overflow-hidden">
                                    {hasScheduledLink ? (
                                        <div className="px-3 py-2.5 flex items-center gap-2 bg-cyan-500/5">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-medium">
                                                Linked: {ed?.team1_name || '?'} vs {ed?.team2_name || '?'}
                                                {ed?.week && <span className="text-cyan-400/60 ml-1">W{ed.week}</span>}
                                                {ed?.date && <span className="text-cyan-400/60 ml-1">{ed.date}</span>}
                                            </span>
                                            <button
                                                onClick={() => onUpdateEditData({ scheduled_match_id: null, team1_id: null, team2_id: null, team1_name: null, team2_name: null, week: null, date: new Date().toISOString().split('T')[0], best_of: 3 })}
                                                className="text-[10px] text-[var(--color-text-secondary)] hover:text-red-400 transition ml-auto"
                                            >
                                                Unlink
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={scheduleSearch}
                                                    onChange={e => setScheduleSearch(e.target.value)}
                                                    placeholder="Search by team name or week..."
                                                    className="flex-1 bg-transparent text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-secondary)]/50"
                                                />
                                                <span className="text-[10px] text-[var(--color-text-secondary)]">{filteredScheduled.length} matches</span>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                                                {filteredScheduled.length === 0 ? (
                                                    <div className="px-3 py-4 text-center text-[10px] text-[var(--color-text-secondary)]">
                                                        {scheduledMatches?.length ? 'No matches found' : 'No scheduled matches for this season'}
                                                    </div>
                                                ) : filteredScheduled.map(sm => {
                                                    const isLinked = linkedScheduledIds?.has(sm.id)
                                                    return (
                                                        <div
                                                            key={sm.id}
                                                            onClick={() => !isLinked && handleLinkScheduled(sm)}
                                                            className={`px-3 py-2 transition cursor-pointer ${
                                                                isLinked ? 'opacity-40 cursor-default' : 'hover:bg-cyan-500/5'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: sm.team1_color || '#3b82f6' }} />
                                                                <span className="text-xs text-[var(--color-text)] font-medium truncate">{sm.team1_name}</span>
                                                                <span className="text-[10px] text-[var(--color-text-secondary)]">vs</span>
                                                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: sm.team2_color || '#ef4444' }} />
                                                                <span className="text-xs text-[var(--color-text)] font-medium truncate">{sm.team2_name}</span>
                                                                <span className="text-[10px] text-[var(--color-text-secondary)] ml-auto shrink-0">
                                                                    {sm.scheduled_date && sm.scheduled_date.slice(0, 10)}
                                                                    {sm.week && ` W${sm.week}`}
                                                                    {` Bo${sm.best_of}`}
                                                                </span>
                                                                {isLinked && <span className="text-[10px] text-cyan-400/60 ml-1">In use</span>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ─── Inline Discord Image Picker ─── */}
                            {imageSource === 'discord' && isPending && (
                                <div className="border border-purple-500/20 rounded-lg overflow-hidden">
                                    {/* Header */}
                                    <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
                                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                                            {filteredDiscordItems.length} pending
                                        </span>
                                        {selectedSeason && (
                                            <button
                                                onClick={() => setDiscordShowAll(v => !v)}
                                                className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                                                    discordShowAll
                                                        ? 'bg-white/10 text-[var(--color-text)]'
                                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                                }`}
                                            >
                                                {discordShowAll ? 'All divisions' : selectedSeason.division_name}
                                            </button>
                                        )}
                                        <button
                                            onClick={onPollDiscord}
                                            disabled={discordPolling}
                                            className="text-[10px] px-2 py-1 rounded-md bg-purple-600/80 hover:bg-purple-600 disabled:opacity-50 text-white transition ml-auto"
                                        >
                                            {discordPolling ? 'Fetching...' : 'Get Images'}
                                        </button>
                                    </div>

                                    {discordError && (
                                        <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-500/10 border-b border-white/5">
                                            {discordError}
                                        </div>
                                    )}

                                    {/* Groups */}
                                    <div className="max-h-56 overflow-y-auto">
                                        {discordGroups.length === 0 ? (
                                            <div className="px-3 py-4 text-center">
                                                <p className="text-[10px] text-[var(--color-text-secondary)]">No pending screenshots</p>
                                                <Link to="/admin/discord" className="text-[10px] text-purple-400 hover:text-purple-300">
                                                    Configure channels
                                                </Link>
                                            </div>
                                        ) : discordGroups.map(group => (
                                            <div key={group.id} className="border-b border-white/5 last:border-0">
                                                <div
                                                    className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-white/3"
                                                    onClick={() => toggleDiscordGroup(group)}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition ${
                                                        isDiscordGroupSelected(group) ? 'bg-blue-600 border-blue-600' :
                                                        isDiscordGroupPartial(group) ? 'bg-blue-600/40 border-blue-500' :
                                                        'border-gray-500'
                                                    }`}>
                                                        {(isDiscordGroupSelected(group) || isDiscordGroupPartial(group)) && (
                                                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                                                {isDiscordGroupPartial(group) ? <path d="M3 6h6" /> : <path d="M2 6l3 3 5-5" />}
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <span className="text-[10px] text-[var(--color-text)] font-medium">{group.author_name || 'Unknown'}</span>
                                                        <span className="text-[10px] text-[var(--color-text-secondary)] ml-1.5">{timeAgo(group.firstTs)}</span>
                                                    </div>
                                                    <span className="text-[9px] text-purple-400 shrink-0">{group.division_name}</span>
                                                </div>

                                                {group.texts.size > 0 && (
                                                    <div className="px-3 pb-1">
                                                        <p className="text-[10px] text-[var(--color-text-secondary)] italic truncate">
                                                            {[...group.texts].join(' | ')}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                                                    {group.items.map(item => (
                                                        <div
                                                            key={item.id}
                                                            onClick={(e) => { e.stopPropagation(); toggleDiscordImage(item.id) }}
                                                            className={`relative w-14 h-10 rounded overflow-hidden cursor-pointer border-2 transition ${
                                                                discordSelectedImages[item.id]
                                                                    ? 'border-blue-500 ring-1 ring-blue-500/30'
                                                                    : 'border-transparent hover:border-white/20'
                                                            }`}
                                                        >
                                                            <img
                                                                src={item.attachment_url}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                                onError={e => { e.target.style.display = 'none' }}
                                                            />
                                                            {discordSelectedImages[item.id] && (
                                                                <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                                                                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <path d="M2 6l3 3 5-5" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer with actions */}
                                    <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between">
                                        <div>
                                            {discordSelectedCount > 0 && (
                                                <button onClick={handleSkipDiscordImages} className="text-[10px] text-[var(--color-text-secondary)] hover:text-red-400 transition">
                                                    Skip {discordSelectedCount}
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleLoadDiscordImages}
                                            disabled={!discordSelectedCount || discordFetching}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                        >
                                            {discordFetching ? 'Loading...' : `Load${discordSelectedCount ? ` ${discordSelectedCount}` : ''} Images`}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Paste/upload area — shown for "Paste" image source */}
                            {imageSource === 'paste' && isPending && (
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                                        DETAILS tab screenshots ({liveImages.length} game{liveImages.length !== 1 ? 's' : ''})
                                    </label>
                                    <div
                                        className="border border-dashed border-[var(--color-border)] rounded-lg p-6 text-center hover:border-[var(--color-accent)]/40 transition-colors cursor-pointer"
                                        onDragOver={e => e.preventDefault()} onDrop={handleDrop}
                                        onClick={() => document.getElementById(`file-${report.id}`).click()}
                                    >
                                        <input id={`file-${report.id}`} type="file" multiple accept="image/*" className="hidden"
                                               onChange={e => { onAddImages(e.target.files); e.target.value = '' }} />
                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                            Drop screenshots, click to browse, or <span className="text-[var(--color-accent)] font-medium">Ctrl+V</span> to paste
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Image thumbnails (always shown when images exist) */}
                            {liveImages.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {liveImages.map((img, idx) => (
                                        <div key={img.id} className="relative group">
                                            <img src={img.preview} alt={`Game ${idx+1}`}
                                                 className="h-20 w-36 object-cover rounded-lg border border-[var(--color-border)]" />
                                            <div className="absolute top-0.5 left-1 bg-black/70 text-white text-[10px] px-1 rounded">
                                                G{idx+1}
                                            </div>
                                            {isPending && (
                                                <button onClick={() => onRemoveImage(img.id)}
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Per-card extract button */}
                            {isPending && liveImages.length > 0 && (
                                <button onClick={onProcess}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                                    Extract Match Data
                                </button>
                            )}
                            {isProcessing && (
                                <div className="flex items-center gap-2 text-blue-400 text-sm">
                                    <span className="animate-spin">⟳</span> Extracting from {liveImages.length} screenshot{liveImages.length > 1 ? 's' : ''}…
                                </div>
                            )}
                        </div>
                    )}

                    {/* REVIEW: editable extracted data */}
                    {(isReview || report.status === 'error') && ed && (
                        <EditableMatchData
                            editData={ed}
                            adminData={adminData}
                            result={report.result}
                            onChange={onUpdateEditData}
                        />
                    )}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// EDITABLE MATCH DATA (review phase)
// ═══════════════════════════════════════════════════
function EditableMatchData({ editData, adminData, result, onChange }) {
    const [activeGame, setActiveGame] = useState(0)
    const [dismissedSuggestion, setDismissedSuggestion] = useState(null)
    const ed = editData
    if (!ed) return null

    const teamsForSeason = adminData?.teams?.filter(t => String(t.season_id) === String(ed.season_id)) || []
    const team1 = teamsForSeason.find(t => String(t.team_id) === String(ed.team1_id))
    const team2 = teamsForSeason.find(t => String(t.team_id) === String(ed.team2_id))

    // Scheduled matches for current season
    const scheduledForSeason = (adminData?.scheduledMatches || []).filter(
        sm => String(sm.season_id) === String(ed.season_id)
    )

    // Auto-detect matching scheduled match (teams match in either order)
    const suggestedMatch = (!ed.scheduled_match_id && ed.team1_id && ed.team2_id)
        ? scheduledForSeason.find(sm => {
            const t1 = String(sm.team1_id), t2 = String(sm.team2_id)
            const et1 = String(ed.team1_id), et2 = String(ed.team2_id)
            return (t1 === et1 && t2 === et2) || (t1 === et2 && t2 === et1)
        })
        : null

    const showSuggestion = suggestedMatch && String(dismissedSuggestion) !== String(suggestedMatch.id)

    const linkScheduledMatch = (sm) => {
        onChange({
            ...ed,
            team1_id: sm.team1_id,
            team2_id: sm.team2_id,
            date: sm.scheduled_date ? sm.scheduled_date.slice(0, 10) : ed.date,
            week: sm.week || ed.week,
            best_of: sm.best_of || ed.best_of,
            scheduled_match_id: sm.id,
        })
        setDismissedSuggestion(null)
    }

    const unlinkScheduledMatch = () => {
        onChange({ ...ed, scheduled_match_id: null })
    }

    const updateField = (key, value) => onChange({ ...ed, [key]: value })
    const updateGame = (gameIdx, gameUpdater) => {
        onChange(prev => {
            const games = [...prev.games]
            games[gameIdx] = typeof gameUpdater === 'function' ? gameUpdater(games[gameIdx]) : { ...games[gameIdx], ...gameUpdater }
            return { ...prev, games }
        })
    }

    // Validation from text parse
    const gw = result?.game_winners

    // Currently linked scheduled match
    const linkedMatch = ed.scheduled_match_id
        ? scheduledForSeason.find(sm => sm.id === ed.scheduled_match_id)
        : null

    return (
        <div>
            {/* ─── Match metadata fields ─── */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <FieldSelect label="Season" value={ed.season_id || ''}
                             onChange={v => onChange({ ...ed, season_id: v ? parseInt(v) : null, team1_id: null, team2_id: null, scheduled_match_id: null })}
                             options={(adminData?.seasons || []).map(s => ({ value: s.season_id, label: `${s.league_name} / ${s.division_name}` }))} />
                <FieldSelect label="Team 1" value={ed.team1_id || ''}
                             onChange={v => updateField('team1_id', v ? parseInt(v) : null)}
                             options={teamsForSeason.map(t => ({ value: t.team_id, label: t.team_name }))}
                             color={team1?.color} />
                <FieldSelect label="Team 2" value={ed.team2_id || ''}
                             onChange={v => updateField('team2_id', v ? parseInt(v) : null)}
                             options={teamsForSeason.filter(t => String(t.team_id) !== String(ed.team1_id)).map(t => ({ value: t.team_id, label: t.team_name }))}
                             color={team2?.color} />
                <FieldInput label="Date" type="date" value={ed.date || ''} onChange={v => updateField('date', v)} />
                <FieldInput label="Week" type="number" value={ed.week || ''} onChange={v => updateField('week', v ? parseInt(v) : null)} />
                <FieldInput label="Best Of" type="number" value={ed.best_of || 3} onChange={v => updateField('best_of', v ? parseInt(v) : 3)} />
            </div>

            {/* ─── Scheduled match selector ─── */}
            {scheduledForSeason.length > 0 && (
                <div className="px-4 py-2 border-t border-[var(--color-border)]">
                    {linkedMatch ? (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-medium">
                                Linked: {linkedMatch.team1_name} vs {linkedMatch.team2_name}
                                {linkedMatch.scheduled_date && ` — ${linkedMatch.scheduled_date.slice(0, 10)}`}
                                {linkedMatch.week && ` (W${linkedMatch.week})`}
                            </span>
                            <button onClick={unlinkScheduledMatch}
                                    className="text-[var(--color-text-secondary)] hover:text-red-400 transition-colors">
                                ✕ Unlink
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-[var(--color-text-secondary)] font-medium shrink-0">Scheduled Match</label>
                            <select
                                value=""
                                onChange={e => {
                                    const sm = scheduledForSeason.find(s => String(s.id) === e.target.value)
                                    if (sm) linkScheduledMatch(sm)
                                }}
                                className="rounded px-2 py-1 text-xs border max-w-md"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="">— Select to auto-fill —</option>
                                {scheduledForSeason.map(sm => (
                                    <option key={sm.id} value={sm.id}>
                                        {sm.team1_name} vs {sm.team2_name}
                                        {sm.scheduled_date ? ` — ${sm.scheduled_date.slice(0, 10)}` : ''}
                                        {sm.week ? ` (W${sm.week})` : ''}
                                        {` Bo${sm.best_of}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Auto-suggestion banner ─── */}
            {showSuggestion && (
                <div className="mx-4 mt-2 flex items-center gap-3 text-xs px-3 py-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    <span>
                        Matches scheduled: <strong>{suggestedMatch.team1_name} vs {suggestedMatch.team2_name}</strong>
                        {suggestedMatch.scheduled_date && ` on ${suggestedMatch.scheduled_date.slice(0, 10)}`}
                        {suggestedMatch.week && ` (Week ${suggestedMatch.week})`}
                    </span>
                    <button onClick={() => linkScheduledMatch(suggestedMatch)}
                            className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">
                        Link
                    </button>
                    <button onClick={() => setDismissedSuggestion(suggestedMatch.id)}
                            className="text-cyan-400/60 hover:text-cyan-400 transition-colors">
                        Dismiss
                    </button>
                </div>
            )}

            {/* ─── Validation banner ─── */}
            {gw?.validation && (
                <div className={`mx-4 mt-2 text-xs px-3 py-1.5 rounded inline-block ${
                    gw.validation.matches_stated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                    {gw.validation.matches_stated
                        ? `✓ Winners match stated: ${gw.validation.stated_result}`
                        : `⚠ Mismatch: stated ${gw.validation.stated_result}, inferred ${gw.validation.inferred_result}`}
                </div>
            )}

            {/* ─── Game tabs ─── */}
            <div className="px-4 pt-3 border-t border-[var(--color-border)] mt-3">
                <div className="flex gap-1 items-center">
                    {ed.games.map((game, idx) => (
                        <button key={idx} onClick={() => setActiveGame(idx)}
                                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                                    activeGame === idx
                                        ? 'bg-[var(--color-card)] text-[var(--color-text)] border border-b-0 border-[var(--color-border)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                }`}>
                            Game {idx + 1}
                            {game.is_forfeit && (
                                <span className="ml-1.5 text-orange-400 font-bold">FF</span>
                            )}
                            {game.winning_team_id && !game.is_forfeit && (
                                <span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${
                                    game.winning_team_id === ed.team1_id ? 'bg-blue-400' : 'bg-red-400'
                                }`} />
                            )}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            const emptyPlayer = () => ({
                                player_name: '', god_played: '', kills: 0, deaths: 0, assists: 0,
                                player_damage: 0, mitigated: 0, structure_damage: 0, gpm: 0,
                                matched_name: null, matched_lp_id: null, is_sub: false, sub_type: null,
                            })
                            onChange(prev => ({
                                ...prev,
                                games: [...prev.games, {
                                    game_index: prev.games.length,
                                    winning_team_id: null,
                                    is_forfeit: false,
                                    left_players: Array.from({ length: 5 }, emptyPlayer),
                                    right_players: Array.from({ length: 5 }, emptyPlayer),
                                }],
                            }))
                            setActiveGame(ed.games.length)
                        }}
                        className="px-2 py-1 text-[10px] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors ml-1"
                        title="Add a game with player stats"
                    >
                        + Game
                    </button>
                    <button
                        onClick={() => {
                            onChange(prev => ({
                                ...prev,
                                games: [...prev.games, {
                                    game_index: prev.games.length,
                                    winning_team_id: null,
                                    is_forfeit: true,
                                    left_players: [],
                                    right_players: [],
                                }],
                            }))
                            setActiveGame(ed.games.length)
                        }}
                        className="px-2 py-1 text-[10px] rounded text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        title="Add a forfeit game"
                    >
                        + FF
                    </button>
                    {ed.games.length > 1 && (
                        <button
                            onClick={() => {
                                onChange(prev => ({
                                    ...prev,
                                    games: prev.games.filter((_, i) => i !== activeGame),
                                }))
                                setActiveGame(Math.max(0, activeGame - 1))
                            }}
                            className="px-2 py-1 text-[10px] rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove this game"
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Active game ─── */}
            {ed.games[activeGame] && (() => {
                const g = ed.games[activeGame]
                // Sides swap each game in SMITE 2 — determine teams from matched players
                const rosterPlayers = adminData?.players || []
                const inferTeam = (players) => {
                    const teamIds = players
                        .filter(p => p.matched_lp_id)
                        .map(p => rosterPlayers.find(r => r.league_player_id === p.matched_lp_id)?.team_id)
                        .filter(Boolean)
                    if (!teamIds.length) return null
                    // Majority vote
                    const counts = {}
                    for (const id of teamIds) counts[id] = (counts[id] || 0) + 1
                    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
                }
                const leftTeamId = inferTeam(g.left_players)
                const swapped = leftTeamId && String(leftTeamId) === String(ed.team2_id)
                const leftTeam = swapped ? team2 : team1
                const rightTeam = swapped ? team1 : team2
                return (
                    <GameEditor
                        key={activeGame}
                        game={g}
                        gameIndex={activeGame}
                        team1={leftTeam}
                        team2={rightTeam}
                        seasonId={ed.season_id}
                        adminData={adminData}
                        onChange={(gameUpdate) => updateGame(activeGame, gameUpdate)}
                    />
                )
            })()}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME EDITOR (winner + player tables)
// ═══════════════════════════════════════════════════
function GameEditor({ game, team1, team2, seasonId, adminData, onChange }) {
    const updatePlayer = (side, playerIdx, updates) => {
        const key = side === 'left' ? 'left_players' : 'right_players'
        const players = [...game[key]]
        players[playerIdx] = { ...players[playerIdx], ...updates }
        onChange({ ...game, [key]: players })
    }

    return (
        <div className="border-t border-[var(--color-border)]">
            {/* Winner selector + forfeit toggle */}
            <div className="px-4 py-3 flex items-center gap-4 bg-[var(--color-card)]/50">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">Winner:</span>
                <div className="flex gap-2">
                    <WinnerButton label={team1?.team_name || 'Team 1'} color="blue"
                                  isActive={game.winning_team_id === team1?.team_id}
                                  onClick={() => onChange({ ...game, winning_team_id: team1?.team_id })} />
                    <WinnerButton label={team2?.team_name || 'Team 2'} color="red"
                                  isActive={game.winning_team_id === team2?.team_id}
                                  onClick={() => onChange({ ...game, winning_team_id: team2?.team_id })} />
                    {game.winning_team_id && (
                        <button onClick={() => onChange({ ...game, winning_team_id: null })}
                                className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-red-400">Clear</button>
                    )}
                </div>
                <div className="ml-auto">
                    <button
                        onClick={() => onChange({ ...game, is_forfeit: !game.is_forfeit })}
                        className={`px-3 py-1 text-xs rounded font-semibold transition-all ${
                            game.is_forfeit
                                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-400/50'
                                : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-orange-400/50 hover:text-orange-400'
                        }`}
                    >
                        FF
                    </button>
                </div>
            </div>

            {/* Forfeit banner */}
            {game.is_forfeit && (
                <div className="px-4 py-2 bg-orange-500/10 border-t border-orange-500/20 text-orange-400 text-xs">
                    Forfeit — no player stats will be recorded. This game won't affect individual player stats or winrates.
                </div>
            )}

            {/* Player tables (hidden for forfeits) */}
            {!game.is_forfeit && (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border)]">
                    <PlayerTable
                        label={team1?.team_name || 'Team 1'}
                        color={team1?.color || '#3b82f6'}
                        players={game.left_players}
                        allGamePlayers={[...game.left_players, ...game.right_players]}
                        side="left"
                        seasonId={seasonId}
                        adminData={adminData}
                        onUpdatePlayer={(idx, updates) => updatePlayer('left', idx, updates)}
                        isWinner={game.winning_team_id === team1?.team_id}
                    />
                    <PlayerTable
                        label={team2?.team_name || 'Team 2'}
                        color={team2?.color || '#ef4444'}
                        players={game.right_players}
                        allGamePlayers={[...game.left_players, ...game.right_players]}
                        side="right"
                        seasonId={seasonId}
                        adminData={adminData}
                        onUpdatePlayer={(idx, updates) => updatePlayer('right', idx, updates)}
                        isWinner={game.winning_team_id === team2?.team_id}
                    />
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// PLAYER TABLE
// ═══════════════════════════════════════════════════
function PlayerTable({ label, color, players, allGamePlayers, seasonId, adminData, onUpdatePlayer, isWinner }) {
    // Collect all matched league_player_ids already used in this game (both sides)
    const usedLpIds = new Set()
    const usedNames = new Set()
    for (const p of (allGamePlayers || [])) {
        if (p.matched_lp_id) usedLpIds.add(p.matched_lp_id)
        if (p.player_name) usedNames.add(p.player_name.toLowerCase())
    }

    return (
        <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold text-[var(--color-text)]">{label}</span>
                {isWinner && <span className="text-xs text-green-400">✓ Winner</span>}
            </div>
            <table className="w-full text-xs">
                <thead>
                <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                    <th className="text-left py-1 pr-2 font-medium min-w-[140px]">Player</th>
                    <th className="text-left py-1 pr-2 font-medium min-w-[80px]">God</th>
                    <th className="text-center py-1 px-1 font-medium w-8">K</th>
                    <th className="text-center py-1 px-1 font-medium w-8">D</th>
                    <th className="text-center py-1 px-1 font-medium w-8">A</th>
                    <th className="text-right py-1 px-1 font-medium w-14">Dmg</th>
                    <th className="text-right py-1 px-1 font-medium w-14">Mit</th>
                </tr>
                </thead>
                <tbody>
                {(players || []).map((player, idx) => (
                    <PlayerRow key={idx} player={player} seasonId={seasonId} adminData={adminData}
                               usedLpIds={usedLpIds} usedNames={usedNames}
                               onChange={(updates) => onUpdatePlayer(idx, updates)} />
                ))}
                </tbody>
            </table>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// PLAYER ROW (inline editing + DB name search)
// ═══════════════════════════════════════════════════
function PlayerRow({ player, seasonId, adminData, usedLpIds, usedNames, onChange }) {
    const [showSearch, setShowSearch] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [aliasSaved, setAliasSaved] = useState(false)
    const [showAliasModal, setShowAliasModal] = useState(false)
    const [originalExtractedName] = useState(player.player_name)
    const searchRef = useRef(null)
    const inputRef = useRef(null)

    // Close dropdown on outside click
    useEffect(() => {
        if (!showSearch) return
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showSearch])

    // Build search results
    // On focus (empty query): show all season roster players
    // While typing: filter by typed text across roster + global
    // Always exclude players already assigned in this game
    const searchResults = (() => {
        if (!showSearch || !adminData) return []
        const q = searchQuery.trim().toLowerCase()
        const results = []
        const seen = new Set()

        // This player's own ID shouldn't be excluded (so they can re-select themselves)
        const selfLpId = player.matched_lp_id
        const selfName = player.player_name?.toLowerCase()

        // Get season roster — if seasonId is set filter by it, otherwise show all
        const seasonPlayers = seasonId
            ? (adminData.players || []).filter(p => String(p.season_id) === String(seasonId))
            : (adminData.players || [])

        for (const p of seasonPlayers) {
            if (seen.has(p.league_player_id)) continue

            // Skip if already used by another row in this game
            const isUsedById = p.league_player_id && usedLpIds?.has(p.league_player_id) && p.league_player_id !== selfLpId
            const isUsedByName = usedNames?.has(p.name.toLowerCase()) && p.name.toLowerCase() !== selfName
            if (isUsedById || isUsedByName) continue

            // If no query, show all roster. If query, filter by it.
            if (!q || p.name.toLowerCase().includes(q)) {
                seen.add(p.league_player_id)
                results.push({
                    name: p.name,
                    league_player_id: p.league_player_id,
                    team_name: p.team_name,
                    team_color: p.team_color,
                    role: p.role,
                    source: 'roster',
                })
            }
        }

        // Global players only when actively searching (not on blank focus)
        if (q.length >= 2) {
            const globalPlayers = adminData.globalPlayers || []
            for (const p of globalPlayers) {
                const alreadyInResults = results.find(r => r.name.toLowerCase() === p.name.toLowerCase())
                const isUsedByName = usedNames?.has(p.name.toLowerCase()) && p.name.toLowerCase() !== selfName
                if (!alreadyInResults && !isUsedByName && p.name.toLowerCase().includes(q)) {
                    results.push({ name: p.name, player_id: p.player_id, league_player_id: null, source: 'global' })
                }
            }

            // Also search aliases
            const aliases = adminData.aliases || []
            for (const a of aliases) {
                if (!a.alias.toLowerCase().includes(q)) continue
                // Find the player this alias belongs to
                const rosterMatch = seasonPlayers.find(p => p.player_id === a.player_id)
                const globalMatch = globalPlayers.find(p => p.player_id === a.player_id)
                const alreadyInResults = results.find(r => r.name.toLowerCase() === (rosterMatch?.name || globalMatch?.name || '').toLowerCase())
                if (alreadyInResults) continue

                if (rosterMatch) {
                    const isUsedById = rosterMatch.league_player_id && usedLpIds?.has(rosterMatch.league_player_id) && rosterMatch.league_player_id !== selfLpId
                    if (!isUsedById) {
                        results.push({
                            name: rosterMatch.name,
                            league_player_id: rosterMatch.league_player_id,
                            team_name: rosterMatch.team_name,
                            team_color: rosterMatch.team_color,
                            role: rosterMatch.role,
                            source: 'alias',
                            alias_matched: a.alias,
                        })
                    }
                } else if (globalMatch) {
                    results.push({ name: globalMatch.name, player_id: globalMatch.player_id, league_player_id: null, source: 'alias', alias_matched: a.alias })
                }
            }
        }

        return results.slice(0, 12)
    })()

    const isMatched = !!player.matched_lp_id

    const openSearch = () => {
        setSearchQuery('') // blank = show full roster
        setShowSearch(true)
    }

    return (
        <tr className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-card)]/30">
            {/* Player name with search */}
            <td className="py-1.5 pr-2">
                <div className="relative" ref={searchRef}>
                    <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMatched ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={showSearch ? searchQuery : player.player_name}
                            onChange={e => {
                                const val = e.target.value
                                setSearchQuery(val)
                                setShowSearch(true)
                                // Also update the actual player name live
                                onChange({ player_name: val, matched_name: null, matched_lp_id: null })
                            }}
                            onFocus={openSearch}
                            onKeyDown={e => {
                                if (e.key === 'Escape') { setShowSearch(false); inputRef.current?.blur() }
                                if (e.key === 'Tab') setShowSearch(false)
                            }}
                            placeholder="Search player…"
                            className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs transition-colors ${
                                isMatched ? 'text-green-400' : 'text-yellow-400'
                            } placeholder:text-[var(--color-text-secondary)]/40`}
                        />
                        {/* Small search icon / clear button */}
                        {isMatched && !showSearch && (
                            <span className="text-green-400 text-[10px] shrink-0">✓</span>
                        )}
                    </div>
                    {isMatched && player.matched_name && player.matched_name !== player.player_name && !showSearch && (
                        <div className="text-[10px] text-[var(--color-text-secondary)] pl-3 truncate">→ {player.matched_name}</div>
                    )}
                    {player.is_sub && !showSearch && !aliasSaved && (
                        <>
                            <span className="text-[9px] ml-3 px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">
                                {player.sub_type === 'new' ? 'NEW SUB' : 'SUB'}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAliasModal(true) }}
                                className="text-[9px] ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors font-semibold"
                                title={`Link "${originalExtractedName}" as alias for an existing player`}
                            >
                                Link Alias
                            </button>
                        </>
                    )}

                    {/* Alias match indicator — shown when auto-matched via alias */}
                    {player.match_source === 'alias' && isMatched && !showSearch && (
                        <span className="text-[9px] ml-3 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">
                            via alias{player.matched_alias ? `: "${player.matched_alias}"` : ''}
                        </span>
                    )}

                    {aliasSaved && !showSearch && (
                        <span className="text-[9px] ml-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">
                            Alias Saved
                        </span>
                    )}

                    {/* Search dropdown */}
                    {showSearch && searchResults.length > 0 && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-72 border rounded shadow-xl max-h-56 overflow-y-auto"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                            {searchQuery === '' && (
                                <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]/50 sticky top-0"
                                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)' }}>
                                    {seasonId ? 'Season roster — type to filter' : 'All players — select season to filter'}
                                </div>
                            )}
                            {searchResults.map((r, i) => (
                                <button key={`${r.league_player_id || r.player_id}_${i}`}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => {
                                            onChange({
                                                player_name: r.name,
                                                matched_name: r.name,
                                                matched_lp_id: r.league_player_id,
                                                is_sub: false,
                                                sub_type: null,
                                            })
                                            setShowSearch(false)
                                            setSearchQuery('')
                                        }}>
                                    {r.team_color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color }} />}
                                    <span className="text-[var(--color-text)]">{r.name}</span>
                                    {r.role && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">{r.role}</span>}
                                    {r.team_name && <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{r.team_name}</span>}
                                    {r.source === 'global' && <span className="text-yellow-400/60 ml-auto text-[10px]">global</span>}
                                    {r.source === 'alias' && <span className="text-blue-400/60 ml-auto text-[10px]">alias: {r.alias_matched}</span>}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No results hint */}
                    {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-64 border rounded shadow-lg px-3 py-2 text-[10px] text-[var(--color-text-secondary)]"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                            No players found for "{searchQuery}" — will be created as sub on submit
                        </div>
                    )}
                </div>
            </td>

            <td className="py-1.5 pr-2">
                <GodAutocomplete value={player.god_played || ''} gods={adminData?.gods} onChange={updates => onChange(updates)} />
            </td>
            <NumCell value={player.kills} onChange={v => onChange({ kills: v })} />
            <NumCell value={player.deaths} onChange={v => onChange({ deaths: v })} />
            <NumCell value={player.assists} onChange={v => onChange({ assists: v })} />
            <NumCell value={player.player_damage} onChange={v => onChange({ player_damage: v })} align="right" />
            <NumCell value={player.mitigated} onChange={v => onChange({ mitigated: v })} align="right" />

            {/* Alias link modal — rendered via portal to avoid table nesting issues */}
            {showAliasModal && ReactDOM.createPortal(
                <AliasLinkModal
                    extractedName={originalExtractedName}
                    adminData={adminData}
                    seasonId={seasonId}
                    onSave={(selectedPlayer) => {
                        onChange({
                            player_name: selectedPlayer.name,
                            matched_name: selectedPlayer.name,
                            matched_lp_id: selectedPlayer.league_player_id,
                            is_sub: false,
                            sub_type: null,
                        })
                        setAliasSaved(true)
                        setShowAliasModal(false)
                    }}
                    onClose={() => setShowAliasModal(false)}
                />,
                document.body
            )}
        </tr>
    )
}


// ═══════════════════════════════════════════════════
// ALIAS LINK MODAL
// ═══════════════════════════════════════════════════
function AliasLinkModal({ extractedName, adminData, seasonId, onSave, onClose }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const searchResults = (() => {
        const q = searchQuery.trim().toLowerCase()
        if (q.length < 2) return []
        const results = []
        const seen = new Set()

        // Search season roster
        const seasonPlayers = seasonId
            ? (adminData?.players || []).filter(p => String(p.season_id) === String(seasonId))
            : (adminData?.players || [])

        for (const p of seasonPlayers) {
            if (seen.has(p.league_player_id)) continue
            if (p.name.toLowerCase().includes(q)) {
                seen.add(p.league_player_id)
                results.push({ ...p, source: 'roster' })
            }
        }

        // Search global players
        if (q.length >= 2) {
            for (const p of (adminData?.globalPlayers || [])) {
                if (seen.has(p.player_id)) continue
                if (p.name.toLowerCase().includes(q)) {
                    seen.add(p.player_id)
                    results.push({ ...p, source: 'global' })
                }
            }
        }

        return results.slice(0, 12)
    })()

    const handleSave = async () => {
        if (!selectedPlayer) return
        setSaving(true)
        setError(null)
        try {
            const pid = selectedPlayer.player_id
            const res = await fetch(`${API}/roster-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'add-alias', player_id: pid, alias: extractedName }),
            })
            const data = await res.json()
            if (res.ok || res.status === 409) {
                onSave(selectedPlayer)
            } else {
                setError(data.error || 'Failed to save alias')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
             onClick={onClose}>
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full p-5"
                 style={{ backgroundColor: 'var(--color-secondary)' }}
                 onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">Link Alias</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                    Save <span className="text-yellow-400 font-semibold">"{extractedName}"</span> as an alias for an existing player.
                </p>

                {/* Player search */}
                <div className="relative mb-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSelectedPlayer(null) }}
                        placeholder="Search for existing player..."
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                    {searchResults.length > 0 && !selectedPlayer && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg shadow-xl max-h-48 overflow-y-auto"
                             style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                            {searchResults.map((r, i) => (
                                <button key={`${r.league_player_id || r.player_id}_${i}`}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                        onClick={() => { setSelectedPlayer(r); setSearchQuery(r.name) }}>
                                    {r.team_color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color }} />}
                                    <span className="text-[var(--color-text)]">{r.name}</span>
                                    {r.role && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">{r.role}</span>}
                                    {r.team_name && <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{r.team_name}</span>}
                                    {r.source === 'global' && <span className="text-yellow-400/60 ml-auto text-[10px]">global</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected player preview */}
                {selectedPlayer && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs">
                        <span className="text-green-400 font-semibold">{selectedPlayer.name}</span>
                        {selectedPlayer.team_name && <span className="text-[var(--color-text-secondary)] ml-2">{selectedPlayer.team_name}</span>}
                        <div className="text-[var(--color-text-secondary)] mt-1">
                            "{extractedName}" will be saved as alias
                        </div>
                    </div>
                )}

                {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

                <div className="flex items-center gap-2 justify-end">
                    <button onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave}
                            disabled={!selectedPlayer || saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {saving ? 'Saving...' : 'Save Alias'}
                    </button>
                </div>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════

function RadioOption({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                active
                    ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'
                    : 'bg-white/5 border-white/10 text-[var(--color-text-secondary)] hover:border-white/20 hover:text-[var(--color-text)]'
            }`}
        >
            {label}
        </button>
    )
}

function StatusBadge({ status }) {
    const styles = {
        pending: 'bg-white/10 text-[var(--color-text-secondary)]',
        processing: 'bg-blue-500/20 text-blue-400',
        review: 'bg-yellow-500/20 text-yellow-400',
        error: 'bg-red-500/20 text-red-400',
        submitted: 'bg-green-500/20 text-green-400',
    }
    const labels = {
        pending: '⏳ Pending',
        processing: '🔄 Extracting',
        review: '📝 Review',
        error: '❌ Error',
        submitted: '✅ Done',
    }
    return <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${styles[status]}`}>{labels[status]}</span>
}

function WinnerButton({ label, color, isActive, onClick }) {
    const activeClass = color === 'blue' ? 'bg-blue-500 text-white ring-1 ring-blue-400' : 'bg-red-500 text-white ring-1 ring-red-400'
    const hoverClass = color === 'blue' ? 'hover:border-blue-400' : 'hover:border-red-400'
    return (
        <button onClick={onClick}
                className={`px-3 py-1 text-xs rounded transition-all ${
                    isActive ? activeClass : `bg-[var(--color-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] ${hoverClass}`
                }`}>
            {label}
        </button>
    )
}

function EditableCell({ value, onChange }) {
    return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
               className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] transition-colors" />
    )
}

function GodAutocomplete({ value, gods, onChange }) {
    const [showDropdown, setShowDropdown] = useState(false)
    const [query, setQuery] = useState('')
    const [highlightIndex, setHighlightIndex] = useState(0)
    const containerRef = useRef(null)
    const inputRef = useRef(null)
    const dropdownRef = useRef(null)

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showDropdown])

    const filtered = (() => {
        if (!showDropdown || !gods?.length) return []
        const q = query.trim().toLowerCase()
        if (!q) return gods
        return gods.filter(g => g.name.toLowerCase().includes(q))
    })()

    // Reset highlight when results change
    useEffect(() => { setHighlightIndex(0) }, [query])

    // Scroll highlighted item into view
    useEffect(() => {
        if (!showDropdown || !dropdownRef.current) return
        const offset = query === '' ? 1 : 0 // account for "All gods" sticky header
        const el = dropdownRef.current.children[highlightIndex + offset]
        el?.scrollIntoView({ block: 'nearest' })
    }, [highlightIndex, showDropdown, query])

    const currentGod = gods?.find(g => g.name.toLowerCase() === (value || '').toLowerCase())

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-1">
                {currentGod?.image_url && !showDropdown && (
                    <img src={currentGod.image_url} alt="" className="w-4 h-4 rounded-sm shrink-0 object-cover" />
                )}
                <input
                    ref={inputRef}
                    type="text"
                    value={showDropdown ? query : (value || '')}
                    onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => { setQuery(value || ''); setShowDropdown(true) }}
                    onKeyDown={e => {
                        if (e.key === 'Escape') { setShowDropdown(false); inputRef.current?.blur() }
                        if (e.key === 'Tab') setShowDropdown(false)
                        if (e.key === 'ArrowDown' && showDropdown && filtered.length > 0) {
                            e.preventDefault()
                            setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1))
                        }
                        if (e.key === 'ArrowUp' && showDropdown && filtered.length > 0) {
                            e.preventDefault()
                            setHighlightIndex(prev => Math.max(prev - 1, 0))
                        }
                        if (e.key === 'Enter' && showDropdown && filtered.length > 0) {
                            e.preventDefault()
                            const god = filtered[highlightIndex]
                            if (god) {
                                onChange({ god_played: god.name, god_id: god.id, god_image_url: god.image_url })
                                setShowDropdown(false)
                                setQuery('')
                            }
                        }
                    }}
                    className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] transition-colors"
                />
            </div>

            {showDropdown && filtered.length > 0 && (
                <div ref={dropdownRef}
                     className="absolute z-50 top-full left-0 mt-1 w-56 border rounded shadow-xl max-h-56 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {query === '' && (
                        <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]/50 sticky top-0"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)' }}>
                            All gods — type to filter
                        </div>
                    )}
                    {filtered.map((god, idx) => (
                        <button key={god.id}
                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                                    idx === highlightIndex
                                        ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                                        : 'hover:bg-[var(--color-accent)]/10'
                                }`}
                                onMouseDown={e => e.preventDefault()}
                                onMouseEnter={() => setHighlightIndex(idx)}
                                onClick={() => {
                                    onChange({ god_played: god.name, god_id: god.id, god_image_url: god.image_url })
                                    setShowDropdown(false)
                                    setQuery('')
                                }}>
                            {god.image_url && (
                                <img src={god.image_url} alt="" className="w-5 h-5 rounded-sm shrink-0 object-cover" />
                            )}
                            <span className="text-[var(--color-text)]">{god.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {showDropdown && query.length >= 2 && filtered.length === 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-48 border rounded shadow-lg px-3 py-2 text-[10px] text-[var(--color-text-secondary)]"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    No gods found for "{query}"
                </div>
            )}
        </div>
    )
}

function NumCell({ value, onChange, align = 'center' }) {
    return (
        <td className={`py-1.5 px-1`}>
            <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
                   className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] tabular-nums text-${align} transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
        </td>
    )
}

function FieldSelect({ label, value, onChange, options, loading, color }) {
    return (
        <div>
            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)} disabled={loading}
                    className="w-full rounded px-2 py-1.5 text-xs disabled:opacity-50 border"
                    style={{
                        backgroundColor: 'var(--color-card, #1e1e2e)',
                        color: 'var(--color-text, #e0e0e0)',
                        borderColor: color || 'var(--color-border, #333)',
                        borderLeftColor: color || 'var(--color-border, #333)',
                        borderLeftWidth: color ? '3px' : '1px',
                    }}>
                <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— Select —</option>
                {options.map(o => (
                    <option key={o.value} value={o.value} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

function FieldInput({ label, type, value, onChange }) {
    return (
        <div>
            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                   className="w-full rounded px-2 py-1.5 text-xs border"
                   style={{
                       backgroundColor: 'var(--color-card, #1e1e2e)',
                       color: 'var(--color-text, #e0e0e0)',
                       borderColor: 'var(--color-border, #333)',
                       colorScheme: 'dark',
                   }} />
        </div>
    )
}

function ErrorBanner({ message, className = '' }) {
    return (
        <div className={`px-4 py-2 bg-red-500/10 text-red-400 text-xs flex items-start gap-2 ${className}`}>
            <span className="shrink-0">⚠</span>
            <span>{message}</span>
        </div>
    )
}