import useHoloEffect from '../../../hooks/useHoloEffect'
import { isPrebuiltType, renderPrebuiltContent } from './prebuiltRenderers'
import '../../../components/TradingCardHolo.css'

const CARD_W = 300
const CARD_H = 420

function PreviewElement({ el }) {
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
                    }}>
                        {el.content || 'Text'}
                    </span>
                </div>
            )
        case 'stats':
            return (
                <div style={{ ...style, width: el.w ?? 120, height: 'auto' }}>
                    <div className="p-2 rounded" style={{ background: el.bgColor || 'rgba(0,0,0,0.7)' }}>
                        {Object.entries(el.stats || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between gap-3 text-xs" style={{ color: el.color || '#ffffff' }}>
                                <span className="opacity-70">{key}</span>
                                <span className="font-bold">{val}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        default:
            if (isPrebuiltType(el.type)) {
                return (
                    <div style={{ ...style, width: el.w ?? 300, height: el.h ?? 'auto' }}>
                        {renderPrebuiltContent(el)}
                    </div>
                )
            }
            return null
    }
}

// Renders just the shine + glare for an effect, inside a data-rarity wrapper for CSS targeting.
// The wrapper has NO z-index — it doesn't create a stacking context.
// The shine/glare have z-index so they interleave with content in the parent stacking context.
// Blend modes work because there's no stacking context barrier between shine and content.
function EffectElement({ el, parentOpacity }) {
    const z = el.z ?? 0
    const intensity = el.intensity ?? 1
    // Scale the parent's --card-opacity by this effect's intensity
    const scaledOpacity = (parentOpacity ?? 0) * intensity
    return (
        <div
            className="holo-card"
            data-rarity={el.effectName}
            data-holo-type="full"
            style={{
                position: 'absolute',
                inset: 0,
                // Override .holo-card CSS defaults that create stacking contexts
                width: 'auto',
                height: 'auto',
                aspectRatio: 'unset',
                transform: 'none',
                transformStyle: 'flat',
                willChange: 'auto',
                pointerEvents: 'none',
                // Opacity on wrapper scales the --card-opacity driven shine
                opacity: el.opacity ?? 1,
                '--card-opacity': scaledOpacity,
                // NO z-index here — avoids creating a stacking context
            }}
        >
            {/* Shine and glare get z-index directly so they participate in parent stacking context */}
            <div className="holo-card__shine" style={{ position: 'absolute', inset: 0, zIndex: z }} />
            <div className="holo-card__glare" style={{ position: 'absolute', inset: 0, zIndex: z }} />
        </div>
    )
}

export default function HoloPreview({ elements, border }) {
    const { cardRef, dynamicStyles, interacting, active, handlers } = useHoloEffect()
    const parentOpacity = parseFloat(dynamicStyles['--card-opacity']) || 0

    const visible = elements.filter(el => el.visible !== false)
    const sorted = [...visible].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

    const cardStyle = {
        width: CARD_W,
        height: CARD_H,
        borderRadius: border?.enabled ? (border.radius ?? 12) : 12,
        border: 'none',
        background: '#111827',
        position: 'relative',
        overflow: 'hidden',
    }

    return (
        <div
            className={`holo-card ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
            data-holo-type="full"
            style={{ ...dynamicStyles, width: CARD_W, '--card-scale': CARD_W / 340 }}
            ref={cardRef}
        >
            <div className="holo-card__translater">
                <div className="holo-card__rotator" {...handlers}>
                    <div className="holo-card__front" style={{ display: 'block' }}>
                        <div style={cardStyle}>
                            {sorted.map(el =>
                                el.type === 'effect'
                                    ? <EffectElement key={el.id} el={el} parentOpacity={parentOpacity} />
                                    : <PreviewElement key={el.id} el={el} />
                            )}
                            <div style={{
                                position: 'absolute', inset: 0, pointerEvents: 'none',
                                borderRadius: border?.enabled ? (border.radius ?? 12) : 12,
                                boxShadow: border?.enabled
                                    ? `inset 0 0 0 ${border.width ?? 3}px ${border.color ?? '#d4af37'}`
                                    : 'none',
                                zIndex: 900,
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
