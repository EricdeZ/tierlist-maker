import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

function ResultRow({ game, index }) {
    const won = game.winner_team_id === game.player_team_id
    const opponentName = game.team_side === 1 ? game.team2_name : game.team1_name
    const dateStr = game.date
        ? new Date(game.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null

    return (
        <div className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${index % 2 === 0 ? 'bg-white/[0.03]' : ''}`}>
            <span className={`text-xs font-bold w-5 text-center px-1 py-0.5 rounded shrink-0 ${won ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {won ? 'W' : 'L'}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm truncate">vs {opponentName || 'Unknown'}</p>
                {game.god_played && (
                    <p className="text-[11px] text-(--color-text-secondary) truncate">{game.god_played}</p>
                )}
            </div>
            <div className="text-xs font-mono shrink-0 flex gap-0.5">
                <span className="text-emerald-400">{game.kills ?? '—'}</span>
                <span className="text-(--color-text-secondary)">/</span>
                <span className="text-red-400">{game.deaths ?? '—'}</span>
                <span className="text-(--color-text-secondary)">/</span>
                <span className="text-blue-400">{game.assists ?? '—'}</span>
            </div>
            {dateStr && (
                <div className="text-[11px] text-(--color-text-secondary) shrink-0 hidden sm:block w-14 text-right">
                    {dateStr}
                </div>
            )}
        </div>
    )
}

export default function RecentResults({ games, linkedPlayer }) {
    if (!linkedPlayer) {
        return (
            <DashboardWidget title="Recent Results" icon={<Trophy size={16} />} size="large">
                <PromoCard
                    title="Link Your Profile"
                    description="See your match history and stats"
                    ctaText="Claim Profile"
                    ctaLink="/players"
                    icon={<Trophy size={28} />}
                />
            </DashboardWidget>
        )
    }

    const profileLink = `/profile/${linkedPlayer.slug}`

    return (
        <DashboardWidget title="Recent Results" icon={<Trophy size={16} />} size="large" linkTo={profileLink} accent="emerald">
            {(!games || games.length === 0) ? (
                <PromoCard
                    title="No Games Yet"
                    description="Browse active leagues and start competing"
                    ctaText="Browse Leagues"
                    ctaLink="/leagues"
                    icon={<Trophy size={28} />}
                />
            ) : (
                <div className="space-y-0.5">
                    {games.slice(0, 5).map((g, i) => (
                        <ResultRow key={i} game={g} index={i} />
                    ))}
                </div>
            )}
        </DashboardWidget>
    )
}
