import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getAuthHeaders } from '../../services/adminApi.js'
import { API, uid, buildEditData, compressImage } from './dashboard/constants'
import { ErrorBanner } from './dashboard/FormControls'
import { MatchReportCard } from './dashboard/MatchReportCard'
import WizardMatchReport from './dashboard/WizardMatchReport'

const LOCK_TTL_MS = 10 * 60 * 1000
const LOCK_WARN_MS = 9 * 60 * 1000

export default function SingleMatchReport() {
    const { scheduledMatchId } = useParams()
    const navigate = useNavigate()

    // Mode toggle
    const [wizardMode, setWizardMode] = useState(true)

    // Core state
    const [adminData, setAdminData] = useState(null)
    const [adminError, setAdminError] = useState(null)
    const [matchInfo, setMatchInfo] = useState(null) // ready-match data
    const [matchReport, setMatchReport] = useState(null)
    const liveImagesRef = useRef([])
    const mrIdRef = useRef(uid())

    // Submission state
    const [submitting, setSubmitting] = useState(false)
    const [submitResult, setSubmitResult] = useState(null)

    // Discord queue
    const [discordItems, setDiscordItems] = useState([])

    // Lock state
    const [lockStatus, setLockStatus] = useState(null) // { locked, locked_by, locked_by_name, is_mine, conflict }
    const [lockError, setLockError] = useState(null)
    const [showLockWarning, setShowLockWarning] = useState(false)
    const lockTimerRef = useRef(null)
    const warnTimerRef = useRef(null)
    const lockAcquiredRef = useRef(false)

    // ─── Fetch admin data ───
    useEffect(() => {
        fetch(`${API}/admin-data`, { headers: getAuthHeaders() })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
            .then(setAdminData)
            .catch(e => setAdminError(e.message))
    }, [])

    // ─── Fetch match info ───
    useEffect(() => {
        if (!scheduledMatchId) return
        fetch(`${API}/discord-queue?action=ready-matches`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(data => {
                const match = (data.matches || []).find(m => m.id === Number(scheduledMatchId))
                if (match) setMatchInfo(match)
                else setAdminError('Match not found or not ready to report')
            })
            .catch(e => setAdminError(e.message))
    }, [scheduledMatchId])

    // ─── Fetch discord queue items for this match ───
    const fetchDiscordQueue = useCallback(async () => {
        if (!scheduledMatchId) return
        try {
            const res = await fetch(
                `${API}/discord-queue?action=queue&suggestedMatchId=${scheduledMatchId}`,
                { headers: getAuthHeaders() },
            )
            if (!res.ok) return
            const data = await res.json()
            setDiscordItems(data.items || [])
        } catch { /* silent */ }
    }, [scheduledMatchId])

    useEffect(() => { fetchDiscordQueue() }, [fetchDiscordQueue])

    // ─── Lock management ───
    const acquireLock = useCallback(async () => {
        if (!scheduledMatchId) return
        try {
            const res = await fetch(`${API}/report-lock`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'acquire', scheduled_match_id: Number(scheduledMatchId) }),
            })
            const data = await res.json()
            if (res.status === 409) {
                setLockStatus({ ...data, conflict: true })
                setLockError(`${data.locked_by_name} is already reporting this match`)
                return false
            }
            if (!res.ok) {
                setLockError(data.error || 'Failed to acquire lock')
                return false
            }
            setLockStatus({ ...data, is_mine: true })
            lockAcquiredRef.current = true
            startLockTimers()
            return true
        } catch (err) {
            setLockError(err.message)
            return false
        }
    }, [scheduledMatchId])

    const releaseLock = useCallback(async () => {
        if (!scheduledMatchId || !lockAcquiredRef.current) return
        lockAcquiredRef.current = false
        clearLockTimers()
        try {
            await fetch(`${API}/report-lock`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'release', scheduled_match_id: Number(scheduledMatchId) }),
            })
        } catch { /* best effort */ }
    }, [scheduledMatchId])

    const refreshLock = useCallback(async () => {
        if (!scheduledMatchId || !lockAcquiredRef.current) return
        setShowLockWarning(false)
        try {
            await fetch(`${API}/report-lock`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'refresh', scheduled_match_id: Number(scheduledMatchId) }),
            })
            startLockTimers()
        } catch { /* silent */ }
    }, [scheduledMatchId])

    const startLockTimers = useCallback(() => {
        clearLockTimers()
        warnTimerRef.current = setTimeout(() => setShowLockWarning(true), LOCK_WARN_MS)
        lockTimerRef.current = setTimeout(() => {
            lockAcquiredRef.current = false
            setLockError('Lock expired. Refresh or re-acquire to continue.')
        }, LOCK_TTL_MS)
    }, [])

    const clearLockTimers = useCallback(() => {
        if (warnTimerRef.current) clearTimeout(warnTimerRef.current)
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
        warnTimerRef.current = null
        lockTimerRef.current = null
    }, [])

    // Acquire lock + initialize match report when match info is loaded
    useEffect(() => {
        if (!matchInfo || matchReport) return
        ;(async () => {
            const acquired = await acquireLock()
            if (!acquired) return

            const mrId = mrIdRef.current
            setMatchReport({
                id: mrId,
                text: '',
                images: [],
                status: 'pending',
                result: null,
                editData: {
                    season_id: matchInfo.season_id,
                    team1_id: matchInfo.team1_id,
                    team2_id: matchInfo.team2_id,
                    team1_name: matchInfo.team1_name,
                    team2_name: matchInfo.team2_name,
                    week: matchInfo.week || null,
                    date: matchInfo.scheduled_date ? matchInfo.scheduled_date.slice(0, 10) : new Date().toISOString().split('T')[0],
                    best_of: matchInfo.best_of || 3,
                    scheduled_match_id: matchInfo.id,
                    games: [],
                },
                error: null,
                _readyQueueItems: discordItems.length ? discordItems : undefined,
            })
        })()
    }, [matchInfo, discordItems])

    // Update _readyQueueItems when discord items load after matchReport is created
    useEffect(() => {
        if (!matchReport || !discordItems.length || matchReport._readyQueueItems) return
        setMatchReport(prev => prev ? { ...prev, _readyQueueItems: discordItems } : prev)
    }, [discordItems, matchReport])

    // Release lock on unmount
    useEffect(() => {
        return () => {
            clearLockTimers()
            if (lockAcquiredRef.current) {
                // Best effort release — navigator.sendBeacon doesn't support auth headers,
                // so use fetch with keepalive
                const token = localStorage.getItem('auth_token')
                fetch(`${API}/report-lock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ action: 'release', scheduled_match_id: Number(scheduledMatchId) }),
                    keepalive: true,
                }).catch(() => {})
            }
        }
    }, [scheduledMatchId])

    // Also release on beforeunload
    useEffect(() => {
        const handler = () => {
            if (!lockAcquiredRef.current) return
            const token = localStorage.getItem('auth_token')
            fetch(`${API}/report-lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'release', scheduled_match_id: Number(scheduledMatchId) }),
                keepalive: true,
            }).catch(() => {})
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [scheduledMatchId])

    // ─── Report helpers ───
    const updateReport = useCallback((updater) => {
        setMatchReport(prev => {
            if (!prev) return prev
            return typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
        })
    }, [])

    const addImages = useCallback((mrId, files) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (!imageFiles.length) return
        const newImgs = imageFiles.map((file, i) => ({
            id: `img_${Date.now()}_${i}`, name: file.name, file, preview: URL.createObjectURL(file),
        }))
        liveImagesRef.current.push(...newImgs)
        updateReport(prev => ({ ...prev, images: [...prev.images, ...newImgs.map(img => ({ id: img.id, name: img.name }))] }))
    }, [updateReport])

    const removeImage = useCallback((mrId, imgId) => {
        const img = liveImagesRef.current.find(i => i.id === imgId)
        if (img?.preview) URL.revokeObjectURL(img.preview)
        liveImagesRef.current = liveImagesRef.current.filter(i => i.id !== imgId)
        updateReport(prev => ({ ...prev, images: prev.images.filter(i => i.id !== imgId) }))
    }, [updateReport])

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

            liveImagesRef.current.push(...newLiveImages)

            const selectedItems = discordItems.filter(q => selectedItemIds.includes(q.id))
            const texts = [...new Set(selectedItems.map(q => q.message_content).filter(Boolean))]
            const text = texts.join('\n').trim()

            updateReport(prev => ({
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

    // ─── Process (AI extraction) ───
    const processOne = useCallback(async () => {
        const mr = matchReport
        const live = liveImagesRef.current
        if (!mr || live.length === 0) return

        updateReport({ status: 'processing', error: null })

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
            const editData = buildEditData(result, adminData)

            // Preserve pre-linked scheduled match data
            if (mr.editData?.scheduled_match_id) {
                editData.scheduled_match_id = mr.editData.scheduled_match_id
                editData.team1_id = mr.editData.team1_id || editData.team1_id
                editData.team2_id = mr.editData.team2_id || editData.team2_id
                editData.team1_name = mr.editData.team1_name || editData.team1_name
                editData.team2_name = mr.editData.team2_name || editData.team2_name
                editData.week = mr.editData.week || editData.week
                editData.date = mr.editData.date || editData.date
                editData.best_of = mr.editData.best_of || editData.best_of
            }

            // Normalize left/right players per game to match team1/team2 ordering
            const rosterPlayers = adminData?.players || []
            for (const game of editData.games) {
                const leftTeamIds = (game.left_players || [])
                    .filter(p => p.matched_lp_id)
                    .map(p => rosterPlayers.find(r => r.league_player_id === p.matched_lp_id)?.team_id)
                    .filter(Boolean)
                if (leftTeamIds.length) {
                    const counts = {}
                    for (const id of leftTeamIds) counts[id] = (counts[id] || 0) + 1
                    const leftTeamId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
                    if (String(leftTeamId) === String(editData.team2_id)) {
                        const tmp = game.left_players
                        game.left_players = game.right_players
                        game.right_players = tmp
                    }
                }
            }
            editData.season_id = mr.editData?.season_id || editData.season_id

            const allGamesOk = result.games?.every(g => g.success)
            updateReport({ status: allGamesOk ? 'review' : 'error', result, editData, error: allGamesOk ? null : 'Some games failed to extract' })
        } catch (err) {
            updateReport({ status: 'error', error: err.message })
        }
    }, [matchReport, adminData, updateReport])

    // ─── Submit ───
    const submitOne = useCallback(async () => {
        const mr = matchReport
        if (!mr?.editData) return

        const ed = mr.editData
        setSubmitting(true)
        setSubmitResult(null)

        try {
            if (!ed.season_id) throw new Error('Season is required')
            if (!ed.team1_id) throw new Error('Team 1 is required')
            if (!ed.team2_id) throw new Error('Team 2 is required')
            if (!ed.games.length) throw new Error('No games to submit')

            for (let i = 0; i < ed.games.length; i++) {
                if (!ed.games[i].winning_team_id) throw new Error(`Game ${i + 1}: Winner not set`)
            }

            const rosterPlayers = adminData?.players || []
            const optionalStat = (v) => (v != null && v !== '' && v !== 0) ? parseInt(v) : null

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
                    if (g.is_forfeit) {
                        return { winning_team_id: g.winning_team_id, is_forfeit: true, team1_players: [], team2_players: [] }
                    }

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

            setSubmitResult({ success: true, data })
            updateReport({ status: 'submitted', error: null })
            lockAcquiredRef.current = false // Lock released server-side on submit
            clearLockTimers()

            // Mark discord queue items as used
            if (mr.discordQueueItemIds?.length) {
                fetch(`${API}/discord-queue`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        action: 'mark-used',
                        queue_item_ids: mr.discordQueueItemIds,
                        match_id: data.match_id || null,
                    }),
                }).catch(() => {})
            }
        } catch (err) {
            setSubmitResult({ success: false, error: err.message })
            updateReport({ error: err.message })
        } finally {
            setSubmitting(false)
        }
    }, [matchReport, adminData, updateReport, clearLockTimers])

    // ─── Wizard helpers ───
    const extractFromScreenshots = useCallback(async (selectedItemIds) => {
        const result = await addDiscordImages(mrIdRef.current, selectedItemIds)
        if (!result.success) {
            updateReport({ status: 'error', error: result.error })
            return
        }
        await processOne()
    }, [addDiscordImages, processOne, updateReport])

    const handleUpdateEditData = useCallback((updater) => {
        updateReport(prev => ({
            ...prev,
            editData: typeof updater === 'function' ? updater(prev.editData) : { ...prev.editData, ...updater },
        }))
    }, [updateReport])

    const selectedSeason = adminData?.seasons?.find(s => String(s.season_id) === String(matchInfo?.season_id)) || null

    // ─── Render ───
    if (adminError || lockError) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-12">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-6 text-center">
                    {lockError && lockStatus?.conflict ? (
                        <>
                            <div className="text-3xl mb-3 opacity-60">&#128274;</div>
                            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Match Locked</h2>
                            <p className="text-[var(--color-text-secondary)] mb-4">
                                <span className="text-[var(--color-accent)] font-semibold">{lockStatus.locked_by_name}</span> is currently reporting this match.
                            </p>
                            <Link to="/admin/matchreport" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 transition">
                                Back to Match Reports
                            </Link>
                        </>
                    ) : (
                        <>
                            <ErrorBanner message={adminError || lockError} className="mb-4" />
                            <Link to="/admin/matchreport" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-[var(--color-text)] hover:bg-white/15 transition">
                                Back to Match Reports
                            </Link>
                        </>
                    )}
                </div>
            </div>
        )
    }

    if (!matchInfo || !matchReport || !adminData) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-12 text-center">
                <div className="text-[var(--color-text-secondary)]">Loading match data...</div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto pb-8 px-4">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Link to="/admin/matchreport" className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition">
                            &larr; All Reports
                        </Link>
                    </div>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: matchInfo.team1_color }} />
                        {matchInfo.team1_name}
                        <span className="text-[var(--color-text-secondary)] font-normal mx-2">vs</span>
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: matchInfo.team2_color }} />
                        {matchInfo.team2_name}
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        {matchInfo.division_name}
                        {matchInfo.week && <> &middot; Week {matchInfo.week}</>}
                        {matchInfo.scheduled_date && <> &middot; {new Date(matchInfo.scheduled_date).toLocaleDateString()}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWizardMode(m => !m)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
                    >
                        {wizardMode ? 'Legacy Mode' : 'Wizard Mode'}
                    </button>
                    <button
                        onClick={async () => { await releaseLock(); navigate('/admin/matchreport') }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-red-400 transition"
                    >
                        Cancel Report
                    </button>
                </div>
            </div>

            {/* Lock refresh warning popup */}
            {showLockWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[var(--color-card)] border border-amber-500/50 rounded-xl p-6 max-w-sm shadow-2xl">
                        <h3 className="text-lg font-bold text-amber-400 mb-2">Lock Expiring</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                            Your report lock expires in about 1 minute. Keep working?
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={refreshLock}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-black hover:bg-amber-400 transition"
                            >
                                Keep Working
                            </button>
                            <button
                                onClick={async () => { setShowLockWarning(false); await releaseLock(); navigate('/admin/matchreport') }}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-red-400 hover:border-red-500/50 transition"
                            >
                                Stop Reporting
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Match report content */}
            {wizardMode ? (
                <WizardMatchReport
                    matchInfo={matchInfo}
                    editData={matchReport.editData}
                    onUpdateEditData={handleUpdateEditData}
                    adminData={adminData}
                    queueItems={discordItems}
                    onExtract={extractFromScreenshots}
                    onAddImages={(files) => addImages(mrIdRef.current, files)}
                    onExtractPasted={processOne}
                    status={matchReport.status}
                    error={matchReport.error}
                    onSubmit={submitOne}
                    isSubmitting={submitting}
                    submitResult={submitResult}
                />
            ) : (
                <MatchReportCard
                    report={matchReport}
                    liveImages={liveImagesRef.current}
                    adminData={adminData}
                    isSelected={false}
                    onToggleSelect={() => {}}
                    onUpdateText={(text) => updateReport({ text })}
                    onUpdateEditData={handleUpdateEditData}
                    onAddImages={(files) => addImages(mrIdRef.current, files)}
                    onRemoveImage={(imgId) => removeImage(mrIdRef.current, imgId)}
                    onRemove={() => {}}
                    confirmDelete={false}
                    onConfirmRemove={() => {}}
                    onCancelRemove={() => {}}
                    onProcess={processOne}
                    onRetry={() => updateReport({ status: 'pending', error: null })}
                    onSubmit={submitOne}
                    isSubmitting={submitting}
                    submitResult={submitResult}
                    scheduledMatches={[]}
                    linkedScheduledIds={new Set()}
                    discordItems={discordItems}
                    discordPolling={false}
                    selectedSeason={selectedSeason}
                    onPollDiscord={() => {}}
                    onAddDiscordImages={(selectedItemIds) => addDiscordImages(mrIdRef.current, selectedItemIds)}
                    onSkipDiscordItems={() => {}}
                    onSetActiveCard={() => {}}
                />
            )}
        </div>
    )
}
