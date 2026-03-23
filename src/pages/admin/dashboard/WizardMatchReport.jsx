import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { GodAutocomplete } from './GodAutocomplete'
import { ROLE_IMAGES, ROLE_LIST, API } from './constants'
import { getAuthHeaders } from '../../../services/adminApi.js'
import { AliasLinkModal } from './AliasLinkModal'
import FloatingImageViewer from '../../../components/admin/FloatingImageViewer'

const GAME_SUBSTEPS = ['winner', 'names', 'gods', 'roles', 'kda', 'damage', 'mitigated']
const SUBSTEP_LABELS = {
    winner: 'Winner', names: 'Player Names', gods: 'Gods',
    roles: 'Roles', kda: 'K/D/A', damage: 'Damage', mitigated: 'Mitigated',
}

// ═══════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════

export default function WizardMatchReport({
    matchInfo, editData, onUpdateEditData, onSwapTeams, adminData,
    queueItems, onExtract, onAddImages, onExtractPasted, status, error,
    onSubmit, isSubmitting, submitResult,
}) {
    const [stepIndex, setStepIndex] = useState(0)
    const [selections, setSelections] = useState({}) // { [pasteId|queueId]: gameNumber }
    const [pastedImages, setPastedImages] = useState([]) // { id, preview, file }
    const [viewerOpen, setViewerOpen] = useState(false)
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0)
    const prevStatusRef = useRef(status)

    // Build step list dynamically based on number of games
    const steps = useMemo(() => {
        const list = [
            { id: 'confirm', label: 'Confirm Match' },
            { id: 'screenshots', label: 'Select Screenshots' },
        ]
        const numGames = editData?.games?.length || 0
        if (numGames > 0) {
            list.push({ id: 'overview', label: 'Extraction Overview' })
            for (let g = 0; g < numGames; g++) {
                for (const sub of GAME_SUBSTEPS) {
                    list.push({
                        id: `game_${g}_${sub}`,
                        label: `Game ${g + 1} — ${SUBSTEP_LABELS[sub]}`,
                        gameIndex: g,
                        substep: sub,
                    })
                }
            }
            list.push({ id: 'review', label: 'Final Review' })
        }
        return list
    }, [editData?.games?.length])

    const step = steps[stepIndex] || steps[0]
    const progress = steps.length > 1 ? (stepIndex / (steps.length - 1)) * 100 : 0

    const next = useCallback(() => setStepIndex(i => Math.min(i + 1, steps.length - 1)), [steps.length])
    const prev = useCallback(() => setStepIndex(i => Math.max(i - 1, 0)), [steps.length])

    // Auto-advance from screenshots to overview after extraction
    useEffect(() => {
        if (prevStatusRef.current === 'processing' && status === 'review' && stepIndex === 1) {
            setStepIndex(2)
        }
        prevStatusRef.current = status
    }, [status, stepIndex])

    // Player update helper
    const updatePlayer = useCallback((gameIndex, side, playerIndex, updates) => {
        onUpdateEditData(prev => {
            const games = [...prev.games]
            const game = { ...games[gameIndex] }
            const key = side === 'left' ? 'left_players' : 'right_players'
            const players = [...game[key]]
            players[playerIndex] = { ...players[playerIndex], ...updates }
            game[key] = players
            games[gameIndex] = game
            return { ...prev, games }
        })
    }, [onUpdateEditData])

    const updateGame = useCallback((gameIndex, updates) => {
        onUpdateEditData(prev => {
            const games = [...prev.games]
            games[gameIndex] = { ...games[gameIndex], ...updates }
            return { ...prev, games }
        })
    }, [onUpdateEditData])

    // Unified toggle for both pasted and discord selections
    const toggleSelection = useCallback((key) => {
        setSelections(prev => {
            if (prev[key]) {
                const removed = prev[key]
                const next = { ...prev }
                delete next[key]
                for (const k in next) if (next[k] > removed) next[k]--
                return next
            }
            const max = Math.max(0, ...Object.values(prev).filter(Boolean))
            return { ...prev, [key]: max + 1 }
        })
    }, [])

    // Paste handler — auto-selects with next game numbers
    const handlePaste = useCallback((files) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (!imageFiles.length) return
        const newPasted = imageFiles.map((file, i) => ({
            id: `paste_${Date.now()}_${i}`,
            preview: URL.createObjectURL(file),
            file,
        }))
        setPastedImages(prev => [...prev, ...newPasted])
        // Auto-select with next game numbers
        setSelections(prev => {
            const next = { ...prev }
            let max = Math.max(0, ...Object.values(next).filter(Boolean))
            for (const img of newPasted) next[img.id] = ++max
            return next
        })
    }, [])

    const removePastedImage = useCallback((id) => {
        setPastedImages(prev => {
            const img = prev.find(p => p.id === id)
            if (img?.preview) URL.revokeObjectURL(img.preview)
            return prev.filter(p => p.id !== id)
        })
        // Also deselect
        setSelections(prev => {
            if (!prev[id]) return prev
            const removed = prev[id]
            const next = { ...prev }
            delete next[id]
            for (const k in next) if (next[k] > removed) next[k]--
            return next
        })
    }, [])

    // Derive selected IDs sorted by game number — split into pasted and discord
    const pastedIds = useMemo(() => new Set(pastedImages.map(p => p.id)), [pastedImages])

    const selectedDiscordIds = useMemo(() =>
        Object.entries(selections)
            .filter(([k, v]) => v && !pastedIds.has(k))
            .sort(([, a], [, b]) => a - b)
            .map(([k]) => Number(k)),
        [selections, pastedIds],
    )

    const selectedPastedInOrder = useMemo(() =>
        Object.entries(selections)
            .filter(([k, v]) => v && pastedIds.has(k))
            .sort(([, a], [, b]) => a - b)
            .map(([k]) => pastedImages.find(p => p.id === k))
            .filter(Boolean),
        [selections, pastedIds, pastedImages],
    )

    const selectedCount = useMemo(() =>
        Object.values(selections).filter(Boolean).length,
        [selections],
    )

    // Handle extract — add selected pasted files to liveRef, then process
    const handleExtract = useCallback(async () => {
        if (selectedPastedInOrder.length > 0) {
            onAddImages(selectedPastedInOrder.map(p => p.file))
        }
        if (selectedDiscordIds.length > 0) {
            await onExtract(selectedDiscordIds)
        } else if (selectedPastedInOrder.length > 0) {
            await onExtractPasted()
        }
    }, [selectedPastedInOrder, selectedDiscordIds, onAddImages, onExtract, onExtractPasted])

    // All images for viewer: selected pasted, selected discord, other discord
    const allViewerImages = useMemo(() => {
        const token = encodeURIComponent(localStorage.getItem('auth_token') || '')
        const pastedImgs = selectedPastedInOrder.map(p => ({ id: p.id, preview: p.preview }))
        const selectedImgs = selectedDiscordIds.map(qId => ({
            id: `q_${qId}`,
            preview: `${API}/discord-image?queueId=${qId}&token=${token}`,
        }))
        const otherImgs = queueItems
            .filter(q => !selectedDiscordIds.includes(q.id))
            .map(q => ({
                id: `q_${q.id}`,
                preview: `${API}/discord-image?queueId=${q.id}&token=${token}`,
            }))
        return [...pastedImgs, ...selectedImgs, ...otherImgs]
    }, [selectedPastedInOrder, selectedDiscordIds, queueItems])

    const openViewer = useCallback((initialIndex = 0) => {
        setViewerInitialIndex(initialIndex)
        setViewerOpen(true)
    }, [])

    // Team info helpers
    const team1Name = editData?.team1_name || matchInfo?.team1_name || 'Team 1'
    const team2Name = editData?.team2_name || matchInfo?.team2_name || 'Team 2'
    const team1Color = matchInfo?.team1_color || '#3b82f6'
    const team2Color = matchInfo?.team2_color || '#ef4444'
    const team1Id = editData?.team1_id || matchInfo?.team1_id
    const team2Id = editData?.team2_id || matchInfo?.team2_id

    // ─── Render current step content ───
    const renderStep = () => {
        if (step.id === 'confirm') {
            return <ConfirmStep matchInfo={matchInfo} onConfirm={next} />
        }

        if (step.id === 'screenshots') {
            return (
                <ScreenshotsStep
                    queueItems={queueItems}
                    selections={selections}
                    onToggle={toggleSelection}
                    onSelectAll={() => {
                        const allSelected = queueItems.every(q => selections[q.id])
                        if (allSelected) {
                            // Remove all discord selections, keep pasted
                            setSelections(prev => {
                                const next = {}
                                const removed = []
                                for (const [k, v] of Object.entries(prev)) {
                                    if (pastedIds.has(k)) next[k] = v
                                    else removed.push(v)
                                }
                                // Renumber pasted to fill gaps
                                const entries = Object.entries(next).sort(([, a], [, b]) => a - b)
                                const renumbered = {}
                                entries.forEach(([k], i) => { renumbered[k] = i + 1 })
                                return renumbered
                            })
                        } else {
                            setSelections(prev => {
                                const next = { ...prev }
                                let max = Math.max(0, ...Object.values(next).filter(Boolean))
                                queueItems.forEach(q => { if (!next[q.id]) next[q.id] = ++max })
                                return next
                            })
                        }
                    }}
                    pastedImages={pastedImages}
                    onPaste={handlePaste}
                    onRemovePasted={removePastedImage}
                    onExtract={handleExtract}
                    extracting={status === 'processing'}
                    error={error}
                    selectedCount={selectedCount}
                />
            )
        }

        if (step.id === 'overview') {
            return (
                <OverviewStep
                    editData={editData}
                    team1Name={team1Name} team2Name={team2Name}
                    team1Id={team1Id} team2Id={team2Id}
                    selectedPasted={selectedPastedInOrder}
                    selectedDiscordIds={selectedDiscordIds}
                    queueItems={queueItems}
                    onViewScreenshot={openViewer}
                    onStartAudit={next}
                />
            )
        }

        if (step.id === 'review') {
            return (
                <ReviewStep
                    editData={editData}
                    team1Name={team1Name} team2Name={team2Name}
                    team1Color={team1Color} team2Color={team2Color}
                    team1Id={team1Id} team2Id={team2Id}
                    adminData={adminData}
                    onSubmit={onSubmit}
                    isSubmitting={isSubmitting}
                    submitResult={submitResult}
                />
            )
        }

        // Game substeps
        const { gameIndex, substep } = step
        const game = editData?.games?.[gameIndex]
        if (!game) return null

        const gameProps = {
            game, gameIndex, substep,
            team1Name, team2Name, team1Color, team2Color, team1Id, team2Id,
            adminData, updatePlayer, updateGame, onNext: next, onSwapTeams,
            seasonId: matchInfo?.season_id || editData?.season_id,
        }

        const substepContent = (() => {
            switch (substep) {
                case 'winner': return <WinnerStep {...gameProps} />
                case 'names': return <NamesStep {...gameProps} />
                case 'gods': return <GodsStep {...gameProps} />
                case 'roles': return <RolesStep {...gameProps} />
                case 'kda': return <KDAStep {...gameProps} />
                case 'damage': return <DamageStep {...gameProps} />
                case 'mitigated': return <MitigatedStep {...gameProps} />
                default: return null
            }
        })()

        return (
            <div>
                <GameScreenshotBar
                    gameIndex={gameIndex}
                    selectedPasted={selectedPastedInOrder}
                    selectedDiscordIds={selectedDiscordIds}
                    queueItems={queueItems}
                    onViewScreenshot={openViewer}
                />
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team1Color }} />
                        <span className="text-xs font-semibold text-[var(--color-text)]">{team1Name}</span>
                    </div>
                    <button
                        onClick={onSwapTeams}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition"
                        title="Swap team sides"
                    >
                        &#8644;
                    </button>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team2Color }} />
                        <span className="text-xs font-semibold text-[var(--color-text)]">{team2Name}</span>
                    </div>
                </div>
                {substepContent}
            </div>
        )
    }

    return (
        <>
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                {/* Progress bar */}
                <div className="h-1 bg-white/5">
                    <div
                        className="h-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Step indicator */}
                <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                    <div>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Step {stepIndex + 1} of {steps.length}
                        </span>
                        <h2 className="text-lg font-bold text-[var(--color-text)]">{step.label}</h2>
                    </div>
                    {stepIndex > 0 && step.id !== 'screenshots' && (
                        <button
                            onClick={prev}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
                        >
                            &larr; Back
                        </button>
                    )}
                </div>

                {/* Step content */}
                <div className="px-6 pb-6">
                    {renderStep()}
                </div>
            </div>

            {viewerOpen && allViewerImages.length > 0 && (
                <FloatingImageViewer
                    images={allViewerImages}
                    onClose={() => setViewerOpen(false)}
                    initialIndex={viewerInitialIndex}
                />
            )}
        </>
    )
}


// ═══════════════════════════════════════════════════
// STEP: CONFIRM MATCH
// ═══════════════════════════════════════════════════

function ConfirmStep({ matchInfo, onConfirm }) {
    return (
        <div className="py-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
                <div className="text-right">
                    <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ backgroundColor: matchInfo.team1_color }} />
                    <span className="text-xl font-bold text-[var(--color-text)]">{matchInfo.team1_name}</span>
                </div>
                <span className="text-xl font-bold text-[var(--color-text-secondary)]">vs</span>
                <div className="text-left">
                    <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ backgroundColor: matchInfo.team2_color }} />
                    <span className="text-xl font-bold text-[var(--color-text)]">{matchInfo.team2_name}</span>
                </div>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] mb-8 space-y-1">
                <p>{matchInfo.division_name} &middot; {matchInfo.league_name}</p>
                {matchInfo.week && <p>Week {matchInfo.week}</p>}
                {matchInfo.scheduled_date && <p>{new Date(matchInfo.scheduled_date).toLocaleDateString()}</p>}
                <p>Best of {matchInfo.best_of}</p>
            </div>
            <button
                onClick={onConfirm}
                className="px-8 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 transition"
            >
                Confirm &amp; Continue
            </button>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: SELECT SCREENSHOTS
// ═══════════════════════════════════════════════════

function ScreenshotsStep({ queueItems, selections, onToggle, onSelectAll, pastedImages, onPaste, onRemovePasted, onExtract, extracting, error, selectedCount }) {
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef(null)

    // Global paste listener
    useEffect(() => {
        const handler = (e) => {
            const files = e.clipboardData?.files
            if (files?.length) {
                e.preventDefault()
                onPaste(files)
            }
        }
        window.addEventListener('paste', handler)
        return () => window.removeEventListener('paste', handler)
    }, [onPaste])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        const files = e.dataTransfer?.files
        if (files?.length) onPaste(files)
    }, [onPaste])

    if (extracting) {
        return (
            <div className="py-16 text-center">
                <div className="inline-block w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-[var(--color-text-secondary)]">Extracting match data from screenshots...</p>
            </div>
        )
    }

    return (
        <div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                <p className="text-xs text-amber-300 font-medium">
                    Select only DETAILS page screenshots for AI extraction.
                </p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">
                    Overview and lobby screenshots will waste AI processing.
                </p>
            </div>

            {/* Paste / drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mb-4 border-2 border-dashed rounded-lg px-4 py-3 text-center cursor-pointer transition ${
                    dragOver
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                        : 'border-[var(--color-border)] hover:border-white/30'
                }`}
            >
                <p className="text-xs text-[var(--color-text-secondary)]">
                    Paste, drop, or click to add screenshots
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files?.length) { onPaste(e.target.files); e.target.value = '' } }}
                />
            </div>

            {/* Pasted images */}
            {pastedImages.length > 0 && (
                <div className="mb-4">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
                        Pasted screenshots ({pastedImages.length})
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {pastedImages.map((img) => {
                            const gameNum = selections[img.id]
                            return (
                                <div
                                    key={img.id}
                                    onClick={() => onToggle(img.id)}
                                    className={`relative aspect-[16/10] rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                                        gameNum
                                            ? 'border-green-500 ring-1 ring-green-500/30'
                                            : 'border-transparent hover:border-white/20'
                                    }`}
                                >
                                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                    {gameNum && (
                                        <>
                                            <div className="absolute inset-0 bg-green-600/20 pointer-events-none" />
                                            <span className="absolute top-0.5 left-0.5 bg-green-600/90 text-white text-[9px] font-bold px-1 rounded">
                                                GAME {gameNum}
                                            </span>
                                        </>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemovePasted(img.id) }}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white/80 hover:text-white flex items-center justify-center text-[10px] leading-none"
                                    >
                                        &times;
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Discord queue items */}
            {queueItems.length > 0 && (
                <>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            {queueItems.length} from Discord
                        </span>
                        <button onClick={onSelectAll} className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition">
                            {queueItems.every(q => selections[q.id]) ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-6">
                        {queueItems.map(item => {
                            const gameNum = selections[item.id]
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onToggle(item.id)}
                                    className={`relative aspect-[16/10] rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                                        gameNum
                                            ? 'border-green-500 ring-1 ring-green-500/30'
                                            : 'border-transparent hover:border-white/20'
                                    }`}
                                >
                                    <img
                                        src={`${API}/discord-image?queueId=${item.id}&token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                                        alt="" className="w-full h-full object-cover" loading="lazy"
                                        onError={e => { e.target.style.display = 'none' }}
                                    />
                                    {gameNum && (
                                        <>
                                            <div className="absolute inset-0 bg-green-600/30 pointer-events-none" />
                                            <span className="absolute top-0.5 left-0.5 bg-green-600/90 text-white text-[9px] font-bold px-1 rounded">
                                                GAME {gameNum}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {error && (
                <div className="mb-4 px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={onExtract}
                    disabled={!selectedCount}
                    className="px-8 py-3 rounded-xl text-sm font-bold bg-[var(--color-accent)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    Extract {selectedCount} Screenshot{selectedCount !== 1 ? 's' : ''}
                </button>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: OVERVIEW
// ═══════════════════════════════════════════════════

function OverviewStep({ editData, team1Name, team2Name, team1Id, team2Id, selectedPasted, selectedDiscordIds, queueItems, onViewScreenshot, onStartAudit }) {
    const games = editData?.games || []
    const token = useMemo(() => encodeURIComponent(localStorage.getItem('auth_token') || ''), [])
    const imgUrl = (qId) => `${API}/discord-image?queueId=${qId}&token=${token}`
    const otherScreenshots = queueItems.filter(q => !selectedDiscordIds.includes(q.id))
    const pastedCount = selectedPasted.length

    return (
        <div className="py-4">
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {games.length} game{games.length !== 1 ? 's' : ''} extracted. Review the summary below, then start the audit.
            </p>
            <div className="space-y-3 mb-6">
                {games.map((g, i) => {
                    const winnerId = g.winning_team_id
                    const winnerName = String(winnerId) === String(team1Id) ? team1Name : String(winnerId) === String(team2Id) ? team2Name : 'Not set'
                    const leftCount = (g.left_players || []).filter(p => p.matched_lp_id).length
                    const rightCount = (g.right_players || []).filter(p => p.matched_lp_id).length
                    const totalPlayers = (g.left_players?.length || 0) + (g.right_players?.length || 0)
                    const matchedCount = leftCount + rightCount
                    const isPasted = i < pastedCount
                    const screenshotSrc = isPasted
                        ? selectedPasted[i]?.preview
                        : (() => { const qId = selectedDiscordIds[i - pastedCount]; return qId ? imgUrl(qId) : null })()
                    return (
                        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/3 border border-[var(--color-border)]">
                            {screenshotSrc && (
                                <button
                                    onClick={() => onViewScreenshot(i)}
                                    className="w-16 aspect-[16/10] rounded overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition shrink-0"
                                >
                                    <img src={screenshotSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </button>
                            )}
                            <span className="text-sm font-bold text-[var(--color-text)] w-16 shrink-0">Game {i + 1}</span>
                            <span className={`text-xs ${winnerId ? 'text-green-400' : 'text-red-400'}`}>
                                {winnerId ? `${winnerName} wins` : 'No winner'}
                            </span>
                            <span className={`text-xs ml-auto ${matchedCount === totalPlayers ? 'text-green-400' : 'text-amber-400'}`}>
                                {matchedCount}/{totalPlayers} matched
                            </span>
                        </div>
                    )
                })}
            </div>

            {otherScreenshots.length > 0 && (
                <div className="mb-6">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
                        Other matched screenshots
                    </span>
                    <div className="flex gap-2 flex-wrap">
                        {otherScreenshots.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={() => onViewScreenshot(pastedCount + selectedDiscordIds.length + idx)}
                                className="w-20 aspect-[16/10] rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-white/30 transition opacity-60 hover:opacity-100"
                            >
                                <img src={imgUrl(item.id)} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={onStartAudit}
                    className="px-8 py-3 rounded-xl text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-500 transition"
                >
                    Start Audit
                </button>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME SCREENSHOT BAR
// ═══════════════════════════════════════════════════

function GameScreenshotBar({ gameIndex, selectedPasted, selectedDiscordIds, queueItems, onViewScreenshot }) {
    const token = useMemo(() => encodeURIComponent(localStorage.getItem('auth_token') || ''), [])
    const imgUrl = (qId) => `${API}/discord-image?queueId=${qId}&token=${token}`

    // Game screenshots: pasted images first, then selected queue items
    const pastedCount = selectedPasted.length
    const isPasted = gameIndex < pastedCount
    const gameScreenshotSrc = isPasted
        ? selectedPasted[gameIndex]?.preview
        : (() => { const qId = selectedDiscordIds[gameIndex - pastedCount]; return qId ? imgUrl(qId) : null })()

    const otherScreenshots = queueItems.filter(q => !selectedDiscordIds.includes(q.id))
    const totalExtracted = pastedCount + selectedDiscordIds.length

    if (!gameScreenshotSrc && !otherScreenshots.length) return null

    return (
        <div className="mb-5 pb-4 border-b border-[var(--color-border)]">
            <div className="flex items-start gap-4">
                {gameScreenshotSrc && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                            Game {gameIndex + 1} screenshot
                        </span>
                        <button
                            onClick={() => onViewScreenshot(gameIndex)}
                            className="relative w-44 aspect-[16/10] rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition group"
                        >
                            <img src={gameScreenshotSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition">
                                <span className="text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition bg-black/50 px-2 py-0.5 rounded">
                                    Click to zoom
                                </span>
                            </div>
                        </button>
                    </div>
                )}

                {otherScreenshots.length > 0 && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                            Other screenshots
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                            {otherScreenshots.map((item, idx) => (
                                <button
                                    key={item.id}
                                    onClick={() => onViewScreenshot(totalExtracted + idx)}
                                    className="w-16 aspect-[16/10] rounded overflow-hidden border border-[var(--color-border)] hover:border-white/30 transition opacity-50 hover:opacity-100"
                                >
                                    <img src={imgUrl(item.id)} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: WINNER
// ═══════════════════════════════════════════════════

function WinnerStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, team1Id, team2Id, updateGame, onNext }) {
    const winnerId = game.winning_team_id
    return (
        <div className="py-8 text-center">
            <p className="text-sm text-[var(--color-text-secondary)] mb-8">Who won this game?</p>
            <div className="flex items-center justify-center gap-6 mb-8">
                <button
                    onClick={() => updateGame(gameIndex, { winning_team_id: team1Id })}
                    className={`px-8 py-5 rounded-xl text-lg font-bold border-2 transition-all ${
                        String(winnerId) === String(team1Id)
                            ? 'border-green-500 bg-green-500/15 text-white scale-105 ring-2 ring-green-500/30'
                            : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-white/40 hover:scale-102'
                    }`}
                >
                    <span className="inline-block w-4 h-4 rounded-full mr-2" style={{ backgroundColor: team1Color }} />
                    {team1Name}
                </button>
                <button
                    onClick={() => updateGame(gameIndex, { winning_team_id: team2Id })}
                    className={`px-8 py-5 rounded-xl text-lg font-bold border-2 transition-all ${
                        String(winnerId) === String(team2Id)
                            ? 'border-green-500 bg-green-500/15 text-white scale-105 ring-2 ring-green-500/30'
                            : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-white/40 hover:scale-102'
                    }`}
                >
                    <span className="inline-block w-4 h-4 rounded-full mr-2" style={{ backgroundColor: team2Color }} />
                    {team2Name}
                </button>
            </div>
            <button
                onClick={onNext}
                disabled={!winnerId}
                className="px-8 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
                Correct &rarr;
            </button>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: NAMES
// ═══════════════════════════════════════════════════

function PlayerNameInput({ player, onChange, rosterPlayers, adminData, seasonId }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [showAliasModal, setShowAliasModal] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const filtered = useMemo(() => {
        const q = (query || player.player_name || '').toLowerCase()
        if (!q) return rosterPlayers.slice(0, 12)
        return rosterPlayers.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.team_name?.toLowerCase().includes(q)
        ).slice(0, 12)
    }, [query, player.player_name, rosterPlayers])

    const statusDot = player.matched_lp_id
        ? 'bg-green-500' // matched
        : player.is_sub
            ? 'bg-amber-500' // sub
            : 'bg-red-500' // unknown

    // Show original OCR name when it differs from the resolved player_name
    const wasResolved = player.original_name && player.original_name !== player.player_name

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={open ? query : player.player_name}
                        onChange={e => { setQuery(e.target.value); setOpen(true) }}
                        onFocus={() => { setQuery(player.player_name || ''); setOpen(true) }}
                        className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-sm text-[var(--color-text)] transition-colors py-1"
                    />
                    {wasResolved && (
                        <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-1">
                            <span>extracted: {player.original_name}</span>
                            {player.match_source === 'alias' && (
                                <span className="text-blue-400/70">(alias)</span>
                            )}
                            {player.match_source === 'fuzzy' && (
                                <span className="text-amber-400/70">(fuzzy)</span>
                            )}
                        </div>
                    )}
                    {!player.matched_lp_id && !open && (
                        <div className="flex items-center gap-1 mt-0.5">
                            {player.is_sub && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">
                                    {player.sub_type === 'new' ? 'NEW RULE 0-SUB' : 'RULE 0-SUB'}
                                </span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAliasModal(true) }}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors font-semibold"
                                title={`Link "${player.original_name || player.player_name}" as alias for an existing player`}
                            >
                                Link Alias
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {open && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-64 border rounded-lg shadow-xl max-h-48 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {filtered.map(p => (
                        <button
                            key={p.league_player_id}
                            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--color-accent)]/10 transition"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                                onChange({
                                    player_name: p.name,
                                    matched_name: p.name,
                                    matched_lp_id: p.league_player_id,
                                    is_sub: false,
                                    sub_type: null,
                                })
                                setOpen(false)
                            }}
                        >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.team_color || '#666' }} />
                            <span className="text-[var(--color-text)]">{p.name}</span>
                            <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{p.team_name}</span>
                        </button>
                    ))}
                </div>
            )}
            {showAliasModal && ReactDOM.createPortal(
                <AliasLinkModal
                    extractedName={player.original_name || player.player_name}
                    adminData={adminData}
                    seasonId={seasonId}
                    onSave={(selectedPlayer) => {
                        onChange({
                            player_name: selectedPlayer.name,
                            matched_name: selectedPlayer.name,
                            matched_lp_id: selectedPlayer.league_player_id || selectedPlayer.player_id,
                            is_sub: false,
                            sub_type: null,
                            match_source: 'alias',
                        })
                        setShowAliasModal(false)
                    }}
                    onClose={() => setShowAliasModal(false)}
                />,
                document.body
            )}
        </div>
    )
}

function NamesStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, seasonId, updatePlayer, onNext }) {
    const rosterPlayers = adminData?.players || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <PlayerNameInput
                            key={i} player={p} rosterPlayers={rosterPlayers}
                            adminData={adminData} seasonId={seasonId}
                            onChange={updates => updatePlayer(gameIndex, 'left', i, updates)}
                        />
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <PlayerNameInput
                            key={i} player={p} rosterPlayers={rosterPlayers}
                            adminData={adminData} seasonId={seasonId}
                            onChange={updates => updatePlayer(gameIndex, 'right', i, updates)}
                        />
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-1.5">
                <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Matched to roster — still verify it's correct</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Sub (not on this team's roster)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> Unmatched — click to search roster</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)]">
                    When <span className="text-[var(--color-text)]">extracted: OCR Name</span> appears below, the name was auto-corrected from the screenshot. <span className="text-blue-400/70">(alias)</span> = matched via alias, <span className="text-amber-400/70">(fuzzy)</span> = matched via similar spelling.
                </p>
            </div>
        </div>
    )
}


// ─── Reusable player label with god icon ───

function PlayerLabel({ player, gods, className = 'w-24' }) {
    const godImg = player.god_played && gods?.find(g => g.name === player.god_played)?.image_url
    return (
        <div className={`flex items-center gap-1.5 shrink-0 min-w-0 ${className}`}>
            {godImg ? (
                <img src={godImg} alt="" className="w-4 h-4 rounded-sm shrink-0" />
            ) : (
                <span className="w-4 h-4 shrink-0" />
            )}
            <span className="text-xs text-[var(--color-text)] truncate">{player.player_name}</span>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: GODS
// ═══════════════════════════════════════════════════

function GodsStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const gods = adminData?.gods || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                            <PlayerLabel player={p} gods={gods} />
                            <div className="flex-1">
                                <GodAutocomplete
                                    value={p.god_played || ''}
                                    gods={gods}
                                    onChange={updates => updatePlayer(gameIndex, 'left', i, updates)}
                                />
                            </div>
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                            <PlayerLabel player={p} gods={gods} />
                            <div className="flex-1">
                                <GodAutocomplete
                                    value={p.god_played || ''}
                                    gods={gods}
                                    onChange={updates => updatePlayer(gameIndex, 'right', i, updates)}
                                />
                            </div>
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: ROLES
// ═══════════════════════════════════════════════════

function RolePicker({ player, onUpdate, allPlayers, side, gameIndex, updatePlayer }) {
    const currentRole = player.role_played

    const handleRoleClick = (role) => {
        if (currentRole === role) {
            onUpdate({ role_played: null })
            return
        }
        // Swap with whoever has this role
        const otherIdx = allPlayers.findIndex(p => p.role_played === role)
        if (otherIdx !== -1) {
            updatePlayer(gameIndex, side, otherIdx, { role_played: currentRole || null })
        }
        onUpdate({ role_played: role })
    }

    return (
        <div className="flex items-center gap-1">
            {ROLE_LIST.map(role => (
                <button
                    key={role}
                    onClick={() => handleRoleClick(role)}
                    className={`w-7 h-7 rounded flex items-center justify-center transition ${
                        currentRole === role
                            ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]'
                            : 'hover:bg-white/10'
                    }`}
                    title={role}
                >
                    <img src={ROLE_IMAGES[role]} alt={role} className="w-4 h-4" />
                </button>
            ))}
        </div>
    )
}

function RolePlayerRow({ player, side, index, gameIndex, allPlayers, updatePlayer, gods }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-1.5 shrink-0">
                {player.role_played && ROLE_IMAGES[player.role_played] ? (
                    <img src={ROLE_IMAGES[player.role_played]} alt={player.role_played} className="w-4 h-4 shrink-0 opacity-70" />
                ) : (
                    <span className="w-4 h-4 shrink-0 rounded-full border border-dashed border-[var(--color-text-secondary)]/30" />
                )}
                <PlayerLabel player={player} gods={gods} className="w-28" />
            </div>
            <RolePicker
                player={player}
                onUpdate={updates => updatePlayer(gameIndex, side, index, updates)}
                allPlayers={allPlayers}
                side={side} gameIndex={gameIndex} updatePlayer={updatePlayer}
            />
        </div>
    )
}

function RolesStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const gods = adminData?.gods || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    {(game.left_players || []).map((p, i) => (
                        <RolePlayerRow key={i} player={p} side="left" index={i}
                            gameIndex={gameIndex} allPlayers={game.left_players} updatePlayer={updatePlayer} gods={gods} />
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    {(game.right_players || []).map((p, i) => (
                        <RolePlayerRow key={i} player={p} side="right" index={i}
                            gameIndex={gameIndex} allPlayers={game.right_players} updatePlayer={updatePlayer} gods={gods} />
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: KDA
// ═══════════════════════════════════════════════════

function StatInput({ value, onChange, className = '' }) {
    return (
        <input
            type="number"
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
            className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-xs text-[var(--color-text)] text-right py-1 transition-colors ${className}`}
        />
    )
}

function KDATable({ players, side, gameIndex, updatePlayer, gods }) {
    return (
        <table className="w-full text-xs">
            <thead>
                <tr className="text-[10px] text-[var(--color-text-secondary)]">
                    <th className="text-left font-normal pb-1.5">Player</th>
                    <th className="text-right font-normal pb-1.5 w-12">K</th>
                    <th className="text-right font-normal pb-1.5 w-12">D</th>
                    <th className="text-right font-normal pb-1.5 w-12">A</th>
                </tr>
            </thead>
            <tbody>
                {(players || []).map((p, i) => (
                    <tr key={i}>
                        <td className="py-0.5"><PlayerLabel player={p} gods={gods} /></td>
                        <td className="w-12 py-0.5">
                            <StatInput value={p.kills} onChange={v => updatePlayer(gameIndex, side, i, { kills: v })} className="w-full" />
                        </td>
                        <td className="w-12 py-0.5">
                            <StatInput value={p.deaths} onChange={v => updatePlayer(gameIndex, side, i, { deaths: v })} className="w-full" />
                        </td>
                        <td className="w-12 py-0.5">
                            <StatInput value={p.assists} onChange={v => updatePlayer(gameIndex, side, i, { assists: v })} className="w-full" />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function KDAStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const gods = adminData?.gods || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    <KDATable players={game.left_players} side="left" gameIndex={gameIndex} updatePlayer={updatePlayer} gods={gods} />
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    <KDATable players={game.right_players} side="right" gameIndex={gameIndex} updatePlayer={updatePlayer} gods={gods} />
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: DAMAGE
// ═══════════════════════════════════════════════════

function DamageStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const gods = adminData?.gods || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    <div className="flex items-center justify-between mb-1 text-[10px] text-[var(--color-text-secondary)]">
                        <span>Player</span>
                        <span className="w-20 text-right">Damage</span>
                    </div>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                            <PlayerLabel player={p} gods={gods} className="flex-1 mr-2" />
                            <StatInput value={p.player_damage} onChange={v => updatePlayer(gameIndex, 'left', i, { player_damage: v })} className="w-20" />
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    <div className="flex items-center justify-between mb-1 text-[10px] text-[var(--color-text-secondary)]">
                        <span>Player</span>
                        <span className="w-20 text-right">Damage</span>
                    </div>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                            <PlayerLabel player={p} gods={gods} className="flex-1 mr-2" />
                            <StatInput value={p.player_damage} onChange={v => updatePlayer(gameIndex, 'right', i, { player_damage: v })} className="w-20" />
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// GAME STEP: MITIGATED
// ═══════════════════════════════════════════════════

function MitigatedStep({ game, gameIndex, team1Name, team2Name, team1Color, team2Color, adminData, updatePlayer, onNext }) {
    const gods = adminData?.gods || []
    return (
        <div>
            <div className="grid grid-cols-2 gap-6 mb-6">
                <TeamColumn label={team1Name} color={team1Color}>
                    <div className="flex items-center justify-between mb-1 text-[10px] text-[var(--color-text-secondary)]">
                        <span>Player</span>
                        <span className="w-20 text-right">Mitigated</span>
                    </div>
                    {(game.left_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                            <PlayerLabel player={p} gods={gods} className="flex-1 mr-2" />
                            <StatInput value={p.mitigated} onChange={v => updatePlayer(gameIndex, 'left', i, { mitigated: v })} className="w-20" />
                        </div>
                    ))}
                </TeamColumn>
                <TeamColumn label={team2Name} color={team2Color}>
                    <div className="flex items-center justify-between mb-1 text-[10px] text-[var(--color-text-secondary)]">
                        <span>Player</span>
                        <span className="w-20 text-right">Mitigated</span>
                    </div>
                    {(game.right_players || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                            <PlayerLabel player={p} gods={gods} className="flex-1 mr-2" />
                            <StatInput value={p.mitigated} onChange={v => updatePlayer(gameIndex, 'right', i, { mitigated: v })} className="w-20" />
                        </div>
                    ))}
                </TeamColumn>
            </div>
            <CorrectButton onClick={onNext} />
        </div>
    )
}


// ═══════════════════════════════════════════════════
// STEP: FINAL REVIEW
// ═══════════════════════════════════════════════════

function ReviewStep({ editData, team1Name, team2Name, team1Color, team2Color, team1Id, team2Id, adminData, onSubmit, isSubmitting, submitResult }) {
    const games = editData?.games || []
    const gods = adminData?.gods || []
    const findGodImg = (name) => gods.find(g => g.name === name)?.image_url

    if (submitResult?.success) {
        return (
            <div className="py-12 text-center">
                <div className="text-4xl mb-3">&#9989;</div>
                <h3 className="text-lg font-bold text-green-400 mb-2">Match Submitted</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Match ID: {submitResult.data?.match_id}</p>
            </div>
        )
    }

    return (
        <div>
            {submitResult?.error && (
                <div className="mb-4 px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {submitResult.error}
                </div>
            )}

            <div className="space-y-6 mb-8">
                {games.map((g, gi) => {
                    const winnerId = g.winning_team_id
                    const winnerName = String(winnerId) === String(team1Id) ? team1Name : team2Name
                    return (
                        <div key={gi} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                            <div className="px-4 py-2 bg-white/3 flex items-center justify-between">
                                <span className="text-sm font-bold text-[var(--color-text)]">Game {gi + 1}</span>
                                <span className="text-xs text-green-400">{winnerName} wins</span>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
                                <ReviewTeamTable
                                    players={g.left_players || []}
                                    teamName={team1Name} teamColor={team1Color}
                                    findGodImg={findGodImg}
                                />
                                <ReviewTeamTable
                                    players={g.right_players || []}
                                    teamName={team2Name} teamColor={team2Color}
                                    findGodImg={findGodImg}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex justify-center">
                <button
                    onClick={onSubmit}
                    disabled={isSubmitting}
                    className="px-10 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Match'}
                </button>
            </div>
        </div>
    )
}

function ReviewTeamTable({ players, teamName, teamColor, findGodImg }) {
    return (
        <div className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
                <span className="text-xs font-semibold text-[var(--color-text)]">{teamName}</span>
            </div>
            <table className="w-full text-[11px]">
                <thead>
                    <tr className="text-[var(--color-text-secondary)] text-[10px]">
                        <th className="text-left font-normal pb-1">Player</th>
                        <th className="text-left font-normal pb-1">God</th>
                        <th className="text-left font-normal pb-1">Role</th>
                        <th className="text-right font-normal pb-1">KDA</th>
                        <th className="text-right font-normal pb-1">Dmg</th>
                        <th className="text-right font-normal pb-1">Mit</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map((p, i) => (
                        <tr key={i} className="border-t border-[var(--color-border)]/30">
                            <td className="py-1 text-[var(--color-text)]">{p.player_name}</td>
                            <td className="py-1">
                                <span className="flex items-center gap-1">
                                    {findGodImg(p.god_played) && <img src={findGodImg(p.god_played)} alt="" className="w-4 h-4 rounded-sm" />}
                                    <span className="text-[var(--color-text)]">{p.god_played}</span>
                                </span>
                            </td>
                            <td className="py-1">
                                {p.role_played && ROLE_IMAGES[p.role_played] && (
                                    <img src={ROLE_IMAGES[p.role_played]} alt={p.role_played} className="w-4 h-4" title={p.role_played} />
                                )}
                            </td>
                            <td className="py-1 text-right text-[var(--color-text)]">{p.kills}/{p.deaths}/{p.assists}</td>
                            <td className="py-1 text-right text-[var(--color-text-secondary)]">{p.player_damage || '-'}</td>
                            <td className="py-1 text-right text-[var(--color-text-secondary)]">{p.mitigated || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function TeamColumn({ label, color, children }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-border)]">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-bold text-[var(--color-text)]">{label}</span>
            </div>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    )
}

function CorrectButton({ onClick }) {
    return (
        <div className="flex justify-end pt-4">
            <button
                onClick={onClick}
                className="px-8 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-500 transition"
            >
                Correct &rarr;
            </button>
        </div>
    )
}
