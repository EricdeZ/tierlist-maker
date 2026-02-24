import { Trophy } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'
import sparkIcon from '../../assets/spark.png'
import forgeLogo from '../../assets/forge.png'

export default function ForgeLeaderboardTab({ leaderboard, loading, currentUserId, seasonSlugs }) {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <img src={forgeLogo} alt="" className="w-12 h-12 object-contain forge-logo-float opacity-40 mb-3" />
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading leaderboard...</div>
                <div className="w-32 h-1 mt-2 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                    <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
                </div>
            </div>
        )
    }

    if (leaderboard.length === 0) {
        return (
            <div className="text-center py-12">
                <Trophy className="mx-auto mb-3 opacity-30" size={40} style={{ color: 'var(--forge-text-dim)' }} />
                <p className="forge-body text-[var(--forge-text-dim)]">No one has entered the Forge yet.</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-[2px] forge-stagger">
            {leaderboard.map((entry) => {
                const isMe = entry.userId === currentUserId
                const profileUrl = entry.playerSlug
                    ? (seasonSlugs
                        ? `/${seasonSlugs.leagueSlug}/${seasonSlugs.divisionSlug}/players/${entry.playerSlug}`
                        : `/profile/${entry.playerSlug}`)
                    : null

                return (
                    <div
                        key={entry.userId}
                        className={`forge-lb-row flex items-center gap-3 p-3 ${
                            isMe
                                ? 'bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/25'
                                : 'bg-[var(--forge-panel)] border border-transparent'
                        }`}
                    >
                        {/* Position */}
                        <div className={`w-10 text-center forge-num text-xl ${
                            entry.position === 1 ? 'text-yellow-400' :
                            entry.position === 2 ? 'text-gray-300' :
                            entry.position === 3 ? 'text-amber-600' : 'text-[var(--forge-text-dim)]'
                        }`}>
                            #{entry.position}
                        </div>

                        {/* Avatar */}
                        {entry.avatar && entry.discordId ? (
                            <img
                                src={`https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=32`}
                                alt=""
                                className="w-10 h-10 forge-clip-hex flex-shrink-0"
                            />
                        ) : (
                            <div
                                className="w-10 h-10 forge-clip-hex flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                style={{ background: 'var(--forge-edge)' }}
                            >
                                {(entry.username || '?')[0]}
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="forge-body font-bold text-base truncate">
                                {profileUrl ? (
                                    <a
                                        href={profileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="forge-profile-link"
                                    >
                                        {entry.username || 'Unknown'}
                                    </a>
                                ) : (
                                    entry.username || 'Unknown'
                                )}
                                {isMe && <span className="text-[var(--forge-flame-bright)] text-sm ml-1">(you)</span>}
                            </div>
                            <div className="text-sm text-[var(--forge-text-dim)] flex items-center gap-1">
                                <span className="forge-num">{entry.holdingsCount}</span> player{entry.holdingsCount !== 1 ? 's' : ''}
                                {' '}&middot;{' '}
                                <img src={sparkIcon} alt="" className="w-6 h-6 object-contain forge-spark-icon" />
                                <span className="forge-num">{entry.totalSparks}</span> Spark{entry.totalSparks !== 1 ? 's' : ''}
                            </div>
                        </div>

                        {/* Profit */}
                        <div className="text-right">
                            <div className={`flex items-center gap-1 justify-end forge-num text-base ${
                                entry.totalProfit >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'
                            }`}>
                                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                {entry.totalProfit >= 0 ? '+' : ''}{entry.totalProfit.toLocaleString()}
                            </div>
                            {entry.portfolioValue > 0 && (
                                <div className="forge-num text-sm text-[var(--forge-text-dim)]">
                                    Holdings: {entry.portfolioValue.toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
