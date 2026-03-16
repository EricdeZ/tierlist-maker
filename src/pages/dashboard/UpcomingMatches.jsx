import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'

function formatCountdown(dateStr) {
    const diff = new Date(dateStr) - new Date()
    if (diff < 0) return 'Starting soon'
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days}d ${hours}h`
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hours}h ${mins}m`
}

function countdownColor(dateStr) {
    const diff = new Date(dateStr) - new Date()
    if (diff < 0) return 'text-red-400'
    if (diff < 2 * 3600000) return 'text-red-400'
    if (diff < 24 * 3600000) return 'text-amber-400'
    return 'text-emerald-400'
}

function MatchRow({ match, isNext }) {
    const isTeam1 = match.user_team_id === match.team1_id
    const myTeam = isTeam1
        ? { name: match.team1_name, logo: match.team1_logo, color: match.team1_color, slug: match.team1_slug }
        : { name: match.team2_name, logo: match.team2_logo, color: match.team2_color, slug: match.team2_slug }
    const opponent = isTeam1
        ? { name: match.team2_name, logo: match.team2_logo, color: match.team2_color, slug: match.team2_slug }
        : { name: match.team1_name, logo: match.team1_logo, color: match.team1_color, slug: match.team1_slug }

    const timeStr = new Date(match.scheduled_time).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    })
    const dateStr = new Date(match.scheduled_time).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    })

    return (
        <Link
            to={`/${match.league_slug}/${match.division_slug}/matches`}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors"
        >
            {/* Both team logos with VS */}
            <div className="flex items-center gap-1.5 shrink-0 relative">
                <TeamLogo logoUrl={myTeam.logo} slug={myTeam.slug} name={myTeam.name} color={myTeam.color} size={28} />
                <span className="text-[9px] font-bold text-(--color-text-secondary)">vs</span>
                <TeamLogo logoUrl={opponent.logo} slug={opponent.slug} name={opponent.name} color={opponent.color} size={28} />
                {isNext && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse ring-2 ring-(--color-primary)" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{opponent.name}</p>
                <p className="text-xs text-(--color-text-secondary)">
                    {match.division_name}{match.stage_name ? ` · ${match.stage_name}` : ''}
                </p>
            </div>
            <div className="text-right shrink-0">
                {isNext ? (
                    <>
                        <p className={`text-xs font-bold ${countdownColor(match.scheduled_time)}`}>
                            {formatCountdown(match.scheduled_time)}
                        </p>
                        <p className="text-[10px] text-(--color-text-secondary)">{timeStr}</p>
                    </>
                ) : (
                    <>
                        <p className="text-xs text-(--color-text-secondary)">{dateStr}</p>
                        <p className="text-[10px] text-(--color-text-secondary)">{timeStr}</p>
                    </>
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
