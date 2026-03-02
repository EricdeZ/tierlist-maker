import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Search, ChevronDown, Flame, Trophy, TrendingUp } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { SORT_OPTIONS, ROLES } from './forgeConstants'
import ForgeHero from './ForgeHero'
import ForgePlayerCard from './ForgePlayerCard'
import ForgePlayerRow from './ForgePlayerRow'
import forgeLogo from '../../assets/forge.png'
import sparkIcon from '../../assets/spark.png'

function TeamFilterDropdown({ teams, value, onChange }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const selectedTeam = teams.find(t => t.slug === value)

    useEffect(() => {
        if (!open) return
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-sm sm:text-lg cursor-pointer hover:border-[var(--forge-border-lt)] transition-colors whitespace-nowrap"
            >
                {selectedTeam ? (
                    <>
                        <TeamLogo slug={selectedTeam.slug} name={selectedTeam.name} size={16} color={selectedTeam.color} />
                        <span>{selectedTeam.name}</span>
                    </>
                ) : (
                    <span>All Teams</span>
                )}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-[var(--color-primary)] border border-[var(--forge-border)] shadow-xl z-50 max-h-[300px] overflow-y-auto">
                    <button
                        onClick={() => { onChange(''); setOpen(false) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                            !value ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
                        }`}
                    >
                        All Teams
                    </button>
                    {teams.map(t => (
                        <button
                            key={t.slug}
                            onClick={() => { onChange(t.slug); setOpen(false) }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left forge-body text-base hover:bg-[var(--forge-surface)] transition-colors ${
                                value === t.slug ? 'text-[var(--forge-flame-bright)]' : 'text-[var(--forge-text-mid)]'
                            }`}
                        >
                            <TeamLogo slug={t.slug} name={t.name} size={16} color={t.color} />
                            <span>{t.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function ForgeMarketTab({
    players, allPlayers, teams,
    search, setSearch, sortBy, setSortBy, teamFilter, setTeamFilter, roleFilter, setRoleFilter,
    loading, marketStatus, featuredPlayer, historyData, userTeamId, isOwner,
    changeView, freeSparksRemaining, referralSparksAvailable = 0, seasonSlugs,
    isLeagueWide, leagueSlug, userTeamBySeasonId, openMarketIds,
    fuelingLocked, coolingLocked,
    onFuel, onCool, onSelectPlayer, onSpotlightPlayer, onRandomPlayer,
}) {
    // All hooks must be called before any early returns
    const top3 = useMemo(() => {
        return [...allPlayers]
            .sort((a, b) => b.currentPrice - a.currentPrice)
            .slice(0, 3)
    }, [allPlayers])

    // Progressive loading on mobile only — render in batches to avoid choking
    const MOBILE_BATCH = 20
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
    const [visibleCount, setVisibleCount] = useState(() => isMobile ? MOBILE_BATCH : 0)

    // Reset when filters change (mobile only)
    useEffect(() => {
        if (isMobile) setVisibleCount(MOBILE_BATCH)
    }, [search, sortBy, teamFilter, roleFilter])

    const loadMore = useCallback(() => {
        setVisibleCount(prev => prev + MOBILE_BATCH)
    }, [])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <img src={forgeLogo} alt="" className="w-24 h-24 object-contain forge-logo-float opacity-40 mb-3" />
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading the Forge...</div>
                <div className="w-32 h-1 mt-2 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                    <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
                </div>
            </div>
        )
    }

    if (allPlayers.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">No active market found for this season.</div>
            </div>
        )
    }

    const tableRows = isMobile ? players.slice(0, visibleCount) : players
    const hasMore = isMobile && visibleCount < players.length

    return (
        <div>
            {/* Hero spotlight */}
            {featuredPlayer && (
                <ForgeHero
                    player={featuredPlayer}
                    historyData={historyData}
                    marketStatus={marketStatus}
                    userTeamId={userTeamId}
                    isOwner={isOwner}
                    changeView={changeView}
                    seasonSlugs={seasonSlugs}
                    isLeagueWide={isLeagueWide}
                    leagueSlug={leagueSlug}
                    userTeamBySeasonId={userTeamBySeasonId}
                    openMarketIds={openMarketIds}
                    fuelingLocked={fuelingLocked}
                    coolingLocked={coolingLocked}
                    onFuel={onFuel}
                    onCool={onCool}
                    onRandom={onRandomPlayer}
                />
            )}

            {/* Starter Sparks banner */}
            {freeSparksRemaining > 0 && (
                <div className="mb-4 p-2.5 sm:p-3 bg-[var(--forge-flame)]/5 border border-[var(--forge-flame)]/15 flex items-center gap-2 sm:gap-3">
                    <img
                        src={sparkIcon}
                        alt=""
                        className="w-8 h-8 sm:w-12 sm:h-12 object-contain flex-shrink-0 forge-spark-icon-lg"
                    />
                    <div>
                        <span className="forge-head text-xs sm:text-sm font-bold tracking-wider text-[var(--forge-flame-bright)]">
                            {freeSparksRemaining} Starter Spark{freeSparksRemaining !== 1 ? 's' : ''} Available
                        </span>
                        <span className="forge-body text-xs sm:text-sm text-[var(--forge-text-mid)] ml-1 sm:ml-2">
                            — Fuel any player for free!
                        </span>
                    </div>
                </div>
            )}

            {/* Referral Sparks banner */}
            {referralSparksAvailable > 0 && freeSparksRemaining <= 0 && (
                <div className="mb-4 p-2.5 sm:p-3 bg-[var(--forge-flame)]/5 border border-[var(--forge-flame)]/15 flex items-center gap-2 sm:gap-3">
                    <img
                        src={sparkIcon}
                        alt=""
                        className="w-8 h-8 sm:w-12 sm:h-12 object-contain flex-shrink-0 forge-spark-icon-lg"
                    />
                    <div>
                        <span className="forge-head text-xs sm:text-sm font-bold tracking-wider text-[var(--forge-flame-bright)]">
                            {referralSparksAvailable} Referral Spark{referralSparksAvailable !== 1 ? 's' : ''} Available
                        </span>
                        <span className="forge-body text-xs sm:text-sm text-[var(--forge-text-mid)] ml-1 sm:ml-2">
                            — Fuel any player for free!
                        </span>
                    </div>
                </div>
            )}

            {/* Top Performers section */}
            {!teamFilter && (
                <>
                    <div className="forge-top-header relative pb-2 mb-3 border-b border-[var(--forge-border)]">
                        <h2 className="forge-head text-xl font-bold tracking-wider flex items-center gap-2">
                            <Flame size={18} className="text-[var(--forge-flame)]" style={{ filter: 'drop-shadow(0 0 6px rgba(232,101,32,0.4))' }} />
                            <span className="text-[var(--forge-flame-bright)]">Top Performers</span>
                            <Trophy size={16} className="text-[var(--forge-gold-bright)] ml-1" />
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 forge-stagger">
                        {top3.map((p, i) => (
                            <ForgePlayerCard
                                key={p.sparkId}
                                player={p}
                                selected={featuredPlayer?.sparkId === p.sparkId}
                                marketStatus={marketStatus}
                                userTeamId={userTeamId}
                                isOwner={isOwner}
                                changeView={changeView}
                                seasonSlugs={seasonSlugs}
                                isLeagueWide={isLeagueWide}
                                leagueSlug={leagueSlug}
                                userTeamBySeasonId={userTeamBySeasonId}
                                openMarketIds={openMarketIds}
                                fuelingLocked={fuelingLocked}
                                coolingLocked={coolingLocked}
                                onSelect={onSelectPlayer}
                                onFuel={onFuel}
                                onCool={onCool}
                                tutorialIndex={i === 0 ? 0 : undefined}
                                rank={i + 1}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Filters */}
            <div className="relative pb-1.5 mb-2.5 border-b border-[var(--forge-border)]">
                <h2 className="forge-head text-lg font-bold tracking-wider text-[var(--forge-text-mid)]">
                    All Sparks
                </h2>
                <div className="forge-section-accent" />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={e => {
                        if (window.innerWidth < 640) {
                            setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                        }
                    }}
                    placeholder="Search players, teams..."
                    data-tutorial="search-input"
                    className="flex-1 min-w-[150px] py-2 px-3 bg-[var(--forge-surface)] border border-[var(--forge-border)] text-[var(--forge-text)] forge-body text-base sm:text-lg outline-none focus:border-[var(--forge-flame)]/40 transition-colors placeholder:text-[var(--forge-text-dim)]"
                />

                <TeamFilterDropdown
                    teams={teams}
                    value={teamFilter}
                    onChange={setTeamFilter}
                />

                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-sm sm:text-lg cursor-pointer hover:border-[var(--forge-border-lt)]"
                >
                    {SORT_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                </select>

                <button
                    onClick={() => setSortBy(sortBy === 'perf-desc' ? 'price-desc' : 'perf-desc')}
                    className={`hidden sm:flex items-center gap-1.5 py-2 px-3 forge-head text-sm font-semibold tracking-wider cursor-pointer transition-colors ${
                        sortBy === 'perf-desc'
                            ? 'bg-[var(--forge-flame)]/15 border border-[var(--forge-flame)]/40 text-[var(--forge-flame-bright)]'
                            : 'bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] hover:border-[var(--forge-border-lt)]'
                    }`}
                >
                    <TrendingUp size={14} />
                    Sort by Performance
                </button>
            </div>

            {/* Role filter chips */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                {['', ...ROLES].map(role => (
                    <button
                        key={role || 'all'}
                        onClick={() => setRoleFilter(role)}
                        className={`flex-shrink-0 py-1 px-3 forge-head text-xs sm:text-sm font-semibold tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                            roleFilter === role
                                ? 'bg-[var(--forge-flame)]/15 border border-[var(--forge-flame)]/40 text-[var(--forge-flame-bright)]'
                                : 'bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] hover:border-[var(--forge-border-lt)]'
                        }`}
                    >
                        {role || 'All Roles'}
                    </button>
                ))}
            </div>

            {/* Player rows */}
            <div className="flex flex-col gap-[2px] forge-stagger" style={{ minHeight: '80vh' }}>
                {tableRows.map((p, i) => (
                    <ForgePlayerRow
                        key={p.sparkId}
                        player={p}
                        listIndex={i}
                        selected={featuredPlayer?.sparkId === p.sparkId}
                        marketStatus={marketStatus}
                        userTeamId={userTeamId}
                        isOwner={isOwner}
                        changeView={changeView}
                        seasonSlugs={seasonSlugs}
                        isLeagueWide={isLeagueWide}
                        leagueSlug={leagueSlug}
                        userTeamBySeasonId={userTeamBySeasonId}
                        openMarketIds={openMarketIds}
                        fuelingLocked={fuelingLocked}
                        coolingLocked={coolingLocked}
                        onSelect={onSelectPlayer}
                        onSpotlight={onSpotlightPlayer}
                        onFuel={onFuel}
                        onCool={onCool}
                    />
                ))}
            </div>

            {hasMore && (
                <button
                    onClick={loadMore}
                    className="w-full py-3 mt-1 forge-head text-sm font-semibold tracking-wider text-[var(--forge-flame-bright)] bg-[var(--forge-panel)] border border-[var(--forge-border)] cursor-pointer hover:bg-[var(--forge-surface)] transition-colors"
                >
                    Show More ({players.length - visibleCount} remaining)
                </button>
            )}

            {players.length === 0 && (
                <div className="text-center py-8 text-[var(--forge-text-dim)]">
                    No players match your search.
                </div>
            )}
        </div>
    )
}
