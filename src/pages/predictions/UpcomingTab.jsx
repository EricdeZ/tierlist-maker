import { Target, Flame, Coins, ChevronDown } from 'lucide-react'
import { INITIAL_SHOW } from './constants'
import { FilterBar } from './FilterBar'
import { FeaturedCard, MatchCard } from './MatchCards'

export function UpcomingTab({
    weekGroups, featured, loading, error, user, login, passion,
    leagues, selectedLeague, setSelectedLeague,
    selectedDivision, setSelectedDivision, availableDivisions,
    search, setSearch, showAll, setShowAll, onPredictionMade, onCoinFlip,
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="py-8 text-center">
                <p className="text-red-400/80 text-sm">{error}</p>
            </div>
        )
    }

    // Flatten all non-featured matches, limit to INITIAL_SHOW unless showAll
    const allRegular = weekGroups.flatMap(g => g.matches)
    const visibleCount = showAll ? allRegular.length : INITIAL_SHOW
    const hasMore = allRegular.length > INITIAL_SHOW && !showAll

    // Rebuild week groups from visible matches
    const visibleMatches = allRegular.slice(0, visibleCount)
    const visibleGroups = []
    let curWeek = null, curGroup = null
    for (const m of visibleMatches) {
        const week = m.week ?? null
        if (week !== curWeek) {
            curWeek = week
            curGroup = { week, matches: [] }
            visibleGroups.push(curGroup)
        }
        curGroup.matches.push(m)
    }

    const noMatches = featured.length === 0 && allRegular.length === 0

    return (
        <div>
            <FilterBar
                leagues={leagues} selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague}
                selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision}
                availableDivisions={availableDivisions} search={search} setSearch={setSearch}
            />

            {noMatches ? (
                <div className="py-20 text-center">
                    <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No Active Markets</h3>
                    <p className="text-white/40 text-sm">New markets open when matches are scheduled.</p>
                </div>
            ) : (
                <>
                    {/* Coin flip button */}
                    <div className="flex justify-end mb-4">
                        <button onClick={onCoinFlip}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            style={{ background: 'rgba(248,197,106,0.1)', border: '1px solid rgba(248,197,106,0.2)', color: '#f8c56a' }}>
                            <Coins className="w-4 h-4" />
                            Can't Decide? Flip!
                        </button>
                    </div>

                    {/* Featured matches */}
                    {featured.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <Flame className="w-4 h-4" style={{ color: '#f8c56a' }} />
                                <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: '#f8c56a' }}>
                                    Featured Matches
                                </span>
                            </div>
                            <div className="space-y-4">
                                {featured.map((m, i) => (
                                    <FeaturedCard key={m.id} match={m} index={i} user={user} login={login} passion={passion} onPredictionMade={onPredictionMade} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Week groups */}
                    {visibleGroups.map((group, gi) => (
                        <div key={gi} className="mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                                    {group.week ? `Week ${group.week}` : 'Unscheduled'}
                                </span>
                                <div className="flex-1 h-px bg-white/[0.06]" />
                                <span className="text-[10px] text-white/30">{group.matches.length}</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {group.matches.map((m, i) => (
                                    <MatchCard key={m.id} match={m} index={i} user={user} login={login} passion={passion} onPredictionMade={onPredictionMade} />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Show more button */}
                    {hasMore && (
                        <div className="text-center mt-6">
                            <button onClick={() => setShowAll(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <ChevronDown className="w-4 h-4" />
                                Show {allRegular.length - INITIAL_SHOW} More Matches
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
