// src/components/stages/RoundRobinView.jsx
// Public round robin display with cross-reference grid and standings
import TeamLogo from '../TeamLogo'

function buildCrossRef(teams, matches) {
    // Map team_id → index
    const idx = {}
    teams.forEach((t, i) => { idx[t.team_id] = i })

    // Create NxN grid of results
    const grid = Array.from({ length: teams.length }, () =>
        Array.from({ length: teams.length }, () => null)
    )

    const stats = {}
    for (const t of teams) {
        stats[t.team_id] = { wins: 0, losses: 0, map_wins: 0, map_losses: 0 }
    }

    for (const m of matches) {
        if (!m.is_completed || !m.winner_team_id) continue
        const i1 = idx[m.team1_id]
        const i2 = idx[m.team2_id]
        if (i1 == null || i2 == null) continue

        const t1Won = m.winner_team_id === m.team1_id

        // grid[row][col] = result from row team's perspective against col team
        grid[i1][i2] = { won: t1Won, score: m.team1_score, opponentScore: m.team2_score }
        grid[i2][i1] = { won: !t1Won, score: m.team2_score, opponentScore: m.team1_score }

        if (stats[m.winner_team_id]) stats[m.winner_team_id].wins++
        const loserId = t1Won ? m.team2_id : m.team1_id
        if (stats[loserId]) stats[loserId].losses++

        if (m.team1_score != null && m.team2_score != null) {
            if (stats[m.team1_id]) {
                stats[m.team1_id].map_wins += m.team1_score
                stats[m.team1_id].map_losses += m.team2_score
            }
            if (stats[m.team2_id]) {
                stats[m.team2_id].map_wins += m.team2_score
                stats[m.team2_id].map_losses += m.team1_score
            }
        }
    }

    return { grid, stats }
}

function CrossRefGrid({ teams, grid }) {
    return (
        <div className="overflow-x-auto">
            <table className="text-xs">
                <thead>
                    <tr>
                        <th className="p-2 text-left min-w-[120px]" />
                        {teams.map((t) => (
                            <th key={t.team_id} className="p-1.5 text-center min-w-[48px]">
                                <div className="flex flex-col items-center gap-1">
                                    <TeamLogo slug={t.slug} name={t.name} size={20} color={t.color} logoUrl={t.logo_url} />
                                    <span className="text-[9px] text-[var(--color-text-secondary)]/50 font-medium truncate max-w-[48px]">
                                        {t.abbreviation || t.name.slice(0, 3).toUpperCase()}
                                    </span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {teams.map((team, row) => (
                        <tr key={team.team_id} className="border-t border-white/[0.04]">
                            <td className="p-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <TeamLogo slug={team.slug} name={team.name} size={18} color={team.color} logoUrl={team.logo_url} />
                                    <span className="font-bold text-[var(--color-text)] truncate">{team.name}</span>
                                </div>
                            </td>
                            {teams.map((_col, col) => {
                                if (row === col) {
                                    return (
                                        <td key={col} className="p-1.5 text-center">
                                            <div className="w-8 h-8 mx-auto rounded bg-white/[0.02] flex items-center justify-center">
                                                <span className="text-[var(--color-text-secondary)]/15">—</span>
                                            </div>
                                        </td>
                                    )
                                }
                                const result = grid[row][col]
                                return (
                                    <td key={col} className="p-1.5 text-center">
                                        <div
                                            className={`w-8 h-8 mx-auto rounded flex items-center justify-center text-[10px] font-bold ${
                                                result == null
                                                    ? 'bg-white/[0.02] text-[var(--color-text-secondary)]/20'
                                                    : result.won
                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                        : 'bg-red-500/8 text-red-400/60 border border-red-500/10'
                                            }`}
                                        >
                                            {result == null ? '·' : result.won ? 'W' : 'L'}
                                        </div>
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function Standings({ teams, stats }) {
    const sorted = [...teams].sort((a, b) => {
        const sa = stats[a.team_id] || { wins: 0, losses: 0 }
        const sb = stats[b.team_id] || { wins: 0, losses: 0 }
        if (sb.wins !== sa.wins) return sb.wins - sa.wins
        const diffA = (sa.map_wins || 0) - (sa.map_losses || 0)
        const diffB = (sb.map_wins || 0) - (sb.map_losses || 0)
        return diffB - diffA
    })

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]/50">
                    <th className="text-left py-2 px-3 font-bold w-8">#</th>
                    <th className="text-left py-2 px-1 font-bold">Team</th>
                    <th className="text-center py-2 px-2 font-bold">W</th>
                    <th className="text-center py-2 px-2 font-bold">L</th>
                    <th className="text-center py-2 px-2 font-bold">Win%</th>
                </tr>
            </thead>
            <tbody>
                {sorted.map((team, i) => {
                    const s = stats[team.team_id] || { wins: 0, losses: 0 }
                    const total = s.wins + s.losses
                    const pct = total > 0 ? ((s.wins / total) * 100).toFixed(0) : '—'

                    return (
                        <tr key={team.team_id} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-2.5 px-3 text-[var(--color-text-secondary)]/40 tabular-nums font-bold text-xs">{i + 1}</td>
                            <td className="py-2.5 px-1">
                                <div className="flex items-center gap-2">
                                    <TeamLogo slug={team.slug} name={team.name} size={20} color={team.color} logoUrl={team.logo_url} />
                                    <span className="font-bold text-[var(--color-text)] truncate">{team.name}</span>
                                </div>
                            </td>
                            <td className="text-center py-2.5 px-2 font-bold text-green-400 tabular-nums">{s.wins}</td>
                            <td className="text-center py-2.5 px-2 font-bold text-red-400/70 tabular-nums">{s.losses}</td>
                            <td className="text-center py-2.5 px-2 text-[var(--color-text-secondary)] tabular-nums">{pct}{pct !== '—' ? '%' : ''}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

export default function RoundRobinView({ stage, groups, groupTeams, matches, leagueColor = 'var(--color-accent)' }) {
    // If there are groups, render each separately. Otherwise use all teams.
    const stageGroups = groups.length > 0
        ? [...groups].sort((a, b) => a.sort_order - b.sort_order)
        : [{ id: null, name: stage.name }]

    return (
        <div className="space-y-8">
            {stageGroups.map(group => {
                const teams = group.id
                    ? groupTeams
                        .filter(gt => gt.group_id === group.id)
                        .map(gt => ({ team_id: gt.team_id, name: gt.team_name, slug: gt.team_slug, color: gt.team_color, logo_url: gt.team_logo_url, abbreviation: gt.team_abbreviation }))
                    : [] // Would need to derive from matches if no groups

                const groupMatches = group.id
                    ? matches.filter(m => m.group_id === group.id)
                    : matches

                const { grid, stats } = buildCrossRef(teams, groupMatches)

                return (
                    <div key={group.id || 'all'}>
                        {groups.length > 1 && (
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-5 rounded-full" style={{ background: leagueColor }} />
                                <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">{group.name}</h3>
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Standings */}
                            <div
                                className="rounded-xl border border-white/[0.06] overflow-hidden"
                                style={{ backgroundColor: 'var(--color-secondary)' }}
                            >
                                <div className="px-4 py-2.5 border-b border-white/[0.06]">
                                    <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Standings</span>
                                </div>
                                <Standings teams={teams} stats={stats} />
                            </div>

                            {/* Cross-reference grid */}
                            {teams.length > 0 && teams.length <= 16 && (
                                <div
                                    className="rounded-xl border border-white/[0.06] overflow-hidden"
                                    style={{ backgroundColor: 'var(--color-secondary)' }}
                                >
                                    <div className="px-4 py-2.5 border-b border-white/[0.06]">
                                        <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Head to Head</span>
                                    </div>
                                    <div className="p-3">
                                        <CrossRefGrid teams={teams} grid={grid} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
