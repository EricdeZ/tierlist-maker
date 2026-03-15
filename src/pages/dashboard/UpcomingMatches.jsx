import { Link } from 'react-router-dom'
import { Calendar, Clock } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

function formatCountdown(dateStr) {
    const diff = new Date(dateStr) - new Date()
    if (diff < 0) return 'Starting soon'
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days}d ${hours}h`
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hours}h ${mins}m`
}

function MatchRow({ match, isNext }) {
    const opponent = match.user_team_id === match.team1_id
        ? { name: match.team2_name, logo: match.team2_logo }
        : { name: match.team1_name, logo: match.team1_logo }

    return (
        <Link
            to={`/${match.league_slug}/${match.division_slug}/matches`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
            {opponent.logo ? (
                <img src={opponent.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                    {opponent.name?.charAt(0)}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">vs {opponent.name}</p>
                <p className="text-xs text-(--color-text-secondary)">
                    {match.division_name}{match.stage_name ? ` · ${match.stage_name}` : ''}
                </p>
            </div>
            <div className="text-right shrink-0">
                {isNext ? (
                    <span className="text-xs font-bold text-(--color-accent)">{formatCountdown(match.scheduled_time)}</span>
                ) : (
                    <span className="text-xs text-(--color-text-secondary)">
                        {new Date(match.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                )}
            </div>
        </Link>
    )
}

export default function UpcomingMatches({ matches, hasTeam }) {
    if (!hasTeam) {
        return (
            <DashboardWidget title="Upcoming Matches" icon={<Calendar size={16} />} size="large">
                <PromoCard
                    title="Join a Team"
                    description="Compete in scheduled league matches"
                    ctaText="Browse Leagues"
                    ctaLink="/leagues"
                    icon={<Calendar size={28} />}
                />
            </DashboardWidget>
        )
    }

    return (
        <DashboardWidget title="Upcoming Matches" icon={<Calendar size={16} />} size="large" accent="blue">
            {matches.length === 0 ? (
                <p className="text-sm text-(--color-text-secondary) py-4 text-center">No upcoming matches scheduled</p>
            ) : (
                <div className="space-y-1">
                    {matches.map((m, i) => (
                        <MatchRow key={m.scheduled_match_id} match={m} isNext={i === 0} />
                    ))}
                </div>
            )}
        </DashboardWidget>
    )
}
