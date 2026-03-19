import '../../vault/components/GameCard.css'
import { RARITIES } from '../../../data/vault/economy'
import { CLASS_DAMAGE } from '../../../data/vault/gods'

const ABILITY_ICONS = {
    damage: 'Dmg', aoe_damage: 'AOE', heal: 'Heal', buff: 'Buff',
    debuff: 'Debf', cc: 'CC', execute: 'Exec', shield: 'Shld',
    summon: 'Smn', global: 'Glbl', stealth: 'Stlh', mobility: 'Move',
}

export default function StructuredCard({ cardData, rarity = 'common', cardType = 'god', size, overrides, footer, banner, canvasBlocks, subtitleEl }) {
    const d = cardData || {}
    const o = overrides || {}
    const rarityInfo = RARITIES[rarity] || RARITIES.common
    const role = d.role || 'mid'
    const scale = size ? parseFloat(size) / 240 : NaN
    const style = { '--card-scale': Number.isFinite(scale) ? scale : 1 }
    if (size) style.width = size

    const type = (cardType === 'player' || cardType === 'custom') ? 'god' : cardType
    const blocks = canvasBlocks || d.blocks || []
    const imageUrl = d.imageUrl

    return (
        <div className="game-card" data-rarity={rarity} data-role={type === 'god' ? role : undefined}
            data-type={type !== 'god' ? type : undefined} style={style}>
            <div className="game-card__border">
                <div className="game-card__body" style={o.bgColor ? { background: o.bgColor } : undefined}>
                    {/* Top banner */}
                    <div className="game-card__top">
                        <span className="game-card__top-name">{banner ? (banner.playerName || 'Name') : (d.name || 'Card Name')}</span>
                        {banner ? (
                            banner.roleLabel && <span className="game-card__type-label">{banner.roleLabel}</span>
                        ) : (
                            <>
                                {type === 'god' && <span className="game-card__type-label">{role}</span>}
                                {type !== 'god' && d.topStatLabel && (
                                    <div className="game-card__top-stat">
                                        <span className="game-card__power-label">{d.topStatLabel}</span>
                                        <span className="game-card__power-value"> {d.topStatValue || '0'}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Image */}
                    <div className="game-card__image-wrap">
                        <div className="game-card__image" style={d.imageBgColor ? { background: d.imageBgColor } : undefined}>
                            {imageUrl ? (
                                <img src={imageUrl} alt={d.name} loading="lazy"
                                    style={(d.imageX != null || d.imageY != null || d.imageZoom != null) ? {
                                        objectFit: 'cover', height: '100%',
                                        objectPosition: `${d.imageX ?? 50}% ${d.imageY ?? 50}%`,
                                        transform: d.imageZoom && d.imageZoom !== 100 ? `scale(${d.imageZoom / 100})` : undefined,
                                    } : undefined} />
                            ) : (
                                <div className="game-card__image-placeholder">
                                    {(type === 'god' ? 'G' : type[0]?.toUpperCase()) || '?'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Subtitle */}
                    {(subtitleEl?.text || d.subtitle) && (
                        <div className="game-card__subtitle">
                            <span>{subtitleEl ? subtitleEl.text : d.subtitle}</span>
                        </div>
                    )}

                    {/* Content blocks */}
                    {blocks.map((block, i) => (
                        <ContentBlock key={i} block={block} />
                    ))}

                    {/* Signature overlay */}
                    {d.signatureUrl && (
                        <div className="game-card__signature">
                            <img src={d.signatureUrl} alt="Signature" loading="lazy" />
                        </div>
                    )}

                    {/* Footer */}
                    <div className="game-card__footer">
                        <span className="game-card__serial">{footer ? (footer.leftText || '') : `#${d.serialNumber || '???'}`}</span>
                        <span className="game-card__rarity-label">{footer ? (footer.rightText || rarityInfo.name) : rarityInfo.name}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ContentBlock({ block }) {
    switch (block.type) {
        case 'ability':
            return (
                <div className="game-card__ability">
                    <div className="game-card__ability-name">
                        {block.abilityType && ABILITY_ICONS[block.abilityType] && (
                            <span style={{ opacity: 0.5, marginRight: '1.72cqi', fontSize: '3.45cqi' }}>
                                [{ABILITY_ICONS[block.abilityType]}]
                            </span>
                        )}
                        {block.name || 'Ability'}
                    </div>
                    <div className="game-card__ability-desc">{block.description || ''}</div>
                    {(block.manaCost || block.cooldown) && (
                        <div className="game-card__ability-cost">
                            {block.manaCost != null && <span className="mana-cost">{block.manaCost} mana</span>}
                            {block.cooldown != null && <span className="cooldown">{block.cooldown}t CD</span>}
                        </div>
                    )}
                </div>
            )

        case 'stats':
            return (
                <div className="game-card__ability">
                    {(block.rows || []).map((row, i) => (
                        <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.43cqi 0',
                            borderBottom: i < (block.rows?.length || 0) - 1 ? '1px solid var(--body-border)' : 'none',
                        }}>
                            <div>
                                <span style={{ fontSize: '3.45cqi', fontWeight: 700, color: 'var(--accent-light)' }}>{row.label}</span>
                                {row.sub && <span style={{ fontSize: '2.8cqi', color: 'var(--text-dim)', marginLeft: '1cqi' }}>{row.sub}</span>}
                            </div>
                            <span style={{ fontSize: '4cqi', fontWeight: 900, color: 'var(--text-bright)' }}>{row.value}</span>
                        </div>
                    ))}
                </div>
            )

        case 'text':
            return (
                <div className="game-card__ability">
                    {block.title && (
                        <div className="game-card__ability-name">{block.title}</div>
                    )}
                    <div className="game-card__ability-desc" style={{ whiteSpace: 'pre-wrap' }}>
                        {block.content || ''}
                    </div>
                </div>
            )

        default:
            return null
    }
}
