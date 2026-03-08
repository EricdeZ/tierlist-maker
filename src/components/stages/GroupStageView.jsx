// src/components/stages/GroupStageView.jsx
// Public group stage display with standings tables and qualification indicators
import TeamLogo from '../TeamLogo'

function computeStandings(groupId, matches, groupTeams) {
    const teamStats = {}

    // Initialize from group team assignments
    for (const gt of groupTeams.filter(t => t.group_id === groupId)) {
        teamStats[gt.team_id] = {
            team_id: gt.team_id,
            name: gt.team_name,
            slug: gt.team_slug,
            color: gt.team_color,
            logo_url: gt.team_logo_url,
            seed: gt.seed,
            wins: 0,
            losses: 0,
            map_wins: 0,
            map_losses: 0,
        }
    }

    // Tally from completed matches in this group
    for (const m of matches) {
        if (m.group_id !== groupId || !m.is_completed || !m.winner_team_id) continue
        const loserId = m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id
        if (teamStats[m.winner_team_id]) {
            teamStats[m.winner_team_id].wins++
        }
        if (teamStats[loserId]) {
            teamStats[loserId].losses++
        }
        // Map score if available
        if (m.team1_score != null && m.team2_score != null) {
            if (teamStats[m.team1_id]) {
                teamStats[m.team1_id].map_wins += m.team1_score
                teamStats[m.team1_id].map_losses += m.team2_score
            }
            if (teamStats[m.team2_id]) {
                teamStats[m.team2_id].map_wins += m.team2_score
                teamStats[m.team2_id].map_losses += m.team1_score
            }
        }
    }

    // Sort: wins desc, map diff desc, map wins desc
    return Object.values(teamStats).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        const diffA = a.map_wins - a.map_losses
        const diffB = b.map_wins - b.map_losses
        if (diffB !== diffA) return diffB - diffA
        return b.map_wins - a.map_wins
    })
}

function StandingsTable({ standings, advanceCount, leagueColor }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]/50">
                        <th className="text-left py-2 px-3 font-bold w-8">#</th>
                        <th className="text-left py-2 px-1 font-bold">Team</th>
                        <th className="text-center py-2 px-2 font-bold">W</th>
                        <th className="text-center py-2 px-2 font-bold">L</th>
                        <th className="text-center py-2 px-2 font-bold">Win%</th>
                        <th className="text-center py-2 px-2 font-bold hidden sm:table-cell">Maps</th>
                        <th className="text-center py-2 px-2 font-bold hidden sm:table-cell">Diff</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((team, i) => {
                        const total = team.wins + team.losses
                        const winPct = total > 0 ? ((team.wins / total) * 100).toFixed(0) : '—'
                        const mapDiff = team.map_wins - team.map_losses
                        const advances = advanceCount != null && i < advanceCount

                        return (
                            <tr
                                key={team.team_id}
                                className={`border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] ${advances ? '' : ''}`}
                            >
                                <td className="py-2.5 px-3 tabular-nums">
                                    <span
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                                            advances
                                                ? 'text-green-400'
                                                : 'text-[var(--color-text-secondary)]/40'
                                        }`}
                                        style={advances ? { background: `${leagueColor}15` } : {}}
                                    >
                                        {i + 1}
                                    </span>
                                </td>
                                <td className="py-2.5 px-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <TeamLogo slug={team.slug} name={team.name} size={20} color={team.color} logoUrl={team.logo_url} />
                                        <span className="font-bold text-[var(--color-text)] truncate">{team.name}</span>
                                        {team.seed != null && (
                                            <span className="text-[10px] text-[var(--color-text-secondary)]/30 shrink-0">
                                                (#{team.seed})
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-center py-2.5 px-2 font-bold text-green-400 tabular-nums">{team.wins}</td>
                                <td className="text-center py-2.5 px-2 font-bold text-red-400/70 tabular-nums">{team.losses}</td>
                                <td className="text-center py-2.5 px-2 text-[var(--color-text-secondary)] tabular-nums">{winPct}{winPct !== '—' ? '%' : ''}</td>
                                <td className="text-center py-2.5 px-2 text-[var(--color-text-secondary)]/60 tabular-nums hidden sm:table-cell">
                                    {team.map_wins}-{team.map_losses}
                                </td>
                                <td className="text-center py-2.5 px-2 tabular-nums hidden sm:table-cell">
                                    <span className={mapDiff > 0 ? 'text-green-400' : mapDiff < 0 ? 'text-red-400/70' : 'text-[var(--color-text-secondary)]/40'}>
                                        {mapDiff > 0 ? '+' : ''}{mapDiff}
                                    </span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default function GroupStageView({ groups, groupTeams, matches, leagueColor = 'var(--color-accent)', advanceCount }) {
    const stageGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order)

    if (stageGroups.length === 0) {
        return <p className="text-sm text-[var(--color-text-secondary)]/50 italic text-center py-8">No groups configured.</p>
    }

    return (
        <div className={stageGroups.length > 1 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
            {stageGroups.map(group => {
                const standings = computeStandings(group.id, matches, groupTeams)
                const groupMatchCount = matches.filter(m => m.group_id === group.id && m.is_completed).length

                return (
                    <div
                        key={group.id}
                        className="rounded-xl border border-white/[0.06] overflow-hidden"
                        style={{ backgroundColor: 'var(--color-secondary)' }}
                    >
                        {/* Group header */}
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-1.5 h-5 rounded-full"
                                    style={{ background: leagueColor }}
                                />
                                <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">{group.name}</h3>
                            </div>
                            <span className="text-[10px] text-[var(--color-text-secondary)]/40 uppercase tracking-wider">
                                {groupMatchCount} match{groupMatchCount !== 1 ? 'es' : ''} played
                            </span>
                        </div>

                        {standings.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-secondary)]/40 italic text-center py-6">No teams assigned.</p>
                        ) : (
                            <StandingsTable
                                standings={standings}
                                advanceCount={advanceCount}
                                leagueColor={leagueColor}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
