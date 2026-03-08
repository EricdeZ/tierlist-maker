// src/components/stages/SwissView.jsx
// Public Swiss format display with round pairings and standings
import TeamLogo from '../TeamLogo'

function computeSwissStandings(matches, groupTeams) {
    const stats = {}

    // Initialize from group team assignments (if available)
    for (const gt of groupTeams) {
        stats[gt.team_id] = {
            team_id: gt.team_id,
            name: gt.team_name,
            slug: gt.team_slug,
            color: gt.team_color,
            logo_url: gt.team_logo_url,
            seed: gt.seed,
            wins: 0,
            losses: 0,
            opponents: [],
        }
    }

    // Also discover teams from matches if not in groupTeams
    for (const m of matches) {
        for (const tid of [m.team1_id, m.team2_id]) {
            if (tid && !stats[tid]) {
                const isT1 = tid === m.team1_id
                stats[tid] = {
                    team_id: tid,
                    name: isT1 ? m.team1_name : m.team2_name,
                    slug: isT1 ? m.team1_slug : m.team2_slug,
                    color: isT1 ? m.team1_color : m.team2_color,
                    logo_url: isT1 ? m.team1_logo_url : m.team2_logo_url,
                    seed: null,
                    wins: 0,
                    losses: 0,
                    opponents: [],
                }
            }
        }
    }

    // Tally results
    for (const m of matches) {
        if (!m.is_completed || !m.winner_team_id) continue
        const loserId = m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id
        if (stats[m.winner_team_id]) {
            stats[m.winner_team_id].wins++
            stats[m.winner_team_id].opponents.push(loserId)
        }
        if (stats[loserId]) {
            stats[loserId].losses++
            stats[loserId].opponents.push(m.winner_team_id)
        }
    }

    // Compute Buchholz (sum of opponents' wins)
    for (const s of Object.values(stats)) {
        s.buchholz = s.opponents.reduce((sum, oppId) => {
            return sum + (stats[oppId]?.wins || 0)
        }, 0)
    }

    // Sort: wins desc, buchholz desc, seed asc
    return Object.values(stats).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz
        if (a.seed != null && b.seed != null) return a.seed - b.seed
        return 0
    })
}

function SwissStandings({ standings, advanceCount, eliminateThreshold, leagueColor }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]/50">
                        <th className="text-left py-2 px-3 font-bold w-8">#</th>
                        <th className="text-left py-2 px-1 font-bold">Team</th>
                        <th className="text-center py-2 px-2 font-bold">Record</th>
                        <th className="text-center py-2 px-2 font-bold hidden sm:table-cell">Buchholz</th>
                        <th className="text-center py-2 px-2 font-bold w-16">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((team, i) => {
                        const advances = advanceCount != null && team.wins >= advanceCount
                        const eliminated = eliminateThreshold != null && team.losses >= eliminateThreshold

                        return (
                            <tr
                                key={team.team_id}
                                className={`border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] ${eliminated ? 'opacity-40' : ''}`}
                            >
                                <td className="py-2.5 px-3 text-[var(--color-text-secondary)]/40 tabular-nums font-bold text-xs">{i + 1}</td>
                                <td className="py-2.5 px-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <TeamLogo slug={team.slug} name={team.name} size={20} color={team.color} logoUrl={team.logo_url} />
                                        <span className="font-bold text-[var(--color-text)] truncate">{team.name}</span>
                                        {team.seed != null && (
                                            <span className="text-[10px] text-[var(--color-text-secondary)]/30 shrink-0">(#{team.seed})</span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-center py-2.5 px-2 tabular-nums">
                                    <span className="text-green-400 font-bold">{team.wins}</span>
                                    <span className="text-[var(--color-text-secondary)]/30 mx-0.5">-</span>
                                    <span className="text-red-400/70 font-bold">{team.losses}</span>
                                </td>
                                <td className="text-center py-2.5 px-2 text-[var(--color-text-secondary)]/60 tabular-nums hidden sm:table-cell">
                                    {team.buchholz}
                                </td>
                                <td className="text-center py-2.5 px-2">
                                    {advances && (
                                        <span
                                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                            style={{ background: `${leagueColor}15`, color: leagueColor }}
                                        >
                                            Advanced
                                        </span>
                                    )}
                                    {eliminated && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/60">
                                            Eliminated
                                        </span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function RoundPairings({ round, matches }) {
    const roundMatches = matches
        .filter(m => m.round_id === round.id)
        .sort((a, b) => (a.bracket_position ?? 999) - (b.bracket_position ?? 999))

    if (roundMatches.length === 0) {
        return (
            <div className="text-xs text-[var(--color-text-secondary)]/30 italic text-center py-3">
                No pairings yet
            </div>
        )
    }

    return (
        <div className="space-y-1.5">
            {roundMatches.map(match => {
                const isCompleted = match.is_completed
                const t1Won = match.winner_team_id === match.team1_id
                const t2Won = match.winner_team_id === match.team2_id

                return (
                    <div
                        key={match.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            isCompleted ? 'border-white/[0.06]' : 'border-white/[0.04] border-dashed'
                        }`}
                        style={{ backgroundColor: isCompleted ? 'var(--color-primary)' : 'transparent' }}
                    >
                        {/* Team 1 */}
                        <div className={`flex items-center gap-2 flex-1 min-w-0 ${isCompleted && !t1Won ? 'opacity-35' : ''}`}>
                            {match.team1_id ? (
                                <>
                                    <TeamLogo slug={match.team1_slug} name={match.team1_name} size={16} color={match.team1_color} logoUrl={match.team1_logo_url} />
                                    <span className="text-xs font-bold text-[var(--color-text)] truncate">{match.team1_name}</span>
                                </>
                            ) : (
                                <span className="text-xs text-[var(--color-text-secondary)]/30 italic">TBD</span>
                            )}
                            {t1Won && <span className="text-[9px] font-black text-green-400 shrink-0">W</span>}
                        </div>

                        {/* VS / Score */}
                        <div className="shrink-0 px-2">
                            {isCompleted && match.team1_score != null ? (
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)]/60 tabular-nums">
                                    {match.team1_score}-{match.team2_score}
                                </span>
                            ) : (
                                <span className="text-[9px] text-[var(--color-text-secondary)]/20 uppercase">vs</span>
                            )}
                        </div>

                        {/* Team 2 */}
                        <div className={`flex items-center gap-2 flex-1 min-w-0 justify-end ${isCompleted && !t2Won ? 'opacity-35' : ''}`}>
                            {t2Won && <span className="text-[9px] font-black text-green-400 shrink-0">W</span>}
                            {match.team2_id ? (
                                <>
                                    <span className="text-xs font-bold text-[var(--color-text)] truncate text-right">{match.team2_name}</span>
                                    <TeamLogo slug={match.team2_slug} name={match.team2_name} size={16} color={match.team2_color} logoUrl={match.team2_logo_url} />
                                </>
                            ) : (
                                <span className="text-xs text-[var(--color-text-secondary)]/30 italic">TBD</span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default function SwissView({
    rounds,
    groupTeams,
    matches,
    leagueColor = 'var(--color-accent)',
    advanceCount,      // wins needed to advance (e.g. 3 in a 3-win-advance format)
    eliminateThreshold, // losses to be eliminated (e.g. 3 in a 3-loss-eliminate format)
}) {
    const sortedRounds = [...rounds].sort((a, b) => a.sort_order - b.sort_order)
    const standings = computeSwissStandings(matches, groupTeams)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Standings (takes 1 column) */}
            <div
                className="rounded-xl border border-white/[0.06] overflow-hidden lg:col-span-1"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                <div className="px-4 py-2.5 border-b border-white/[0.06]">
                    <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Standings</span>
                </div>
                <SwissStandings
                    standings={standings}
                    advanceCount={advanceCount}
                    eliminateThreshold={eliminateThreshold}
                    leagueColor={leagueColor}
                />
            </div>

            {/* Round pairings (takes 2 columns) */}
            <div className="lg:col-span-2 space-y-4">
                {sortedRounds.map(round => {
                    const roundMatchCount = matches.filter(m => m.round_id === round.id).length
                    const completedCount = matches.filter(m => m.round_id === round.id && m.is_completed).length

                    return (
                        <div
                            key={round.id}
                            className="rounded-xl border border-white/[0.06] overflow-hidden"
                            style={{ backgroundColor: 'var(--color-secondary)' }}
                        >
                            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-[var(--color-text)] font-heading">{round.name}</span>
                                    {round.best_of_override && (
                                        <span className="text-[10px] text-[var(--color-text-secondary)]/40">Bo{round.best_of_override}</span>
                                    )}
                                </div>
                                <span className="text-[10px] text-[var(--color-text-secondary)]/40 uppercase tracking-wider">
                                    {completedCount}/{roundMatchCount}
                                </span>
                            </div>
                            <div className="p-3">
                                <RoundPairings round={round} matches={matches} />
                            </div>
                        </div>
                    )
                })}

                {sortedRounds.length === 0 && (
                    <p className="text-sm text-[var(--color-text-secondary)]/50 italic text-center py-8">No rounds configured yet.</p>
                )}
            </div>
        </div>
    )
}
