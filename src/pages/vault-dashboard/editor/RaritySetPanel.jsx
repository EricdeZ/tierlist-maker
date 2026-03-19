import { Trash2, ChevronUp, ChevronDown, BarChart3, FileText, Zap } from 'lucide-react'

const CLASSES = ['Guardian', 'Warrior', 'Assassin', 'Mage', 'Hunter']
const ROLES = ['adc', 'solo', 'jungle', 'mid', 'support']
const ABILITY_TYPES = ['damage', 'aoe_damage', 'heal', 'buff', 'debuff', 'cc', 'execute', 'shield', 'summon', 'global', 'stealth', 'mobility']

const input = 'px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500'
const label = 'block text-[10px] text-gray-500 mb-1 uppercase tracking-wider'
const btn = 'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors'

export default function RaritySetPanel({ cardData, onCardDataChange, cardType }) {
    const d = cardData

    const update = (updates) => onCardDataChange({ ...d, ...updates })

    const blocks = d.blocks || []
    const updateBlock = (idx, updates) => {
        const newBlocks = blocks.map((b, i) => i === idx ? { ...b, ...updates } : b)
        update({ blocks: newBlocks })
    }
    const removeBlock = (idx) => update({ blocks: blocks.filter((_, i) => i !== idx) })
    const moveBlock = (idx, dir) => {
        const newBlocks = [...blocks]
        const target = idx + dir
        if (target < 0 || target >= newBlocks.length) return
        ;[newBlocks[idx], newBlocks[target]] = [newBlocks[target], newBlocks[idx]]
        update({ blocks: newBlocks })
    }
    const addBlock = (type) => {
        const newBlock = type === 'ability'
            ? { type: 'ability', name: 'Ability', description: '', abilityType: 'damage', manaCost: 50, cooldown: 12 }
            : type === 'stats'
            ? { type: 'stats', rows: [{ label: 'Stat', value: '0', sub: '' }] }
            : { type: 'text', title: '', content: 'Description text' }
        update({ blocks: [...blocks, newBlock] })
    }

    return (
        <div className="space-y-4 text-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Card Data</h3>

            {/* Header fields */}
            <div className="space-y-2">
                <div>
                    <label className={label}>Name</label>
                    <input type="text" value={d.name || ''} onChange={e => update({ name: e.target.value })}
                        className={`${input} w-full`} />
                </div>
                <div>
                    <label className={label}>Image URL</label>
                    <input type="text" value={d.imageUrl || ''} onChange={e => update({ imageUrl: e.target.value })}
                        placeholder="Auto from canvas image" className={`${input} w-full`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={label}>Role</label>
                        <select value={d.role || 'mid'} onChange={e => update({ role: e.target.value })}
                            className={`${input} w-full capitalize`}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={label}>Class</label>
                        <select value={d.class || 'Mage'} onChange={e => update({ class: e.target.value })}
                            className={`${input} w-full`}>
                            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className={label}>Subtitle</label>
                    <input type="text" value={d.subtitle || ''} onChange={e => update({ subtitle: e.target.value })}
                        placeholder="e.g. Mage · Magical" className={`${input} w-full`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={label}>Serial #</label>
                        <input type="text" value={d.serialNumber || ''} onChange={e => update({ serialNumber: e.target.value })}
                            placeholder="001" className={`${input} w-full`} />
                    </div>
                    <div>
                        <label className={label}>Top Stat</label>
                        <div className="flex gap-1">
                            <input type="text" value={d.topStatLabel || ''} onChange={e => update({ topStatLabel: e.target.value })}
                                placeholder="HP" className={`${input} w-12`} />
                            <input type="text" value={d.topStatValue || ''} onChange={e => update({ topStatValue: e.target.value })}
                                placeholder="100" className={`${input} flex-1`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Blocks */}
            <div className="border-t border-gray-800 pt-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Content Blocks</h3>

                {blocks.length === 0 && (
                    <p className="text-[10px] text-gray-600 mb-2">No blocks yet. Add one below.</p>
                )}

                <div className="space-y-2">
                    {blocks.map((block, i) => (
                        <div key={i} className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
                            {/* Block header */}
                            <div className="flex items-center gap-1 mb-1.5">
                                <span className="text-[10px] font-medium text-gray-300 flex-1 capitalize">{block.type}</span>
                                <button onClick={() => moveBlock(i, -1)} disabled={i === 0}
                                    className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"><ChevronUp size={12} /></button>
                                <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}
                                    className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"><ChevronDown size={12} /></button>
                                <button onClick={() => removeBlock(i)}
                                    className="p-0.5 text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                            </div>

                            {/* Ability block */}
                            {block.type === 'ability' && (
                                <div className="space-y-1">
                                    <input type="text" value={block.name || ''} placeholder="Ability name"
                                        onChange={e => updateBlock(i, { name: e.target.value })}
                                        className={`${input} w-full`} />
                                    <textarea value={block.description || ''} placeholder="Description"
                                        onChange={e => updateBlock(i, { description: e.target.value })}
                                        rows={2} className={`${input} w-full resize-none`} />
                                    <div className="grid grid-cols-3 gap-1">
                                        <div>
                                            <span className="text-[9px] text-gray-600">Type</span>
                                            <select value={block.abilityType || 'damage'}
                                                onChange={e => updateBlock(i, { abilityType: e.target.value })}
                                                className={`${input} w-full`}>
                                                {ABILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-gray-600">Mana</span>
                                            <input type="number" value={block.manaCost ?? ''}
                                                onChange={e => updateBlock(i, { manaCost: parseInt(e.target.value) || 0 })}
                                                className={`${input} w-full`} />
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-gray-600">CD</span>
                                            <input type="number" value={block.cooldown ?? ''}
                                                onChange={e => updateBlock(i, { cooldown: parseInt(e.target.value) || 0 })}
                                                className={`${input} w-full`} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stats block */}
                            {block.type === 'stats' && (
                                <div className="space-y-1">
                                    {(block.rows || []).map((row, j) => (
                                        <div key={j} className="flex items-center gap-1">
                                            <input type="text" value={row.label} placeholder="Label"
                                                onChange={e => {
                                                    const rows = [...(block.rows || [])]
                                                    rows[j] = { ...rows[j], label: e.target.value }
                                                    updateBlock(i, { rows })
                                                }}
                                                className={`${input} w-14`} />
                                            <input type="text" value={row.value} placeholder="Value"
                                                onChange={e => {
                                                    const rows = [...(block.rows || [])]
                                                    rows[j] = { ...rows[j], value: e.target.value }
                                                    updateBlock(i, { rows })
                                                }}
                                                className={`${input} w-12`} />
                                            <input type="text" value={row.sub || ''} placeholder="Sub"
                                                onChange={e => {
                                                    const rows = [...(block.rows || [])]
                                                    rows[j] = { ...rows[j], sub: e.target.value }
                                                    updateBlock(i, { rows })
                                                }}
                                                className={`${input} flex-1`} />
                                            <button onClick={() => {
                                                const rows = (block.rows || []).filter((_, k) => k !== j)
                                                updateBlock(i, { rows })
                                            }} className="text-gray-500 hover:text-red-400 p-0.5">
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => updateBlock(i, { rows: [...(block.rows || []), { label: 'Stat', value: '0', sub: '' }] })}
                                        className="text-[10px] text-amber-400 hover:text-amber-300">+ Add Row</button>
                                </div>
                            )}

                            {/* Text block */}
                            {block.type === 'text' && (
                                <div className="space-y-1">
                                    <input type="text" value={block.title || ''} placeholder="Title (optional)"
                                        onChange={e => updateBlock(i, { title: e.target.value })}
                                        className={`${input} w-full`} />
                                    <textarea value={block.content || ''} placeholder="Content"
                                        onChange={e => updateBlock(i, { content: e.target.value })}
                                        rows={2} className={`${input} w-full resize-none`} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add block buttons */}
                <div className="flex gap-1.5 mt-2">
                    <button onClick={() => addBlock('ability')} className={`${btn} bg-amber-600/20 text-amber-400 hover:bg-amber-600/30`}>
                        <Zap size={12} /> Ability
                    </button>
                    <button onClick={() => addBlock('stats')} className={`${btn} bg-purple-600/20 text-purple-400 hover:bg-purple-600/30`}>
                        <BarChart3 size={12} /> Stats
                    </button>
                    <button onClick={() => addBlock('text')} className={`${btn} bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30`}>
                        <FileText size={12} /> Text
                    </button>
                </div>
            </div>

        </div>
    )
}
