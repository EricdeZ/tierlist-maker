// src/pages/division/MatchDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { matchService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'
import { Flag, Pencil } from 'lucide-react'
import soloImage from '../../assets/roles/solo.webp'
import jungleImage from '../../assets/roles/jungle.webp'
import midImage from '../../assets/roles/mid.webp'
import suppImage from '../../assets/roles/supp.webp'
import adcImage from '../../assets/roles/adc.webp'

const ROLE_IMAGES = { Solo: soloImage, Jungle: jungleImage, Mid: midImage, Support: suppImage, ADC: adcImage }
const ROLE_ORDER = { Solo: 0, Jungle: 1, Mid: 2, Support: 3, ADC: 4 }

const MatchDetail = () => {
    const { leagueSlug, divisionSlug, matchId } = useParams()
    const { user, permissions } = useAuth()
    const { season } = useDivision()
    const [match, setMatch] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeGame, setActiveGame] = useState(0)

    const basePath = `/${leagueSlug}/${divisionSlug}`

    useEffect(() => {
        if (!matchId) return

        let cancelled = false

        const fetchMatch = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await matchService.getById(matchId)
                if (!cancelled) {
                    setMatch(data)
                    setActiveGame(0)
                }
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchMatch()
        return () => { cancelled = true }
    }, [matchId])

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num || 0))

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading match data...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-400 mb-3">Failed to Load Match</h2>
                    <p className="text-red-300/80 mb-6">{error}</p>
                    <Link to={`${basePath}/matches`} className="text-(--color-accent) hover:underline">
                        ← Back to Matches
                    </Link>
                </div>
            </div>
        )
    }

    if (!match) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <h2 className="text-2xl font-bold text-(--color-text) mb-4">Match Not Found</h2>
                <Link to={`${basePath}/matches`} className="text-(--color-accent) hover:underline">
                    ← Back to Matches
                </Link>
            </div>
        )
    }

    const team1Won = match.winner_team_id === match.team1_id
    const team2Won = match.winner_team_id === match.team2_id
    const hasGames = match.games && match.games.length > 0
    const currentGame = hasGames ? match.games[activeGame] : null

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {match && <PageTitle title={`${match.team1_name} vs ${match.team2_name}`} description={`${match.team1_name} vs ${match.team2_name} match details. Game-by-game stats, player performances, KDA, damage, and mitigated.`} />}
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-(--color-text-secondary) mb-6">
                <Link to={`${basePath}/matches`} className="hover:text-(--color-accent) transition-colors">
                    Matches
                </Link>
                <span>/</span>
                <span className="text-(--color-text)">
                    {match.team1_name} vs {match.team2_name}
                </span>
            </div>

            {/* ── Match Header ── */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden mb-6">
                {/* Meta bar */}
                <div className="flex items-center justify-between px-5 py-2.5 bg-white/5 border-b border-white/5 text-xs text-(--color-text-secondary)">
                    <div className="flex items-center gap-3">
                        {match.week && <span>Week {match.week}</span>}
                        {match.date && <span>{formatDate(match.date)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {match.best_of > 1 && <span>Best of {match.best_of}</span>}
                        {user && match.is_completed && (
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-report-modal', {
                                    detail: { matchId: match.id, team1Name: match.team1_name, team2Name: match.team2_name },
                                }))}
                                className="p-1 rounded text-(--color-text-secondary)/40 hover:text-orange-400 hover:bg-orange-400/10 transition-colors cursor-pointer"
                                title="Report a data issue"
                            >
                                <Flag className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {user && (() => {
                            const hasPerm = (key) => permissions.global.includes(key) || Object.values(permissions.byLeague).some(p => p.includes(key))
                            if (hasPerm('match_manage')) return true
                            return hasPerm('match_manage_own') && match.reported_by === user.id
                        })() && (
                            <Link
                                to={`/admin/matches/${match.id}`}
                                className="p-1 rounded text-(--color-text-secondary)/40 hover:text-(--color-accent) hover:bg-(--color-accent)/10 transition-colors"
                                title="Manage match"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        {match.is_completed ? (
                            <span className="px-2 py-0.5 rounded-full bg-white/10 font-bold uppercase tracking-wider">Final</span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full bg-(--color-accent)/10 text-(--color-accent) font-bold uppercase tracking-wider">Upcoming</span>
                        )}
                    </div>
                </div>

                {/* Scoreboard */}
                <div className="p-6">
                    {/* Desktop */}
                    <div className="hidden sm:flex items-center justify-center gap-6">
                        {/* Team 1 */}
                        <Link
                            to={`${basePath}/teams/${match.team1_slug}`}
                            className={`flex-1 flex items-center gap-4 justify-end group transition-opacity ${team2Won && match.is_completed ? 'opacity-50' : ''}`}
                        >
                            <span className="text-xl font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors text-right">
                                {match.team1_name}
                            </span>
                            <div className="w-4 h-12 rounded flex-shrink-0" style={{ backgroundColor: match.team1_color }} />
                            <TeamLogo slug={match.team1_slug} name={match.team1_name} size={48} />
                        </Link>

                        {/* Score */}
                        <div className="flex items-center gap-3 flex-shrink-0 px-4">
                            {match.is_completed && hasGames ? (
                                <>
                                    <span className={`font-heading text-4xl font-black ${team1Won ? 'text-(--color-text)' : 'text-(--color-text-secondary)/40'}`}>
                                        {match.team1_game_wins}
                                    </span>
                                    <span className="text-2xl text-(--color-text-secondary)/30 font-light">—</span>
                                    <span className={`font-heading text-4xl font-black ${team2Won ? 'text-(--color-text)' : 'text-(--color-text-secondary)/40'}`}>
                                        {match.team2_game_wins}
                                    </span>
                                </>
                            ) : (
                                <span className="font-heading text-2xl font-bold text-(--color-text-secondary)/40">vs</span>
                            )}
                        </div>

                        {/* Team 2 */}
                        <Link
                            to={`${basePath}/teams/${match.team2_slug}`}
                            className={`flex-1 flex items-center gap-4 group transition-opacity ${team1Won && match.is_completed ? 'opacity-50' : ''}`}
                        >
                            <TeamLogo slug={match.team2_slug} name={match.team2_name} size={48} />
                            <div className="w-4 h-12 rounded flex-shrink-0" style={{ backgroundColor: match.team2_color }} />
                            <span className="text-xl font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                {match.team2_name}
                            </span>
                        </Link>
                    </div>

                    {/* Mobile */}
                    <div className="sm:hidden space-y-3">
                        <div className="flex items-center justify-between">
                            <Link
                                to={`${basePath}/teams/${match.team1_slug}`}
                                className={`flex items-center gap-3 group ${team2Won && match.is_completed ? 'opacity-50' : ''}`}
                            >
                                <TeamLogo slug={match.team1_slug} name={match.team1_name} size={32} />
                                <div className="w-3 h-10 rounded" style={{ backgroundColor: match.team1_color }} />
                                <span className="text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                    {match.team1_name}
                                </span>
                            </Link>
                            {match.is_completed && hasGames && (
                                <span className={`font-heading text-2xl font-black ${team1Won ? 'text-(--color-text)' : 'text-(--color-text-secondary)/40'}`}>
                                    {match.team1_game_wins}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <Link
                                to={`${basePath}/teams/${match.team2_slug}`}
                                className={`flex items-center gap-3 group ${team1Won && match.is_completed ? 'opacity-50' : ''}`}
                            >
                                <TeamLogo slug={match.team2_slug} name={match.team2_name} size={32} />
                                <div className="w-3 h-10 rounded" style={{ backgroundColor: match.team2_color }} />
                                <span className="text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                    {match.team2_name}
                                </span>
                            </Link>
                            {match.is_completed && hasGames && (
                                <span className={`font-heading text-2xl font-black ${team2Won ? 'text-(--color-text)' : 'text-(--color-text-secondary)/40'}`}>
                                    {match.team2_game_wins}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Game Tabs ── */}
            {hasGames && (
                <>
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                        {match.games.map((game, idx) => {
                            const gameTeam1Won = game.winner_team_id === match.team1_id
                            const gameTeam2Won = game.winner_team_id === match.team2_id
                            const winnerColor = gameTeam1Won ? match.team1_color : gameTeam2Won ? match.team2_color : null

                            return (
                                <button
                                    key={game.id}
                                    onClick={() => setActiveGame(idx)}
                                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${
                                        activeGame === idx
                                            ? 'bg-(--color-secondary) text-(--color-text) border border-white/15 shadow-lg'
                                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                                    }`}
                                >
                                    Game {game.game_number}
                                    {game.is_forfeit && (
                                        <span className="text-xs font-bold text-orange-400">FF</span>
                                    )}
                                    {winnerColor && !game.is_forfeit && (
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: winnerColor }}
                                        />
                                    )}
                                    {activeGame === idx && (
                                        <span
                                            className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                                            style={{ backgroundColor: 'var(--color-accent)' }}
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* ── Active Game Stats ── */}
                    {currentGame && (
                        <div className="space-y-4">
                            {/* Game winner banner */}
                            {currentGame.winner_team_id && (
                                <div className="flex items-center justify-center gap-2 py-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: currentGame.winner_color }}
                                    />
                                    <span className="text-sm font-bold text-(--color-text)">
                                        {currentGame.winner_name} wins Game {currentGame.game_number}
                                        {currentGame.is_forfeit && (
                                            <span className="ml-2 text-orange-400 font-bold">
                                                (Forfeit)
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}

                            {/* Forfeit — no stats to show */}
                            {currentGame.is_forfeit ? (
                                <div className="bg-(--color-secondary) rounded-xl border border-orange-500/20 p-8 text-center">
                                    <span className="text-2xl font-black text-orange-400/60">FF</span>
                                    <p className="text-(--color-text-secondary) text-sm mt-2">
                                        This game was a forfeit. No player stats recorded.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Team stat comparison bar */}
                                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-4">
                                        <TeamComparisonBar
                                            label="Kills"
                                            val1={currentGame.team1_totals.kills}
                                            val2={currentGame.team2_totals.kills}
                                            color1={match.team1_color}
                                            color2={match.team2_color}
                                        />
                                        <TeamComparisonBar
                                            label="Damage"
                                            val1={currentGame.team1_totals.damage}
                                            val2={currentGame.team2_totals.damage}
                                            color1={match.team1_color}
                                            color2={match.team2_color}
                                            format={formatNumber}
                                        />
                                        <TeamComparisonBar
                                            label="Mitigated"
                                            val1={currentGame.team1_totals.mitigated}
                                            val2={currentGame.team2_totals.mitigated}
                                            color1={match.team1_color}
                                            color2={match.team2_color}
                                            format={formatNumber}
                                        />
                                    </div>

                                    {/* Player stats tables — side by side on desktop, stacked on mobile */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <TeamGameStats
                                            teamName={match.team1_name}
                                            teamColor={match.team1_color}
                                            teamSlug={match.team1_slug}
                                            players={currentGame.team1_players}
                                            isWinner={currentGame.winner_team_id === match.team1_id}
                                            basePath={basePath}
                                            formatNumber={formatNumber}
                                        />
                                        <TeamGameStats
                                            teamName={match.team2_name}
                                            teamColor={match.team2_color}
                                            teamSlug={match.team2_slug}
                                            players={currentGame.team2_players}
                                            isWinner={currentGame.winner_team_id === match.team2_id}
                                            basePath={basePath}
                                            formatNumber={formatNumber}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* No game data */}
            {!hasGames && match.is_completed && (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                    <p className="text-(--color-text-secondary)">No detailed game data available for this match.</p>
                </div>
            )}

            {!match.is_completed && (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                    <p className="text-(--color-text-secondary) text-lg">This match hasn't been played yet.</p>
                </div>
            )}
        </div>
    )
}

/* ── Team comparison bar ── */
const TeamComparisonBar = ({ label, val1, val2, color1, color2, format }) => {
    const total = (val1 || 0) + (val2 || 0)
    const pct1 = total > 0 ? ((val1 || 0) / total) * 100 : 50
    const display = format || ((v) => v)

    return (
        <div className="flex items-center gap-3 py-2">
            <span className="text-sm font-bold text-(--color-text) w-16 text-right tabular-nums">
                {display(val1 || 0)}
            </span>
            <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-white/5">
                <div
                    className="h-full rounded-l-full transition-all duration-500"
                    style={{ width: `${pct1}%`, backgroundColor: color1 }}
                />
                <div
                    className="h-full rounded-r-full transition-all duration-500"
                    style={{ width: `${100 - pct1}%`, backgroundColor: color2 }}
                />
            </div>
            <span className="text-sm font-bold text-(--color-text) w-16 tabular-nums">
                {display(val2 || 0)}
            </span>
            <span className="text-xs text-(--color-text-secondary) w-16 hidden sm:block">{label}</span>
        </div>
    )
}

/* ── Team game stats table ── */
const TeamGameStats = ({ teamName, teamColor, teamSlug, players, isWinner, basePath, formatNumber }) => {
    if (!players || players.length === 0) {
        return (
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 text-center">
                <p className="text-(--color-text-secondary) text-sm">No player data available</p>
            </div>
        )
    }

    // Sort by role order if any player has a role assigned
    const hasRoles = players.some(p => p.role_played)
    const sorted = hasRoles
        ? [...players].sort((a, b) => (ROLE_ORDER[a.role_played] ?? 99) - (ROLE_ORDER[b.role_played] ?? 99))
        : players

    return (
        <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
            {/* Team header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <TeamLogo slug={teamSlug} name={teamName} size={20} />
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
                <Link
                    to={`${basePath}/teams/${teamSlug}`}
                    className="text-sm font-bold text-(--color-text) hover:text-(--color-accent) transition-colors"
                >
                    {teamName}
                </Link>
                {isWinner && (
                    <span className="ml-auto text-xs font-bold text-green-400 px-2 py-0.5 rounded-full bg-green-400/10">
                        WIN
                    </span>
                )}
            </div>

            {/* Player rows */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/5">
                    <thead className="bg-white/[0.03]">
                        <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">Player</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">God</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">K</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">D</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">A</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">Dmg</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-(--color-text-secondary) uppercase tracking-wider">Mit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                        {sorted.map((player, idx) => {
                            const kda = player.deaths === 0
                                ? player.kills + (player.assists / 2)
                                : (player.kills + (player.assists / 2)) / player.deaths

                            return (
                                <tr key={`${player.player_id}-${idx}`} className={idx % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <Link
                                            to={`${basePath}/players/${player.player_slug}`}
                                            className="text-sm font-medium text-(--color-text) hover:text-(--color-accent) transition-colors"
                                        >
                                            {player.player_name}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        {player.role_played && ROLE_IMAGES[player.role_played] ? (
                                            <img src={ROLE_IMAGES[player.role_played]} alt={player.role_played} title={player.role_played} className="w-5 h-5 object-contain inline-block" />
                                        ) : (
                                            <span className="text-xs text-(--color-text-secondary)">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-xs text-(--color-text-secondary) whitespace-nowrap">
                                        {player.god_played || '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-sm font-medium text-(--color-text) tabular-nums">
                                        {player.kills}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-sm font-medium text-(--color-text) tabular-nums">
                                        {player.deaths}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-sm font-medium text-(--color-text) tabular-nums">
                                        {player.assists}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-xs text-(--color-text) tabular-nums whitespace-nowrap">
                                        {player.damage != null ? formatNumber(player.damage) : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-xs text-(--color-text-secondary) tabular-nums whitespace-nowrap">
                                        {player.mitigated != null ? formatNumber(player.mitigated) : '—'}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default MatchDetail
