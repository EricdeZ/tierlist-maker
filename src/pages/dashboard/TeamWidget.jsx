import { Link } from 'react-router-dom'
import { Users, Bell, Shield } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import TeamLogo from '../../components/TeamLogo'
import { getDiscordAvatarUrl } from '../../utils/playerAvatar'

function TeamRow({ team, isLeague }) {
    const accentColor = team.color || team.team_color || '#3b82f6'
    const name = team.name || team.team_name
    const logo = team.logo_url || team.team_logo_url
    const slug = team.slug || team.team_slug
    const memberCount = team.members?.length ?? team.member_count ?? 0

    // Build link — league teams link to their division team page
    const teamLink = isLeague && team.league_slug && team.division_slug && slug
        ? `/${team.league_slug}/${team.division_slug}/teams/${slug}`
        : null

    const content = (
        <div className={`flex items-center gap-2.5 ${teamLink ? 'hover:bg-white/5 -mx-1.5 px-1.5 py-0.5 rounded transition-colors' : ''}`}>
            <div className="rounded-md p-0.5 shrink-0" style={{ boxShadow: `0 0 0 1.5px ${accentColor}40` }}>
                <TeamLogo logoUrl={logo} slug={slug} name={name} color={accentColor} size={24} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate leading-tight">{name}</p>
                <p className="text-[11px] text-(--color-text-secondary)">
                    {isLeague ? team.league_name || team.division_name || 'League' : `${memberCount} members`}
                </p>
            </div>
            {isLeague && (
                <Shield size={12} className="text-amber-400/50 shrink-0" />
            )}
        </div>
    )

    return teamLink ? <Link to={teamLink}>{content}</Link> : content
}

export default function TeamWidget({ teams, leagueTeams, pendingCount }) {
    const hasAny = (teams?.length > 0) || (leagueTeams?.length > 0)

    if (!hasAny) {
        return (
            <DashboardWidget title="My Teams" icon={<Users size={16} />} accent="blue">
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

    // Combine league teams first, then community teams
    const allTeams = [
        ...(leagueTeams || []).map(t => ({ ...t, _isLeague: true })),
        ...(teams || []).map(t => ({ ...t, _isLeague: false })),
    ]

    const primaryTeam = allTeams[0]
    const primaryColor = primaryTeam?.color || primaryTeam?.team_color || '#3b82f6'

    return (
        <DashboardWidget title="My Teams" icon={<Users size={16} />} accent="blue" linkTo="/scrims">
            <div className="space-y-2.5">
                {allTeams.slice(0, 3).map((t, i) => (
                    <TeamRow key={t.id || t.team_id || i} team={t} isLeague={t._isLeague} />
                ))}
                {allTeams.length > 3 && (
                    <p className="text-[11px] text-(--color-text-secondary)">+{allTeams.length - 3} more</p>
                )}

                {/* Member avatars of first team */}
                {primaryTeam && !primaryTeam._isLeague && primaryTeam.members?.length > 0 && (
                    <div className="flex -space-x-1.5 pt-0.5">
                        {primaryTeam.members.slice(0, 6).map((m, i) => {
                            const name = m.displayName || m.discord_username || m.player_name || '?'
                            const avatarUrl = getDiscordAvatarUrl(m.discord_id, m.discord_avatar, 32)
                            return (
                                <div key={m.user_id ?? i} className="w-6 h-6 rounded-full border-2 border-(--color-primary) overflow-hidden shrink-0" title={name}>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white/90" style={{ backgroundColor: primaryColor }}>
                                            {name[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {pendingCount > 0 && (
                    <p className="text-xs font-semibold flex items-center gap-1" style={{ color: primaryColor }}>
                        <Bell size={11} />
                        {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
                    </p>
                )}
            </div>
        </DashboardWidget>
    )
}
