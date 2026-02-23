import { Trophy } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'

export default function ForgeLeaderboardTab({ leaderboard, loading, currentUserId }) {
    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="forge-head text-[var(--forge-text-dim)] text-lg tracking-wider">Loading leaderboard...</div>
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
        <div className="max-w-2xl mx-auto space-y-[2px]">
            {leaderboard.map((entry) => {
                const isMe = entry.userId === currentUserId

                return (
                    <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 transition-all ${
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
                                className="w-9 h-9 forge-clip-hex flex-shrink-0"
                            />
                        ) : (
                            <div
                                className="w-9 h-9 forge-clip-hex flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                style={{ background: 'var(--forge-edge)' }}
                            >
                                {(entry.username || '?')[0]}
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="forge-body font-bold text-base truncate">
                                {entry.username || 'Unknown'}
                                {isMe && <span className="text-[var(--forge-flame-bright)] text-sm ml-1">(you)</span>}
                            </div>
                            <div className="text-sm text-[var(--forge-text-dim)]">
                                <span className="forge-num">{entry.holdingsCount}</span> player{entry.holdingsCount !== 1 ? 's' : ''}
                                {' '}&middot;{' '}
                                <span className="forge-num">{entry.totalSparks}</span> Spark{entry.totalSparks !== 1 ? 's' : ''}
                            </div>
                        </div>

                        {/* Value */}
                        <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                <span className="forge-num text-base text-[var(--forge-gold-bright)]">
                                    {entry.portfolioValue.toLocaleString()}
                                </span>
                            </div>
                            <div className={`forge-num text-sm ${entry.pl >= 0 ? 'text-[var(--forge-gain)]' : 'text-[var(--forge-loss)]'}`}>
                                {entry.pl >= 0 ? '+' : ''}{entry.pl.toLocaleString()}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
