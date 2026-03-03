import { useState, useEffect, useRef, useCallback } from 'react'
import { codexService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Package, Tag, Settings2, X, Copy, GripVertical, Layers, Save, Link2 } from 'lucide-react'
import CodexImagePicker from '../../components/codex/CodexImagePicker'
import { describeFieldValue } from '../../utils/codexFieldDescriptors'

export default function CodexItems() {
    const [fields, setFields] = useState([])
    const [tags, setTags] = useState([])
    const [items, setItems] = useState([])
    const [groupTypes, setGroupTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Section collapse state
    const [showGroupTypes, setShowGroupTypes] = useState(false)
    const [showFields, setShowFields] = useState(false)
    const [showTags, setShowTags] = useState(false)

    // Field form
    const [fieldForm, setFieldForm] = useState(null) // null = hidden, {} = create, {id} = edit
    // Tag form
    const [tagForm, setTagForm] = useState(null)
    // Item form
    const [itemForm, setItemForm] = useState(null)
    // Group type form
    const [groupTypeForm, setGroupTypeForm] = useState(null)
    // Field popup (save-as-type / link-to-type)
    const [fieldPopup, setFieldPopup] = useState(null)

    // Search/filter
    const [search, setSearch] = useState('')
    const [filterTag, setFilterTag] = useState(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await codexService.getAll()
            setFields(data.fields || [])
            setTags(data.tags || [])
            setItems(data.items || [])
            setGroupTypes(data.groupTypes || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    // ── Field CRUD ──

    const startFieldCreate = () => {
        setFieldForm({ slug: '', name: '', icon_url: '', description: '', field_type: 'text', required: false, sort_order: fields.length, sentence_template: '', group_type_id: null })
    }

    const startFieldEdit = (field) => {
        setFieldForm({ ...field })
    }

    const saveField = async () => {
        if (!fieldForm.name?.trim()) return
        setSaving(true)
        try {
            if (fieldForm.id) {
                await codexService.updateField(fieldForm)
            } else {
                await codexService.createField(fieldForm)
            }
            setFieldForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteField = async (field) => {
        if (!confirm(`Delete field "${field.name}"? This will remove the field definition. Existing item values for this field will remain in their data but won't be displayed.`)) return
        try {
            await codexService.deleteField(field.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Tag CRUD ──

    const startTagCreate = () => {
        setTagForm({ name: '', color: '#6366f1' })
    }

    const startTagEdit = (tag) => {
        setTagForm({ ...tag })
    }

    const saveTag = async () => {
        if (!tagForm.name?.trim()) return
        setSaving(true)
        try {
            if (tagForm.id) {
                await codexService.updateTag(tagForm)
            } else {
                await codexService.createTag(tagForm)
            }
            setTagForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteTag = async (tag) => {
        if (!confirm(`Delete tag "${tag.name}"? It will be removed from all items.`)) return
        try {
            await codexService.deleteTag(tag.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Item CRUD ──

    const startItemCreate = () => {
        setItemForm({ name: '', description: '', icon_url: '', field_values: {}, tag_ids: [] })
    }

    const startItemEdit = (item) => {
        setItemForm({ ...item, field_values: { ...(item.field_values || {}) }, tag_ids: [...(item.tag_ids || [])] })
    }

    const setItemField = (key, value) => {
        setItemForm(prev => ({ ...prev, [key]: value }))
    }

    const setItemFieldValue = (slug, value) => {
        setItemForm(prev => ({ ...prev, field_values: { ...prev.field_values, [slug]: value } }))
    }

    const setGroupSubValue = (fieldSlug, subKey, value) => {
        setItemForm(prev => ({
            ...prev,
            field_values: {
                ...prev.field_values,
                [fieldSlug]: { ...(prev.field_values[fieldSlug] || {}), [subKey]: value }
            }
        }))
    }

    // Sub-field builder helpers for group fields
    const updateSubField = (idx, key, value) => {
        setFieldForm(prev => {
            const subFields = [...(prev.options?.sub_fields || [])]
            subFields[idx] = { ...subFields[idx], [key]: value }
            return { ...prev, options: { ...prev.options, sub_fields: subFields } }
        })
    }

    const addSubField = () => {
        setFieldForm(prev => ({
            ...prev,
            options: { ...prev.options, sub_fields: [...(prev.options?.sub_fields || []), { key: '', label: '', type: 'number' }] }
        }))
    }

    const removeSubField = (idx) => {
        setFieldForm(prev => ({
            ...prev,
            options: { ...prev.options, sub_fields: (prev.options?.sub_fields || []).filter((_, i) => i !== idx) }
        }))
    }

    const moveSubField = (fromIdx, toIdx) => {
        setFieldForm(prev => {
            const subs = [...(prev.options?.sub_fields || [])]
            const [moved] = subs.splice(fromIdx, 1)
            subs.splice(toIdx, 0, moved)
            return { ...prev, options: { ...prev.options, sub_fields: subs } }
        })
    }

    // ── Group Type CRUD ──

    const startGroupTypeCreate = () => {
        setGroupTypeForm({ name: '', sub_fields: [{ key: '', label: '', type: 'number' }], sentence_template: '' })
    }

    const startGroupTypeEdit = (gt) => {
        setGroupTypeForm({ ...gt, sub_fields: Array.isArray(gt.sub_fields) ? [...gt.sub_fields] : [] })
    }

    const saveGroupType = async () => {
        if (!groupTypeForm.name?.trim()) return
        setSaving(true)
        try {
            if (groupTypeForm.id) {
                await codexService.updateGroupType(groupTypeForm)
            } else {
                await codexService.createGroupType(groupTypeForm)
            }
            setGroupTypeForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteGroupType = async (gt) => {
        if (!confirm(`Delete group type "${gt.name}"? Fields using it will lose their sub-fields until reassigned.`)) return
        try {
            await codexService.deleteGroupType(gt.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const updateGtSubField = (idx, key, value) => {
        setGroupTypeForm(prev => {
            const subs = [...(prev.sub_fields || [])]
            subs[idx] = { ...subs[idx], [key]: value }
            return { ...prev, sub_fields: subs }
        })
    }

    const addGtSubField = () => {
        setGroupTypeForm(prev => ({ ...prev, sub_fields: [...(prev.sub_fields || []), { key: '', label: '', type: 'number' }] }))
    }

    const removeGtSubField = (idx) => {
        setGroupTypeForm(prev => ({ ...prev, sub_fields: (prev.sub_fields || []).filter((_, i) => i !== idx) }))
    }

    const moveGtSubField = (fromIdx, toIdx) => {
        setGroupTypeForm(prev => {
            const subs = [...(prev.sub_fields || [])]
            const [moved] = subs.splice(fromIdx, 1)
            subs.splice(toIdx, 0, moved)
            return { ...prev, sub_fields: subs }
        })
    }

    // ── Field popup actions (save-as-type / link-to-type) ──

    const saveFieldAsType = async (field) => {
        const name = fieldPopup?.name?.trim()
        if (!name) return
        setSaving(true)
        try {
            const subFields = field.options?.sub_fields || []
            const result = await codexService.createGroupType({ name, sub_fields: subFields, sentence_template: field.sentence_template || null })
            await codexService.updateField({ id: field.id, group_type_id: result.groupType.id })
            setFieldPopup(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const linkFieldToType = async (fieldId) => {
        const typeId = fieldPopup?.typeId
        if (!typeId) return
        setSaving(true)
        try {
            await codexService.updateField({ id: fieldId, group_type_id: typeId })
            setFieldPopup(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const startItemCopy = (item) => {
        setItemForm({
            name: item.name + ' (copy)',
            description: item.description || '',
            icon_url: item.icon_url || '',
            field_values: { ...(item.field_values || {}) },
            tag_ids: [...(item.tag_ids || [])]
        })
    }

    const toggleItemTag = (tagId) => {
        setItemForm(prev => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(tagId)
                ? prev.tag_ids.filter(id => id !== tagId)
                : [...prev.tag_ids, tagId]
        }))
    }

    const saveItem = async () => {
        if (!itemForm.name?.trim()) return
        setSaving(true)
        try {
            if (itemForm.id) {
                await codexService.updateItem(itemForm)
            } else {
                await codexService.createItem(itemForm)
            }
            setItemForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteItem = async (item) => {
        if (!confirm(`Delete item "${item.name}"?`)) return
        try {
            await codexService.deleteItem(item.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const isLongText = (val) => typeof val === 'string' && val.length > 50

    const pendingFocus = useRef(null)

    const trackFocus = (key, el) => {
        if (!el) return
        pendingFocus.current = { key, pos: el.selectionStart ?? el.value?.length ?? 0 }
    }

    const fieldRef = useCallback((key) => (el) => {
        if (!el) return
        if (el.tagName === 'TEXTAREA') {
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
        }
        if (pendingFocus.current?.key === key) {
            const pos = pendingFocus.current.pos
            pendingFocus.current = null
            el.focus()
            el.setSelectionRange(pos, pos)
        }
    }, [])

    const autoResize = (el) => {
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
    }

    // ── Filtering ──

    const filteredItems = items.filter(item => {
        if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
        if (filterTag && !item.tag_ids?.includes(filterTag)) return false
        return true
    })

    const getTagById = (id) => tags.find(t => t.id === id)

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent border-white/20 mx-auto" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <PageTitle title="Codex - Items" noindex />

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 mb-4 text-red-400 text-sm">{error}</div>
            )}

            {/* ═══ Group Types Section ═══ */}
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

            {/* ═══ Fields Section ═══ */}
            <div className="mb-6">
                <button
                    onClick={() => setShowFields(!showFields)}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                >
                    {showFields ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" /> : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />}
                    <Settings2 className="w-4 h-4 text-amber-400" />
                    <span className="font-heading text-sm font-bold text-(--color-text)">Fields</span>
                    <span className="text-xs text-(--color-text-secondary)">({fields.length})</span>
                    <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Define the attributes for items</span>
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
                                        {field.required && <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">required</span>}
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
                            <button onClick={startFieldCreate}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) text-sm transition-colors cursor-pointer">
                                <Plus className="w-3.5 h-3.5" /> Add Field
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Tags Section ═══ */}
            <div className="mb-6">
                <button
                    onClick={() => setShowTags(!showTags)}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                >
                    {showTags ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" /> : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />}
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <span className="font-heading text-sm font-bold text-(--color-text)">Tags</span>
                    <span className="text-xs text-(--color-text-secondary)">({tags.length})</span>
                    <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Categorize items with tags</span>
                </button>

                {showTags && (
                    <div className="mt-2 bg-(--color-secondary) border border-white/10 rounded-xl p-4">
                        {/* Tag chips */}
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {tags.map(tag => (
                                    <div key={tag.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 group">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#6366f1' }} />
                                        <span className="text-sm text-(--color-text)">{tag.name}</span>
                                        <button onClick={() => startTagEdit(tag)} className="p-0.5 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer opacity-0 group-hover:opacity-100" title="Edit">
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => deleteTag(tag)} className="p-0.5 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100" title="Delete">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tag form */}
                        {tagForm ? (
                            <div className="border border-white/10 rounded-lg p-4 bg-black/10">
                                <h4 className="text-sm font-bold text-(--color-text) mb-3">{tagForm.id ? 'Edit Tag' : 'New Tag'}</h4>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                        <input type="text" value={tagForm.name} onChange={e => setTagForm(p => ({ ...p, name: e.target.value }))}
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="Tag name" />
                                    </div>
                                    <div className="w-32">
                                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={tagForm.color || '#6366f1'} onChange={e => setTagForm(p => ({ ...p, color: e.target.value }))}
                                                className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent" />
                                            <input type="text" value={tagForm.color || ''} onChange={e => setTagForm(p => ({ ...p, color: e.target.value }))}
                                                className="flex-1 px-2 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs font-mono focus:outline-none focus:border-(--color-accent)" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                    <button onClick={saveTag} disabled={saving || !tagForm.name?.trim()}
                                        className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                        {saving ? 'Saving...' : (tagForm.id ? 'Update' : 'Create')}
                                    </button>
                                    <button onClick={() => setTagForm(null)}
                                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={startTagCreate}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) text-sm transition-colors cursor-pointer">
                                <Plus className="w-3.5 h-3.5" /> Add Tag
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Items Section ═══ */}
            <div>
                {/* Items header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-(--color-accent)" />
                        <h2 className="font-heading text-2xl font-bold text-(--color-text)">Items</h2>
                        <span className="text-sm text-(--color-text-secondary)">({filteredItems.length}{filteredItems.length !== items.length ? ` / ${items.length}` : ''})</span>
                    </div>
                    <button onClick={startItemCreate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer">
                        <Plus className="w-4 h-4" /> New Item
                    </button>
                </div>

                {/* Search + filter bar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        className="flex-1 px-3 py-2 bg-(--color-secondary) border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)"
                        placeholder="Search items..." />
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {filterTag && (
                                <button onClick={() => setFilterTag(null)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 text-xs text-(--color-text) cursor-pointer">
                                    <X className="w-3 h-3" /> Clear
                                </button>
                            )}
                            {tags.map(tag => (
                                <button key={tag.id} onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${filterTag === tag.id ? 'bg-white/15 text-(--color-text) border border-white/20' : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10 border border-transparent'}`}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#6366f1' }} />
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Item form */}
                {itemForm && (
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-5 mb-4">
                        <h3 className="font-heading text-lg font-bold text-(--color-text) mb-4">
                            {itemForm.id ? 'Edit Item' : 'Create Item'}
                        </h3>

                        {/* Core fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                <input type="text" value={itemForm.name} onChange={e => setItemField('name', e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="Item name" />
                            </div>
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Icon</label>
                                <CodexImagePicker value={itemForm.icon_url || null} onChange={url => setItemField('icon_url', url || '')} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Description</label>
                                <textarea value={itemForm.description || ''} onChange={e => setItemField('description', e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[60px]" placeholder="Item description" rows={2} />
                            </div>
                        </div>

                        {/* Dynamic fields */}
                        {fields.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs text-(--color-text-secondary) uppercase tracking-wider mb-2 font-semibold">Custom Fields</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fields.map(field => (
                                        <div key={field.id} className={field.field_type === 'group' ? 'sm:col-span-2 lg:col-span-3' : (field.field_type === 'text' && isLongText(itemForm.field_values[field.slug])) ? 'sm:col-span-2 lg:col-span-3' : ''}>
                                            <label className="flex items-center gap-1.5 text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">
                                                {field.icon_url && <img src={field.icon_url} alt="" className="w-3.5 h-3.5 rounded" />}
                                                {field.name}
                                                {field.required && <span className="text-amber-400">*</span>}
                                            </label>
                                            {field.field_type === 'group' && field.options?.sub_fields ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {field.options.sub_fields.map(sf => {
                                                        const sfVal = (itemForm.field_values[field.slug] || {})[sf.key]
                                                        const sfLong = sf.type === 'text' && isLongText(sfVal)
                                                        return (
                                                        <div key={sf.key} className={sfLong ? 'w-full' : 'flex-1 min-w-[100px]'}>
                                                            <label className="block text-[10px] text-(--color-text-secondary)/60 mb-0.5">{sf.label}</label>
                                                            {sf.type === 'boolean' ? (
                                                                <label className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-lg cursor-pointer">
                                                                    <input type="checkbox"
                                                                        checked={!!(itemForm.field_values[field.slug] || {})[sf.key]}
                                                                        onChange={e => setGroupSubValue(field.slug, sf.key, e.target.checked)}
                                                                        className="rounded border-white/20 bg-black/20 text-(--color-accent) focus:ring-(--color-accent)" />
                                                                    <span className="text-sm text-(--color-text)">{(itemForm.field_values[field.slug] || {})[sf.key] ? 'Yes' : 'No'}</span>
                                                                </label>
                                                            ) : (
                                                                <div className={sf.type === 'percentage' ? 'relative' : ''}>
                                                                    {sfLong ? (
                                                                        <textarea
                                                                            value={sfVal ?? ''}
                                                                            onChange={e => { trackFocus(`${field.slug}.${sf.key}`, e.target); setGroupSubValue(field.slug, sf.key, e.target.value); autoResize(e.target) }}
                                                                            ref={fieldRef(`${field.slug}.${sf.key}`)}
                                                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[38px]"
                                                                            placeholder={sf.label}
                                                                            rows={1}
                                                                        />
                                                                    ) : (
                                                                        <input
                                                                            type={sf.type === 'number' || sf.type === 'percentage' ? 'number' : 'text'}
                                                                            value={sfVal ?? ''}
                                                                            onChange={e => { if (sf.type === 'text') trackFocus(`${field.slug}.${sf.key}`, e.target); setGroupSubValue(field.slug, sf.key, e.target.value) }}
                                                                            ref={fieldRef(`${field.slug}.${sf.key}`)}
                                                                            className={`w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)${sf.type === 'percentage' ? ' pr-7' : ''}`}
                                                                            placeholder={sf.label}
                                                                        />
                                                                    )}
                                                                    {sf.type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)/40 text-sm">%</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : field.field_type === 'boolean' ? (
                                                <label className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-lg cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={!!itemForm.field_values[field.slug]}
                                                        onChange={e => setItemFieldValue(field.slug, e.target.checked)}
                                                        className="rounded border-white/20 bg-black/20 text-(--color-accent) focus:ring-(--color-accent)" />
                                                    <span className="text-sm text-(--color-text)">{itemForm.field_values[field.slug] ? 'Yes' : 'No'}</span>
                                                </label>
                                            ) : (
                                                <div className={field.field_type === 'percentage' ? 'relative' : ''}>
                                                    {field.field_type === 'text' && isLongText(itemForm.field_values[field.slug]) ? (
                                                        <textarea
                                                            value={itemForm.field_values[field.slug] ?? ''}
                                                            onChange={e => { trackFocus(field.slug, e.target); setItemFieldValue(field.slug, e.target.value); autoResize(e.target) }}
                                                            ref={fieldRef(field.slug)}
                                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[38px]"
                                                            placeholder={field.description || field.name}
                                                            rows={1}
                                                        />
                                                    ) : (
                                                        <input
                                                            type={field.field_type === 'number' || field.field_type === 'percentage' ? 'number' : 'text'}
                                                            value={itemForm.field_values[field.slug] ?? ''}
                                                            onChange={e => { if (field.field_type === 'text') trackFocus(field.slug, e.target); setItemFieldValue(field.slug, e.target.value) }}
                                                            ref={fieldRef(field.slug)}
                                                            className={`w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)${field.field_type === 'percentage' ? ' pr-7' : ''}`}
                                                            placeholder={field.description || field.name}
                                                        />
                                                    )}
                                                    {field.field_type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)/40 text-sm">%</span>}
                                                </div>
                                            )}
                                            {(() => {
                                                const preview = describeFieldValue(field, itemForm.field_values[field.slug])
                                                return preview ? <div className="mt-1 text-xs text-(--color-accent)/60 italic">{preview}</div> : null
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tag assignment */}
                        {tags.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs text-(--color-text-secondary) uppercase tracking-wider mb-2 font-semibold">Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map(tag => {
                                        const selected = itemForm.tag_ids.includes(tag.id)
                                        return (
                                            <button key={tag.id} onClick={() => toggleItemTag(tag.id)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors cursor-pointer border ${selected ? 'bg-white/10 border-white/20 text-(--color-text)' : 'bg-white/[0.02] border-white/5 text-(--color-text-secondary) hover:bg-white/5'}`}>
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || '#6366f1' }} />
                                                {tag.name}
                                                {selected && <span className="text-(--color-accent) text-xs ml-0.5">&#10003;</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Save / Cancel */}
                        <div className="flex items-center gap-3">
                            <button onClick={saveItem} disabled={saving || !itemForm.name?.trim()}
                                className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                {saving ? 'Saving...' : (itemForm.id ? 'Update' : 'Create')}
                            </button>
                            <button onClick={() => setItemForm(null)}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Items list */}
                <div className="space-y-2">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-(--color-secondary) border border-white/10 rounded-xl p-4 hover:border-white/15 transition-colors group">
                            <div className="flex items-start gap-3">
                                {/* Icon */}
                                {item.icon_url ? (
                                    <img src={item.icon_url} alt="" className="w-10 h-10 rounded-lg shrink-0 bg-black/20" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg shrink-0 bg-white/5 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-(--color-text-secondary)/30" />
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-heading text-sm font-bold text-(--color-text)">{item.name}</span>
                                        {/* Tags */}
                                        {item.tag_ids?.map(tagId => {
                                            const tag = getTagById(tagId)
                                            if (!tag) return null
                                            return (
                                                <span key={tagId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-(--color-text-secondary) bg-white/5">
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || '#6366f1' }} />
                                                    {tag.name}
                                                </span>
                                            )
                                        })}
                                    </div>
                                    {item.description && (
                                        <p className="text-xs text-(--color-text-secondary)/60 mb-1 line-clamp-1">{item.description}</p>
                                    )}
                                    {/* Field values preview */}
                                    {fields.length > 0 && Object.keys(item.field_values || {}).length > 0 && (
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                            {fields.filter(f => {
                                                const val = item.field_values[f.slug]
                                                if (f.field_type === 'group') return val && typeof val === 'object' && Object.values(val).some(v => v !== '' && v != null)
                                                if (f.field_type === 'boolean') return val !== undefined
                                                return val !== undefined && val !== ''
                                            }).map(field => (
                                                <span key={field.slug} className="text-xs text-(--color-text-secondary)/50">
                                                    {field.icon_url && <img src={field.icon_url} alt="" className="w-3 h-3 rounded inline mr-0.5 -mt-0.5" />}
                                                    <span className="text-(--color-text-secondary)/40">{field.name}:</span>{' '}
                                                    <span className="text-(--color-text-secondary)">
                                                        {describeFieldValue(field, item.field_values[field.slug])}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startItemCopy(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Duplicate">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => startItemEdit(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Edit">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => deleteItem(item)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {items.length === 0 && !itemForm && (
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-12 text-center">
                        <Package className="w-12 h-12 mx-auto mb-4 text-(--color-text-secondary)/30" />
                        <p className="text-(--color-text-secondary) text-lg font-medium font-heading">No items yet</p>
                        <p className="text-(--color-text-secondary)/50 text-sm mt-1">
                            {fields.length === 0 ? 'Start by defining some fields above, then create your first item' : 'Create your first item to get started'}
                        </p>
                    </div>
                )}

                {filteredItems.length === 0 && items.length > 0 && (
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-8 text-center">
                        <p className="text-(--color-text-secondary) text-sm">No items match your filters</p>
                    </div>
                )}
            </div>
        </div>
    )
}
