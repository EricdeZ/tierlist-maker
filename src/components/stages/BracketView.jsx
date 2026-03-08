// src/components/stages/BracketView.jsx
// Public bracket visualization for single & double elimination stages
import TeamLogo from '../TeamLogo'

const MATCH_HEIGHT = 64
const ROUND_GAP = 32
const MATCH_GAP = 12
const CONNECTOR_WIDTH = 24

function TeamSlot({ team, isWinner, isLoser, sourceLabel }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 min-w-0 transition-opacity ${isLoser ? 'opacity-35' : ''}`}>
            {team ? (
                <>
                    <TeamLogo slug={team.slug} name={team.name} size={18} color={team.color} logoUrl={team.logo_url} />
                    <span className={`text-xs font-bold truncate flex-1 ${isWinner ? 'text-[var(--color-text)]' : 'text-[var(--color-text)]'}`}>
                        {team.name}
                    </span>
                    {team.seed != null && (
                        <span className="text-[10px] text-[var(--color-text-secondary)]/50 tabular-nums shrink-0">
                            #{team.seed}
                        </span>
                    )}
                    {isWinner && (
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-wider shrink-0">W</span>
                    )}
                </>
            ) : (
                <span className="text-xs text-[var(--color-text-secondary)]/40 italic truncate flex-1">
                    {sourceLabel || 'TBD'}
                </span>
            )}
        </div>
    )
}

function MatchBox({ match, leagueColor, basePath }) {
    const isCompleted = match.status === 'completed'
    const team1Won = match.winner_team_id && match.winner_team_id === match.team1_id
    const team2Won = match.winner_team_id && match.winner_team_id === match.team2_id

    const content = (
        <div
            className={`rounded-lg border overflow-hidden transition-all ${
                isCompleted
                    ? 'border-white/10 hover:border-white/20'
                    : 'border-white/[0.06]'
            }`}
            style={{ backgroundColor: 'var(--color-secondary)', width: 180 }}
        >
            <TeamSlot
                team={match.team1_id ? { name: match.team1_name, slug: match.team1_slug, color: match.team1_color, logo_url: match.team1_logo_url, seed: match.team1_seed } : null}
                isWinner={team1Won}
                isLoser={isCompleted && !team1Won}
                sourceLabel={match.team1_source_label}
            />
            <div className="h-px bg-white/[0.06]" />
            <TeamSlot
                team={match.team2_id ? { name: match.team2_name, slug: match.team2_slug, color: match.team2_color, logo_url: match.team2_logo_url, seed: match.team2_seed } : null}
                isWinner={team2Won}
                isLoser={isCompleted && !team2Won}
                sourceLabel={match.team2_source_label}
            />
            {/* Status strip */}
            <div
                className="h-0.5"
                style={{
                    background: isCompleted
                        ? `linear-gradient(90deg, ${leagueColor}60, ${leagueColor}20)`
                        : 'rgba(255,255,255,0.03)',
                }}
            />
        </div>
    )

    if (isCompleted && basePath && match.match_id) {
        return <a href={`${basePath}/matches/${match.match_id}`} className="block hover:scale-[1.02] transition-transform">{content}</a>
    }
    return content
}

function BracketColumn({ round, matches, leagueColor, basePath, isLast }) {
    return (
        <div className="flex flex-col items-center shrink-0">
            {/* Round header */}
            <div className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 text-center px-2 truncate w-full" style={{ maxWidth: 180 + CONNECTOR_WIDTH }}>
                {round.name}
            </div>

            {/* Match slots */}
            <div className="flex flex-col justify-around flex-1" style={{ gap: MATCH_GAP }}>
                {matches.length === 0 ? (
                    <div className="text-xs text-[var(--color-text-secondary)]/30 italic text-center py-4" style={{ width: 180 }}>
                        No matches
                    </div>
                ) : (
                    matches.map(match => (
                        <div key={match.id} className="flex items-center">
                            <MatchBox match={match} leagueColor={leagueColor} basePath={basePath} />
                            {!isLast && (
                                <div style={{ width: CONNECTOR_WIDTH }} className="flex items-center">
                                    <div className="w-full h-px bg-white/10" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default function BracketView({ stage, rounds, matches, leagueColor = 'var(--color-accent)', basePath }) {
    const isDouble = stage.stage_type === 'double_elimination'
    const sortedRounds = [...rounds].sort((a, b) => a.sort_order - b.sort_order)

    // Organize matches by round
    const roundMatches = {}
    for (const r of sortedRounds) roundMatches[r.id] = []
    for (const m of matches) {
        if (m.round_id && roundMatches[m.round_id]) {
            roundMatches[m.round_id].push(m)
        }
    }
    // Sort by bracket_position within each round
    for (const arr of Object.values(roundMatches)) {
        arr.sort((a, b) => (a.bracket_position ?? 999) - (b.bracket_position ?? 999))
    }

    // For double elim, split into winners/losers/finals by naming heuristic
    let winnersRounds = sortedRounds
    let losersRounds = []
    let grandFinals = []

    if (isDouble) {
        winnersRounds = sortedRounds.filter(r => {
            const n = r.name.toLowerCase()
            return !n.includes('loser') && !n.startsWith('l') && !n.includes('grand final')
        })
        losersRounds = sortedRounds.filter(r => {
            const n = r.name.toLowerCase()
            return n.includes('loser') || n.startsWith('l')
        })
        grandFinals = sortedRounds.filter(r => r.name.toLowerCase().includes('grand final'))
        if (losersRounds.length === 0 && grandFinals.length === 0) {
            winnersRounds = sortedRounds
        }
    }

    const renderBracketRow = (roundsList, label, labelColor) => {
        if (roundsList.length === 0) return null
        return (
            <div>
                {label && (
                    <div className="mb-3 flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>{label}</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>
                )}
                <div className="flex items-stretch overflow-x-auto pb-2" style={{ gap: 0 }}>
                    {roundsList.map((round, i) => (
                        <BracketColumn
                            key={round.id}
                            round={round}
                            matches={roundMatches[round.id] || []}
                            leagueColor={leagueColor}
                            basePath={basePath}
                            isLast={i === roundsList.length - 1}
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {isDouble && losersRounds.length > 0 ? (
                <>
                    {renderBracketRow(winnersRounds, 'Winners Bracket', 'text-green-400')}
                    {renderBracketRow(losersRounds, 'Losers Bracket', 'text-red-400')}
                    {renderBracketRow(grandFinals, 'Grand Finals', 'text-amber-400')}
                </>
            ) : (
                renderBracketRow(winnersRounds, null, null)
            )}
        </div>
    )
}
