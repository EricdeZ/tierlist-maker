import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

function ResultRow({ game }) {
    // Derive win/loss and opponent from raw API fields
    const won = game.winner_team_id === game.player_team_id
    const opponentName = game.team_side === 1 ? game.team2_name : game.team1_name
    return (
        <div className="flex items-center gap-3 p-2 rounded-lg">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${won ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {won ? 'W' : 'L'}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm truncate">vs {opponentName || 'Unknown'}</p>
            </div>
            <div className="text-xs text-(--color-text-secondary) shrink-0">
                {game.kills}/{game.deaths}/{game.assists}
            </div>
            <div className="text-xs text-(--color-text-secondary) shrink-0 hidden sm:block">
                {new Date(game.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
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
                <div className="space-y-1">
                    {games.slice(0, 5).map((g, i) => (
                        <ResultRow key={i} game={g} />
                    ))}
                </div>
            )}
        </DashboardWidget>
    )
}
