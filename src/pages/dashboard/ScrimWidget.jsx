import { Swords, Bell, Circle } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'

const STATUS_COLORS = {
    open: 'text-orange-400',
    accepted: 'text-emerald-400',
    pending: 'text-yellow-400',
    expired: 'text-white/30',
    cancelled: 'text-white/30',
}

function statusLabel(status) {
    if (!status) return null
    return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function ScrimWidget({ scrims, incomingCount, isCaptain }) {
    if (!isCaptain) return null

    if (!scrims || scrims.length === 0) {
        return (
            <DashboardWidget title="Scrims" icon={<Swords size={16} />} linkTo="/scrims" accent="orange">
                <PromoCard
                    title="Challenge Teams"
                    description="Post or accept scrim requests"
                    ctaText="Open Scrim Planner"
                    ctaLink="/scrims"
                    icon={<Swords size={28} />}
                />
            </DashboardWidget>
        )
    }

    // Prefer accepted/pending scrims first, then open ones
    const sorted = [...scrims].sort((a, b) => {
        const priority = { accepted: 0, pending: 1, open: 2 }
        return (priority[a.status] ?? 3) - (priority[b.status] ?? 3)
    })
    const next = sorted[0]

    // Determine opponent info with logo/color
    const opponentName = next.acceptedTeamName || next.accepted_team_name
        || next.challengedTeamName || next.challenged_team_name
        || (next.status === 'open' ? 'Open challenge' : 'TBD')
    const opponentLogo = next.accepted_team_logo || next.challenged_team_logo || next.team_logo
    const opponentColor = next.accepted_team_color || next.challenged_team_color || next.team_color

    const scheduledAt = next.scheduledDate || next.scheduled_at || next.scheduled_time || next.scheduled_date
    const statusColor = STATUS_COLORS[next.status] || 'text-white/60'

    return (
        <DashboardWidget title="Scrims" icon={<Swords size={16} />} linkTo="/scrims" accent="orange">
            <div className="space-y-2">
                {/* Opponent with team logo */}
                <div className="flex items-center gap-2">
                    <TeamLogo logoUrl={opponentLogo} name={opponentName} color={opponentColor} size={22} />
                    <Swords size={12} className="text-orange-400 shrink-0" />
                    <p className="text-sm font-semibold truncate">{opponentName}</p>
                </div>

                <div className="flex items-center gap-3">
                    {next.status && (
                        <span className={`text-xs font-semibold flex items-center gap-1 ${statusColor}`}>
                            <Circle size={6} fill="currentColor" />
                            {statusLabel(next.status)}
                        </span>
                    )}
                    {scheduledAt && (
                        <p className="text-xs text-(--color-text-secondary)">
                            {new Date(scheduledAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                            })}
                        </p>
                    )}
                </div>

                {incomingCount > 0 && (
                    <p className="text-xs text-orange-400 font-semibold flex items-center gap-1">
                        <Bell size={11} />
                        {incomingCount} incoming request{incomingCount !== 1 ? 's' : ''}
                    </p>
                )}
            </div>
        </DashboardWidget>
    )
}
