import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Settings2, Save, Link2, Copy, GripVertical } from 'lucide-react'
import CodexImagePicker from '../../../components/codex/CodexImagePicker'

export default function CodexFieldsSection({
    fields, fieldForm, setFieldForm,
    groupTypes,
    showFields, setShowFields,
    startFieldCreate, startFieldEdit, saveField, deleteField,
    updateSubField, addSubField, removeSubField, moveSubField,
    fieldPopup, setFieldPopup, saveFieldAsType, linkFieldToType,
    saving,
    entityLabel = 'entities',
    iconColor = 'amber-400',
}) {
    return (
        <div className="mb-6">
            <button
                onClick={() => setShowFields(!showFields)}
                className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
            >
                {showFields ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" /> : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />}
                <Settings2 className={`w-4 h-4 text-${iconColor}`} />
                <span className="font-heading text-sm font-bold text-(--color-text)">Fields</span>
                <span className="text-xs text-(--color-text-secondary)">({fields.length})</span>
                <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Define the attributes for {entityLabel}</span>
            </button>

            {showFields && (
                <div className="mt-2 bg-(--color-secondary) border border-white/10 rounded-xl p-4">
                    {/* Field list */}
                    {fields.length > 0 && (
                        <div className="space-y-1 mb-4">
                            {fields.map(field => (
                                <div key={field.id} className="relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] group">
                                    {field.icon_url && <img src={field.icon_url} alt="" className="w-4 h-4 rounded" />}
                                    <span className="text-sm font-medium text-(--color-text)">{field.name}</span>
                                    <code className="text-xs text-(--color-text-secondary)/50 bg-white/5 px-1.5 py-0.5 rounded">{field.slug}</code>
                                    <span className="text-xs text-(--color-text-secondary) bg-white/5 px-1.5 py-0.5 rounded">
                                        {field.field_type}
                                        {field.field_type === 'group' && field.options?.sub_fields && (
                                            <span className="text-(--color-text-secondary)/40 ml-1">({field.options.sub_fields.length})</span>
                                        )}
                                    </span>
                                    {field.field_type === 'group' && field._group_type_name && (
                                        <span className="text-xs text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">{field._group_type_name}</span>
                                    )}
                                    {field.field_type === 'group' && field.options?.sub_fields && (
                                        <span className="text-xs text-(--color-text-secondary)/30">[{field.options.sub_fields.map(sf => sf.label).join(', ')}]</span>
                                    )}
                                    {field.required && <span className={`text-xs text-${iconColor} bg-${iconColor}/10 px-1.5 py-0.5 rounded`}>required</span>}
                                    {field.description && <span className="text-xs text-(--color-text-secondary)/40 truncate flex-1">{field.description}</span>}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
                                        {field.field_type === 'group' && !field._group_type_name && field.options?.sub_fields?.length > 0 && (
                                            <button onClick={() => setFieldPopup({ fieldId: field.id, type: 'save', name: field.name })}
                                                className="p-1 rounded hover:bg-violet-500/10 text-(--color-text-secondary) hover:text-violet-400 transition-colors cursor-pointer" title="Save as Group Type">
                                                <Save className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {field.field_type === 'group' && groupTypes.length > 0 && (
                                            <button onClick={() => setFieldPopup({ fieldId: field.id, type: 'link', typeId: field.group_type_id || groupTypes[0]?.id })}
                                                className="p-1 rounded hover:bg-violet-500/10 text-(--color-text-secondary) hover:text-violet-400 transition-colors cursor-pointer" title="Link to Group Type">
                                                <Link2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => startFieldEdit(field)} className="p-1 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Edit">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => deleteField(field)} className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Save as Group Type popup */}
                                    {fieldPopup?.fieldId === field.id && fieldPopup.type === 'save' && (
                                        <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-(--color-secondary) border border-white/10 rounded-lg p-3 shadow-xl">
                                            <h5 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-1">Save as Group Type</h5>
                                            <p className="text-[11px] text-(--color-text-secondary)/60 mb-2">
                                                Creates a reusable Group Type from this field's sub-fields and links this field to it. Other fields can then use the same type.
                                            </p>
                                            <input type="text" value={fieldPopup.name || ''} onChange={e => setFieldPopup(p => ({ ...p, name: e.target.value }))}
                                                className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-violet-400 mb-2" placeholder="Type name" autoFocus />
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => saveFieldAsType(field)} disabled={saving || !fieldPopup.name?.trim()}
                                                    className="px-3 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                                    {saving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button onClick={() => setFieldPopup(null)}
                                                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-xs transition-colors cursor-pointer">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Link to Group Type popup */}
                                    {fieldPopup?.fieldId === field.id && fieldPopup.type === 'link' && (
                                        <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-(--color-secondary) border border-white/10 rounded-lg p-3 shadow-xl">
                                            <h5 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-1">Link to Group Type</h5>
                                            <p className="text-[11px] text-(--color-text-secondary)/60 mb-2">
                                                This field will use the selected type's sub-fields. Updating the type will automatically update this field too.
                                            </p>
                                            <select value={fieldPopup.typeId || ''} onChange={e => setFieldPopup(p => ({ ...p, typeId: parseInt(e.target.value) }))}
                                                className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-violet-400 mb-2 cursor-pointer">
                                                {groupTypes.map(gt => (
                                                    <option key={gt.id} value={gt.id}>{gt.name} — [{(Array.isArray(gt.sub_fields) ? gt.sub_fields : []).map(sf => sf.label).join(', ')}]</option>
                                                ))}
                                            </select>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => linkFieldToType(field.id)} disabled={saving || !fieldPopup.typeId}
                                                    className="px-3 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                                    {saving ? 'Linking...' : 'Link'}
                                                </button>
                                                <button onClick={() => setFieldPopup(null)}
                                                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-xs transition-colors cursor-pointer">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Field form */}
                    {fieldForm ? (
                        <div className="border border-white/10 rounded-lg p-4 bg-black/10">
                            <h4 className="text-sm font-bold text-(--color-text) mb-3">{fieldForm.id ? 'Edit Field' : 'New Field'}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                    <input type="text" value={fieldForm.name} onChange={e => setFieldForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="e.g. Physical Power" />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Slug</label>
                                    <input type="text" value={fieldForm.slug} onChange={e => setFieldForm(p => ({ ...p, slug: e.target.value }))}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="auto-generated from name" />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Icon</label>
                                    <CodexImagePicker value={fieldForm.icon_url || null} onChange={url => setFieldForm(p => ({ ...p, icon_url: url || '' }))} />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Description</label>
                                    <input type="text" value={fieldForm.description} onChange={e => setFieldForm(p => ({ ...p, description: e.target.value }))}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="Help text for editors" />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Type</label>
                                    <select value={fieldForm.field_type} onChange={e => {
                                        const newType = e.target.value
                                        setFieldForm(p => ({
                                            ...p, field_type: newType,
                                            options: newType === 'group' ? (p.options || { sub_fields: [{ key: '', label: '', type: 'number' }] }) : null
                                        }))
                                    }}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) cursor-pointer">
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Boolean</option>
                                        <option value="percentage">Percentage</option>
                                        <option value="group">Group</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Sort Order</label>
                                    <input type="number" value={fieldForm.sort_order} onChange={e => setFieldForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" />
                                </div>
                                {fieldForm.field_type === 'group' && (
                                    <div className="sm:col-span-2">
                                        <div className="flex items-center gap-3 mb-2">
                                            <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider">Sub-fields</label>
                                            {groupTypes.length > 0 && (
                                                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                                                    <button type="button" onClick={() => setFieldForm(p => ({ ...p, group_type_id: null }))}
                                                        className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${!fieldForm.group_type_id ? 'bg-(--color-accent) text-white' : 'text-(--color-text-secondary) hover:text-(--color-text)'}`}>
                                                        Inline
                                                    </button>
                                                    <button type="button" onClick={() => setFieldForm(p => ({ ...p, group_type_id: groupTypes[0]?.id || null, options: null }))}
                                                        className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${fieldForm.group_type_id ? 'bg-violet-500 text-white' : 'text-(--color-text-secondary) hover:text-(--color-text)'}`}>
                                                        Saved Type
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {fieldForm.group_type_id ? (
                                            <select value={fieldForm.group_type_id || ''} onChange={e => setFieldForm(p => ({ ...p, group_type_id: parseInt(e.target.value) || null }))}
                                                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) cursor-pointer">
                                                {groupTypes.map(gt => (
                                                    <option key={gt.id} value={gt.id}>{gt.name} — [{(Array.isArray(gt.sub_fields) ? gt.sub_fields : []).map(sf => sf.label).join(', ')}]</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="space-y-2">
                                                {(fieldForm.options?.sub_fields || []).map((sf, idx) => (
                                                    <div key={idx} className="flex items-center gap-2"
                                                        draggable onDragStart={e => e.dataTransfer.setData('text/plain', idx)}
                                                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                                                        onDrop={e => { e.preventDefault(); moveSubField(parseInt(e.dataTransfer.getData('text/plain')), idx) }}>
                                                        <div className="cursor-grab active:cursor-grabbing text-(--color-text-secondary)/40 hover:text-(--color-text-secondary)">
                                                            <GripVertical className="w-3.5 h-3.5" />
                                                        </div>
                                                        <input type="text" placeholder="Label" value={sf.label}
                                                            onChange={e => {
                                                                const label = e.target.value
                                                                const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
                                                                updateSubField(idx, 'label', label)
                                                                updateSubField(idx, 'key', key)
                                                            }}
                                                            className="flex-1 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)" />
                                                        <select value={sf.type}
                                                            onChange={e => updateSubField(idx, 'type', e.target.value)}
                                                            className="w-24 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent) cursor-pointer">
                                                            <option value="text">Text</option>
                                                            <option value="number">Number</option>
                                                            <option value="boolean">Boolean</option>
                                                            <option value="percentage">Percentage</option>
                                                        </select>
                                                        <button type="button" onClick={() => {
                                                                if (sf.key) setFieldForm(p => ({ ...p, sentence_template: (p.sentence_template || '') + `{${sf.key}}` }))
                                                            }}
                                                            className="p-1 rounded hover:bg-(--color-accent)/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title={sf.key ? `Insert {${sf.key}}` : 'Set a label first'}>
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button type="button" onClick={() => removeSubField(idx)}
                                                            className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={addSubField}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-(--color-accent) hover:bg-(--color-accent)/10 transition-colors cursor-pointer">
                                                    <Plus className="w-3 h-3" /> Add Sub-field
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-3">
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Sentence Template</label>
                                <textarea value={fieldForm.sentence_template || ''} onChange={e => setFieldForm(p => ({ ...p, sentence_template: e.target.value }))}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[40px] font-mono"
                                    placeholder={fieldForm.field_type === 'group' ? 'e.g. Grants a shield of [{flat_shield}][ + {percentage_max_health_shield}% of max health]' : 'e.g. {value} meters'}
                                    rows={2} />
                                <p className="text-[10px] text-(--color-text-secondary)/40 mt-0.5">
                                    Use <code className="bg-white/5 px-1 rounded">{'{key}'}</code> for values.
                                    Wrap in <code className="bg-white/5 px-1 rounded">[...]</code> for conditional sections (hidden if value is empty).
                                    For booleans: <code className="bg-white/5 px-1 rounded">{'{key:text if true}'}</code>
                                </p>
                            </div>
                            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                <input type="checkbox" checked={fieldForm.required} onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                                    className="rounded border-white/20 bg-black/20 text-(--color-accent) focus:ring-(--color-accent)" />
                                <span className="text-sm text-(--color-text)">Required field</span>
                            </label>
                            <div className="flex items-center gap-3 mt-4">
                                <button onClick={saveField} disabled={saving || !fieldForm.name?.trim()}
                                    className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                    {saving ? 'Saving...' : (fieldForm.id ? 'Update' : 'Create')}
                                </button>
                                <button onClick={() => setFieldForm(null)}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => startFieldCreate(fields.length)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) text-sm transition-colors cursor-pointer">
                            <Plus className="w-3.5 h-3.5" /> Add Field
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
