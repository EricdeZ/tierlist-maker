import { useRef, useEffect, useState } from 'react'
import { ChevronDown, RotateCcw, Flame, BookOpen } from 'lucide-react'
import { getLeagueLogo } from '../../utils/leagueImages'
import { getDivisionImage } from '../../utils/divisionImages'
import forgeLogo from '../../assets/forge.png'

export default function ForgeHeader({
    visibleSeasons,
    leagueOptions,
    seasonId,
    isLeagueWide,
    leagueWideId,
    urlLeagueSlug,
    selectedLeagueOption,
    changeView,
    setChangeView,
    activeTab,
    isOwner,
    market,
    openMarketIds,
    players,
    tutorialReplay,
    onSetSeasonId,
    onSelectLeagueWide,
    onNavigateTab,
    onToggleMarketStatus,
    onReplayTutorial,
}) {
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        if (!dropdownOpen) return
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [dropdownOpen])

    const selected = isLeagueWide ? null : visibleSeasons.find(s => s.id === seasonId)
    const selectedLeagueLogo = isLeagueWide
        ? getLeagueLogo(urlLeagueSlug)
        : (selected ? getLeagueLogo(selected.leagueSlug) : null)
    const selectedDivLogo = selected ? getDivisionImage(selected.leagueSlug, selected.divisionSlug, selected.divisionTier) : null
    const selectedLabel = isLeagueWide
        ? `${selectedLeagueOption?.leagueName || urlLeagueSlug} — All Divisions`
        : (selected ? `${selected.leagueName} — ${selected.divisionName}` : 'Select Season')

    // Group seasons by league for dropdown
    const leagueSlugsOrdered = []
    const seasonsByLeague = {}
    for (const s of visibleSeasons) {
        if (!seasonsByLeague[s.leagueSlug]) {
            seasonsByLeague[s.leagueSlug] = []
            leagueSlugsOrdered.push(s.leagueSlug)
        }
        seasonsByLeague[s.leagueSlug].push(s)
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--forge-border)] relative">
            <div className="absolute bottom-[-1px] left-0 w-[200px] h-[2px]" style={{ background: 'linear-gradient(90deg, var(--forge-flame), transparent)' }} />
            <div className="flex items-center gap-2.5">
                <img
                    src={forgeLogo}
                    alt="Forge"
                    className="w-10 h-10 sm:w-18 sm:h-18 object-contain forge-logo-glow"
                />
                <div className="forge-head text-lg sm:text-[1.6rem] font-bold tracking-wider">
                    Fantasy <span className="text-[var(--forge-flame-bright)]">Forge</span>
                </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Season selector */}
                {(visibleSeasons.length > 1 || leagueOptions.length > 0) && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-base cursor-pointer hover:border-[var(--forge-border-lt)] transition-colors whitespace-nowrap"
                        >
                            {selectedLeagueLogo && <img src={selectedLeagueLogo} alt="" className="w-5 h-5 object-contain" />}
                            {selectedDivLogo && <img src={selectedDivLogo} alt="" className="w-5 h-5 object-contain" />}
                            <span>{selectedLabel}</span>
                            <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 min-w-[280px] bg-[var(--color-primary)] border border-[var(--forge-border)] shadow-xl z-50 max-h-[350px] overflow-y-auto">
                                {leagueSlugsOrdered.map(slug => {
                                    const lgSeasons = seasonsByLeague[slug]
                                    const leagueOpt = leagueOptions.find(l => l.leagueSlug === slug)
                                    const lLogo = getLeagueLogo(slug)
                                    return (
                                        <div key={slug}>
                                            {leagueOpt && (() => {
                                                const allClosed = lgSeasons.length > 0 && lgSeasons.every(s => s.forgeStatus === 'closed')
                                                const allEnded = !allClosed && lgSeasons.length > 0 && lgSeasons.every(s => s.forgeStatus === 'closed' || s.forgeStatus === 'ended' || s.forgeStatus === 'liquidated')
                                                return (
                                                    <button
                                                        onClick={() => { onSelectLeagueWide(leagueOpt.leagueId, leagueOpt.leagueSlug); setDropdownOpen(false) }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                                                            isLeagueWide && leagueWideId === leagueOpt.leagueId ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
                                                        }`}
                                                    >
                                                        {lLogo && <img src={lLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                                                        <Flame size={14} className="text-[var(--forge-flame)] flex-shrink-0" />
                                                        <span className="flex-1 font-semibold">{leagueOpt.leagueName} — All Divisions</span>
                                                        {isOwner && allClosed && (
                                                            <span className="forge-head text-[0.75rem] tracking-wider text-[var(--forge-loss)]">Closed</span>
                                                        )}
                                                        {isOwner && allEnded && (
                                                            <span className="forge-head text-[0.75rem] tracking-wider text-[var(--forge-text-dim)]">Ended</span>
                                                        )}
                                                    </button>
                                                )
                                            })()}
                                            {lgSeasons.map(s => {
                                                const dLogo = getDivisionImage(s.leagueSlug, s.divisionSlug, s.divisionTier)
                                                return (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => { onSetSeasonId(s.id); setDropdownOpen(false) }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                                                            !isLeagueWide && seasonId === s.id ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
                                                        }`}
                                                    >
                                                        {lLogo && <img src={lLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                                                        {dLogo && <img src={dLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                                                        <span className="flex-1">{s.leagueName} — {s.divisionName}</span>
                                                        {isOwner && s.forgeStatus && s.forgeStatus !== 'open' && (
                                                            <span className={`forge-head text-[0.75rem] tracking-wider ${
                                                                s.forgeStatus === 'closed' ? 'text-[var(--forge-loss)]' : 'text-[var(--forge-text-dim)]'
                                                            }`}>
                                                                {s.forgeStatus === 'closed' ? 'Closed' : 'Ended'}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Change view toggle */}
                <div className="forge-change-toggle flex items-center forge-head text-[0.85rem] font-semibold tracking-wider">
                    {['24h', '7d', 'all'].map(v => (
                        <button
                            key={v}
                            onClick={() => setChangeView(v)}
                            className={`px-2.5 py-1.5 cursor-pointer transition-all ${
                                changeView === v
                                    ? 'bg-[var(--forge-flame)]/15 text-[var(--forge-flame-bright)] border border-[var(--forge-flame)]/25'
                                    : 'bg-[var(--forge-panel)] text-[var(--forge-text-dim)] border border-[var(--forge-border)]'
                            }`}
                        >
                            {v === 'all' ? 'ALL' : v.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Replay tutorial (only on market tab) */}
                {activeTab === 'market' && !tutorialReplay && (
                    <button
                        onClick={onReplayTutorial}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--forge-text-dim)] hover:text-[var(--forge-flame-bright)] hover:bg-[var(--forge-flame)]/8 border border-transparent hover:border-[var(--forge-flame)]/20 transition-all forge-head text-[0.75rem] tracking-wider"
                        title="Replay tutorial"
                    >
                        <RotateCcw size={13} />
                        Tutorial
                    </button>
                )}

                {/* Market status -- league-wide */}
                {isLeagueWide && openMarketIds.length > 0 && (
                    <div className="flex items-center gap-1.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-gain)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--forge-gain)] shadow-[0_0_8px_var(--forge-gain)]" style={{ animation: 'forge-blink 2s infinite' }} />
                        Open
                    </div>
                )}
                {isLeagueWide && openMarketIds.length === 0 && players.length > 0 && (
                    <span className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-loss)]">Closed</span>
                )}
                {/* Market status -- single division */}
                {!isLeagueWide && market?.status === 'open' && (
                    isOwner ? (
                        <button onClick={onToggleMarketStatus} className="flex items-center gap-1.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-gain)] cursor-pointer hover:opacity-80 transition-opacity" title="Click to close market">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--forge-gain)] shadow-[0_0_8px_var(--forge-gain)]" style={{ animation: 'forge-blink 2s infinite' }} />
                            Open
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-gain)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--forge-gain)] shadow-[0_0_8px_var(--forge-gain)]" style={{ animation: 'forge-blink 2s infinite' }} />
                            Open
                        </div>
                    )
                )}
                {market?.status === 'closed' && (
                    isOwner ? (
                        <button onClick={onToggleMarketStatus} className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-loss)] cursor-pointer hover:opacity-80 transition-opacity" title="Click to open market">
                            Closed
                        </button>
                    ) : (
                        <span className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-loss)]">Closed</span>
                    )
                )}
                {market?.status === 'liquidated' && (
                    <span className="forge-head text-[0.85rem] font-semibold tracking-wider text-[var(--forge-text-dim)]">Season Ended</span>
                )}
                {/* Mobile Guide button */}
                <button
                    onClick={() => onNavigateTab('wiki')}
                    className={`sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded border forge-head text-[0.75rem] font-semibold tracking-wider transition-all ${
                        activeTab === 'wiki'
                            ? 'text-[var(--forge-flame-bright)] border-[var(--forge-flame)] bg-[var(--forge-flame)]/10'
                            : 'text-[var(--forge-text-dim)] border-[var(--forge-text-dim)]/30 hover:text-[var(--forge-text-mid)] hover:border-[var(--forge-text-dim)]/50'
                    }`}
                >
                    <BookOpen size={12} />
                    Guide
                </button>
            </div>
        </div>
    )
}
