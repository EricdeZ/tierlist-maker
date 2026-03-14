import { useState } from 'react'
import { Eye, EyeOff, Trash2, Plus, Image, Sparkles, Frame, Type, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'

const TYPE_BADGES = {
    image: 'bg-blue-500/20 text-blue-400',
    effect: 'bg-purple-500/20 text-purple-400',
    frame: 'bg-amber-500/20 text-amber-400',
    text: 'bg-green-500/20 text-green-400',
}

const TYPE_ICONS = { image: Image, effect: Sparkles, frame: Frame, text: Type }

const ADD_OPTIONS = [
    { type: 'image', label: 'Image Layer', Icon: Image },
    { type: 'effect', label: 'Holo Effect', Icon: Sparkles },
    { type: 'frame', label: 'Card Frame', Icon: Frame },
    { type: 'text', label: 'Text Label', Icon: Type },
]

export default function LayerStackPanel({ layers, selectedLayerId, onSelect, onAdd, onDelete, onReorder, onToggleVisibility }) {
    const [showDropdown, setShowDropdown] = useState(false)
    const sorted = [...layers].sort((a, b) => (b.z ?? 0) - (a.z ?? 0))

    function moveLayer(index, direction) {
        const target = index + direction
        if (target < 0 || target >= sorted.length) return
        const reordered = [...sorted]
        ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
        onReorder([...reordered].reverse())
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    Layers
                    {layers.length > 0 && <span className="ml-1.5 text-gray-500 font-normal">({layers.length})</span>}
                </h3>
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
                    >
                        <Plus size={12} />
                        Add
                    </button>
                    {showDropdown && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 w-36">
                                {ADD_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.type}
                                        onClick={() => { onAdd(opt.type); setShowDropdown(false) }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                    >
                                        <opt.Icon size={14} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {sorted.length === 0 ? (
                <div className="py-6 text-center">
                    <p className="text-xs text-gray-500">No layers yet</p>
                    <p className="text-[10px] text-gray-600 mt-1">Drop an image above or click Add</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {sorted.map((layer, i) => {
                        const LayerIcon = TYPE_ICONS[layer.type] || Image
                        const isPending = !!layer._pendingFile
                        return (
                            <div
                                key={layer.id}
                                onClick={() => onSelect(layer.id)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all group ${
                                    selectedLayerId === layer.id
                                        ? 'bg-amber-500/10 border border-amber-500/30'
                                        : 'bg-gray-800/50 border border-transparent hover:bg-gray-800'
                                }`}
                            >
                                {/* Thumbnail or icon */}
                                {layer.type === 'image' && layer.url ? (
                                    <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-900">
                                        <img src={layer.url} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${TYPE_BADGES[layer.type]}`}>
                                        <LayerIcon size={14} />
                                    </div>
                                )}

                                {/* Name + type */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-200 truncate">{layer.name || layer.id}</p>
                                    <p className="text-[10px] text-gray-500 capitalize">{layer.type}</p>
                                </div>

                                {/* Pending upload indicator */}
                                {isPending && (
                                    <Loader2 size={12} className="text-amber-400 animate-spin flex-shrink-0" />
                                )}

                                {/* Controls - visible on hover or when selected */}
                                <div className={`flex items-center gap-0.5 ${selectedLayerId === layer.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                    <button onClick={e => { e.stopPropagation(); moveLayer(i, -1) }} disabled={i === 0}
                                        className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20" title="Move up">
                                        <ChevronUp size={12} />
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); moveLayer(i, 1) }} disabled={i === sorted.length - 1}
                                        className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20" title="Move down">
                                        <ChevronDown size={12} />
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); onToggleVisibility(layer.id) }}
                                        className="p-0.5 text-gray-500 hover:text-white" title={layer.visible !== false ? 'Hide' : 'Show'}>
                                        {layer.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); onDelete(layer.id) }}
                                        className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
