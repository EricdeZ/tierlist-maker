import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { godService, leagueService, bannedContentService } from '../services/database'
import { usePassion } from '../context/PassionContext'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import aspectIcon from '../assets/aspect.png'

const DRAFT_SEQUENCE = [
    { type: 'ban', team: 'order' },
    { type: 'ban', team: 'chaos' },
    { type: 'ban', team: 'order' },
    { type: 'ban', team: 'chaos' },
    { type: 'ban', team: 'order' },
    { type: 'ban', team: 'chaos' },
    { type: 'pick', team: 'order' },
    { type: 'pick', team: 'chaos' },
    { type: 'pick', team: 'chaos' },
    { type: 'pick', team: 'order' },
    { type: 'pick', team: 'order' },
    { type: 'pick', team: 'chaos' },
    { type: 'pick', team: 'chaos' },
    { type: 'pick', team: 'order' },
    { type: 'pick', team: 'order' },
    { type: 'pick', team: 'chaos' },
]

const TEAM_COLORS = {
    order: {
        primary: '#3b82f6',
        glow: 'rgba(59, 130, 246, 0.4)',
        border: 'rgba(59, 130, 246, 0.6)',
        bg: 'rgba(59, 130, 246, 0.08)',
    },
    chaos: {
        primary: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.4)',
        border: 'rgba(239, 68, 68, 0.6)',
        bg: 'rgba(239, 68, 68, 0.08)',
    },
}

const FORMATS = [
    { value: 'regular', label: 'Regular', description: 'No restrictions between games' },
    { value: 'fearless', label: 'Fearless', description: 'Picked & banned gods unavailable in later games' },
    { value: 'fearless_picks', label: 'Fearless Picks', description: 'Picked gods unavailable in later games' },
    { value: 'fearless_bans', label: 'Fearless Bans', description: 'Banned gods unavailable in later games' },
]

const GAME_COUNTS = [1, 2, 3, 5, 7]

export default function DraftSimulator() {
    const { trackAction } = usePassion()
    const hasTrackedAction = useRef(false)
    const [gods, setGods] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [totalGames, setTotalGames] = useState(1)
    const [format, setFormat] = useState('regular')
    const [draftStarted, setDraftStarted] = useState(false)

    const [currentGame, setCurrentGame] = useState(1)
    const [completedGames, setCompletedGames] = useState([])
    const [showSummary, setShowSummary] = useState(false)

    const [currentStep, setCurrentStep] = useState(0)
    const [orderBans, setOrderBans] = useState([])
    const [chaosBans, setChaosBans] = useState([])
    const [orderPicks, setOrderPicks] = useState([])
    const [chaosPicks, setChaosPicks] = useState([])
    const [selectedGod, setSelectedGod] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [leagues, setLeagues] = useState([])
    const [selectedLeagueId, setSelectedLeagueId] = useState(null)
    const [banList, setBanList] = useState(null)
    const [showBans, setShowBans] = useState(false)
    const [orderAspects, setOrderAspects] = useState(new Set())
    const [chaosAspects, setChaosAspects] = useState(new Set())

    const isGameComplete = currentStep >= DRAFT_SEQUENCE.length
    const isSeriesComplete = isGameComplete && currentGame >= totalGames
    const currentAction = isGameComplete ? null : DRAFT_SEQUENCE[currentStep]

    const restrictedGodIds = useMemo(() => {
        if (format === 'regular') return new Set()
        const ids = new Set()
        for (const game of completedGames) {
            if (format === 'fearless' || format === 'fearless_picks') {
                game.orderPicks.forEach(g => ids.add(g.id))
                game.chaosPicks.forEach(g => ids.add(g.id))
            }
            if (format === 'fearless' || format === 'fearless_bans') {
                game.orderBans.forEach(g => ids.add(g.id))
                game.chaosBans.forEach(g => ids.add(g.id))
            }
        }
        return ids
    }, [format, completedGames])

    const usedGodIds = useMemo(() => new Set([
        ...orderBans.map(g => g.id),
        ...chaosBans.map(g => g.id),
        ...orderPicks.map(g => g.id),
        ...chaosPicks.map(g => g.id),
        ...restrictedGodIds,
    ]), [orderBans, chaosBans, orderPicks, chaosPicks, restrictedGodIds])

    // God names banned by the league (from "God Bans" section)
    const bannedGodNames = useMemo(() => {
        if (!banList?.sections) return new Set()
        const godBansSection = banList.sections.find(s => s.name.toLowerCase() === 'god bans')
        if (!godBansSection) return new Set()
        return new Set(godBansSection.items.map(n => n.toLowerCase()))
    }, [banList])

    // God names whose aspects are banned (extract god name from "X Aspect" entries)
    const aspectBannedGodNames = useMemo(() => {
        if (!banList?.sections) return new Set()
        const section = banList.sections.find(s => s.name.toLowerCase() === 'aspect bans')
        if (!section) return new Set()
        return new Set(section.items
            .map(n => n.replace(/\s+aspect$/i, '').toLowerCase())
            .filter(Boolean))
    }, [banList])

    useEffect(() => {
        godService.getAll()
            .then(data => { setGods(data); setLoading(false) })
            .catch(err => {
                console.error('Failed to load gods:', err)
                setError('Failed to load gods')
                setLoading(false)
            })
        leagueService.getAll()
            .then(data => {
                setLeagues(data || [])
                if (data?.length === 1) setSelectedLeagueId(data[0].id)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (!selectedLeagueId) { setBanList(null); return }
        bannedContentService.getByLeague(selectedLeagueId)
            .then(data => setBanList(data.banList?.parsed_data || null))
            .catch(() => setBanList(null))
    }, [selectedLeagueId])

    const filteredGods = gods.filter(god =>
        god.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const confirmSelection = useCallback(() => {
        if (!selectedGod || isGameComplete) return
        const { type, team } = currentAction
        if (type === 'ban') {
            if (team === 'order') setOrderBans(prev => [...prev, selectedGod])
            else setChaosBans(prev => [...prev, selectedGod])
        } else {
            if (team === 'order') setOrderPicks(prev => [...prev, selectedGod])
            else setChaosPicks(prev => [...prev, selectedGod])
        }
        setSelectedGod(null)
        setCurrentStep(prev => prev + 1)
    }, [selectedGod, isGameComplete, currentAction])

    const handleGodClick = (god) => {
        if (usedGodIds.has(god.id) || isGameComplete) return
        if (selectedGod?.id === god.id) {
            confirmSelection()
        } else {
            setSelectedGod(god)
        }
    }

    const toggleAspect = (team, godId) => {
        const setter = team === 'order' ? setOrderAspects : setChaosAspects
        setter(prev => {
            const next = new Set(prev)
            if (next.has(godId)) next.delete(godId)
            else next.add(godId)
            return next
        })
    }

    const resetCurrentGame = () => {
        setCurrentStep(0)
        setOrderBans([])
        setChaosBans([])
        setOrderPicks([])
        setChaosPicks([])
        setSelectedGod(null)
        setSearchQuery('')
        setOrderAspects(new Set())
        setChaosAspects(new Set())
    }

    const handleNextGame = () => {
        setCompletedGames(prev => [...prev, { orderPicks, chaosPicks, orderBans, chaosBans, orderAspects: new Set(orderAspects), chaosAspects: new Set(chaosAspects) }])
        setCurrentGame(prev => prev + 1)
        resetCurrentGame()
    }

    const handleFinishSeries = () => {
        setCompletedGames(prev => [...prev, { orderPicks, chaosPicks, orderBans, chaosBans, orderAspects: new Set(orderAspects), chaosAspects: new Set(chaosAspects) }])
        setShowSummary(true)
        if (!hasTrackedAction.current) {
            hasTrackedAction.current = true
            trackAction('draft_complete')
        }
    }

    const handleFullReset = () => {
        setDraftStarted(false)
        setCurrentGame(1)
        setCompletedGames([])
        setShowSummary(false)
        resetCurrentGame()
    }

    const getPhaseLabel = () => {
        if (isGameComplete) return 'DRAFT COMPLETE'
        const { type, team } = currentAction
        return `${team.toUpperCase()} IS ${type === 'ban' ? 'BANNING' : 'PICKING'}`
    }

    if (loading) {
        return (
            <>
                <Navbar title="Draft Simulator" />
                <div className="min-h-screen bg-(--color-primary) flex items-center justify-center">
                    <div className="text-(--color-text-secondary) text-lg">Loading gods...</div>
                </div>
            </>
        )
    }

    if (error) {
        return (
            <>
                <Navbar title="Draft Simulator" />
                <div className="min-h-screen bg-(--color-primary) flex items-center justify-center">
                    <div className="text-red-400 text-lg">{error}</div>
                </div>
            </>
        )
    }

    const activeTeamColor = isGameComplete ? null : TEAM_COLORS[currentAction.team]
    const formatLabel = FORMATS.find(f => f.value === format)?.label || format
    const isBanPhase = currentAction?.type === 'ban'

    return (
        <div className="h-screen bg-(--color-primary) flex flex-col overflow-hidden pt-20">
            <Navbar title="Draft Simulator" />
            <PageTitle title="SMITE 2 Draft Simulator - Practice Picks & Bans" description="Free SMITE 2 draft simulator. Practice pick/ban strategy with every god. Supports Regular, Fearless, and multi-game series formats." />

            {/* Pre-start setup (full center) */}
            {!draftStarted && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 overflow-y-auto py-8">
                    <h2 className="text-2xl font-heading font-bold text-(--color-accent)">Picks & Bans Simulator</h2>

                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-5 max-w-sm w-full space-y-4">
                        {/* Games */}
                        <div>
                            <label className="block text-xs text-(--color-text-secondary) font-medium uppercase tracking-wider mb-1.5">Number of Games</label>
                            <div className="flex gap-2">
                                {GAME_COUNTS.map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setTotalGames(n)}
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                                            totalGames === n
                                                ? 'bg-(--color-accent) text-(--color-primary)'
                                                : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Format */}
                        <div>
                            <label className="block text-xs text-(--color-text-secondary) font-medium uppercase tracking-wider mb-1.5">Format</label>
                            <div className="space-y-1.5">
                                {FORMATS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setFormat(f.value)}
                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                                            format === f.value
                                                ? 'border-(--color-accent)/40 bg-(--color-accent)/10 text-(--color-accent)'
                                                : 'border-white/5 bg-white/[0.02] text-(--color-text-secondary)/60 hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="text-sm font-semibold">{f.label}</span>
                                        <span className={`block text-[11px] mt-0.5 ${format === f.value ? 'text-(--color-accent)/70' : 'text-(--color-text-secondary)/40'}`}>
                                            {f.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* League (for ban list) */}
                        {leagues.length > 0 && (
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) font-medium uppercase tracking-wider mb-1.5">League Ban List</label>
                                <select
                                    value={selectedLeagueId || ''}
                                    onChange={e => setSelectedLeagueId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/10 text-(--color-text) text-sm"
                                >
                                    <option value="">None</option>
                                    {leagues.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            onClick={() => setDraftStarted(true)}
                            className="w-full py-2.5 rounded-lg bg-(--color-accent) text-(--color-primary) font-heading font-bold text-sm hover:brightness-110 transition-all mt-2"
                        >
                            Start Draft
                        </button>
                    </div>
                </div>
            )}

            {/* Active draft */}
            {draftStarted && (
                <>
                    {/* Info bar */}
                    <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-white/5 bg-(--color-secondary)/50 flex-shrink-0 gap-2">
                        <div className="flex items-center gap-3 sm:gap-4 text-xs min-w-0">
                            <span className="text-(--color-text-secondary) hidden sm:inline">{formatLabel}</span>
                            <span className="text-(--color-text-secondary) sm:hidden">{formatLabel.split(' ')[0]}</span>
                            {totalGames > 1 && (
                                <span className="font-heading font-semibold tracking-wider whitespace-nowrap">
                                    <span className="text-(--color-text-secondary)">Game </span>
                                    <span className="text-(--color-accent)">{currentGame}</span>
                                    <span className="text-(--color-text-secondary)">/{totalGames}</span>
                                </span>
                            )}
                            {format !== 'regular' && restrictedGodIds.size > 0 && (
                                <span className="text-amber-400/70 whitespace-nowrap">
                                    {restrictedGodIds.size} restricted
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleFullReset}
                            className="px-3 py-1 rounded-md bg-white/5 text-(--color-text-secondary) text-xs font-medium hover:bg-white/10 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Phase Banner */}
                    <div
                        className="text-center py-2 font-heading font-bold text-lg sm:text-xl tracking-widest transition-colors duration-300 flex-shrink-0"
                        style={{
                            color: isGameComplete ? '#f8c56a' : activeTeamColor.primary,
                            textShadow: isGameComplete
                                ? '0 0 20px rgba(248, 197, 106, 0.5)'
                                : `0 0 20px ${activeTeamColor.glow}`,
                        }}
                    >
                        {getPhaseLabel()}
                        {!isGameComplete && (
                            <span className="block text-[11px] text-(--color-text-secondary) font-normal tracking-normal mt-0.5">
                                Step {currentStep + 1} of {DRAFT_SEQUENCE.length}
                            </span>
                        )}
                    </div>

                    {/* Main layout */}
                    <div className="flex-1 flex flex-col lg:flex-row lg:items-stretch px-2 pb-2 min-h-0">

                        {/* Mobile: both teams side by side above grid */}
                        <div className="flex flex-col sm:flex-row gap-1.5 lg:hidden flex-shrink-0">
                            <MobileTeamPanel
                                team="order"
                                label="ORDER"
                                picks={orderPicks}
                                bans={orderBans}
                                aspects={orderAspects}
                                onToggleAspect={(godId) => toggleAspect('order', godId)}
                                isActive={!isGameComplete && currentAction.team === 'order'}
                                currentAction={currentAction}
                            />
                            <MobileTeamPanel
                                team="chaos"
                                label="CHAOS"
                                picks={chaosPicks}
                                bans={chaosBans}
                                aspects={chaosAspects}
                                onToggleAspect={(godId) => toggleAspect('chaos', godId)}
                                isActive={!isGameComplete && currentAction.team === 'chaos'}
                                currentAction={currentAction}
                            />
                        </div>

                        {/* Desktop: Order sidebar */}
                        <div className="hidden lg:flex flex-shrink-0">
                            <DesktopTeamPanel
                                team="order"
                                label="ORDER"
                                picks={orderPicks}
                                bans={orderBans}
                                aspects={orderAspects}
                                onToggleAspect={(godId) => toggleAspect('order', godId)}
                                isActive={!isGameComplete && currentAction.team === 'order'}
                                currentAction={currentAction}
                            />
                        </div>

                        {/* God Grid (center) */}
                        <div className="flex-1 flex flex-col min-h-0 min-w-0 lg:mx-6">
                            <div className="pb-2 flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search gods..."
                                    className="flex-1 min-w-0 px-4 py-2 rounded-lg bg-(--color-secondary) border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 text-sm"
                                />
                                {banList?.sections?.some(s => s.items?.length > 0) && (
                                    <button
                                        onClick={() => setShowBans(!showBans)}
                                        className={`shrink-0 px-4 py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-2 ${
                                            showBans
                                                ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                                : 'bg-(--color-secondary) border-white/10 text-(--color-text-secondary) hover:border-white/20'
                                        }`}
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                        </svg>
                                        Banned Content
                                    </button>
                                )}
                            </div>

                            {/* Collapsible banned content panel */}
                            {showBans && banList && (
                                <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 overflow-y-auto max-h-48">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                                            {banList.title || 'Banned Content'}
                                            {banList.updated && <span className="font-normal text-red-400/60 ml-2">Updated {banList.updated}</span>}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {banList.sections.filter(s => s.items?.length > 0).map(section => (
                                            <div key={section.name}>
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-400/80 mb-1">{section.name}</h4>
                                                <ul className="space-y-0.5">
                                                    {section.items.map((item, idx) => (
                                                        <li key={idx} className="text-xs text-(--color-text-secondary)">{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto draft-scrollbar rounded-xl border border-white/10 bg-(--color-secondary) p-3">
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,6rem))] sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,6.25rem))] gap-2 justify-center">
                                    {filteredGods.map(god => {
                                        const isRestricted = restrictedGodIds.has(god.id)
                                        const isUsed = usedGodIds.has(god.id)
                                        const isSelected = selectedGod?.id === god.id
                                        const isLeagueBanned = bannedGodNames.has(god.name.toLowerCase())
                                        const isAspectBanned = aspectBannedGodNames.has(god.name.toLowerCase())
                                        return (
                                            <button
                                                key={god.id}
                                                onClick={() => handleGodClick(god)}
                                                disabled={isUsed || isGameComplete}
                                                title={`${god.name}${isLeagueBanned ? ' (league banned)' : isAspectBanned ? ' (aspect banned)' : isRestricted ? ' (restricted)' : ''}`}
                                                className={`
                                                    relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150
                                                    ${isUsed
                                                        ? isRestricted
                                                            ? 'opacity-15 border-amber-500/20 cursor-not-allowed grayscale'
                                                            : 'opacity-25 border-white/5 cursor-not-allowed grayscale'
                                                        : isSelected
                                                            ? 'border-[var(--select-color)] shadow-[0_0_12px_var(--select-glow)] scale-105 z-10'
                                                            : 'border-white/10 hover:border-white/30 cursor-pointer'
                                                    }
                                                `}
                                                style={{
                                                    '--select-color': activeTeamColor?.primary || '#f8c56a',
                                                    '--select-glow': activeTeamColor?.glow || 'rgba(248, 197, 106, 0.4)',
                                                }}
                                            >
                                                <img
                                                    src={god.image_url}
                                                    alt={god.name}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                {isLeagueBanned && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                        <svg className="w-8 h-8 text-red-500 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                        </svg>
                                                    </div>
                                                )}
                                                {isAspectBanned && !isLeagueBanned && (
                                                    <div className="absolute bottom-0.5 right-0.5 w-8 h-8">
                                                        <img src={aspectIcon} alt="" className="w-full h-full object-contain" />
                                                        <svg className="absolute inset-0 w-full h-full text-red-500 drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                        </svg>
                                                    </div>
                                                )}
                                                {isRestricted && !isLeagueBanned && (
                                                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500/80 flex items-center justify-center">
                                                        <span className="text-[8px] text-black font-bold">!</span>
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 py-0.5 opacity-0 hover:opacity-100 transition-opacity">
                                                    <span className="text-[10px] text-white font-medium truncate block text-center">
                                                        {god.name}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Bottom actions */}
                            <div className="py-4 flex flex-wrap justify-center gap-3 flex-shrink-0">
                                {!isGameComplete && (
                                    <button
                                        onClick={confirmSelection}
                                        disabled={!selectedGod}
                                        className={`px-10 sm:px-12 py-3 rounded-lg font-heading font-bold text-base uppercase tracking-wider transition-all duration-200 ${!selectedGod ? 'bg-white/5 text-white/20 cursor-not-allowed' : ''}`}
                                        style={selectedGod ? {
                                            backgroundColor: activeTeamColor.primary,
                                            color: '#fff',
                                            boxShadow: `0 4px 25px ${activeTeamColor.glow}`,
                                        } : undefined}
                                    >
                                        {selectedGod ? (
                                            <span>{isBanPhase ? 'Ban' : 'Lock In'} {selectedGod.name}</span>
                                        ) : (
                                            <span>
                                                {isBanPhase ? 'Select a god to ban' : 'Select a god to pick'}
                                            </span>
                                        )}
                                    </button>
                                )}

                                {isGameComplete && !isSeriesComplete && (
                                    <button
                                        onClick={handleNextGame}
                                        className="px-10 sm:px-12 py-3 rounded-lg font-heading font-bold text-base uppercase tracking-wider bg-(--color-accent) text-(--color-primary) hover:brightness-110 shadow-lg shadow-(--color-accent)/20 transition-all"
                                    >
                                        Next Game ({currentGame + 1})
                                    </button>
                                )}

                                {isSeriesComplete && (
                                    <button
                                        onClick={handleFinishSeries}
                                        className="px-10 sm:px-12 py-3 rounded-lg font-heading font-bold text-base uppercase tracking-wider bg-(--color-accent) text-(--color-primary) hover:brightness-110 shadow-lg shadow-(--color-accent)/20 transition-all"
                                    >
                                        View Summary
                                    </button>
                                )}

                                {isGameComplete && (
                                    <button
                                        onClick={resetCurrentGame}
                                        className="px-6 py-3 rounded-lg font-heading font-semibold text-sm uppercase tracking-wider bg-white/5 text-(--color-text-secondary) hover:bg-white/10 transition-colors"
                                    >
                                        Redo Game
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Desktop: Chaos sidebar */}
                        <div className="hidden lg:flex flex-shrink-0">
                            <DesktopTeamPanel
                                team="chaos"
                                label="CHAOS"
                                picks={chaosPicks}
                                bans={chaosBans}
                                aspects={chaosAspects}
                                onToggleAspect={(godId) => toggleAspect('chaos', godId)}
                                isActive={!isGameComplete && currentAction.team === 'chaos'}
                                currentAction={currentAction}
                            />
                        </div>
                    </div>
                </>
            )}

            {showSummary && (
                <SummaryModal
                    games={completedGames}
                    totalGames={totalGames}
                    format={format}
                    onClose={() => setShowSummary(false)}
                    onNewDraft={handleFullReset}
                />
            )}
        </div>
    )
}

/* ── Desktop sidebar panel ──────────────────────────────────────── */
function DesktopTeamPanel({ team, label, picks, bans, aspects, onToggleAspect, isActive, currentAction }) {
    const colors = TEAM_COLORS[team]

    return (
        <div
            className="w-64 xl:w-72 flex flex-col rounded-xl border transition-all duration-300"
            style={{
                borderColor: isActive ? colors.border : 'rgba(255,255,255,0.05)',
                backgroundColor: isActive ? colors.bg : 'rgba(255,255,255,0.02)',
                boxShadow: isActive ? `inset 0 0 30px ${colors.glow}, 0 0 15px ${colors.glow}` : 'none',
            }}
        >
            <div
                className="px-4 py-2.5 text-center font-heading font-bold text-sm tracking-[0.2em] border-b"
                style={{ color: colors.primary, borderColor: `${colors.primary}33` }}
            >
                {label}
            </div>

            <div className="flex-1 flex flex-col gap-2 p-2.5">
                {Array.from({ length: 5 }).map((_, i) => {
                    const god = picks[i]
                    const isNext = isActive && currentAction?.type === 'pick' && i === picks.length
                    const hasAspect = god && aspects.has(god.id)
                    return (
                        <div
                            key={i}
                            className={`flex items-center gap-2.5 rounded-lg border p-2 transition-all duration-200
                                ${god ? 'border-white/10 bg-white/5'
                                    : isNext ? 'border-dashed animate-pulse'
                                    : 'border-white/5 bg-white/[0.02]'}`}
                            style={{
                                borderColor: isNext ? colors.border : undefined,
                                backgroundColor: isNext ? `${colors.primary}10` : undefined,
                            }}
                        >
                            <div
                                className={`relative w-[50px] h-[50px] rounded-md overflow-hidden flex-shrink-0 border ${god ? 'border-white/20' : 'border-white/5'}`}
                                style={{ borderColor: isNext ? colors.border : undefined }}
                            >
                                {god ? (
                                    <>
                                        <img src={god.image_url} alt={god.name} className="w-full h-full object-cover" />
                                        {hasAspect && (
                                            <img src={aspectIcon} alt="Aspect" className="absolute bottom-0 right-0 w-4 h-4 object-contain drop-shadow" />
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                        <span className="text-white/10 text-sm font-bold">{i + 1}</span>
                                    </div>
                                )}
                            </div>
                            <span className={`text-sm font-medium truncate flex-1 ${god ? 'text-(--color-text)' : 'text-white/15'}`}>
                                {god ? god.name : `Pick ${i + 1}`}
                            </span>
                            {god && (
                                <button
                                    onClick={() => onToggleAspect(god.id)}
                                    className="shrink-0 w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                                    title={hasAspect ? 'Disable aspect' : 'Enable aspect'}
                                >
                                    <img
                                        src={aspectIcon}
                                        alt="Aspect"
                                        className={`w-5 h-5 object-contain transition-all ${hasAspect ? '' : 'grayscale opacity-30'}`}
                                    />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            <BanSlots bans={bans} isActive={isActive} currentAction={currentAction} colors={colors} />
        </div>
    )
}

/* ── Mobile compact panel ───────────────────────────────────────── */
function MobileTeamPanel({ team, label, picks, bans, aspects, onToggleAspect, isActive, currentAction }) {
    const colors = TEAM_COLORS[team]

    return (
        <div
            className="flex-1 rounded-lg border p-2 transition-all duration-300"
            style={{
                borderColor: isActive ? colors.border : 'rgba(255,255,255,0.05)',
                backgroundColor: isActive ? colors.bg : 'rgba(255,255,255,0.02)',
                boxShadow: isActive ? `inset 0 0 20px ${colors.glow}` : 'none',
            }}
        >
            <div
                className="text-center font-heading font-bold text-xs tracking-[0.15em] mb-2"
                style={{ color: colors.primary }}
            >
                {label}
            </div>

            {/* Picks row */}
            <div className="flex gap-1.5 justify-center mb-2">
                {Array.from({ length: 5 }).map((_, i) => {
                    const god = picks[i]
                    const isNext = isActive && currentAction?.type === 'pick' && i === picks.length
                    const hasAspect = god && aspects.has(god.id)
                    return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                            <div
                                className={`relative w-10 h-10 rounded overflow-hidden border transition-all
                                    ${god ? 'border-white/15' : isNext ? 'border-dashed animate-pulse' : 'border-white/5'}`}
                                style={{ borderColor: isNext ? colors.border : undefined }}
                                title={god?.name || `Pick ${i + 1}`}
                            >
                                {god ? (
                                    <>
                                        <img src={god.image_url} alt={god.name} className="w-full h-full object-cover" />
                                        {hasAspect && (
                                            <img src={aspectIcon} alt="" className="absolute bottom-0 right-0 w-3 h-3 object-contain drop-shadow" />
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                        <span className="text-white/10 text-[10px] font-bold">{i + 1}</span>
                                    </div>
                                )}
                            </div>
                            {god && (
                                <button
                                    onClick={() => onToggleAspect(god.id)}
                                    className="w-5 h-5 rounded flex items-center justify-center"
                                    title={hasAspect ? 'Disable aspect' : 'Enable aspect'}
                                >
                                    <img
                                        src={aspectIcon}
                                        alt=""
                                        className={`w-4 h-4 object-contain transition-all ${hasAspect ? '' : 'grayscale opacity-30'}`}
                                    />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Bans row */}
            <div className="flex gap-1.5 justify-center">
                <span className="text-[9px] text-(--color-text-secondary)/30 uppercase tracking-wider self-center mr-0.5">Ban</span>
                {Array.from({ length: 3 }).map((_, i) => {
                    const god = bans[i]
                    const isNext = isActive && currentAction?.type === 'ban' && i === bans.length
                    return (
                        <div
                            key={i}
                            className={`w-8 h-8 rounded overflow-hidden border relative transition-all
                                ${god ? 'border-red-500/30' : isNext ? 'border-dashed animate-pulse' : 'border-white/5'}`}
                            style={{ borderColor: isNext ? colors.border : undefined }}
                            title={god?.name}
                        >
                            {god ? (
                                <>
                                    <img src={god.image_url} alt={god.name} className="w-full h-full object-cover grayscale opacity-60" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-red-500/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <line x1="4" y1="4" x2="20" y2="20" />
                                            <line x1="20" y1="4" x2="4" y2="20" />
                                        </svg>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full bg-white/5" />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Shared ban slots (desktop) ─────────────────────────────────── */
function BanSlots({ bans, isActive, currentAction, colors }) {
    return (
        <div className="px-2.5 pb-2.5">
            <div className="text-[10px] uppercase tracking-wider text-(--color-text-secondary)/50 font-semibold mb-1.5 text-center">
                Bans
            </div>
            <div className="flex justify-center gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => {
                    const god = bans[i]
                    const isNext = isActive && currentAction?.type === 'ban' && i === bans.length
                    return (
                        <div
                            key={i}
                            className={`w-[50px] h-[50px] rounded-md overflow-hidden border relative transition-all duration-200
                                ${god ? 'border-red-500/30' : isNext ? 'border-dashed animate-pulse' : 'border-white/5'}`}
                            style={{ borderColor: isNext ? colors.border : undefined }}
                        >
                            {god ? (
                                <>
                                    <img src={god.image_url} alt={god.name} className="w-full h-full object-cover grayscale opacity-60" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-red-500/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <line x1="4" y1="4" x2="20" y2="20" />
                                            <line x1="20" y1="4" x2="4" y2="20" />
                                        </svg>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                    <span className="text-white/10 text-[10px] font-bold">{isNext ? '?' : ''}</span>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Summary Modal ──────────────────────────────────────────────── */
function SummaryModal({ games, totalGames, format, onClose, onNewDraft }) {
    const formatLabel = FORMATS.find(f => f.value === format)?.label || format

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-(--color-primary) border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-(--color-primary) border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div>
                        <h2 className="text-lg sm:text-xl font-heading font-bold text-(--color-accent)">Draft Summary</h2>
                        <p className="text-xs text-(--color-text-secondary) mt-0.5">
                            {totalGames} {totalGames === 1 ? 'Game' : 'Games'} &middot; {formatLabel}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-(--color-text-secondary) hover:text-(--color-text) transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Games */}
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {games.map((game, idx) => (
                        <div key={idx} className="bg-(--color-secondary) rounded-xl border border-white/5 overflow-hidden">
                            <div className="px-4 py-2 border-b border-white/5 font-heading font-semibold text-sm text-(--color-text-secondary)">
                                Game {idx + 1}
                            </div>
                            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SummaryTeam label="ORDER" color={TEAM_COLORS.order.primary} picks={game.orderPicks} bans={game.orderBans} aspects={game.orderAspects} />
                                <SummaryTeam label="CHAOS" color={TEAM_COLORS.chaos.primary} picks={game.chaosPicks} bans={game.chaosBans} aspects={game.chaosAspects} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-(--color-primary) border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-white/5 text-(--color-text-secondary) text-sm font-medium hover:bg-white/10 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={onNewDraft}
                        className="px-4 py-2 rounded-lg bg-(--color-accent) text-(--color-primary) text-sm font-heading font-bold hover:brightness-110 transition-all"
                    >
                        New Draft
                    </button>
                </div>
            </div>
        </div>
    )
}

function SummaryTeam({ label, color, picks, bans, aspects }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-heading font-bold tracking-wider" style={{ color }}>{label}</span>
            </div>
            <div className="flex gap-1.5 mb-2 flex-wrap">
                {picks.map(god => (
                    <div key={god.id} className="relative w-11 h-11 rounded-lg overflow-hidden border border-white/10" title={`${god.name}${aspects?.has(god.id) ? ' (Aspect)' : ''}`}>
                        <img src={god.image_url} alt={god.name} className="w-full h-full object-cover" />
                        {aspects?.has(god.id) && (
                            <img src={aspectIcon} alt="Aspect" className="absolute bottom-0 right-0 w-4 h-4 object-contain drop-shadow" />
                        )}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-(--color-text-secondary)/40 uppercase tracking-wider mr-0.5">Bans</span>
                {bans.map(god => (
                    <div key={god.id} className="w-7 h-7 rounded overflow-hidden border border-red-500/20 relative" title={god.name}>
                        <img src={god.image_url} alt={god.name} className="w-full h-full object-cover grayscale opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-red-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <line x1="4" y1="4" x2="20" y2="20" />
                                <line x1="20" y1="4" x2="4" y2="20" />
                            </svg>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
