import { Users } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

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

    return (
        <DashboardWidget title="My Team" icon={<Users size={16} />} accent="blue" linkTo="/scrims">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    {team.logo_url ? (
                        <img src={team.logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                            {team.name?.charAt(0)}
                        </div>
                    )}
                    <p className="text-sm font-semibold truncate">{team.name}</p>
                </div>

                {/* Roster avatars */}
                {team.members?.length > 0 && (
                    <div className="flex -space-x-1.5">
                        {team.members.slice(0, 6).map(m => (
                            <div key={m.user_id} className="w-6 h-6 rounded-full bg-white/10 border border-(--color-primary) overflow-hidden" title={m.username}>
                                {m.avatar ? (
                                    <img src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.avatar}.webp?size=32`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[8px]">{m.username?.[0]}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {pendingCount > 0 && (
                    <p className="text-xs text-blue-400 font-semibold">{pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}</p>
                )}
            </div>
        </DashboardWidget>
    )
}
