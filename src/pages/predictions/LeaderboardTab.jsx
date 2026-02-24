import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'

export function LeaderboardTab({ leaderboard, loading, error, user }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    if (leaderboard.length === 0) {
        return (
            <div className="py-20 text-center">
                <Trophy className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-base font-heading font-bold text-white/60 mb-1">No Rankings Yet</h3>
                <p className="text-white/40 text-sm">Rankings appear after matches are resolved.</p>
            </div>
        )
    }

    const top3 = leaderboard.slice(0, 3)
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
    const PODIUM = [
        { height: 'h-16', color: '#9ca3af', medal: '2nd', glow: '' },
        { height: 'h-24', color: '#f8c56a', medal: '1st', glow: '0 0 30px -8px rgba(248,197,106,0.25)' },
        { height: 'h-12', color: '#cd7f32', medal: '3rd', glow: '' },
    ]

    return (
        <div>
            {top3.length >= 3 && (
                <div className="flex items-end justify-center gap-3 sm:gap-5 mb-10 pt-4">
                    {podiumOrder.map((entry, i) => {
                        const s = PODIUM[i]
                        const avatarUrl = entry.avatar && entry.discordId
                            ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=64`
                            : null
                        return (
                            <div key={entry.userId} className="flex flex-col items-center gap-2 pred-card-enter" style={{ animationDelay: `${i * 100}ms` }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-11 h-11 sm:w-13 sm:h-13 rounded-full"
                                        style={{ border: `2px solid ${s.color}`, boxShadow: s.glow }} />
                                ) : (
                                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-bold"
                                        style={{ border: `2px solid ${s.color}`, boxShadow: s.glow }}>
                                        {entry.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div className="text-xs font-medium text-white/70 truncate max-w-[80px]">{entry.username}</div>
                                <div className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{entry.accuracy}%</div>
                                <div className={`w-14 sm:w-18 ${s.height} rounded-t-xl flex items-start justify-center pt-2`}
                                    style={{ background: `linear-gradient(to top, rgba(255,255,255,0.02), ${s.color}12)`, borderTop: `1px solid ${s.color}25`, borderLeft: `1px solid ${s.color}15`, borderRight: `1px solid ${s.color}15` }}>
                                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.medal}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Full Rankings</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_5rem] sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem] items-center px-3 py-2 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">#</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">Predictor</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-center hidden sm:block">Record</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-center">Rate</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-center">Correct</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/25 text-right hidden sm:block">Earned</span>
            </div>

            {leaderboard.map((entry, i) => {
                const isMe = user && entry.userId === user.id
                const avatarUrl = entry.avatar && entry.discordId
                    ? `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=32`
                    : null

                return (
                    <div key={entry.userId}
                        className="grid grid-cols-[2rem_1fr_4rem_4rem_5rem] sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem] items-center px-3 py-2.5 rounded-lg pred-card-enter"
                        style={{
                            animationDelay: `${i * 20}ms`,
                            background: isMe ? 'rgba(248,197,106,0.06)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        }}>
                        <span className={`text-sm font-bold tabular-nums ${i < 3 ? '' : 'text-white/30'}`}
                            style={{ color: i === 0 ? '#f8c56a' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : undefined }}>
                            {entry.position}
                        </span>

                        <div className="flex items-center gap-2 min-w-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                    {entry.username?.[0]?.toUpperCase()}
                                </div>
                            )}
                            {entry.playerSlug ? (
                                <Link to={`/profile/${entry.playerSlug}`} className="text-sm font-medium text-white/70 truncate hover:text-white transition-colors">
                                    {entry.username}
                                </Link>
                            ) : (
                                <span className="text-sm font-medium text-white/70 truncate">{entry.username}</span>
                            )}
                        </div>

                        <span className="text-xs text-white/30 text-center hidden sm:block tabular-nums">{entry.correct}-{entry.incorrect}</span>

                        <span className="text-sm font-bold text-center tabular-nums" style={{
                            color: entry.accuracy >= 70 ? '#22c55e' : entry.accuracy >= 50 ? '#f8c56a' : '#ef4444'
                        }}>{entry.accuracy}%</span>

                        <span className="text-xs text-white/40 text-center tabular-nums">{entry.correct}</span>

                        <span className="hidden sm:flex items-center justify-end gap-1 text-sm font-medium tabular-nums" style={{ color: '#f8c56a' }}>
                            {entry.totalEarned} <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
