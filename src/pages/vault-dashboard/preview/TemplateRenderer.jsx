import TradingCard from '../../../components/TradingCard'

export default function TemplateRenderer({ templateData }) {
    const { baseCard } = templateData
    const { type, rarity, holoType, customName, frameStyle } = baseCard

    if (type === 'player') {
        return (
            <TradingCard
                playerName={customName || 'Player Name'}
                teamName="Team"
                teamColor="#6366f1"
                seasonName="Season 1"
                role="MID"
                rarity={rarity === 'full_art' ? 'mythic' : rarity}
                size={300}
                holo={holoType ? { type: holoType } : undefined}
            />
        )
    }

    // Non-player placeholder card
    const rarityColors = {
        common: '#9ca3af',
        uncommon: '#22c55e',
        rare: '#3b82f6',
        epic: '#a855f7',
        legendary: '#ff8c00',
        mythic: '#ef4444',
        full_art: '#d4af37',
    }

    const borderColor = rarityColors[rarity] || '#9ca3af'

    return (
        <div
            className="rounded-xl flex flex-col items-center justify-center text-center p-4"
            style={{
                width: 250,
                height: 350,
                border: `2px solid ${borderColor}`,
                background: `linear-gradient(135deg, #1f2937 0%, #111827 100%)`,
            }}
        >
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                {type}
            </div>
            <div className="text-lg font-bold text-white mb-1">
                {customName || type.charAt(0).toUpperCase() + type.slice(1) + ' Card'}
            </div>
            <div
                className="text-sm font-medium mt-1"
                style={{ color: borderColor }}
            >
                {rarity === 'full_art' ? 'Full Art' : rarity.charAt(0).toUpperCase() + rarity.slice(1)}
            </div>
            {frameStyle && frameStyle !== 'default' && (
                <div className="text-xs text-gray-500 mt-2">
                    Frame: {frameStyle}
                </div>
            )}
        </div>
    )
}
