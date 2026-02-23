import { useMemo, useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { SORT_OPTIONS } from './forgeConstants'
import ForgeHero from './ForgeHero'
import ForgePlayerCard from './ForgePlayerCard'
import ForgePlayerRow from './ForgePlayerRow'

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
                className="flex items-center gap-2 py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-lg cursor-pointer hover:border-[var(--forge-border-lt)] transition-colors whitespace-nowrap"
            >
                {selectedTeam ? (
                    <>
                        <TeamLogo slug={selectedTeam.slug} name={selectedTeam.name} size={16} />
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
                            <TeamLogo slug={t.slug} name={t.name} size={16} />
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
    loading, marketStatus, featuredPlayer, historyData,
    onFuel, onCool, onSelectPlayer,
}) {
    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading the Forge...</div>
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

    // Remaining players for table (excluding top 3 if unfiltered)
    const tableRows = useMemo(() => {
        const top3Ids = new Set(top3.map(p => p.sparkId))
        // If user is searching/filtering, show all matching; otherwise exclude top 3
        if (search.trim() || teamFilter) return players
        return players.filter(p => !top3Ids.has(p.sparkId))
    }, [players, top3, search, teamFilter])

    return (
        <div>
            {/* Hero spotlight */}
            {featuredPlayer && (
                <ForgeHero
                    player={featuredPlayer}
                    historyData={historyData}
                    marketStatus={marketStatus}
                    onFuel={onFuel}
                    onCool={onCool}
                />
            )}

            {/* Top Performers section */}
            {!search.trim() && !teamFilter && (
                <>
                    <div className="relative pb-1.5 mb-2.5 border-b border-[var(--forge-border)]">
                        <h2 className="forge-head text-lg font-bold tracking-wider text-[var(--forge-text-mid)]">
                            Top Performers
                        </h2>
                        <div className="forge-section-accent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
                        {top3.map(p => (
                            <ForgePlayerCard
                                key={p.sparkId}
                                player={p}
                                selected={featuredPlayer?.sparkId === p.sparkId}
                                marketStatus={marketStatus}
                                onSelect={onSelectPlayer}
                                onFuel={onFuel}
                                onCool={onCool}
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

            <div className="flex gap-1.5 mb-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search players, teams..."
                    className="flex-1 py-2 px-3 bg-[var(--forge-surface)] border border-[var(--forge-border)] text-[var(--forge-text)] forge-body text-lg outline-none focus:border-[var(--forge-border-lt)] placeholder:text-[var(--forge-text-dim)]"
                />

                <TeamFilterDropdown
                    teams={teams}
                    value={teamFilter}
                    onChange={setTeamFilter}
                />

                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="py-2 px-3 bg-[var(--forge-panel)] border border-[var(--forge-border)] text-[var(--forge-text-mid)] forge-body text-lg cursor-pointer hover:border-[var(--forge-border-lt)]"
                >
                    {SORT_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                </select>
            </div>

            {/* Player rows */}
            <div className="flex flex-col gap-[2px]">
                {tableRows.map(p => (
                    <ForgePlayerRow
                        key={p.sparkId}
                        player={p}
                        selected={featuredPlayer?.sparkId === p.sparkId}
                        marketStatus={marketStatus}
                        onSelect={onSelectPlayer}
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
