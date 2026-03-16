import { Users, Bell } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'
import { getDiscordAvatarUrl } from '../../utils/playerAvatar'

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

                {/* Roster avatars — use Discord pfps when available */}
                {team.members?.length > 0 && (
                    <div className="flex -space-x-1.5">
                        {team.members.slice(0, 7).map((m, i) => {
                            const name = m.displayName || m.discord_username || m.player_name || '?'
                            const avatarUrl = getDiscordAvatarUrl(m.discord_id, m.discord_avatar, 32)
                            return (
                                <div
                                    key={m.user_id ?? i}
                                    className="w-7 h-7 rounded-full border-2 border-(--color-primary) overflow-hidden flex-shrink-0"
                                    title={name}
                                >
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div
                                            className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white/90"
                                            style={{ backgroundColor: accentColor }}
                                        >
                                            {name[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {memberCount > 7 && (
                            <div className="w-7 h-7 rounded-full border-2 border-(--color-primary) bg-white/10 flex items-center justify-center text-[9px] text-(--color-text-secondary) flex-shrink-0">
                                +{memberCount - 7}
                            </div>
                        )}
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
