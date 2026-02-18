import { useState } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import { getContrastColor } from '../utils/colorContrast'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = { SOLO: 'Solo', JUNGLE: 'Jng', MID: 'Mid', SUPPORT: 'Sup', ADC: 'ADC' }
const ROLES = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

function getAvatarUrl(author) {
    if (author.avatar && author.discordId) {
        return `https://cdn.discordapp.com/avatars/${author.discordId}/${author.avatar}.png?size=64`
    }
    return null
}

const TierListPostCard = ({ post, teams, league, division, season, onLike, onDelete }) => {
    const { user } = useAuth()
    const [liking, setLiking] = useState(false)

    // Build player → team color lookup from teams
    const playerColorMap = {}
    if (teams) {
        for (const team of teams) {
            const color = team.color || '#6b7280'
            for (const p of team.players || []) {
                playerColorMap[p.name || p] = color
            }
        }
    }

    const handleLike = async () => {
        if (liking) return
        setLiking(true)
        try {
            await onLike(post.id)
        } finally {
            setLiking(false)
        }
    }

    const avatarUrl = getAvatarUrl(post.author)
    const isOwn = user && user.id === post.author.id

    return (
        <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-(--color-text-secondary)">
                            {post.author.username?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-(--color-text) truncate">
                            {post.author.username}
                        </span>
                        <span className="text-xs text-(--color-text-secondary)">
                            {timeAgo(post.createdAt)}
                        </span>
                    </div>
                    {post.title && (
                        <p className="text-sm text-(--color-text-secondary) truncate">{post.title}</p>
                    )}
                </div>
            </div>

            {/* Compact tier list */}
            <div className="mx-3 mt-3 bg-(--color-primary) rounded-lg border border-white/5 overflow-hidden">
                {/* Tier list header */}
                <div className="text-center py-2 border-b border-white/5">
                    <div className="text-sm font-bold text-(--color-text) font-heading">
                        {league?.slug?.toUpperCase()} Tierlist
                    </div>
                    <div className="text-[11px] text-(--color-text-secondary)">
                        {division?.name}{season ? ` — ${season.name}` : ''}
                    </div>
                </div>
            <div className="grid grid-cols-5 gap-px p-3">
                {ROLES.map(role => {
                    const players = post.rankings?.[role] || []
                    return (
                        <div key={role} className="min-w-0">
                            <div className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wider text-center mb-1.5">
                                {ROLE_LABELS[role]}
                            </div>
                            <div className="space-y-1">
                                {players.map((name, i) => {
                                    const color = playerColorMap[name] || '#6b7280'
                                    const textColor = getContrastColor(color)
                                    return (
                                        <div
                                            key={`${role}-${name}-${i}`}
                                            className="text-[11px] font-medium px-1.5 py-1 rounded truncate text-center"
                                            style={{ backgroundColor: color, color: textColor }}
                                            title={name}
                                        >
                                            {name}
                                        </div>
                                    )
                                })}
                                {players.length === 0 && (
                                    <div className="text-[10px] text-(--color-text-secondary)/30 italic text-center py-2">
                                        --
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
            </div>

            {/* Actions bar */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5">
                <button
                    onClick={handleLike}
                    disabled={liking || !user || isOwn}
                    className={`flex items-center gap-1.5 text-sm transition-colors disabled:opacity-40 ${
                        post.likedByMe
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-(--color-text-secondary) hover:text-red-400'
                    }`}
                    title={isOwn ? 'Cannot like your own post' : !user ? 'Log in to like' : ''}
                >
                    <Heart className="w-4 h-4" fill={post.likedByMe ? 'currentColor' : 'none'} />
                    <span className="font-medium tabular-nums">{post.likeCount}</span>
                </button>

                {isOwn && (
                    <button
                        onClick={() => onDelete(post.id)}
                        className="flex items-center gap-1 text-xs text-(--color-text-secondary) hover:text-red-400 transition-colors ml-auto"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                )}
            </div>
        </div>
    )
}

export default TierListPostCard
