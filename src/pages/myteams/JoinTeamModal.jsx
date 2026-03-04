import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Users, Crown } from 'lucide-react'
import { RANK_LABELS, getDivisionImage } from '../../utils/divisionImages'
import { communityTeamService } from '../../services/database'

export default function JoinTeamModal({ code, onJoined, onClose }) {
    const [team, setTeam] = useState(null)
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        communityTeamService.previewLink(code)
            .then(data => setTeam(data.team))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [code])

    const handleJoin = async () => {
        setJoining(true)
        setError(null)
        try {
            await communityTeamService.joinLink(code)
            onJoined()
        } catch (err) {
            setError(err.message)
            setJoining(false)
        }
    }

    const color = team?.color || '#6366f1'
    const tierImg = team ? getDivisionImage(null, null, team.skill_tier) : null
    const tierLabel = team ? (RANK_LABELS[team.skill_tier] || `Tier ${team.skill_tier}`) : ''

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-sm bg-(--color-primary) border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-base font-bold text-(--color-text)">Team Invite</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : error && !team ? (
                        <div className="text-center py-6">
                            <p className="text-sm text-red-400 mb-4">{error}</p>
                            <button onClick={onClose} className="text-xs text-(--color-text-secondary) hover:text-(--color-text) transition-colors cursor-pointer">
                                Close
                            </button>
                        </div>
                    ) : team && (
                        <div className="space-y-4">
                            {/* Team info */}
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center" style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}>
                                    {team.logo_url ? (
                                        <img src={team.logo_url} alt="" className="w-12 h-12 object-contain" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold" style={{ backgroundColor: `${color}20`, color }}>
                                            {team.name[0]}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-base font-bold text-(--color-text) truncate">{team.name}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {tierImg && <img src={tierImg} alt="" className="w-4 h-4" />}
                                        <span className="text-xs text-(--color-text-secondary)">{tierLabel}</span>
                                        <span className="text-xs text-(--color-text-secondary)/40 ml-1">{team.members?.length || 0} member{(team.members?.length || 0) !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Members */}
                            {team.members?.length > 0 && (
                                <div>
                                    <div className="text-[9px] uppercase tracking-widest text-(--color-text-secondary)/40 mb-2 font-semibold">Members</div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                        {team.members.map((m, i) => {
                                            const name = m.player_name || m.discord_username || '?'
                                            const profileSlug = m.player_slug || m.discord_username
                                            return (
                                                <div key={i} className="flex items-center gap-1.5">
                                                    {m.discord_avatar && m.discord_id ? (
                                                        <img src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.discord_avatar}.png?size=64`} alt="" className="w-5 h-5 rounded-full shrink-0" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: `${color}20`, color }}>
                                                            {name[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    {profileSlug ? (
                                                        <Link to={`/profile/${profileSlug}`} onClick={onClose} className="text-xs text-(--color-text)/80 hover:text-(--color-text) transition-colors">
                                                            {name}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-xs text-(--color-text)/80">{name}</span>
                                                    )}
                                                    {m.role === 'captain' && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-xs text-red-400">{error}</p>}

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleJoin}
                                    disabled={joining}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                    style={{ backgroundColor: `${color}20`, color }}
                                >
                                    {joining ? 'Joining...' : 'Join Team'}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-lg text-sm text-(--color-text-secondary) bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
