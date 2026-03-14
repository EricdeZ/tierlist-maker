import { useRef } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'

const inputClass = 'px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500'
const labelClass = 'block text-[10px] text-gray-500 mb-1 uppercase tracking-wider'

const BLEND_MODES = ['normal', 'overlay', 'multiply', 'screen', 'soft-light']
const EFFECT_TYPES = [
    { value: 'rainbow', label: 'Rainbow' },
    { value: 'sparkle', label: 'Sparkle' },
    { value: 'foil', label: 'Foil' },
    { value: 'cosmos', label: 'Cosmos' },
    { value: 'galaxy', label: 'Galaxy' },
    { value: 'radiant', label: 'Radiant' },
    { value: 'secret', label: 'Secret' },
    { value: 'gold', label: 'Gold' },
]
const FRAME_STYLES = [
    { value: 'full_art_gold', label: 'Gold' },
    { value: 'full_art_silver', label: 'Silver' },
    { value: 'full_art_cosmic', label: 'Cosmic' },
]
const FONTS = [
    { value: 'Cinzel', label: 'Cinzel (Elegant)' },
    { value: 'Bebas Neue', label: 'Bebas Neue (Bold)' },
    { value: 'Inter', label: 'Inter (Clean)' },
    { value: 'Georgia', label: 'Georgia (Serif)' },
    { value: 'monospace', label: 'Monospace' },
]

export default function LayerProperties({ layer, onUpdate, onUploadImage }) {
    const fileInputRef = useRef(null)

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const objectUrl = URL.createObjectURL(file)
        onUpdate({ url: objectUrl, _pendingFile: file })
        if (onUploadImage) onUploadImage(file, layer.id)
        e.target.value = ''
    }

    return (
        <div className="border-t border-gray-700 pt-4 space-y-4">
            {/* Layer name */}
            <div>
                <label className={labelClass}>Layer Name</label>
                <input
                    type="text"
                    value={layer.name || ''}
                    onChange={e => onUpdate({ name: e.target.value })}
                    placeholder="Layer name..."
                    className={`${inputClass} w-full`}
                />
            </div>

            {/* Image-specific: visual image picker */}
            {layer.type === 'image' && (
                <div>
                    <label className={labelClass}>Image</label>
                    {layer.url ? (
                        <div className="relative group mb-2">
                            <img src={layer.url} alt="Layer" className="w-full h-32 object-cover rounded-lg border border-gray-700" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg font-medium"
                                >
                                    Replace Image
                                </button>
                            </div>
                            {layer._pendingFile && (
                                <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-600/90 text-white text-[10px] rounded-full">
                                    Uploading...
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-24 border-2 border-dashed border-gray-600 hover:border-amber-500/50 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors mb-2"
                        >
                            <Upload size={20} className="text-gray-500" />
                            <span className="text-xs text-gray-500">Click to upload</span>
                        </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

                    <input
                        type="text"
                        value={layer.url?.startsWith('blob:') ? '' : (layer.url || '')}
                        onChange={e => onUpdate({ url: e.target.value })}
                        placeholder="...or paste image URL"
                        className={`${inputClass} w-full text-[10px]`}
                    />
                </div>
            )}

            {/* Effect type */}
            {layer.type === 'effect' && (
                <div>
                    <label className={labelClass}>Effect Type</label>
                    <div className="grid grid-cols-4 gap-1">
                        {EFFECT_TYPES.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => onUpdate({ effectName: value })}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                    layer.effectName === value
                                        ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Frame style */}
            {layer.type === 'frame' && (
                <div>
                    <label className={labelClass}>Frame Style</label>
                    <div className="grid grid-cols-3 gap-1">
                        {FRAME_STYLES.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => onUpdate({ frameStyle: value })}
                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                                    layer.frameStyle === value
                                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Text-specific */}
            {layer.type === 'text' && (
                <>
                    <div>
                        <label className={labelClass}>Text Content</label>
                        <input
                            type="text"
                            value={layer.content || ''}
                            onChange={e => onUpdate({ content: e.target.value })}
                            className={`${inputClass} w-full text-sm`}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelClass}>Font</label>
                            <select value={layer.font || 'Cinzel'} onChange={e => onUpdate({ font: e.target.value })}
                                className={`${inputClass} w-full`}>
                                {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Color</label>
                            <div className="flex gap-1">
                                <input type="color" value={layer.color || '#ffffff'} onChange={e => onUpdate({ color: e.target.value })}
                                    className="w-8 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                                <input type="text" value={layer.color || '#ffffff'} onChange={e => onUpdate({ color: e.target.value })}
                                    className={`${inputClass} flex-1`} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Size: {layer.fontSize || 24}px</label>
                        <input type="range" min={8} max={72} value={layer.fontSize || 24}
                            onChange={e => onUpdate({ fontSize: parseInt(e.target.value) })}
                            className="w-full accent-amber-500" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={!!layer.shadow} onChange={e => onUpdate({ shadow: e.target.checked })}
                            className="accent-amber-500" />
                        Drop Shadow
                    </label>
                </>
            )}

            {/* Position (image + text) */}
            {(layer.type === 'image' || layer.type === 'text') && (
                <div>
                    <label className={labelClass}>Position</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-600 w-3">X</span>
                            <input type="number" value={layer.position?.x ?? 0}
                                onChange={e => onUpdate({ position: { ...layer.position, x: parseInt(e.target.value) || 0 } })}
                                className={`${inputClass} flex-1`} />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-600 w-3">Y</span>
                            <input type="number" value={layer.position?.y ?? 0}
                                onChange={e => onUpdate({ position: { ...layer.position, y: parseInt(e.target.value) || 0 } })}
                                className={`${inputClass} flex-1`} />
                        </div>
                    </div>
                </div>
            )}

            {/* Size (image only) */}
            {layer.type === 'image' && (
                <div>
                    <label className={labelClass}>Size</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-600 w-3">W</span>
                            <input type="text" value={layer.size?.w ?? '100%'}
                                onChange={e => onUpdate({ size: { ...layer.size, w: e.target.value } })}
                                className={`${inputClass} flex-1`} />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-600 w-3">H</span>
                            <input type="text" value={layer.size?.h ?? '100%'}
                                onChange={e => onUpdate({ size: { ...layer.size, h: e.target.value } })}
                                className={`${inputClass} flex-1`} />
                        </div>
                    </div>
                </div>
            )}

            {/* Opacity + Blend (all types) */}
            <div>
                <label className={labelClass}>Opacity: {Math.round((layer.opacity ?? 1) * 100)}%</label>
                <input type="range" min={0} max={1} step={0.05} value={layer.opacity ?? 1}
                    onChange={e => onUpdate({ opacity: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500" />
            </div>

            <div>
                <label className={labelClass}>Blend Mode</label>
                <div className="grid grid-cols-3 gap-1">
                    {BLEND_MODES.map(m => (
                        <button
                            key={m}
                            onClick={() => onUpdate({ blendMode: m })}
                            className={`px-2 py-1 rounded text-[10px] transition-colors ${
                                (layer.blendMode || 'normal') === m
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
                            }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
