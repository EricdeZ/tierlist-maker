import { Link } from 'react-router-dom'
import TeamLogo from '../../../components/TeamLogo'
import { roleImages, formatNumber, formatDate } from './profileUtils'

export default function MatchHistory({ gameHistory, basePath }) {
    if (gameHistory.length === 0) {
        return (
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                <p className="text-(--color-text-secondary)">No games played yet this season.</p>
            </div>
        )
    }

    const hasRoles = gameHistory.some(g => g.role_played)
    const hasGods = gameHistory.some(g => g.god_played)

    return (
        <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Opponent</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Result</th>
                        {hasRoles && (
                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                        )}
                        {hasGods && (
                            <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">God</th>
                        )}
                        <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">K</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">D</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">A</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Damage</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Mitigated</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider"></th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                    {gameHistory.map((game, index) => {
                        const isWin = game.winner_team_id === game.player_team_id
                        const opponent = game.player_team_id === game.team1_id
                            ? { name: game.team2_name, color: game.team2_color, slug: game.team2_slug }
                            : { name: game.team1_name, color: game.team1_color, slug: game.team1_slug }

                        return (
                            <tr key={game.game_id} className={index % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                                <td className="px-4 py-3 text-sm whitespace-nowrap">
                                    <Link to={`${basePath}/matches/${game.match_id}`} className="text-(--color-text-secondary) hover:text-(--color-accent) transition-colors">
                                        {formatDate(game.date)}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <Link
                                        to={`${basePath}/teams/${opponent.slug}`}
                                        className="flex items-center gap-2 group"
                                    >
                                        <TeamLogo slug={opponent.slug} name={opponent.name} size={18} color={opponent.color} />
                                        <div
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: opponent.color }}
                                        />
                                        <span className="text-sm text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                                            {opponent.name}
                                        </span>
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                        isWin
                                            ? 'bg-green-400/10 text-green-400'
                                            : 'bg-red-400/10 text-red-400'
                                    }`}>
                                        {isWin ? 'W' : 'L'}
                                    </span>
                                </td>
                                {hasRoles && (
                                    <td className="px-4 py-3 text-center">
                                        {game.role_played && roleImages[game.role_played.toUpperCase()] ? (
                                            <img src={roleImages[game.role_played.toUpperCase()]} alt={game.role_played} title={game.role_played} className="w-5 h-5 object-contain inline-block" />
                                        ) : (
                                            <span className="text-sm text-(--color-text-secondary)">—</span>
                                        )}
                                    </td>
                                )}
                                {hasGods && (
                                    <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                        {game.god_played || '—'}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-center text-sm font-medium text-(--color-text)">
                                    {game.kills}
                                </td>
                                <td className="px-4 py-3 text-center text-sm font-medium text-(--color-text)">
                                    {game.deaths}
                                </td>
                                <td className="px-4 py-3 text-center text-sm font-medium text-(--color-text)">
                                    {game.assists}
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                    {game.damage != null ? formatNumber(game.damage) : '—'}
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-(--color-text)">
                                    {game.mitigated != null ? formatNumber(game.mitigated) : '—'}
                                </td>
                                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                                    <Link to={`${basePath}/matches/${game.match_id}`} className="text-(--color-accent) hover:opacity-80 transition-opacity text-xs font-medium">
                                        View Match →
                                    </Link>
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
