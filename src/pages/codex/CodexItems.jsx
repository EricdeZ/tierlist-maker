import { useState, useEffect } from 'react'
import { codexService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Plus, Pencil, Trash2, Package, X, Copy } from 'lucide-react'
import CodexImagePicker from '../../components/codex/CodexImagePicker'
import { describeFieldValue } from '../../utils/codexFieldDescriptors'
import useCodexCrud from './shared/useCodexCrud'
import CodexGroupTypesSection from './shared/CodexGroupTypesSection'
import CodexFieldsSection from './shared/CodexFieldsSection'
import CodexTagsSection from './shared/CodexTagsSection'

export default function CodexItems() {
    const [fields, setFields] = useState([])
    const [tags, setTags] = useState([])
    const [items, setItems] = useState([])
    const [groupTypes, setGroupTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

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
            setGroupTypes(data.groupTypes || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const crud = useCodexCrud({
        fieldApi: { create: codexService.createField, update: codexService.updateField, delete: codexService.deleteField },
        tagApi: { create: codexService.createTag, update: codexService.updateTag, delete: codexService.deleteTag },
        groupTypeApi: { create: codexService.createGroupType, update: codexService.updateGroupType, delete: codexService.deleteGroupType },
        fieldUpdateApi: codexService.updateField,
        fetchData,
    })

    useEffect(() => { fetchData() }, [])

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
        crud.setSaving(true)
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
            crud.setSaving(false)
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

            <CodexGroupTypesSection
                groupTypes={groupTypes}
                groupTypeForm={crud.groupTypeForm} setGroupTypeForm={crud.setGroupTypeForm}
                showGroupTypes={crud.showGroupTypes} setShowGroupTypes={crud.setShowGroupTypes}
                startGroupTypeCreate={crud.startGroupTypeCreate} startGroupTypeEdit={crud.startGroupTypeEdit}
                saveGroupType={crud.saveGroupType} deleteGroupType={crud.deleteGroupType}
                updateGtSubField={crud.updateGtSubField} addGtSubField={crud.addGtSubField}
                removeGtSubField={crud.removeGtSubField} moveGtSubField={crud.moveGtSubField}
                saving={crud.saving}
            />

            <CodexFieldsSection
                fields={fields} fieldForm={crud.fieldForm} setFieldForm={crud.setFieldForm}
                groupTypes={groupTypes}
                showFields={crud.showFields} setShowFields={crud.setShowFields}
                startFieldCreate={crud.startFieldCreate} startFieldEdit={crud.startFieldEdit}
                saveField={crud.saveField} deleteField={(f) => crud.deleteField(f, 'item')}
                updateSubField={crud.updateSubField} addSubField={crud.addSubField}
                removeSubField={crud.removeSubField} moveSubField={crud.moveSubField}
                fieldPopup={crud.fieldPopup} setFieldPopup={crud.setFieldPopup}
                saveFieldAsType={crud.saveFieldAsType} linkFieldToType={crud.linkFieldToType}
                saving={crud.saving}
                entityLabel="items"
                iconColor="amber-400"
            />

            <CodexTagsSection
                tags={tags} tagForm={crud.tagForm} setTagForm={crud.setTagForm}
                showTags={crud.showTags} setShowTags={crud.setShowTags}
                startTagCreate={crud.startTagCreate} startTagEdit={crud.startTagEdit}
                saveTag={crud.saveTag} deleteTag={(t) => crud.deleteTag(t, 'items')}
                saving={crud.saving}
                entityLabel="items"
            />

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
                                        <div key={field.id} className={field.field_type === 'group' ? 'sm:col-span-2 lg:col-span-3' : (field.field_type === 'text' && crud.isLongText(itemForm.field_values[field.slug])) ? 'sm:col-span-2 lg:col-span-3' : ''}>
                                            <label className="flex items-center gap-1.5 text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">
                                                {field.icon_url && <img src={field.icon_url} alt="" className="w-3.5 h-3.5 rounded" />}
                                                {field.name}
                                                {field.required && <span className="text-amber-400">*</span>}
                                            </label>
                                            {field.field_type === 'group' && field.options?.sub_fields ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {field.options.sub_fields.map(sf => {
                                                        const sfVal = (itemForm.field_values[field.slug] || {})[sf.key]
                                                        const sfLong = sf.type === 'text' && crud.isLongText(sfVal)
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
                                                                            onChange={e => { crud.trackFocus(`${field.slug}.${sf.key}`, e.target); setGroupSubValue(field.slug, sf.key, e.target.value); crud.autoResize(e.target) }}
                                                                            ref={crud.fieldRef(`${field.slug}.${sf.key}`)}
                                                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[38px]"
                                                                            placeholder={sf.label}
                                                                            rows={1}
                                                                        />
                                                                    ) : (
                                                                        <input
                                                                            type={sf.type === 'number' || sf.type === 'percentage' ? 'number' : 'text'}
                                                                            value={sfVal ?? ''}
                                                                            onChange={e => { if (sf.type === 'text') crud.trackFocus(`${field.slug}.${sf.key}`, e.target); setGroupSubValue(field.slug, sf.key, e.target.value) }}
                                                                            ref={crud.fieldRef(`${field.slug}.${sf.key}`)}
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
                                                    {field.field_type === 'text' && crud.isLongText(itemForm.field_values[field.slug]) ? (
                                                        <textarea
                                                            value={itemForm.field_values[field.slug] ?? ''}
                                                            onChange={e => { crud.trackFocus(field.slug, e.target); setItemFieldValue(field.slug, e.target.value); crud.autoResize(e.target) }}
                                                            ref={crud.fieldRef(field.slug)}
                                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[38px]"
                                                            placeholder={field.description || field.name}
                                                            rows={1}
                                                        />
                                                    ) : (
                                                        <input
                                                            type={field.field_type === 'number' || field.field_type === 'percentage' ? 'number' : 'text'}
                                                            value={itemForm.field_values[field.slug] ?? ''}
                                                            onChange={e => { if (field.field_type === 'text') crud.trackFocus(field.slug, e.target); setItemFieldValue(field.slug, e.target.value) }}
                                                            ref={crud.fieldRef(field.slug)}
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
                            <button onClick={saveItem} disabled={crud.saving || !itemForm.name?.trim()}
                                className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                {crud.saving ? 'Saving...' : (itemForm.id ? 'Update' : 'Create')}
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
