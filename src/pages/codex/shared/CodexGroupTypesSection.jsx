import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Copy, GripVertical, Layers } from 'lucide-react'

export default function CodexGroupTypesSection({
    groupTypes, groupTypeForm, setGroupTypeForm,
    showGroupTypes, setShowGroupTypes,
    startGroupTypeCreate, startGroupTypeEdit, saveGroupType, deleteGroupType,
    updateGtSubField, addGtSubField, removeGtSubField, moveGtSubField,
    saving,
}) {
    return (
        <div className="mb-6">
            <button
                onClick={() => setShowGroupTypes(!showGroupTypes)}
                className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
            >
                {showGroupTypes ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" /> : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />}
                <Layers className="w-4 h-4 text-violet-400" />
                <span className="font-heading text-sm font-bold text-(--color-text)">Group Types</span>
                <span className="text-xs text-(--color-text-secondary)">({groupTypes.length})</span>
                <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Reusable sub-field templates for group fields</span>
            </button>

            {showGroupTypes && (
                <div className="mt-2 bg-(--color-secondary) border border-white/10 rounded-xl p-4">
                    {groupTypes.length > 0 && (
                        <div className="space-y-1 mb-4">
                            {groupTypes.map(gt => (
                                <div key={gt.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] group">
                                    <span className="text-sm font-medium text-(--color-text)">{gt.name}</span>
                                    <span className="text-xs text-(--color-text-secondary)/30">
                                        [{(Array.isArray(gt.sub_fields) ? gt.sub_fields : []).map(sf => sf.label).join(', ')}]
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
                                        <button onClick={() => startGroupTypeEdit(gt)} className="p-1 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Edit">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => deleteGroupType(gt)} className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {groupTypeForm ? (
                        <div className="border border-white/10 rounded-lg p-4 bg-black/10">
                            <h4 className="text-sm font-bold text-(--color-text) mb-3">{groupTypeForm.id ? 'Edit Group Type' : 'New Group Type'}</h4>
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                <input type="text" value={groupTypeForm.name} onChange={e => setGroupTypeForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="e.g. Scaling Stats" />
                            </div>
                            <div className="mt-3">
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Sub-fields</label>
                                <div className="space-y-2">
                                    {(groupTypeForm.sub_fields || []).map((sf, idx) => (
                                        <div key={idx} className="flex items-center gap-2"
                                            draggable onDragStart={e => e.dataTransfer.setData('text/plain', idx)}
                                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                                            onDrop={e => { e.preventDefault(); moveGtSubField(parseInt(e.dataTransfer.getData('text/plain')), idx) }}>
                                            <div className="cursor-grab active:cursor-grabbing text-(--color-text-secondary)/40 hover:text-(--color-text-secondary)">
                                                <GripVertical className="w-3.5 h-3.5" />
                                            </div>
                                            <input type="text" placeholder="Label" value={sf.label}
                                                onChange={e => {
                                                    const label = e.target.value
                                                    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
                                                    updateGtSubField(idx, 'label', label)
                                                    updateGtSubField(idx, 'key', key)
                                                }}
                                                className="flex-1 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)" />
                                            <select value={sf.type}
                                                onChange={e => updateGtSubField(idx, 'type', e.target.value)}
                                                className="w-24 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent) cursor-pointer">
                                                <option value="text">Text</option>
                                                <option value="number">Number</option>
                                                <option value="boolean">Boolean</option>
                                                <option value="percentage">Percentage</option>
                                            </select>
                                            <button type="button" onClick={() => {
                                                    if (sf.key) setGroupTypeForm(p => ({ ...p, sentence_template: (p.sentence_template || '') + `{${sf.key}}` }))
                                                }}
                                                className="p-1 rounded hover:bg-(--color-accent)/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title={sf.key ? `Insert {${sf.key}}` : 'Set a label first'}>
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" onClick={() => removeGtSubField(idx)}
                                                className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addGtSubField}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-(--color-accent) hover:bg-(--color-accent)/10 transition-colors cursor-pointer">
                                        <Plus className="w-3 h-3" /> Add Sub-field
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3">
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Sentence Template</label>
                                <textarea value={groupTypeForm.sentence_template || ''} onChange={e => setGroupTypeForm(p => ({ ...p, sentence_template: e.target.value }))}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[40px] font-mono"
                                    placeholder="e.g. Grants [{flat}][ + {scaling}% scaling]"
                                    rows={2} />
                            </div>
                            <div className="flex items-center gap-3 mt-4">
                                <button onClick={saveGroupType} disabled={saving || !groupTypeForm.name?.trim()}
                                    className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                    {saving ? 'Saving...' : (groupTypeForm.id ? 'Update' : 'Create')}
                                </button>
                                <button onClick={() => setGroupTypeForm(null)}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={startGroupTypeCreate}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) text-sm transition-colors cursor-pointer">
                            <Plus className="w-3.5 h-3.5" /> Add Group Type
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
