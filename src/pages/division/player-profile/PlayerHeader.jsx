import { Link } from 'react-router-dom'
import { UserCheck, User, ExternalLink } from 'lucide-react'
import TeamLogo from '../../../components/TeamLogo'
import PlayerAvatar from '../../../components/PlayerAvatar'
import RankBadge from '../../../components/RankBadge'
import { getRank, formatRank } from '../../../config/ranks'
import { getTierColor } from '../../../config/challengeTiers'
import passionCoin from '../../../assets/passion/passion.png'
import { roleImages } from './profileUtils'

export default function PlayerHeader({
    player, team, basePath, totalEarned,
    discordId, discordAvatar, isConnected, allowDiscordAvatar, mostPlayedGod,
    profileData, passionBalance, isOwnProfile,
    user, linkedPlayer, authLoading,
}) {
    const roleImg = player.role ? roleImages[player.role.toUpperCase()] : null

    return (
        <>
            {/* Header -- avatar + name + rank (rank hidden on mobile) */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-3">
                <div className="flex items-center gap-4">
                    <PlayerAvatar
                        discordId={discordId}
                        discordAvatar={discordAvatar}
                        isConnected={isConnected}
                        allowDiscordAvatar={allowDiscordAvatar}
                        mostPlayedGod={mostPlayedGod}
                        playerName={player.name}
                        teamColor={team?.color}
                        size={56}
                        className="border-2 border-(--color-accent)/30"
                    />
                    <h1 className="font-heading text-3xl font-bold text-(--color-text) flex-1 min-w-0 truncate">
                        {player.name}
                    </h1>
                    {totalEarned != null && (
                        <Link to="/challenges" className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <RankBadge totalEarned={totalEarned} size="lg" />
                            <span className="text-xs font-semibold text-(--color-text-secondary)">
                                {formatRank(getRank(totalEarned))}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Team / Role card (+ rank on mobile) */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 mb-6">
                <div className="flex items-center gap-3">
                    {team && (
                        <Link to={`${basePath}/teams/${team.slug}`} className="flex items-center gap-2 flex-shrink-0">
                            <TeamLogo slug={team.slug} name={team.name} size={36} color={team.color} />
                            <div className="w-2.5 h-10 rounded hover:opacity-80 transition-opacity" style={{ backgroundColor: team.color }} />
                        </Link>
                    )}
                    {roleImg && (
                        <img src={roleImg} alt={player.role} className="w-9 h-9 object-contain flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-(--color-text)">
                            {team ? (
                                <Link
                                    to={`${basePath}/teams/${team.slug}`}
                                    className="font-semibold hover:text-(--color-accent) transition-colors"
                                >
                                    {team.name}
                                </Link>
                            ) : (
                                <span className="text-(--color-text-secondary)">No Team</span>
                            )}
                        </p>
                        {player.role && (
                            <p className="text-xs text-(--color-text-secondary)">
                                {player.role}
                                {player.secondary_role && ` / ${player.secondary_role}`}
                            </p>
                        )}
                    </div>
                    {/* Rank -- mobile only (hidden on sm+) */}
                    {totalEarned != null && (
                        <Link to="/challenges" className="flex sm:hidden flex-col items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <RankBadge totalEarned={totalEarned} size="md" />
                            <span className="text-[10px] font-semibold text-(--color-text-secondary)">
                                {formatRank(getRank(totalEarned))}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Profile Tags */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {profileData?.player?.is_claimed && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" />
                        Verified
                    </span>
                )}
                {!authLoading && (() => {
                    if (isOwnProfile) {
                        return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-medium">
                                Your Profile
                            </span>
                        )
                    }
                    if (!user) {
                        return (
                            <button
                                onClick={login}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium transition-colors"
                            >
                                <User className="w-3.5 h-3.5" />
                                Claim Profile
                            </button>
                        )
                    }
                    if (!linkedPlayer) {
                        return (
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal', { detail: { playerId: player.id, playerName: player.name } }))}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium transition-colors"
                            >
                                <User className="w-3.5 h-3.5" />
                                Claim This Profile
                            </button>
                        )
                    }
                    return null
                })()}
                {player.tracker_url && (
                    <a
                        href={player.tracker_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-medium hover:bg-(--color-accent)/20 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Tracker
                    </a>
                )}
                {passionBalance != null && (
                    <Link
                        to="/challenges"
                        className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-bold hover:bg-(--color-accent)/20 transition-colors"
                    >
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        {new Intl.NumberFormat().format(passionBalance)}
                    </Link>
                )}
            </div>

            {/* Badges */}
            {profileData?.badges?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {profileData.badges.map((badge, i) => {
                        const color = getTierColor(badge.tier)
                        return (
                            <div
                                key={i}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold"
                                style={{
                                    borderColor: `${color}60`,
                                    color: color,
                                    backgroundColor: `${color}15`,
                                }}
                                title={`${badge.title} — ${badge.completed_at ? new Date(badge.completed_at).toLocaleDateString() : ''}`}
                            >
                                <span>&#9733;</span>
                                {badge.badge_label}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Claim CTA Banner — only for signed-in users without a linked player, on unclaimed profiles */}
            {profileData && !profileData.player.is_claimed && !authLoading && user && !linkedPlayer && (
                <div
                    className="relative overflow-hidden rounded-xl border border-[#5865F2]/30 p-5 mb-6"
                    style={{ background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.08), var(--color-secondary))' }}
                >
                    <div
                        className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none"
                        style={{ background: 'radial-gradient(circle at top right, #5865F2, transparent 70%)' }}
                    />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-[#5865F2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading text-lg font-bold text-(--color-text) mb-1">
                                Is this you? Claim this profile!
                            </h3>
                            <p className="text-sm text-(--color-text-secondary)">
                                Link your Discord and unlock your full competitive identity.
                                Show off your stats and track your career across every season.
                            </p>
                        </div>
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal', { detail: { playerId: player.id, playerName: player.name } }))}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                        >
                            <User className="w-4 h-4" />
                            Claim This Profile
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
