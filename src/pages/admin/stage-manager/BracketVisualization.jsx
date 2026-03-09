import { MATCH_STATUS_COLORS } from './constants'

export default function BracketVisualization({ stage, rounds, scheduledMatches, getSourceDescription }) {
    const isDouble = stage.stage_type === 'double_elimination'

    // Organize matches by round
    const roundMap = {}
    for (const r of rounds) {
        roundMap[r.id] = { ...r, matches: [] }
    }
    // Also handle matches without a round assignment
    const unroundedMatches = []
    for (const m of scheduledMatches) {
        if (m.round_id && roundMap[m.round_id]) {
            roundMap[m.round_id].matches.push(m)
        } else {
            unroundedMatches.push(m)
        }
    }

    // Sort matches within each round by bracket_position
    for (const r of Object.values(roundMap)) {
        r.matches.sort((a, b) => (a.bracket_position ?? 999) - (b.bracket_position ?? 999))
    }

    const sortedRounds = rounds.slice().sort((a, b) => a.sort_order - b.sort_order)

    // For double elimination, split into winners/losers by naming convention or group
    let winnersRounds = sortedRounds
    let losersRounds = []
    if (isDouble) {
        winnersRounds = sortedRounds.filter(r => {
            const nameLower = r.name.toLowerCase()
            return !nameLower.includes('loser') && !nameLower.startsWith('l')
        })
        losersRounds = sortedRounds.filter(r => {
            const nameLower = r.name.toLowerCase()
            return nameLower.includes('loser') || nameLower.startsWith('l')
        })
        // If the heuristic didn't split them, just show all in winners
        if (losersRounds.length === 0) {
            winnersRounds = sortedRounds
        }
    }

    return (
        <div>
            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Bracket</h3>
            <div className="overflow-x-auto">
                {isDouble && losersRounds.length > 0 && (
                    <div className="mb-2">
                        <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">Winners Bracket</span>
                    </div>
                )}
                <BracketRow rounds={winnersRounds} roundMap={roundMap} getSourceDescription={getSourceDescription} />

                {isDouble && losersRounds.length > 0 && (
                    <>
                        <div className="my-3 border-t border-white/10" />
                        <div className="mb-2">
                            <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Losers Bracket</span>
                        </div>
                        <BracketRow rounds={losersRounds} roundMap={roundMap} getSourceDescription={getSourceDescription} />
                    </>
                )}
            </div>
        </div>
    )
}

function BracketRow({ rounds, roundMap, getSourceDescription }) {
    if (rounds.length === 0) return null

    return (
        <div className="flex gap-0 items-stretch min-w-fit">
            {rounds.map((round, roundIdx) => {
                const rd = roundMap[round.id]
                const matches = rd?.matches || []
                const isLast = roundIdx === rounds.length - 1

                return (
                    <div key={round.id} className="flex flex-col items-center" style={{ minWidth: 220 }}>
                        {/* Round header */}
                        <div className="text-xs text-[var(--color-text-secondary)] font-semibold mb-2 text-center px-2 truncate w-full">
                            {round.name}
                        </div>

                        {/* Match slots */}
                        <div className="flex flex-col justify-around flex-1 gap-2 w-full px-1">
                            {matches.length === 0 ? (
                                <div className="text-xs text-[var(--color-text-secondary)] italic text-center py-4">No matches</div>
                            ) : (
                                matches.map((match) => (
                                    <div key={match.id} className="flex items-center">
                                        <BracketMatchBox match={match} getSourceDescription={getSourceDescription} />
                                        {/* Connector line to next round */}
                                        {!isLast && (
                                            <div className="w-4 flex items-center justify-center">
                                                <div className="w-full h-px bg-white/20" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function BracketMatchBox({ match, getSourceDescription }) {
    const isCancelled = match.status === 'cancelled'
    const statusColor = MATCH_STATUS_COLORS[match.status] || MATCH_STATUS_COLORS.scheduled

    const team1Label = match.team1_name || getSourceDescription(match.team1_source) || 'TBD'
    const team2Label = match.team2_name || getSourceDescription(match.team2_source) || 'TBD'

    return (
        <div className={`rounded-lg border border-white/10 overflow-hidden flex-1 ${isCancelled ? 'opacity-50' : ''}`}
            style={{ backgroundColor: 'var(--color-primary)', maxWidth: 200 }}>
            {/* Team 1 */}
            <div className={`flex items-center gap-1.5 px-2 py-1.5 ${match.team1_name ? '' : 'opacity-50'}`}>
                {match.team1_name ? (
                    <>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: match.team1_color || '#3b82f6' }} />
                        <span className="text-xs text-[var(--color-text)] truncate flex-1">{match.team1_name}</span>
                    </>
                ) : (
                    <span className="text-xs text-[var(--color-text-secondary)] italic truncate flex-1">{team1Label}</span>
                )}
            </div>

            {/* Divider with status */}
            <div className="flex items-center gap-1 px-2 border-y border-white/5">
                <div className="flex-1 h-px bg-white/10" />
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>{match.status}</span>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Team 2 */}
            <div className={`flex items-center gap-1.5 px-2 py-1.5 ${match.team2_name ? '' : 'opacity-50'}`}>
                {match.team2_name ? (
                    <>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: match.team2_color || '#ef4444' }} />
                        <span className="text-xs text-[var(--color-text)] truncate flex-1">{match.team2_name}</span>
                    </>
                ) : (
                    <span className="text-xs text-[var(--color-text-secondary)] italic truncate flex-1">{team2Label}</span>
                )}
            </div>
        </div>
    )
}
