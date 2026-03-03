import { RANK_LABELS, getDivisionImage } from '../../utils/divisionImages'
import { Crown, Users, LogOut } from 'lucide-react'

export default function TeamCard({ team, onLeave, onDisband, onManage }) {
    const tierImg = getDivisionImage(null, null, team.skill_tier)
    const isCaptain = team.role === 'captain'

    return (
        <div className="rounded-xl border border-white/10 bg-(--color-secondary) p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    {team.logo_url ? (
                        <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <Users className="w-6 h-6 text-(--color-text-secondary)/40" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-(--color-text) truncate">{team.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {tierImg && <img src={tierImg} alt="" className="w-4 h-4" />}
                        <span className="text-xs text-(--color-text-secondary)">
                            {RANK_LABELS[team.skill_tier] || `Tier ${team.skill_tier}`}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isCaptain ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Captain
                        </span>
                    ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-(--color-text-secondary) font-semibold">
                            Member
                        </span>
                    )}
                    <span className="text-[10px] text-(--color-text-secondary)">
                        {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                    </span>
                </div>

                {isCaptain ? (
                    <div className="flex gap-1.5">
                        {onManage && (
                            <button
                                onClick={() => onManage(team)}
                                className="text-[10px] px-2 py-1 rounded bg-white/5 text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Manage
                            </button>
                        )}
                        {onDisband && (
                            <button
                                onClick={() => onDisband(team)}
                                className="text-[10px] px-2 py-1 rounded bg-red-900/20 text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-colors cursor-pointer"
                            >
                                Disband
                            </button>
                        )}
                    </div>
                ) : (
                    onLeave && (
                        <button
                            onClick={() => onLeave(team)}
                            className="text-[10px] px-2 py-1 rounded bg-white/5 text-(--color-text-secondary) hover:text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <LogOut className="w-3 h-3" /> Leave
                        </button>
                    )
                )}
            </div>
        </div>
    )
}
