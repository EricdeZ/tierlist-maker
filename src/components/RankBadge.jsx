import { getRank, formatRank } from '../config/ranks'

const sizes = {
    sm: { img: 'w-8 h-8', text: 'text-[8px]', wrapper: '' },
    md: { img: 'w-12 h-12', text: 'text-[10px]', wrapper: '' },
    lg: { img: 'w-20 h-20', text: 'text-xs', wrapper: '' },
    xl: { img: 'w-28 h-28', text: 'text-sm', wrapper: '' },
    '2xl': { img: 'w-38 h-38', text: 'text-base', wrapper: '' },
    '3xl': { img: 'w-44 h-44', text: 'text-base', wrapper: '' },
}

// High-tier glow colors
const glowColors = {
    Master: 'drop-shadow(0 0 8px rgba(200, 150, 255, 0.6))',
    Demigod: 'drop-shadow(0 0 10px rgba(180, 255, 180, 0.5))',
    Deity: 'drop-shadow(0 0 12px rgba(255, 100, 200, 0.6))',
}

export default function RankBadge({ totalEarned, rank: rankProp, size = 'md', showLabel = false }) {
    const rank = rankProp || getRank(totalEarned || 0)
    const s = sizes[size] || sizes.md
    const glow = glowColors[rank.name] || ''

    return (
        <div className={`inline-flex flex-col items-center ${s.wrapper}`}>
            <div className="relative">
                {rank.image ? (
                    <img
                        src={rank.image}
                        alt={formatRank(rank)}
                        className={`${s.img} object-contain`}
                        style={glow ? { filter: glow } : undefined}
                    />
                ) : (
                    <div className={`${s.img} rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-(--color-text-secondary)`}>
                        {rank.name[0]}
                    </div>
                )}
            </div>
            {showLabel && (
                <span className="text-xs text-(--color-text-secondary) whitespace-nowrap">
                    {formatRank(rank)}
                </span>
            )}
        </div>
    )
}
