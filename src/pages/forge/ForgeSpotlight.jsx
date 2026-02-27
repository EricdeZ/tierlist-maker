import { X } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { usePlayerAvatar } from './usePlayerAvatar'
import { getHeatTier, getActiveChange } from './forgeConstants'

export default function ForgeSpotlight({
    player, pos, isDragging, dragOffset,
    onStartDrag, onClose, onViewProfile, changeView,
}) {
    const avatarUrl = usePlayerAvatar(player)
    const teamColor = player.teamColor || '#666'
    const initials = player.playerName.slice(0, 2).toUpperCase()
    const change = getActiveChange(player, changeView)
    const tier = getHeatTier(change)

    const gp = player.gamesPlayed || 0
    const wins = player.wins || 0
    const losses = gp - wins
    const winRate = gp > 0 ? ((wins / gp) * 100).toFixed(0) : null
    const avgK = player.avgKills || 0
    const avgD = player.avgDeaths || 0
    const avgA = player.avgAssists || 0
    const kda = avgD > 0 ? (avgK + avgA / 2) / avgD : avgK + avgA / 2

    const kdaColor = kda >= 2 ? 'var(--forge-gain)' : kda >= 1.2 ? 'var(--forge-gold)' : 'var(--forge-loss)'
    const wrColor = winRate >= 60 ? 'var(--forge-gain)' : winRate >= 45 ? 'var(--forge-gold)' : 'var(--forge-loss)'

    const statRows = [
        { label: 'Record', value: gp > 0 ? `${wins}W - ${losses}L` : '—' },
        { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—', color: winRate != null ? wrColor : undefined },
        { label: 'KDA', value: gp > 0 ? kda.toFixed(2) : '—', color: gp > 0 ? kdaColor : undefined },
        { label: 'Avg K/D/A', value: gp > 0 ? `${avgK.toFixed(1)} / ${avgD.toFixed(1)} / ${avgA.toFixed(1)}` : '—' },
        { label: 'Price', value: Math.round(player.currentPrice).toLocaleString() },
    ]

    return (
        <div
            className="fixed z-30 overflow-hidden shadow-xl select-none"
            style={{
                width: '14.5rem',
                backgroundColor: '#0e0e0e',
                border: '1px solid var(--forge-border-lt)',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
            }}
        >
            {/* Drag handle + player header */}
            <div
                className="px-3 py-2.5 flex items-center gap-2"
                style={{
                    background: `linear-gradient(135deg, ${teamColor}cc, ${teamColor}88)`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={(e) => {
                    e.preventDefault()
                    dragOffset.current = {
                        x: e.clientX - pos.x,
                        y: e.clientY - pos.y,
                    }
                    onStartDrag()
                }}
            >
                {/* Drag grip */}
                <div className="flex flex-col gap-[2px] flex-shrink-0 opacity-40 mr-0.5">
                    <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-white" /><span className="w-[3px] h-[3px] rounded-full bg-white" /></div>
                    <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-white" /><span className="w-[3px] h-[3px] rounded-full bg-white" /></div>
                    <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-white" /><span className="w-[3px] h-[3px] rounded-full bg-white" /></div>
                </div>
                {/* Avatar */}
                <div
                    className="w-8 h-8 forge-clip-hex flex items-center justify-center font-extrabold text-[0.75rem] text-white flex-shrink-0"
                    style={{
                        background: avatarUrl
                            ? `url(${avatarUrl}) center/cover`
                            : `linear-gradient(135deg, ${teamColor}80, ${teamColor})`,
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}
                >
                    {!avatarUrl && initials}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-white truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                        {player.playerName}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-white/70">
                        <TeamLogo slug={player.teamSlug} name={player.teamName} size={11} color={teamColor} />
                        <span className="truncate">{player.teamName}</span>
                        {player.isFreeAgent && <span className="opacity-50">FA</span>}
                        {player.role && <span className="opacity-60">· {player.role}</span>}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-white/50 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Heat accent line */}
            <div
                className="h-[2px]"
                style={{
                    background: tier === 'blazing' ? 'linear-gradient(90deg, var(--forge-flame), var(--forge-ember), transparent)'
                        : tier === 'cooling' ? 'linear-gradient(90deg, var(--forge-cool), #4a9eff, transparent)'
                        : 'linear-gradient(90deg, var(--forge-gold), transparent)',
                }}
            />

            {/* Stats */}
            <div className="px-3 py-2">
                {statRows.map(row => (
                    <div key={row.label} className="flex justify-between items-center py-1 border-b border-[var(--forge-edge)] last:border-0">
                        <span className="forge-head text-[10px] tracking-wider text-[var(--forge-text-dim)]">{row.label}</span>
                        <span
                            className="forge-num text-[11px] font-bold tabular-nums"
                            style={{ color: row.color || 'var(--forge-text)' }}
                        >
                            {row.value}
                        </span>
                    </div>
                ))}
            </div>

            {/* View profile link */}
            <div className="px-3 pb-2">
                <button
                    onClick={onViewProfile}
                    className="w-full text-center forge-head text-[10px] font-bold tracking-wider py-1.5 text-[var(--forge-flame-bright)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 hover:bg-[var(--forge-flame)]/15 transition-colors cursor-pointer"
                >
                    View Full Profile
                </button>
            </div>
        </div>
    )
}
