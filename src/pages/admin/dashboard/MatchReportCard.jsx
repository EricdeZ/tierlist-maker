import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Link } from 'react-router-dom'
import FloatingImageViewer from '../../../components/admin/FloatingImageViewer'
import { API, groupDiscordItems, timeAgo } from './constants'
import { RadioOption, StatusBadge, ErrorBanner } from './FormControls'
import { EditableMatchData } from './EditableMatchData'


// ═══════════════════════════════════════════════════
// READY REPORT IMAGE SELECTOR
// ═══════════════════════════════════════════════════
export function ReadyReportImageSelector({ queueItems, onLoadImages }) {
    const [selected, setSelected] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const toggle = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }))
    const selectAll = () => {
        const allSelected = queueItems.every(q => selected[q.id])
        const next = {}
        queueItems.forEach(q => { next[q.id] = !allSelected })
        setSelected(next)
    }

    const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number)
    const selectedCount = selectedIds.length

    const handleExtract = async () => {
        if (!selectedCount) return
        setLoading(true)
        setError(null)
        try {
            const result = await onLoadImages(selectedIds)
            if (!result?.success) throw new Error(result?.error || 'Failed to load images')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="border border-green-500/20 rounded-lg overflow-hidden">
            {/* Disclaimer */}
            <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
                <p className="text-xs text-amber-300 font-medium">
                    Select only DETAILS page screenshots for AI extraction.
                </p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">
                    Overview and lobby screenshots will waste AI processing. Each game has a Details tab — select those.
                </p>
            </div>

            {/* Image grid */}
            <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                        {queueItems.length} screenshot{queueItems.length !== 1 ? 's' : ''} matched
                    </span>
                    <button
                        onClick={selectAll}
                        className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
                    >
                        {queueItems.every(q => selected[q.id]) ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {queueItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => toggle(item.id)}
                            className={`relative aspect-[16/10] rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                                selected[item.id]
                                    ? 'border-green-500 ring-1 ring-green-500/30'
                                    : 'border-transparent hover:border-white/20'
                            }`}
                        >
                            <img
                                src={`${API}/discord-image?queueId=${item.id}&token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={e => { e.target.style.display = 'none' }}
                            />
                            {selected[item.id] && (
                                <div className="absolute inset-0 bg-green-600/30 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 6l3 3 5-5" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {error && (
                <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20">
                    {error}
                </div>
            )}

            {/* Action footer */}
            <div className="px-3 py-2.5 border-t border-white/10 flex items-center justify-end">
                <button
                    onClick={handleExtract}
                    disabled={!selectedCount || loading}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    {loading ? 'Loading...' : `Extract ${selectedCount || ''} Screenshot${selectedCount !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// MATCH REPORT CARD (one card = one BO series)
// ═══════════════════════════════════════════════════
export function MatchReportCard({
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
    const [showImageViewer, setShowImageViewer] = useState(false)
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

    const discordSelectedIds = Object.entries(discordSelectedImages)
        .filter(([, v]) => v)
        .sort(([, a], [, b]) => a - b)
        .map(([k]) => Number(k))
    const discordSelectedCount = discordSelectedIds.length

    const toggleDiscordImage = (id) => setDiscordSelectedImages(prev => {
        if (prev[id]) {
            const removed = prev[id]
            const next = { ...prev }
            delete next[id]
            for (const k in next) {
                if (next[k] > removed) next[k]--
            }
            return next
        }
        const max = Math.max(0, ...Object.values(prev).filter(Boolean))
        return { ...prev, [id]: max + 1 }
    })
    const toggleDiscordGroup = (group) => {
        const allSelected = group.items.every(item => discordSelectedImages[item.id])
        if (allSelected) {
            // Deselect all in group, renumber remaining
            const toRemove = new Set(group.items.map(item => item.id))
            const next = {}
            const remaining = Object.entries(discordSelectedImages)
                .filter(([k, v]) => v && !toRemove.has(Number(k)))
                .sort(([, a], [, b]) => a - b)
            remaining.forEach(([k], i) => { next[k] = i + 1 })
            setDiscordSelectedImages(next)
        } else {
            const next = { ...discordSelectedImages }
            let max = Math.max(0, ...Object.values(next).filter(Boolean))
            for (const item of group.items) {
                if (!next[item.id]) next[item.id] = ++max
            }
            setDiscordSelectedImages(next)
        }
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
                                {'\u00b7'} {ed.games.length}G Bo{ed.best_of} {'\u00b7'} {ed.date}
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
                            {'\u21bb'} Retry
                        </button>
                    )}
                    {report.status === 'error' && ed && (
                        <>
                            <button onClick={onRetry}
                                    className="px-3 py-1.5 text-xs rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors">
                                {'\u21bb'} Re-extract
                            </button>
                            <button onClick={onSubmit} disabled={isSubmitting}
                                    className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                                {isSubmitting ? 'Submitting\u2026' : 'Submit Anyway'}
                            </button>
                        </>
                    )}
                    {isReview && (
                        <>
                            {(liveImages.length > 0 || report.discordQueueItemIds?.length > 0) && (
                                <button onClick={() => setShowImageViewer(v => !v)}
                                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                                            showImageViewer
                                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10'
                                        }`}>
                                    {showImageViewer ? 'Hide' : 'View'} Screenshots
                                </button>
                            )}
                            <button onClick={onSubmit} disabled={isSubmitting}
                                    className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                                {isSubmitting ? 'Submitting\u2026' : 'Submit'}
                            </button>
                        </>
                    )}
                    <button onClick={() => setExpanded(!expanded)}
                            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                        {expanded ? '\u25be' : '\u25b8'}
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
                                className="text-[var(--color-text-secondary)] hover:text-red-400 transition-colors text-sm">{'\u2715'}</button>
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
                        <span>{'\u2713'} Submitted (Match ID: {submitResult.data?.match_id})</span>
                        {matchUrl && (
                            <Link to={matchUrl} className="underline hover:text-green-300 ml-2">
                                View Match {'\u2192'}
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
                            {/* ─── Ready Report: Image Selection Step ─── */}
                            {isPending && report._readyQueueItems?.length > 0 && liveImages.length === 0 && (
                                <ReadyReportImageSelector
                                    queueItems={report._readyQueueItems}
                                    onLoadImages={async (selectedItemIds) => {
                                        // Fetch selected images and add to report
                                        const result = await onAddDiscordImages(selectedItemIds)
                                        if (result?.success) {
                                            // Trigger extraction automatically
                                            setTimeout(() => onProcess(), 100)
                                        }
                                        return result
                                    }}
                                />
                            )}
                            {isPending && !(report._readyQueueItems?.length > 0 && liveImages.length === 0) && (
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
                                                                src={`${API}/discord-image?queueId=${item.id}&token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                                onError={e => { e.target.style.display = 'none' }}
                                                            />
                                                            {discordSelectedImages[item.id] && (
                                                                <>
                                                                    <div className="absolute inset-0 bg-blue-600/30 pointer-events-none" />
                                                                    <span className="absolute top-0 left-0 bg-blue-600/90 text-white text-[7px] font-bold px-0.5 rounded-br">
                                                                        GAME {discordSelectedImages[item.id]}
                                                                    </span>
                                                                </>
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
                                                    {'\u2715'}
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
                                    <span className="animate-spin">{'\u27f3'}</span> Extracting from {liveImages.length} screenshot{liveImages.length > 1 ? 's' : ''}{'\u2026'}
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

            {/* Floating screenshot viewer (portalled to body) */}
            {showImageViewer && (liveImages.length > 0 || report.discordQueueItemIds?.length > 0) && ReactDOM.createPortal(
                <FloatingImageViewer
                    images={liveImages}
                    queueItemIds={report.discordQueueItemIds || []}
                    onClose={() => setShowImageViewer(false)}
                />,
                document.body,
            )}
        </div>
    )
}
