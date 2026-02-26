import { useMemo, useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Flame, Trophy } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { SORT_OPTIONS } from './forgeConstants'
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
    search, setSearch, sortBy, setSortBy, teamFilter, setTeamFilter,
    loading, marketStatus, featuredPlayer, historyData, userTeamId, isOwner,
    changeView, freeSparksRemaining, referralSparksAvailable = 0, seasonSlugs,
    isLeagueWide, leagueSlug, userTeamBySeasonId, openMarketIds,
    onFuel, onCool, onSelectPlayer, onSpotlightPlayer, onRandomPlayer,
}) {
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

    // Top 3 by price for featured cards
    const top3 = useMemo(() => {
        return [...allPlayers]
            .sort((a, b) => b.currentPrice - a.currentPrice)
            .slice(0, 3)
    }, [allPlayers])

    // All players for the table (top performers also appear in cards above)
    const tableRows = players

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
            </div>

            {/* Player rows */}
            <div className="flex flex-col gap-[2px] forge-stagger" style={{ minHeight: '80vh' }}>
                {tableRows.map(p => (
                    <ForgePlayerRow
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
                        onSelect={onSelectPlayer}
                        onSpotlight={onSpotlightPlayer}
                        onFuel={onFuel}
                        onCool={onCool}
                    />
                ))}
            </div>

            {players.length === 0 && (
                <div className="text-center py-8 text-[var(--forge-text-dim)]">
                    No players match your search.
                </div>
            )}
        </div>
    )
}
