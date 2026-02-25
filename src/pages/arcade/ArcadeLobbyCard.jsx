import { Clock, Users } from 'lucide-react'
import { STATUS_LABELS, STATUS_CSS, avatarUrl } from './arcadeConstants'

export default function ArcadeLobbyCard({ lobby, onSelect }) {
    const coinSlots = []
    for (let i = 0; i < lobby.maxPlayers; i++) {
        coinSlots.push(
            <div
                key={i}
                className={`arcade-coin ${i < (lobby.playerCount || 0) ? 'filled' : ''}`}
            />
        )
    }

    const isScheduled = lobby.mode === 'scheduled' && lobby.scheduledAt
    const scheduledDate = isScheduled ? new Date(lobby.scheduledAt) : null
    const formattedDate = scheduledDate
        ? scheduledDate.toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
        })
        : null

    const avatar = avatarUrl(lobby.creatorDiscordId, lobby.creatorAvatar)

    return (
        <button
            onClick={onSelect}
            className="w-full text-left rounded-lg p-4 transition-all hover:scale-[1.02] arcade-border-glow arcade-scanlines"
            style={{
                background: 'var(--arcade-panel)',
                border: '1.5px solid var(--arcade-border)',
            }}
        >
            {/* Status + scope */}
            <div className="flex items-center justify-between mb-3 relative z-10">
                <span className={`arcade-status ${STATUS_CSS[lobby.status] || ''}`}>
                    {STATUS_LABELS[lobby.status] || lobby.status}
                </span>
                {lobby.accessScope !== 'open' && (
                    <span className="arcade-label" style={{ color: 'var(--arcade-text-dim)', fontSize: '0.45rem' }}>
                        {lobby.accessScope === 'division' ? lobby.divisionName : lobby.leagueName}
                    </span>
                )}
            </div>

            {/* Title */}
            <h3
                className="arcade-label text-sm mb-2 truncate relative z-10"
                style={{ color: 'var(--arcade-text)', fontSize: '0.65rem' }}
            >
                {lobby.title}
            </h3>

            {/* Creator */}
            <div className="flex items-center gap-2 mb-3 relative z-10">
                {avatar ? (
                    <img src={avatar} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                    <div className="w-4 h-4 rounded-full" style={{ background: 'var(--arcade-border-lt)' }} />
                )}
                <span className="text-xs" style={{ color: 'var(--arcade-text-mid)' }}>
                    {lobby.creatorName}
                </span>
            </div>

            {/* Coin slots (player count) */}
            <div className="flex items-center gap-1.5 mb-3 relative z-10">
                {coinSlots}
                <span className="ml-2 text-xs" style={{ color: 'var(--arcade-text-mid)' }}>
                    {lobby.playerCount || 0}/{lobby.maxPlayers}
                </span>
            </div>

            {/* Footer: schedule or live */}
            <div className="flex items-center gap-3 text-xs relative z-10" style={{ color: 'var(--arcade-text-dim)' }}>
                {isScheduled ? (
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                    </span>
                ) : (
                    <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Live Queue
                    </span>
                )}
            </div>
        </button>
    )
}
