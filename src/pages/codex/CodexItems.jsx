import { useState, useEffect } from 'react'
import { codexService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Package, Tag, Settings2, X } from 'lucide-react'
import CodexImagePicker from '../../components/codex/CodexImagePicker'

export default function CodexItems() {
    const [fields, setFields] = useState([])
    const [tags, setTags] = useState([])
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Section collapse state
    const [showFields, setShowFields] = useState(false)
    const [showTags, setShowTags] = useState(false)

    // Field form
    const [fieldForm, setFieldForm] = useState(null) // null = hidden, {} = create, {id} = edit
    // Tag form
    const [tagForm, setTagForm] = useState(null)
    // Item form
    const [itemForm, setItemForm] = useState(null)

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
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    // ── Field CRUD ──

    const startFieldCreate = () => {
        setFieldForm({ slug: '', name: '', icon_url: '', description: '', field_type: 'text', required: false, sort_order: fields.length })
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
                                    <div key={field.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] group">
                                        {field.icon_url && <img src={field.icon_url} alt="" className="w-4 h-4 rounded" />}
                                        <span className="text-sm font-medium text-(--color-text)">{field.name}</span>
                                        <code className="text-xs text-(--color-text-secondary)/50 bg-white/5 px-1.5 py-0.5 rounded">{field.slug}</code>
                                        <span className="text-xs text-(--color-text-secondary) bg-white/5 px-1.5 py-0.5 rounded">{field.field_type}</span>
                                        {field.required && <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">required</span>}
                                        {field.description && <span className="text-xs text-(--color-text-secondary)/40 truncate flex-1">{field.description}</span>}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
                                            <button onClick={() => startFieldEdit(field)} className="p-1 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Edit">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => deleteField(field)} className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
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
                                        <select value={fieldForm.field_type} onChange={e => setFieldForm(p => ({ ...p, field_type: e.target.value }))}
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) cursor-pointer">
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Sort Order</label>
                                        <input type="number" value={fieldForm.sort_order} onChange={e => setFieldForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" />
                                    </div>
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
                                        <div key={field.id}>
                                            <label className="flex items-center gap-1.5 text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">
                                                {field.icon_url && <img src={field.icon_url} alt="" className="w-3.5 h-3.5 rounded" />}
                                                {field.name}
                                                {field.required && <span className="text-amber-400">*</span>}
                                            </label>
                                            <input
                                                type={field.field_type === 'number' ? 'number' : 'text'}
                                                value={itemForm.field_values[field.slug] ?? ''}
                                                onChange={e => setItemFieldValue(field.slug, e.target.value)}
                                                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)"
                                                placeholder={field.description || field.name}
                                            />
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
                                            {fields.filter(f => item.field_values[f.slug] !== undefined && item.field_values[f.slug] !== '').map(field => (
                                                <span key={field.slug} className="text-xs text-(--color-text-secondary)/50">
                                                    {field.icon_url && <img src={field.icon_url} alt="" className="w-3 h-3 rounded inline mr-0.5 -mt-0.5" />}
                                                    <span className="text-(--color-text-secondary)/40">{field.name}:</span>{' '}
                                                    <span className="text-(--color-text-secondary)">{item.field_values[field.slug]}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
