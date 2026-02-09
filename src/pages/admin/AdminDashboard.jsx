// src/pages/admin/AdminDashboard.jsx
import { useState, useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Link } from 'react-router-dom'

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

// ═══════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════
export default function AdminDashboard() {
    const [matchReports, setMatchReports] = useState(() => loadStorage())
    const [processing, setProcessing] = useState(false)
    const [submitting, setSubmitting] = useState({}) // { [mrId]: true }
    const [submitResults, setSubmitResults] = useState({}) // { [mrId]: { success, error, data } }
    const [selected, setSelected] = useState({}) // checkboxes for bulk submit
    const [bulkSubmitting, setBulkSubmitting] = useState(false)

    // Live image refs (File objects can't go in localStorage)
    const liveImagesRef = useRef({}) // { [mrId]: [{ id, file, preview }] }

    // Admin metadata
    const [adminData, setAdminData] = useState(null)
    const [adminError, setAdminError] = useState(null)

    useEffect(() => {
        fetch(`${API}/admin-data`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
            .then(setAdminData)
            .catch(e => setAdminError(e.message))
    }, [])

    // Persist on change
    useEffect(() => { saveStorage(matchReports) }, [matchReports])

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: imageData, match_text: mr.text || null }),
            })

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
                throw new Error(errBody.error || `Extraction failed: ${res.status}`)
            }

            const result = await res.json()

            // Build editable data from extraction result
            const editData = buildEditData(result)

            const allGamesOk = result.games?.every(g => g.success)
            const status = allGamesOk ? 'review' : 'error'

            updateReport(mrId, { status, result, editData, error: allGamesOk ? null : 'Some games failed to extract' })
        } catch (err) {
            updateReport(mrId, { status: 'error', error: err.message })
        }
    }, [matchReports, updateReport])

    // ─── Process all pending ───
    const processAll = async () => {
        setProcessing(true)
        const pending = matchReports.filter(mr => mr.status === 'pending' && mr.images.length > 0)
        for (const mr of pending) {
            await processOne(mr.id)
        }
        setProcessing(false)
    }

    // ─── Submit one match to DB ───
    const submitOne = useCallback(async (mr) => {
        const id = mr.id
        const ed = mr.editData
        if (!ed) return

        setSubmitting(prev => ({ ...prev, [id]: true }))
        setSubmitResults(prev => ({ ...prev, [id]: null }))

        try {
            if (!ed.season_id) throw new Error('Season is required')
            if (!ed.team1_id) throw new Error('Team 1 (Order) is required')
            if (!ed.team2_id) throw new Error('Team 2 (Chaos) is required')
            if (!ed.games.length) throw new Error('No games to submit')

            for (let i = 0; i < ed.games.length; i++) {
                if (!ed.games[i].winning_side) throw new Error(`Game ${i + 1}: Winner not set`)
            }

            const payload = {
                action: 'submit-match',
                season_id: ed.season_id,
                team1_id: ed.team1_id,
                team2_id: ed.team2_id,
                week: ed.week || null,
                date: ed.date || new Date().toISOString().split('T')[0],
                best_of: ed.best_of || ed.games.length,
                games: ed.games.map(g => ({
                    winning_side: g.winning_side === 'left' ? 'order' : 'chaos',
                    order_players: g.left_players.map(p => ({
                        player_name: p.player_name,
                        god_played: p.god_played,
                        kills: p.kills || 0,
                        deaths: p.deaths || 0,
                        assists: p.assists || 0,
                        damage: p.player_damage || 0,
                        mitigated: p.mitigated || 0,
                        structure_damage: p.structure_damage || 0,
                        gpm: p.gpm || 0,
                        league_player_id: p.matched_lp_id || null,
                    })),
                    chaos_players: g.right_players.map(p => ({
                        player_name: p.player_name,
                        god_played: p.god_played,
                        kills: p.kills || 0,
                        deaths: p.deaths || 0,
                        assists: p.assists || 0,
                        damage: p.player_damage || 0,
                        mitigated: p.mitigated || 0,
                        structure_damage: p.structure_damage || 0,
                        gpm: p.gpm || 0,
                        league_player_id: p.matched_lp_id || null,
                    })),
                })),
            }

            const res = await fetch(`${API}/admin-write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

            setSubmitResults(prev => ({ ...prev, [id]: { success: true, data } }))
            updateReport(id, { status: 'submitted', error: null })
        } catch (err) {
            setSubmitResults(prev => ({ ...prev, [id]: { success: false, error: err.message } }))
            updateReport(id, { error: err.message })
        } finally {
            setSubmitting(prev => ({ ...prev, [id]: false }))
        }
    }, [updateReport])

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

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Match Admin</h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        Paste match text + DETAILS screenshots → AI extracts → Review & edit → Submit
                    </p>
                </div>
                <Link to="/" className="text-sm text-[var(--color-accent)] hover:underline">← Home</Link>
            </div>

            {adminError && <ErrorBanner message={`Admin data: ${adminError}`} className="mb-4" />}

            {/* Action bar */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={addMatchReport}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 transition-opacity">
                        + New Match
                    </button>

                    {counts.pending > 0 && (
                        <button onClick={processAll} disabled={processing}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                            {processing ? 'Processing…' : `Extract ${counts.pending} Pending`}
                        </button>
                    )}

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
                    />
                ))}
            </div>

            {/* Empty state */}
            {matchReports.length === 0 && (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4 opacity-50">📋</div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">No match reports</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm mb-6">
                        Add a match, paste the Discord text and DETAILS tab screenshots, then extract & submit.
                    </p>
                    <button onClick={addMatchReport}
                            className="px-6 py-3 rounded-xl font-semibold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 transition-opacity">
                        + New Match
                    </button>
                </div>
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
            winning_side: gw?.winning_side || null,
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
        best_of: meta?.best_of || games.length || 3,
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
                         }) {
    const [expanded, setExpanded] = useState(true)
    const [pasteFlash, setPasteFlash] = useState(false)
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

    // Display info
    const meta = report.result?.match_meta
    const team1 = adminData?.teams?.find(t => String(t.team_id) === String(ed?.team1_id))
    const team2 = adminData?.teams?.find(t => String(t.team_id) === String(ed?.team2_id))
    const t1Wins = ed?.games?.filter(g => g.winning_side === 'left').length || 0
    const t2Wins = ed?.games?.filter(g => g.winning_side === 'right').length || 0

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
                    {/* PENDING: text + screenshots input */}
                    {(isPending || isProcessing) && (
                        <div className="p-4 space-y-4">
                            {/* Match text */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                                    Match report text (Discord message)
                                </label>
                                <textarea
                                    value={report.text}
                                    onChange={e => onUpdateText(e.target.value)}
                                    placeholder='e.g. "@Team Alpha vs @Team Beta — Alpha wins 2-1"'
                                    className="w-full px-3 py-2 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 border"
                                    style={{
                                        backgroundColor: 'var(--color-card, #1e1e2e)',
                                        color: 'var(--color-text, #e0e0e0)',
                                        borderColor: 'var(--color-border, #333)',
                                    }}
                                    disabled={isProcessing}
                                />
                            </div>

                            {/* Image upload */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                                    DETAILS tab screenshots ({liveImages.length} game{liveImages.length !== 1 ? 's' : ''})
                                </label>
                                {isPending && (
                                    <div
                                        className="border border-dashed border-[var(--color-border)] rounded-lg p-6 text-center hover:border-[var(--color-accent)]/40 transition-colors cursor-pointer mb-3"
                                        onDragOver={e => e.preventDefault()} onDrop={handleDrop}
                                        onClick={() => document.getElementById(`file-${report.id}`).click()}
                                    >
                                        <input id={`file-${report.id}`} type="file" multiple accept="image/*" className="hidden"
                                               onChange={e => { onAddImages(e.target.files); e.target.value = '' }} />
                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                            Drop screenshots, click to browse, or <span className="text-[var(--color-accent)] font-medium">Ctrl+V</span> to paste
                                        </p>
                                    </div>
                                )}
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
                            </div>

                            {/* Process button */}
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
    const ed = editData
    if (!ed) return null

    const teamsForSeason = adminData?.teams?.filter(t => String(t.season_id) === String(ed.season_id)) || []
    const team1 = teamsForSeason.find(t => String(t.team_id) === String(ed.team1_id))
    const team2 = teamsForSeason.find(t => String(t.team_id) === String(ed.team2_id))

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

    return (
        <div>
            {/* ─── Match metadata fields ─── */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <FieldSelect label="Season" value={ed.season_id || ''}
                             onChange={v => onChange({ ...ed, season_id: v ? parseInt(v) : null, team1_id: null, team2_id: null })}
                             options={(adminData?.seasons || []).map(s => ({ value: s.season_id, label: `${s.league_name} / ${s.division_name}` }))} />
                <FieldSelect label="Team 1 (Order/Left)" value={ed.team1_id || ''}
                             onChange={v => updateField('team1_id', v ? parseInt(v) : null)}
                             options={teamsForSeason.map(t => ({ value: t.team_id, label: t.team_name }))}
                             color={team1?.color} />
                <FieldSelect label="Team 2 (Chaos/Right)" value={ed.team2_id || ''}
                             onChange={v => updateField('team2_id', v ? parseInt(v) : null)}
                             options={teamsForSeason.filter(t => String(t.team_id) !== String(ed.team1_id)).map(t => ({ value: t.team_id, label: t.team_name }))}
                             color={team2?.color} />
                <FieldInput label="Date" type="date" value={ed.date || ''} onChange={v => updateField('date', v)} />
                <FieldInput label="Week" type="number" value={ed.week || ''} onChange={v => updateField('week', v ? parseInt(v) : null)} />
                <FieldInput label="Best Of" type="number" value={ed.best_of || ''} onChange={v => updateField('best_of', v ? parseInt(v) : null)} />
            </div>

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
                <div className="flex gap-1">
                    {ed.games.map((game, idx) => (
                        <button key={idx} onClick={() => setActiveGame(idx)}
                                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                                    activeGame === idx
                                        ? 'bg-[var(--color-card)] text-[var(--color-text)] border border-b-0 border-[var(--color-border)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                }`}>
                            Game {idx + 1}
                            {game.winning_side && (
                                <span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${
                                    game.winning_side === 'left' ? 'bg-blue-400' : 'bg-red-400'
                                }`} />
                            )}
                        </button>
                    ))}
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
            {/* Winner selector */}
            <div className="px-4 py-3 flex items-center gap-4 bg-[var(--color-card)]/50">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">Winner:</span>
                <div className="flex gap-2">
                    <WinnerButton label={team1?.team_name || 'Team 1'} color="blue"
                                  isActive={game.winning_side === 'left'}
                                  onClick={() => onChange({ ...game, winning_side: 'left' })} />
                    <WinnerButton label={team2?.team_name || 'Team 2'} color="red"
                                  isActive={game.winning_side === 'right'}
                                  onClick={() => onChange({ ...game, winning_side: 'right' })} />
                    {game.winning_side && (
                        <button onClick={() => onChange({ ...game, winning_side: null })}
                                className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-red-400">Clear</button>
                    )}
                </div>
            </div>

            {/* Player tables */}
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
                    isWinner={game.winning_side === 'left'}
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
                    isWinner={game.winning_side === 'right'}
                />
            </div>
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
                headers: { 'Content-Type': 'application/json' },
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
    const containerRef = useRef(null)
    const inputRef = useRef(null)

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
                    }}
                    className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] transition-colors"
                />
            </div>

            {showDropdown && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-56 border rounded shadow-xl max-h-56 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {query === '' && (
                        <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]/50 sticky top-0"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)' }}>
                            All gods — type to filter
                        </div>
                    )}
                    {filtered.map(god => (
                        <button key={god.id}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                onMouseDown={e => e.preventDefault()}
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