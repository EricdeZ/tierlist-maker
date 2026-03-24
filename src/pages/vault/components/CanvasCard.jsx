import useHoloEffect from '../../../hooks/useHoloEffect'
import { isPrebuiltType, renderPrebuiltContent } from '../../vault-dashboard/preview/prebuiltRenderers'
import { RARITIES } from '../../../data/vault/economy'
import '../../../components/TradingCardHolo.css'

const BASE_W = 300
const BASE_H = 420

function CardElement({ el }) {
    const style = {
        position: 'absolute',
        left: el.x ?? 0,
        top: el.y ?? 0,
        width: el.w ?? '100%',
        height: el.h ?? '100%',
        opacity: el.opacity ?? 1,
        zIndex: el.z ?? 0,
        pointerEvents: 'none',
    }

    switch (el.type) {
        case 'image':
            return (
                <div style={style}>
                    {el.url && <img src={el.url} alt="" className="w-full h-full object-cover" draggable={false} />}
                </div>
            )
        case 'text':
            return (
                <div style={{ ...style, width: 'auto', height: 'auto', padding: '2px 4px' }}>
                    <span className="whitespace-nowrap" style={{
                        fontFamily: el.font || 'Cinzel, serif',
                        fontSize: el.fontSize ?? 20,
                        color: el.color || '#ffffff',
                        fontWeight: el.bold ? 'bold' : 'normal',
                        textShadow: el.shadow ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none',
                        letterSpacing: el.letterSpacing ?? 0,
                    }}>
                        {el.content || 'Text'}
                    </span>
                </div>
            )
        case 'stats': {
            const stats = el.stats || {}
            return (
                <div style={{ ...style, width: el.w ?? 120, height: 'auto' }}>
                    <div className="p-2 rounded" style={{ background: el.bgColor || 'rgba(0,0,0,0.7)' }}>
                        {Object.entries(stats).map(([key, val]) => (
                            <div key={key} className="flex justify-between gap-3 text-xs" style={{ color: el.color || '#ffffff' }}>
                                <span className="opacity-70">{key}</span>
                                <span className="font-bold">{val}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        case 'effect':
            return null
        default:
            if (isPrebuiltType(el.type)) {
                return (
                    <div style={{ ...style, width: el.w ?? BASE_W, height: el.h ?? 'auto' }}>
                        {renderPrebuiltContent(el)}
                    </div>
                )
            }
            return null
    }
}

function CardContent({ elements, border, rarity, signatureUrl }) {
    const visible = (elements || []).filter(el => el.visible !== false)
    const sorted = [...visible].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    const firstImage = elements?.find(el => el.type === 'image')
    const rarityColor = RARITIES[rarity]?.color || '#9ca3af'
    const radius = border?.enabled ? (border.radius ?? 12) : 12

    return (
        <div
            className="relative overflow-hidden"
            style={{
                width: BASE_W,
                height: BASE_H,
                borderRadius: radius,
                background: firstImage?.bgColor || '#111827',
            }}
        >
            {sorted.map(el => <CardElement key={el.id} el={el} />)}

            {/* Signature overlay — full-card transparent PNG, same as GameCard.css .game-card__signature */}
            {signatureUrl && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 800,
                    pointerEvents: 'none', borderRadius: radius, overflow: 'hidden',
                }}>
                    <img src={signatureUrl} alt="Signature" loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'fill',
                                 filter: 'drop-shadow(0 0 3px #e8e8ff66)' }} />
                </div>
            )}

            {/* Border overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: radius,
                boxShadow: border?.enabled
                    ? `inset 0 0 0 ${border.width ?? 3}px ${border.color ?? '#d4af37'}`
                    : 'inset 0 0 0 1px #374151',
                zIndex: 900,
            }} />

            {/* Rarity glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: radius,
                boxShadow: `0 0 12px 2px ${rarityColor}30`,
                zIndex: 901,
            }} />
        </div>
    )
}

export default function CanvasCard({ elements, border, rarity = 'common', size = 240, holo, signatureUrl }) {
    const { cardRef, dynamicStyles, interacting, active, handlers } = useHoloEffect()
    const scale = size / BASE_W
    const height = size * (BASE_H / BASE_W)

    const content = (
        <CardContent
            elements={elements}
            border={border}
            rarity={rarity}
            signatureUrl={signatureUrl}
        />
    )

    const scaledContent = (
        <div style={{ width: size, height, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BASE_W, height: BASE_H }}>
                {content}
            </div>
        </div>
    )

    if (!holo) return scaledContent

    return (
        <div
            className={`holo-card ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
            data-rarity={holo.rarity}
            data-holo-type={holo.holoType}
            style={{ ...dynamicStyles, width: size, '--card-scale': size / 340 }}
            ref={cardRef}
        >
            <div className="holo-card__translater">
                <div className="holo-card__rotator" {...handlers}>
                    <div className="holo-card__front">
                        {scaledContent}
                        <div className="holo-card__shine" />
                        {holo.rarity === 'unique' && <div className="holo-card__shine2" />}
                        <div className="holo-card__glare" />
                    </div>
                </div>
            </div>
        </div>
    )
}
