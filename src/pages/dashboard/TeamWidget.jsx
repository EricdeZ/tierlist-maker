import { Users, Bell } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'

export default function TeamWidget({ teams, pendingCount }) {
    if (!teams || teams.length === 0) {
        return (
            <DashboardWidget title="My Team" icon={<Users size={16} />} accent="blue">
                <PromoCard
                    title="Find a Team"
                    description="Join or create a community team"
                    ctaText="Browse Teams"
                    ctaLink="/leagues"
                    icon={<Users size={28} />}
                />
            </DashboardWidget>
        )
    }

    const team = teams[0]
    const accentColor = team.color || '#3b82f6'
    const memberCount = team.members?.length ?? team.member_count ?? 0

    return (
        <DashboardWidget title="My Team" icon={<Users size={16} />} accent="blue" linkTo="/scrims">
            <div className="space-y-3">
                {/* Team identity */}
                <div className="flex items-center gap-3">
                    <div
                        className="rounded-lg p-0.5 flex-shrink-0"
                        style={{ boxShadow: `0 0 0 2px ${accentColor}40` }}
                    >
                        <TeamLogo
                            logoUrl={team.logo_url}
                            name={team.name}
                            color={team.color}
                            size={32}
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold truncate leading-tight">{team.name}</p>
                        <p className="text-xs" style={{ color: accentColor }}>
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Roster initials */}
                {team.members?.length > 0 && (
                    <div className="flex -space-x-1.5">
                        {team.members.slice(0, 7).map((m, i) => {
                            const name = m.displayName || m.discord_username || m.player_name || '?'
                            return (
                                <div
                                    key={m.user_id ?? i}
                                    className="w-6 h-6 rounded-full border border-black/30 flex items-center justify-center text-[9px] font-bold text-white/90 flex-shrink-0"
                                    style={{ backgroundColor: accentColor }}
                                    title={name}
                                >
                                    {name[0]?.toUpperCase()}
                                </div>
                            )
                        })}
                    </div>
                )}

                {pendingCount > 0 && (
                    <p className="text-xs font-semibold flex items-center gap-1" style={{ color: accentColor }}>
                        <Bell size={11} />
                        {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
                    </p>
                )}
            </div>
        </DashboardWidget>
    )
}
