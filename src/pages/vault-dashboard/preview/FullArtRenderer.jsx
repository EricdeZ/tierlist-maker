const CARD_WIDTH = 300
const CARD_HEIGHT = 420

export default function FullArtRenderer({ layers = [], showOutlines, selectedLayerId, onSelectLayer }) {
    const visibleLayers = [...layers]
        .filter(l => l.visible !== false)
        .sort((a, b) => (a.z || 0) - (b.z || 0))

    return (
        <div
            className="rounded-xl overflow-hidden relative bg-gray-900 border border-gray-700"
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        >
            {visibleLayers.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-sm">Drop an image here</p>
                    <p className="text-xs mt-1 text-gray-600">or use the controls on the left</p>
                </div>
            )}

            {visibleLayers.map(layer => {
                const isSelected = selectedLayerId === layer.id
                const baseStyle = {
                    position: 'absolute',
                    left: layer.position?.x ?? 0,
                    top: layer.position?.y ?? 0,
                    width: layer.size?.w ?? '100%',
                    height: layer.size?.h ?? '100%',
                    opacity: layer.opacity ?? 1,
                    mixBlendMode: layer.blendMode || 'normal',
                    zIndex: layer.z ?? 0,
                }

                if (showOutlines) {
                    baseStyle.outline = '1px solid rgba(255, 180, 0, 0.4)'
                }
                if (isSelected) {
                    baseStyle.outline = '2px solid #f59e0b'
                    baseStyle.outlineOffset = '-1px'
                }

                switch (layer.type) {
                    case 'image':
                        return layer.url ? (
                            <img
                                key={layer.id}
                                src={layer.url}
                                alt={layer.name || 'Image layer'}
                                style={baseStyle}
                                className="object-cover cursor-pointer"
                                onClick={() => onSelectLayer?.(layer.id)}
                                draggable={false}
                            />
                        ) : (
                            <div
                                key={layer.id}
                                style={baseStyle}
                                className="flex items-center justify-center bg-gray-800/50 border border-dashed border-gray-600 cursor-pointer"
                                onClick={() => onSelectLayer?.(layer.id)}
                            >
                                <span className="text-[10px] text-gray-500">No image</span>
                            </div>
                        )

                    case 'effect': {
                        // Gradient-based effect visualization
                        const effectGradients = {
                            rainbow: 'linear-gradient(135deg, #ff000040, #ff800040, #ffff0040, #00ff0040, #0000ff40, #800080 40)',
                            sparkle: 'radial-gradient(circle at 30% 30%, #ffffff30, transparent 50%), radial-gradient(circle at 70% 60%, #ffffff20, transparent 40%)',
                            foil: 'linear-gradient(160deg, #c0c0c020, #e8e8e840, #c0c0c020)',
                            cosmos: 'radial-gradient(ellipse at center, #1a0533, #0d001a)',
                            galaxy: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
                            radiant: 'radial-gradient(circle at center, #ffd70040, #ff850020, transparent)',
                            secret: 'linear-gradient(135deg, #ffd70030, #daa52030, #cd853f30)',
                            gold: 'linear-gradient(135deg, #ffd700, #daa520, #b8860b)',
                        }
                        return (
                            <div
                                key={layer.id}
                                style={{ ...baseStyle, background: effectGradients[layer.effectName] || effectGradients.rainbow }}
                                className="cursor-pointer"
                                onClick={() => onSelectLayer?.(layer.id)}
                            />
                        )
                    }

                    case 'frame':
                        return (
                            <div
                                key={layer.id}
                                style={{
                                    ...baseStyle,
                                    width: '100%',
                                    height: '100%',
                                    left: 0,
                                    top: 0,
                                    borderRadius: 12,
                                    boxSizing: 'border-box',
                                    border: layer.frameStyle === 'full_art_gold'
                                        ? '3px solid rgba(255, 215, 0, 0.5)'
                                        : layer.frameStyle === 'full_art_silver'
                                            ? '3px solid rgba(192, 192, 192, 0.5)'
                                            : '3px solid rgba(138, 43, 226, 0.4)',
                                    pointerEvents: 'none',
                                }}
                            />
                        )

                    case 'text':
                        return (
                            <span
                                key={layer.id}
                                style={{
                                    ...baseStyle,
                                    width: 'auto',
                                    height: 'auto',
                                    fontFamily: layer.font || 'Cinzel, serif',
                                    fontSize: layer.fontSize ?? 24,
                                    color: layer.color || '#ffffff',
                                    textShadow: layer.shadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                }}
                                onClick={() => onSelectLayer?.(layer.id)}
                            >
                                {layer.content || 'Text'}
                            </span>
                        )

                    default:
                        return <div key={layer.id} style={baseStyle} />
                }
            })}
        </div>
    )
}
