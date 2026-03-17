import { useRef, useState } from 'react'
import { ImagePlus, Type, BarChart3, Sparkles, Trash2, Upload, GripVertical, CreditCard, Table2, AlignCenter, PanelBottom } from 'lucide-react'
import { ROLES } from '../preview/prebuiltRenderers'

const FONTS = ['Cinzel', 'Bebas Neue', 'Inter', 'Georgia', 'monospace', "'Segoe UI', system-ui, sans-serif"]
const HOLO_EFFECTS = [
    'common', 'amazing',
    'galaxy', 'vstar', 'shiny', 'ultra',
    'radiant', 'sparkle', 'rainbow-alt', 'cosmos',
    'rainbow', 'secret', 'gold',
]

const btn = 'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors'
const input = 'px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500'
const label = 'block text-[10px] text-gray-500 mb-1 uppercase tracking-wider'

export default function CardSidebar({
    elements,
    selectedId,
    selectedElement,
    onSelect,
    onAddImage,
    onAddText,
    onAddStats,
    onAddEffect,
    onAddNameBanner,
    onAddStatsBlock,
    onAddSubtitle,
    onAddFooter,
    onUpdateElement,
    onDeleteElement,
    onReorder,
    border,
    onBorderChange,
    onUploadImage,
}) {
    const fileRef = useRef(null)
    const [dragId, setDragId] = useState(null)
    const [dragOverId, setDragOverId] = useState(null)

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (file) onAddImage(file)
        e.target.value = ''
    }

    const sel = selectedElement

    return (
        <div className="space-y-4 text-sm">
            {/* Add Elements */}
            <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add Elements</h3>
                <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => fileRef.current?.click()} className={`${btn} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30`}>
                        <ImagePlus size={16} /> Image
                    </button>
                    <button onClick={onAddText} className={`${btn} bg-green-600/20 text-green-400 hover:bg-green-600/30`}>
                        <Type size={16} /> Text
                    </button>
                    <button onClick={onAddStats} className={`${btn} bg-purple-600/20 text-purple-400 hover:bg-purple-600/30`}>
                        <BarChart3 size={16} /> Stats
                    </button>
                    <button onClick={() => onAddEffect('rainbow')} className={`${btn} bg-amber-600/20 text-amber-400 hover:bg-amber-600/30`}>
                        <Sparkles size={16} /> Effect
                    </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Prebuilt Components */}
            <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Prebuilt Components</h3>
                <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={onAddNameBanner} className={`${btn} bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30`}>
                        <CreditCard size={16} /> Banner
                    </button>
                    <button onClick={onAddStatsBlock} className={`${btn} bg-rose-600/20 text-rose-400 hover:bg-rose-600/30`}>
                        <Table2 size={16} /> Stats
                    </button>
                    <button onClick={onAddSubtitle} className={`${btn} bg-teal-600/20 text-teal-400 hover:bg-teal-600/30`}>
                        <AlignCenter size={16} /> Subtitle
                    </button>
                    <button onClick={onAddFooter} className={`${btn} bg-orange-600/20 text-orange-400 hover:bg-orange-600/30`}>
                        <PanelBottom size={16} /> Footer
                    </button>
                </div>
            </div>

            {/* Border */}
            <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Card Border</h3>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={border?.enabled ?? false}
                        onChange={e => onBorderChange({ ...border, enabled: e.target.checked })}
                        className="accent-amber-500"
                    />
                    <span className="text-xs text-gray-300">Show Border</span>
                </label>
                {border?.enabled && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-500 w-12">Color</label>
                            <input
                                type="color"
                                value={border.color || '#d4af37'}
                                onChange={e => onBorderChange({ ...border, color: e.target.value })}
                                className="w-8 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                            />
                            <input
                                type="text"
                                value={border.color || '#d4af37'}
                                onChange={e => onBorderChange({ ...border, color: e.target.value })}
                                className={`${input} flex-1`}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-500 w-12">Width</label>
                            <input
                                type="range"
                                min={1}
                                max={8}
                                value={border.width ?? 3}
                                onChange={e => onBorderChange({ ...border, width: parseInt(e.target.value) })}
                                className="flex-1 accent-amber-500"
                            />
                            <span className="text-[10px] text-gray-400 w-6 text-right">{border.width ?? 3}px</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-500 w-12">Radius</label>
                            <input
                                type="range"
                                min={0}
                                max={24}
                                value={border.radius ?? 12}
                                onChange={e => onBorderChange({ ...border, radius: parseInt(e.target.value) })}
                                className="flex-1 accent-amber-500"
                            />
                            <span className="text-[10px] text-gray-400 w-6 text-right">{border.radius ?? 12}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Selected Element Properties */}
            {sel && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            {{ image: 'Image', text: 'Text', effect: 'Holo Effect', stats: 'Stats',
                               'name-banner': 'Name Banner', 'stats-block': 'Stats Block',
                               subtitle: 'Subtitle', footer: 'Footer' }[sel.type] || sel.type}
                        </h3>
                        <button
                            onClick={() => onDeleteElement(sel.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            title="Delete element"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Image properties */}
                    {sel.type === 'image' && (
                        <div className="space-y-3">
                            {sel.url && (
                                <img src={sel.url} alt="" className="w-full h-20 object-cover rounded-lg border border-gray-700" />
                            )}
                            <button
                                onClick={() => {
                                    const inp = document.createElement('input')
                                    inp.type = 'file'
                                    inp.accept = 'image/*'
                                    inp.onchange = (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const url = URL.createObjectURL(file)
                                        onUpdateElement(sel.id, { url, _pendingFile: file })
                                        if (onUploadImage) onUploadImage(file, sel.id)
                                    }
                                    inp.click()
                                }}
                                className={`${btn} bg-gray-700 text-gray-300 hover:bg-gray-600 justify-center`}
                            >
                                <Upload size={14} /> Replace Image
                            </button>
                            <div>
                                <label className={label}>Opacity: {Math.round((sel.opacity ?? 1) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.05} value={sel.opacity ?? 1}
                                    onChange={e => onUpdateElement(sel.id, { opacity: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                        </div>
                    )}

                    {/* Text properties */}
                    {sel.type === 'text' && (
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Content</label>
                                <input type="text" value={sel.content || ''} onChange={e => onUpdateElement(sel.id, { content: e.target.value })}
                                    className={`${input} w-full text-sm`} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={label}>Font</label>
                                    <select value={sel.font || 'Cinzel'} onChange={e => onUpdateElement(sel.id, { font: e.target.value })}
                                        className={`${input} w-full`}>
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Color</label>
                                    <div className="flex gap-1">
                                        <input type="color" value={sel.color || '#ffffff'}
                                            onChange={e => onUpdateElement(sel.id, { color: e.target.value })}
                                            className="w-8 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                                        <input type="text" value={sel.color || '#ffffff'}
                                            onChange={e => onUpdateElement(sel.id, { color: e.target.value })}
                                            className={`${input} flex-1`} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={label}>Size: {sel.fontSize ?? 20}px</label>
                                <input type="range" min={8} max={72} value={sel.fontSize ?? 20}
                                    onChange={e => onUpdateElement(sel.id, { fontSize: parseInt(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                            <div className="flex gap-3">
                                <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                    <input type="checkbox" checked={!!sel.bold} onChange={e => onUpdateElement(sel.id, { bold: e.target.checked })}
                                        className="accent-amber-500" />
                                    Bold
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                    <input type="checkbox" checked={!!sel.shadow} onChange={e => onUpdateElement(sel.id, { shadow: e.target.checked })}
                                        className="accent-amber-500" />
                                    Shadow
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Stats properties */}
                    {sel.type === 'stats' && (
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Text Color</label>
                                <div className="flex gap-1">
                                    <input type="color" value={sel.color || '#ffffff'}
                                        onChange={e => onUpdateElement(sel.id, { color: e.target.value })}
                                        className="w-8 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                                    <input type="text" value={sel.color || '#ffffff'}
                                        onChange={e => onUpdateElement(sel.id, { color: e.target.value })}
                                        className={`${input} flex-1`} />
                                </div>
                            </div>
                            <div>
                                <label className={label}>Background</label>
                                <div className="flex gap-1">
                                    <input type="color" value={sel.bgColor || '#000000'}
                                        onChange={e => onUpdateElement(sel.id, { bgColor: e.target.value })}
                                        className="w-8 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                                    <input type="text" value={sel.bgColor || 'rgba(0,0,0,0.7)'}
                                        onChange={e => onUpdateElement(sel.id, { bgColor: e.target.value })}
                                        className={`${input} flex-1`} />
                                </div>
                            </div>
                            <div>
                                <label className={label}>Edit Stats</label>
                                {Object.entries(sel.stats || {}).map(([key, val]) => (
                                    <div key={key} className="flex items-center gap-1 mb-1">
                                        <input type="text" value={key}
                                            onChange={e => {
                                                const newStats = { ...sel.stats }
                                                const oldVal = newStats[key]
                                                delete newStats[key]
                                                newStats[e.target.value] = oldVal
                                                onUpdateElement(sel.id, { stats: newStats })
                                            }}
                                            className={`${input} w-16`} />
                                        <input type="text" value={val}
                                            onChange={e => onUpdateElement(sel.id, { stats: { ...sel.stats, [key]: e.target.value } })}
                                            className={`${input} flex-1`} />
                                        <button onClick={() => {
                                            const newStats = { ...sel.stats }
                                            delete newStats[key]
                                            onUpdateElement(sel.id, { stats: newStats })
                                        }} className="text-gray-500 hover:text-red-400 p-0.5">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => onUpdateElement(sel.id, { stats: { ...sel.stats, 'Stat': '0' } })}
                                    className="text-xs text-amber-400 hover:text-amber-300 mt-1"
                                >
                                    + Add Stat Row
                                </button>
                            </div>
                        </div>
                    )}


                    {/* Effect properties */}
                    {sel.type === 'effect' && (
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Effect Type</label>
                                <div className="grid grid-cols-3 gap-1">
                                    {HOLO_EFFECTS.map(e => (
                                        <button key={e} onClick={() => onUpdateElement(sel.id, { effectName: e, name: e })}
                                            className={`px-1.5 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-colors ${
                                                sel.effectName === e
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-300'
                                            }`}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={label}>Opacity: {Math.round((sel.opacity ?? 1) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.05} value={sel.opacity ?? 1}
                                    onChange={e => onUpdateElement(sel.id, { opacity: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                        </div>
                    )}

                    {/* Name Banner properties */}
                    {sel.type === 'name-banner' && (
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Player Name</label>
                                <input type="text" value={sel.playerName || ''} onChange={e => onUpdateElement(sel.id, { playerName: e.target.value })}
                                    className={`${input} w-full`} />
                            </div>
                            <div>
                                <label className={label}>Role Label</label>
                                <input type="text" value={sel.roleLabel || ''} onChange={e => onUpdateElement(sel.id, { roleLabel: e.target.value })}
                                    className={`${input} w-full`} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={label}>Role Colors</label>
                                    <select value={sel.role || 'adc'} onChange={e => onUpdateElement(sel.id, { role: e.target.value })}
                                        className={`${input} w-full capitalize`}>
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Font</label>
                                    <select value={sel.font || "'Segoe UI', system-ui, sans-serif"} onChange={e => onUpdateElement(sel.id, { font: e.target.value })}
                                        className={`${input} w-full`}>
                                        {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={label}>Size: {sel.fontSize ?? 16}px</label>
                                <input type="range" min={10} max={32} value={sel.fontSize ?? 16}
                                    onChange={e => onUpdateElement(sel.id, { fontSize: parseInt(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                            <div>
                                <label className={label}>BG Opacity: {Math.round((sel.bgOpacity ?? 1) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.05} value={sel.bgOpacity ?? 1}
                                    onChange={e => onUpdateElement(sel.id, { bgOpacity: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                        </div>
                    )}

                    {/* Stats Block properties */}
                    {sel.type === 'stats-block' && (
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Role Colors</label>
                                <select value={sel.role || 'adc'} onChange={e => onUpdateElement(sel.id, { role: e.target.value })}
                                    className={`${input} w-full capitalize`}>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={label}>Font</label>
                                    <select value={sel.font || "'Segoe UI', system-ui, sans-serif"} onChange={e => onUpdateElement(sel.id, { font: e.target.value })}
                                        className={`${input} w-full`}>
                                        {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Size: {sel.fontSize ?? 10}px</label>
                                    <input type="range" min={7} max={18} value={sel.fontSize ?? 10}
                                        onChange={e => onUpdateElement(sel.id, { fontSize: parseInt(e.target.value) })}
                                        className="w-full accent-amber-500" />
                                </div>
                            </div>
                            <div>
                                <label className={label}>Stat Rows</label>
                                {(sel.rows || []).map((row, i) => (
                                    <div key={i} className="flex items-center gap-1 mb-1">
                                        <input type="text" value={row.label} placeholder="Label"
                                            onChange={e => {
                                                const rows = [...(sel.rows || [])]
                                                rows[i] = { ...rows[i], label: e.target.value }
                                                onUpdateElement(sel.id, { rows })
                                            }}
                                            className={`${input} w-14`} />
                                        <input type="text" value={row.value} placeholder="Value"
                                            onChange={e => {
                                                const rows = [...(sel.rows || [])]
                                                rows[i] = { ...rows[i], value: e.target.value }
                                                onUpdateElement(sel.id, { rows })
                                            }}
                                            className={`${input} w-12`} />
                                        <input type="text" value={row.sub || ''} placeholder="Sub"
                                            onChange={e => {
                                                const rows = [...(sel.rows || [])]
                                                rows[i] = { ...rows[i], sub: e.target.value }
                                                onUpdateElement(sel.id, { rows })
                                            }}
                                            className={`${input} flex-1`} />
                                        <button onClick={() => {
                                            const rows = (sel.rows || []).filter((_, j) => j !== i)
                                            onUpdateElement(sel.id, { rows })
                                        }} className="text-gray-500 hover:text-red-400 p-0.5">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => onUpdateElement(sel.id, { rows: [...(sel.rows || []), { label: 'Stat', value: '0', sub: '' }] })}
                                    className="text-xs text-amber-400 hover:text-amber-300 mt-1"
                                >
                                    + Add Row
                                </button>
                            </div>
                            <div>
                                <label className={label}>Record Bar</label>
                                <div className="grid grid-cols-3 gap-1">
                                    <div>
                                        <span className="text-[9px] text-gray-600">WR</span>
                                        <input type="text" value={sel.record?.winRate || ''} placeholder="70%"
                                            onChange={e => onUpdateElement(sel.id, { record: { ...sel.record, winRate: e.target.value } })}
                                            className={`${input} w-full`} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-600">Record</span>
                                        <input type="text" value={sel.record?.record || ''} placeholder="7W-3L"
                                            onChange={e => onUpdateElement(sel.id, { record: { ...sel.record, record: e.target.value } })}
                                            className={`${input} w-full`} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-600">Games</span>
                                        <input type="text" value={sel.record?.games || ''} placeholder="10"
                                            onChange={e => onUpdateElement(sel.id, { record: { ...sel.record, games: e.target.value } })}
                                            className={`${input} w-full`} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={label}>BG Opacity: {Math.round((sel.bgOpacity ?? 1) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.05} value={sel.bgOpacity ?? 1}
                                    onChange={e => onUpdateElement(sel.id, { bgOpacity: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                        </div>
                    )}

                    {/* Subtitle properties */}
                    {sel.type === 'subtitle' && (
                        <div className="space-y-3">
                            <div>
                                <label className={label}>Text</label>
                                <input type="text" value={sel.text || ''} onChange={e => onUpdateElement(sel.id, { text: e.target.value })}
                                    className={`${input} w-full`} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={label}>Role Colors</label>
                                    <select value={sel.role || 'adc'} onChange={e => onUpdateElement(sel.id, { role: e.target.value })}
                                        className={`${input} w-full capitalize`}>
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Color</label>
                                    <div className="flex gap-1">
                                        <input type="color" value={sel.color || '#9a8a70'}
                                            onChange={e => onUpdateElement(sel.id, { color: e.target.value })}
                                            className="w-8 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                                        <input type="text" value={sel.color || ''}
                                            onChange={e => onUpdateElement(sel.id, { color: e.target.value })}
                                            placeholder="auto"
                                            className={`${input} flex-1`} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={label}>Size: {sel.fontSize ?? 9}px</label>
                                <input type="range" min={6} max={20} value={sel.fontSize ?? 9}
                                    onChange={e => onUpdateElement(sel.id, { fontSize: parseInt(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={!!sel.showBg} onChange={e => onUpdateElement(sel.id, { showBg: e.target.checked })}
                                    className="accent-amber-500" />
                                Show Background
                            </label>
                            <div>
                                <label className={label}>BG Opacity: {Math.round((sel.bgOpacity ?? 1) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.05} value={sel.bgOpacity ?? 1}
                                    onChange={e => onUpdateElement(sel.id, { bgOpacity: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                        </div>
                    )}

                    {/* Footer properties */}
                    {sel.type === 'footer' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={label}>Left Text</label>
                                    <input type="text" value={sel.leftText || ''} onChange={e => onUpdateElement(sel.id, { leftText: e.target.value })}
                                        className={`${input} w-full`} />
                                </div>
                                <div>
                                    <label className={label}>Right Text</label>
                                    <input type="text" value={sel.rightText || ''} onChange={e => onUpdateElement(sel.id, { rightText: e.target.value })}
                                        className={`${input} w-full`} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={label}>Role Colors</label>
                                    <select value={sel.role || 'adc'} onChange={e => onUpdateElement(sel.id, { role: e.target.value })}
                                        className={`${input} w-full capitalize`}>
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Size: {sel.fontSize ?? 9}px</label>
                                    <input type="range" min={6} max={20} value={sel.fontSize ?? 9}
                                        onChange={e => onUpdateElement(sel.id, { fontSize: parseInt(e.target.value) })}
                                        className="w-full accent-amber-500" />
                                </div>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={!!sel.showBg} onChange={e => onUpdateElement(sel.id, { showBg: e.target.checked })}
                                    className="accent-amber-500" />
                                Show Background
                            </label>
                            <div>
                                <label className={label}>BG Opacity: {Math.round((sel.bgOpacity ?? 1) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.05} value={sel.bgOpacity ?? 1}
                                    onChange={e => onUpdateElement(sel.id, { bgOpacity: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500" />
                            </div>
                        </div>
                    )}

                    {/* Position & Size */}
                    {sel.type !== 'effect' && (
                        <div className="mt-3 pt-3 border-t border-gray-800">
                            <label className={label}>Position & Size</label>
                            <div className="grid grid-cols-4 gap-1">
                                <div>
                                    <span className="text-[9px] text-gray-600">X</span>
                                    <input type="number" value={sel.x ?? 0} onChange={e => onUpdateElement(sel.id, { x: parseInt(e.target.value) || 0 })}
                                        className={`${input} w-full`} />
                                </div>
                                <div>
                                    <span className="text-[9px] text-gray-600">Y</span>
                                    <input type="number" value={sel.y ?? 0} onChange={e => onUpdateElement(sel.id, { y: parseInt(e.target.value) || 0 })}
                                        className={`${input} w-full`} />
                                </div>
                                {sel.type !== 'text' && (
                                    <>
                                        <div>
                                            <span className="text-[9px] text-gray-600">W</span>
                                            <input type="number" value={sel.w ?? 100} onChange={e => onUpdateElement(sel.id, { w: parseInt(e.target.value) || 20 })}
                                                className={`${input} w-full`} />
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-gray-600">H</span>
                                            <input type="number" value={sel.h ?? 100} onChange={e => onUpdateElement(sel.id, { h: parseInt(e.target.value) || 20 })}
                                                className={`${input} w-full`} />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* Layer list (drag to reorder) */}
            {elements.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Layers ({elements.length})
                    </h3>
                    <div className="space-y-0.5">
                        {[...elements].sort((a, b) => (b.z ?? 0) - (a.z ?? 0)).map(el => (
                            <div
                                key={el.id}
                                draggable
                                onDragStart={(e) => {
                                    setDragId(el.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                    if (dragOverId !== el.id) setDragOverId(el.id)
                                }}
                                onDragLeave={() => {
                                    if (dragOverId === el.id) setDragOverId(null)
                                }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setDragOverId(null)
                                    if (!dragId || dragId === el.id) return
                                    const sorted = [...elements].sort((a, b) => (b.z ?? 0) - (a.z ?? 0))
                                    const ids = sorted.map(e => e.id)
                                    const fromIdx = ids.indexOf(dragId)
                                    const toIdx = ids.indexOf(el.id)
                                    if (fromIdx < 0 || toIdx < 0) return
                                    ids.splice(fromIdx, 1)
                                    ids.splice(toIdx, 0, dragId)
                                    onReorder(ids)
                                }}
                                onDragEnd={() => {
                                    setDragId(null)
                                    setDragOverId(null)
                                }}
                                onClick={() => onSelect?.(el.id)}
                                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-xs cursor-grab active:cursor-grabbing transition-colors ${
                                    dragOverId === el.id ? 'border-t-2 border-amber-400' : 'border-t-2 border-transparent'
                                } ${
                                    el.id === selectedId
                                        ? 'bg-amber-500/10 text-amber-300'
                                        : dragId === el.id
                                            ? 'opacity-40 text-gray-500'
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                                }`}
                            >
                                <GripVertical size={12} className="text-gray-600 flex-shrink-0" />
                                {el.type === 'image' && el.url ? (
                                    <img src={el.url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                                ) : (
                                    <span className="w-5 h-5 rounded bg-gray-700 flex items-center justify-center text-[8px] uppercase flex-shrink-0">
                                        {el.type[0]}
                                    </span>
                                )}
                                <span className="truncate">{el.name || el.type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
