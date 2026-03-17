import { isPrebuiltType, renderPrebuiltContent } from './prebuiltRenderers'

const W = 120
const H = 168
const SCALE = W / 300

export default function MiniCardPreview({ templateData }) {
    if (!templateData) return <Placeholder />
    const { elements, border } = templateData
    if (!elements?.length) return <Placeholder />

    const visible = elements.filter(el => el.visible !== false)
    const sorted = [...visible].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

    return (
        <div
            className="relative overflow-hidden flex-shrink-0"
            style={{
                width: W,
                height: H,
                borderRadius: border?.enabled ? (border.radius ?? 12) * SCALE : 5,
                background: '#111827',
            }}
        >
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: 300, height: 420 }}>
                {sorted.map(el => <MiniElement key={el.id} el={el} />)}
            </div>
            {/* Border overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: border?.enabled ? (border.radius ?? 12) * SCALE : 5,
                boxShadow: border?.enabled
                    ? `inset 0 0 0 ${Math.max(1, (border.width ?? 3) * SCALE)}px ${border.color ?? '#d4af37'}`
                    : 'inset 0 0 0 1px #374151',
            }} />
        </div>
    )
}

function MiniElement({ el }) {
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
                    <div style={{ ...style, width: el.w ?? 300, height: el.h ?? 'auto' }}>
                        {renderPrebuiltContent(el)}
                    </div>
                )
            }
            return null
    }
}

function Placeholder() {
    return (
        <div className="flex items-center justify-center flex-shrink-0 bg-gray-700 rounded"
            style={{ width: W, height: H }}>
            <span className="text-gray-500 text-xs">No preview</span>
        </div>
    )
}
