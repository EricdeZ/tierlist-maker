import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RANK_LABELS, getDivisionImage } from '../../utils/divisionImages'
import TeamLogo from '../../components/TeamLogo'
import { Crown, Users, LogOut, ChevronDown, Swords, ExternalLink, UserPlus, X } from 'lucide-react'

const teamImages = import.meta.glob('../../assets/teams/*.webp', { eager: true })

export default function TeamCard({ team, onLeave, onDisband, onInvite, onKick }) {
    const [expanded, setExpanded] = useState(false)

    const isLeague = !!team.is_league
    const isCaptain = team.role === 'captain'
    const color = team.color || '#6366f1'
    const tierImg = isLeague
        ? getDivisionImage(team.league_slug, team.division_slug, team.division_tier)
        : getDivisionImage(null, null, team.skill_tier)
    const tierLabel = isLeague
        ? team.division_name
        : (RANK_LABELS[team.skill_tier] || `Tier ${team.skill_tier}`)
    const members = (team.members || []).filter(m =>
        m.role === 'captain' || m.role === 'member' || m.roster_status === 'captain' || m.roster_status === 'member'
    )
    const logoUrl = team.logo_url || (team.slug ? teamImages[`../../assets/teams/${team.slug}.webp`]?.default : null)

    return (
        <div className="relative overflow-hidden group">
            {/* Color accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />

            {/* Background logo watermark */}
            {logoUrl && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none select-none">
                    <img
                        src={logoUrl}
                        alt=""
                        className="w-24 h-24 object-contain"
                        style={{ opacity: 0.06, filter: `drop-shadow(0 0 20px ${color}40)` }}
                    />
                </div>
            )}

            {/* Main content */}
            <div
                className="relative bg-white/[0.03] hover:bg-white/[0.05] border-y border-r border-white/[0.06] transition-colors cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4 px-5 py-3.5">
                    {/* Logo */}
                    <div className="w-12 h-12 shrink-0 flex items-center justify-center" style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}>
                        {isLeague ? (
                            <TeamLogo slug={team.slug} name={team.name} size={48} logoUrl={logoUrl} color={color} />
                        ) : logoUrl ? (
                            <img src={logoUrl} alt="" className="w-12 h-12 object-contain" />
                        ) : (
                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold"
                                style={{ backgroundColor: `${color}20`, color }}
                            >
                                {team.name[0]}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                            <span className="font-bold text-(--color-text) truncate text-[15px]">{team.name}</span>
                            {isLeague && (
                                <span
                                    className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0"
                                    style={{ backgroundColor: `${color}20`, color }}
                                >
                                    League
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5">
                                {tierImg && <img src={tierImg} alt="" className="w-4 h-4" />}
                                <span className="text-xs text-(--color-text-secondary)">{tierLabel}</span>
                            </div>
                            {isLeague && (
                                <span className="text-[10px] text-(--color-text-secondary)/50">{team.league_name}</span>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                                {isCaptain ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1" style={{ backgroundColor: `${color}15`, color }}>
                                        <Crown className="w-3 h-3" /> Captain
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-(--color-text-secondary) font-semibold">
                                        Member
                                    </span>
                                )}
                                <span className="text-[10px] text-(--color-text-secondary)/40">
                                    {team.member_count || members.length}p
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Expand toggle */}
                    <ChevronDown
                        className={`w-4 h-4 text-(--color-text-secondary)/40 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* Expanded section */}
            <div
                className="overflow-hidden transition-all duration-200 ease-in-out"
                style={{ maxHeight: expanded ? '600px' : '0px', opacity: expanded ? 1 : 0 }}
            >
                <div className="relative bg-white/[0.02] border-b border-r border-white/[0.06] pl-5 pr-5 py-3 space-y-3">
                    {/* Members list */}
                    {members.length > 0 && (
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-(--color-text-secondary)/40 mb-2 font-semibold">Roster</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                                {members.map((m, i) => {
                                    const displayName = m.player_name || m.discord_username || '?'
                                    const profileSlug = m.player_slug || m.discord_username
                                    const nameEl = profileSlug ? (
                                        <Link
                                            to={`/profile/${profileSlug}`}
                                            className="text-xs text-(--color-text)/80 truncate hover:text-(--color-text) transition-colors"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {displayName}
                                        </Link>
                                    ) : (
                                        <span className="text-xs text-(--color-text)/80 truncate">{displayName}</span>
                                    )
                                    const isMemberCaptain = m.role === 'captain' || m.roster_status === 'captain'
                                    const canKick = !isLeague && isCaptain && !isMemberCaptain && onKick
                                    return (
                                        <div key={i} className="flex items-center gap-2 py-0.5 group/member">
                                            {m.discord_avatar && m.discord_id ? (
                                                <img
                                                    src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.discord_avatar}.png?size=64`}
                                                    alt="" className="w-5 h-5 rounded-full shrink-0"
                                                />
                                            ) : (
                                                <div
                                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                                                    style={{ backgroundColor: `${color}20`, color }}
                                                >
                                                    {displayName[0].toUpperCase()}
                                                </div>
                                            )}
                                            {nameEl}
                                            {isMemberCaptain && (
                                                <Crown className="w-3 h-3 shrink-0" style={{ color }} />
                                            )}
                                            {canKick && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); onKick(team, m.user_id, displayName) }}
                                                    className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/member:opacity-100 text-red-400/60 hover:text-red-400 hover:bg-red-500/15 transition-all cursor-pointer shrink-0 ml-auto"
                                                    title={`Remove ${displayName}`}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isCaptain && (
                            <Link
                                to="/scrims"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-emerald-400 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
                                onClick={e => e.stopPropagation()}
                            >
                                <Swords className="w-3.5 h-3.5" /> Post a Scrim
                            </Link>
                        )}
                        {isLeague && (
                            <Link
                                to={`/${team.league_slug}/${team.division_slug}/teams/${team.slug}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-(--color-text-secondary) hover:text-(--color-text) bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                                onClick={e => e.stopPropagation()}
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> View Team Page
                            </Link>
                        )}
                        {!isLeague && isCaptain && onInvite && (
                            <button
                                onClick={e => { e.stopPropagation(); onInvite(team) }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-blue-400 text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/15 transition-colors cursor-pointer"
                            >
                                <UserPlus className="w-3.5 h-3.5" /> Invite Members
                            </button>
                        )}
                        {!isLeague && isCaptain && onDisband && (
                            <button
                                onClick={e => { e.stopPropagation(); onDisband(team) }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-red-400/60 text-xs hover:text-red-300 bg-red-900/10 hover:bg-red-900/20 transition-colors cursor-pointer ml-auto"
                            >
                                Disband
                            </button>
                        )}
                        {!isLeague && !isCaptain && onLeave && (
                            <button
                                onClick={e => { e.stopPropagation(); onLeave(team) }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-(--color-text-secondary)/60 text-xs hover:text-red-400 bg-white/[0.04] hover:bg-red-900/15 transition-colors cursor-pointer ml-auto"
                            >
                                <LogOut className="w-3.5 h-3.5" /> Leave
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
