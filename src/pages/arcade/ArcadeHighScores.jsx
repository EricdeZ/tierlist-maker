import { useState, useEffect } from 'react'
import { inhouseService } from '../../services/database'
import { Trophy, TrendingUp, Flame } from 'lucide-react'
import { avatarUrl } from './arcadeConstants'

const SORT_OPTIONS = [
    { key: 'wins', label: 'WINS' },
    { key: 'games', label: 'GAMES' },
    { key: 'winrate', label: 'WIN %' },
    { key: 'streak', label: 'STREAK' },
]

export default function ArcadeHighScores() {
    const [leaderboard, setLeaderboard] = useState([])
    const [loading, setLoading] = useState(true)
    const [sort, setSort] = useState('wins')

    useEffect(() => {
        setLoading(true)
        inhouseService.getLeaderboard(sort)
            .then(data => setLeaderboard(data))
            .catch(err => console.error('Leaderboard error:', err))
            .finally(() => setLoading(false))
    }, [sort])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="arcade-label arcade-pulse" style={{ color: 'var(--arcade-cyan)' }}>LOADING...</div>
            </div>
        )
    }

    return (
        <div>
            {/* Sort tabs */}
            <div className="flex gap-2 mb-4">
                {SORT_OPTIONS.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setSort(opt.key)}
                        className="arcade-label px-3 py-1.5 rounded transition-all"
                        style={{
                            background: sort === opt.key ? 'var(--arcade-cyan-dim)' : 'var(--arcade-surface)',
                            color: sort === opt.key ? 'var(--arcade-cyan)' : 'var(--arcade-text-dim)',
                            border: `1px solid ${sort === opt.key ? 'var(--arcade-cyan-dim)' : 'var(--arcade-border)'}`,
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {leaderboard.length === 0 ? (
                <div className="text-center py-16">
                    <p className="arcade-label" style={{ color: 'var(--arcade-text-dim)' }}>
                        NO SCORES YET
                    </p>
                </div>
            ) : (
                <div className="space-y-1.5 arcade-stagger">
                    {leaderboard.map((entry, i) => (
                        <div
                            key={entry.userId}
                            className="flex items-center gap-3 px-4 py-2.5 rounded"
                            style={{
                                background: i < 3 ? 'var(--arcade-surface)' : 'transparent',
                                border: i < 3 ? '1px solid var(--arcade-border)' : '1px solid transparent',
                            }}
                        >
                            {/* Rank */}
                            <div className="w-8 text-center">
                                {i === 0 ? (
                                    <Trophy className="w-4 h-4 mx-auto" style={{ color: 'var(--arcade-yellow)' }} />
                                ) : (
                                    <span className="arcade-label" style={{
                                        color: i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--arcade-text-dim)',
                                    }}>
                                        {entry.position}
                                    </span>
                                )}
                            </div>

                            {/* Avatar + name */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {avatarUrl(entry.discordId, entry.avatar) ? (
                                    <img src={avatarUrl(entry.discordId, entry.avatar)} alt="" className="w-6 h-6 rounded-full shrink-0" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full shrink-0" style={{ background: 'var(--arcade-border-lt)' }} />
                                )}
                                <span className="text-sm truncate" style={{ color: 'var(--arcade-text)' }}>
                                    {entry.username}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 text-xs shrink-0">
                                <span style={{ color: 'var(--arcade-win)' }}>{entry.wins}W</span>
                                <span style={{ color: 'var(--arcade-loss)' }}>{entry.losses}L</span>
                                <span style={{ color: 'var(--arcade-text-mid)' }}>{entry.winrate}%</span>
                                {entry.streak > 0 && (
                                    <span className="flex items-center gap-0.5" style={{ color: 'var(--arcade-yellow)' }}>
                                        <Flame className="w-3 h-3" />{entry.streak}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
