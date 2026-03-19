import './GameCard.css'
import { RARITIES } from '../../../data/vault/economy'

export default function EmptyCardSlot({ rarity = 'common', size }) {
    const rarityInfo = RARITIES[rarity] || RARITIES.common
    const scale = size ? parseFloat(size) / 240 : 1
    return (
        <div
            className="game-card"
            data-rarity={rarity}
            style={{ '--card-scale': scale, ...(size ? { width: size } : {}) }}
        >
            <div className="game-card__border">
                <div className="game-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '3.45cqi', color: 'var(--text-dim)', opacity: 0.5 }}>
                        {rarityInfo.name} Card
                    </span>
                </div>
            </div>
        </div>
    )
}
