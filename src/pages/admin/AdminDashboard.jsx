// src/pages/admin/AdminDashboard.jsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MatchReportHelp } from '../../components/admin/AdminHelp'
import DraggablePanel from '../../components/admin/DraggablePanel'
import ScheduledMatchPanel from '../../components/admin/ScheduledMatchPanel'
import DiscordImagesPanel from '../../components/admin/DiscordImagesPanel'
import { getAuthHeaders } from '../../services/adminApi.js'
import { API, loadStorage, saveStorage, uid, buildEditData, compressImage } from './dashboard/constants'
import { ErrorBanner } from './dashboard/FormControls'
import { MatchReportCard } from './dashboard/MatchReportCard'

export default function AdminDashboard() {
    const { scheduledMatchId } = useParams()
    const navigate = useNavigate()
    const autoStartedRef = useRef(false)
    const [matchReports, setMatchReports] = useState(() => loadStorage())
    const [submitting, setSubmitting] = useState({}) // { [mrId]: true }
    const [submitResults, setSubmitResults] = useState({}) // { [mrId]: { success, error, data } }
    const [selected, setSelected] = useState({}) // checkboxes for bulk submit
    const [bulkSubmitting, setBulkSubmitting] = useState(false)

    // Discord queue state (shared across all cards)
    const [discordItems, setDiscordItems] = useState([])
    const [discordPolling, setDiscordPolling] = useState(false)

    // Ready to Report state
    const [readyMatches, setReadyMatches] = useState([])
    const [readyMatchLoading, setReadyMatchLoading] = useState(false)

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

    // ─── Ready to Report matches ───
    const fetchReadyMatches = useCallback(async () => {
        try {
            const res = await fetch(`${API}/discord-queue?action=ready-matches`, { headers: getAuthHeaders() })
            if (!res.ok) return
            const data = await res.json()
            setReadyMatches(data.matches || [])
        } catch { /* silent */ }
    }, [])

    useEffect(() => { fetchReadyMatches() }, [fetchReadyMatches])

    const unlinkReadyMatch = useCallback(async (matchId) => {
        if (!confirm('Unlink all screenshots from this match? They will move back to unmatched in Discord Review.')) return
        try {
            // Fetch queue item IDs for this match, then unlink them all
            const queueRes = await fetch(
                `${API}/discord-queue?action=queue&suggestedMatchId=${matchId}`,
                { headers: getAuthHeaders() },
            )
            if (!queueRes.ok) return
            const queueData = await queueRes.json()
            const itemIds = (queueData.items || []).map(i => i.id)
            if (!itemIds.length) return

            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'update-suggested-match',
                    queue_item_ids: itemIds,
                    scheduled_match_id: null,
                }),
            })
            if (!res.ok) throw new Error('Failed to unlink')
            fetchReadyMatches()
        } catch { /* silent */ }
    }, [fetchReadyMatches])

    const startReadyReport = useCallback(async (readyMatch) => {
        setReadyMatchLoading(true)
        try {
            // 1. Fetch queue items for this match
            const queueRes = await fetch(
                `${API}/discord-queue?action=queue&suggestedMatchId=${readyMatch.id}`,
                { headers: getAuthHeaders() },
            )
            const queueData = await queueRes.json()
            const queueItems = queueData.items || []
            if (!queueItems.length) return

            // 2. Create match report with scheduled match pre-linked
            const mrId = uid()
            liveImagesRef.current[mrId] = []

            const texts = [...new Set(queueItems.map(q => q.message_content).filter(Boolean))]

            setMatchReports(prev => [...prev, {
                id: mrId,
                text: texts.join('\n').trim(),
                images: [],
                status: 'pending',
                result: null,
                editData: {
                    season_id: readyMatch.season_id,
                    team1_id: readyMatch.team1_id,
                    team2_id: readyMatch.team2_id,
                    team1_name: readyMatch.team1_name,
                    team2_name: readyMatch.team2_name,
                    week: readyMatch.week || null,
                    date: readyMatch.scheduled_date ? readyMatch.scheduled_date.slice(0, 10) : new Date().toISOString().split('T')[0],
                    best_of: readyMatch.best_of || 3,
                    scheduled_match_id: readyMatch.id,
                    games: [],
                },
                error: null,
                discordQueueItemIds: queueItems.map(q => q.id),
                // Store queue items for image selection step
                _readyQueueItems: queueItems,
            }])

            // Always switch to the correct season for this match
            handleSeasonChange(String(readyMatch.season_id))

            fetchReadyMatches()
        } catch (err) {
            console.error('startReadyReport error:', err)
        } finally {
            setReadyMatchLoading(false)
        }
    }, [fetchReadyMatches])

    // Auto-open match report from URL param (e.g. /admin/matchreport/123)
    useEffect(() => {
        if (!scheduledMatchId || autoStartedRef.current || !readyMatches.length) return
        const match = readyMatches.find(rm => rm.id === Number(scheduledMatchId))
        if (match) {
            autoStartedRef.current = true
            startReadyReport(match)
            navigate('/admin/matchreport', { replace: true })
        }
    }, [scheduledMatchId, readyMatches, startReadyReport, navigate])

    // ─── Start a forfeit report (skip screenshots) ───
    const startForfeitReport = useCallback((readyMatch) => {
        const mrId = uid()
        liveImagesRef.current[mrId] = []

        setMatchReports(prev => [...prev, {
            id: mrId,
            text: '',
            images: [],
            status: 'review',
            result: null,
            editData: {
                season_id: readyMatch.season_id,
                team1_id: readyMatch.team1_id,
                team2_id: readyMatch.team2_id,
                team1_name: readyMatch.team1_name,
                team2_name: readyMatch.team2_name,
                week: readyMatch.week || null,
                date: readyMatch.scheduled_date ? readyMatch.scheduled_date.slice(0, 10) : new Date().toISOString().split('T')[0],
                best_of: readyMatch.best_of || 3,
                scheduled_match_id: readyMatch.id,
                games: [{ winning_team_id: null, is_forfeit: true, left_players: [], right_players: [] }],
            },
            error: null,
        }])

        handleSeasonChange(String(readyMatch.season_id))
        fetchReadyMatches()
    }, [fetchReadyMatches])

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
            const editData = buildEditData(result, adminData)

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
                        role_played: p.role_played || null,
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
        <div className="max-w-7xl mx-auto pb-8 px-4">
            <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Match Report</h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    Paste match text + DETAILS screenshots → AI extracts → Review & submit
                </p>
            </div>

            <MatchReportHelp />

            {adminError && <ErrorBanner message={`Admin data: ${adminError}`} className="mb-4" />}

            {/* Ready to Report */}
            {readyMatches.length > 0 && (
                <div id="ready-to-report" className="mb-6">
                    <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                        Ready to Report
                    </h2>
                    <div className="space-y-4">
                        {Object.entries(readyMatches.reduce((acc, rm) => {
                            const div = rm.division_name || 'Unknown'
                            if (!acc[div]) acc[div] = []
                            acc[div].push(rm)
                            return acc
                        }, {})).map(([divName, matches]) => (
                            <div key={divName}>
                                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">{divName}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {matches.map(rm => {
                                        const conf = rm.match_confidence || 'unknown'
                                        const isLow = conf === 'low'
                                        const isMedium = conf === 'medium'
                                        const confColor = isLow ? 'text-red-400' : isMedium ? 'text-amber-400' : 'text-green-400'
                                        const confBorder = isLow ? 'border-red-500/50' : isMedium ? 'border-amber-500/30' : 'border-[var(--color-border)]'
                                        const confLabel = isLow ? 'Low match' : isMedium ? 'Likely match' : 'Strong match'
                                        return (
                                        <div key={rm.id} className={`bg-[var(--color-card)] border rounded-lg p-3 hover:border-[var(--color-accent)]/40 transition-colors ${confBorder}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                        {rm.screenshot_count} screenshot{rm.screenshot_count !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${confColor}`} title={
                                                        isLow ? 'Matched by date only or weak signals — verify teams are correct'
                                                        : isMedium ? 'One team confirmed — double-check the opponent'
                                                        : 'Both teams confirmed via Discord roles or text'
                                                    }>
                                                        {confLabel}
                                                    </span>
                                                    {rm.week && <span className="text-xs text-[var(--color-text-secondary)]">Wk {rm.week}</span>}
                                                </div>
                                            </div>
                                            {isLow && (
                                                <div className="mb-2 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                                                    <p className="text-[10px] text-red-400">
                                                        Needs review — verify this is the correct match before reporting
                                                    </p>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rm.team1_color }} />
                                                <span className="text-sm font-semibold text-[var(--color-text)] truncate">{rm.team1_name}</span>
                                                <span className="text-xs text-[var(--color-text-secondary)]">vs</span>
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rm.team2_color }} />
                                                <span className="text-sm font-semibold text-[var(--color-text)] truncate">{rm.team2_name}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-[var(--color-text-secondary)]">
                                                    {new Date(rm.scheduled_date).toLocaleDateString()}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => unlinkReadyMatch(rm.id)}
                                                        disabled={readyMatchLoading}
                                                        className="px-2 py-1 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-red-400 disabled:opacity-50 transition"
                                                        title="Unlink screenshots from this match"
                                                    >
                                                        Unlink
                                                    </button>
                                                    <button
                                                        onClick={() => startForfeitReport(rm)}
                                                        disabled={readyMatchLoading}
                                                        className="px-2 py-1 rounded-lg text-xs font-semibold border border-orange-500/40 text-orange-400 hover:bg-orange-500/15 disabled:opacity-50 transition"
                                                        title="Report as forfeit — skip screenshots"
                                                    >
                                                        FF
                                                    </button>
                                                    <button
                                                        onClick={() => startReadyReport(rm)}
                                                        disabled={readyMatchLoading}
                                                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition"
                                                    >
                                                        Report Match
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 px-1">
                        <p className="text-[10px] text-[var(--color-text-secondary)] italic">
                            Auto-matched from Discord screenshots. <span className="text-red-400 not-italic font-medium">Red cards</span> have weak matches — verify the correct game before reporting.
                        </p>
                    </div>
                </div>
            )}

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
                        <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>{'\u2014'} Season {'\u2014'}</option>
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
                                    {bulkSubmitting ? 'Submitting\u2026' : `Submit ${selectedCount} Selected`}
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
                {[...matchReports].reverse().map(mr => (
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
                    <div className="text-5xl mb-4 opacity-50">{'\ud83d\udccb'}</div>
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

            {/* Floating panels (toggled from action bar) */}
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
