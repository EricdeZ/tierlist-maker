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
    user, linkedPlayer, login, authLoading,
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

            {/* Claim CTA Banner */}
            {profileData && !profileData.player.is_claimed && !authLoading && (
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
                        {!user ? (
                            <button
                                onClick={login}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                </svg>
                                Login to Claim
                            </button>
                        ) : !linkedPlayer ? (
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal', { detail: { playerId: player.id, playerName: player.name } }))}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                            >
                                <User className="w-4 h-4" />
                                Claim This Profile
                            </button>
                        ) : null}
                    </div>
                </div>
            )}
        </>
    )
}
