import { useState, useEffect } from 'react'
import { codexService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Swords, Tag, Settings2, X, Link2, FolderTree, ImagePlus } from 'lucide-react'
import CodexImagePicker from '../../components/codex/CodexImagePicker'

function buildCategoryTree(categories, parentId = null) {
    return categories
        .filter(c => c.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(c => ({ ...c, children: buildCategoryTree(categories, c.id) }))
}

function flattenTree(tree, depth = 0) {
    const result = []
    for (const node of tree) {
        result.push({ ...node, depth })
        result.push(...flattenTree(node.children, depth + 1))
    }
    return result
}

export default function CodexGods() {
    const [fields, setFields] = useState([])
    const [tags, setTags] = useState([])
    const [gods, setGods] = useState([])
    const [linkedGods, setLinkedGods] = useState([])
    const [categories, setCategories] = useState([])
    const [godImages, setGodImages] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Section collapse state
    const [showFields, setShowFields] = useState(false)
    const [showTags, setShowTags] = useState(false)
    const [showCategories, setShowCategories] = useState(false)

    // Field form
    const [fieldForm, setFieldForm] = useState(null)
    // Tag form
    const [tagForm, setTagForm] = useState(null)
    // Category form
    const [categoryForm, setCategoryForm] = useState(null)
    // God form
    const [godForm, setGodForm] = useState(null)

    // Gallery: which category is in "add image" mode
    const [galleryAddCat, setGalleryAddCat] = useState(null)

    // Search/filter
    const [search, setSearch] = useState('')
    const [filterTag, setFilterTag] = useState(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await codexService.getAllGods()
            setFields(data.fields || [])
            setTags(data.tags || [])
            setGods(data.gods || [])
            setLinkedGods(data.linkedGods || [])
            setCategories(data.categories || [])
            setGodImages(data.godImages || [])
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
                await codexService.updateGodField(fieldForm)
            } else {
                await codexService.createGodField(fieldForm)
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
        if (!confirm(`Delete field "${field.name}"? This will remove the field definition. Existing god values for this field will remain in their data but won't be displayed.`)) return
        try {
            await codexService.deleteGodField(field.id)
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
                await codexService.updateGodTag(tagForm)
            } else {
                await codexService.createGodTag(tagForm)
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
        if (!confirm(`Delete tag "${tag.name}"? It will be removed from all gods.`)) return
        try {
            await codexService.deleteGodTag(tag.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Category CRUD ──

    const startCategoryCreate = (parentId = null) => {
        setCategoryForm({ name: '', slug: '', parent_id: parentId, sort_order: categories.length })
    }

    const startCategoryEdit = (cat) => {
        setCategoryForm({ ...cat })
    }

    const saveCategory = async () => {
        if (!categoryForm.name?.trim()) return
        setSaving(true)
        try {
            if (categoryForm.id) {
                await codexService.updateGodCategory(categoryForm)
            } else {
                await codexService.createGodCategory(categoryForm)
            }
            setCategoryForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteCategory = async (cat) => {
        if (!confirm(`Delete category "${cat.name}"? All sub-categories and image associations in this category will be removed.`)) return
        try {
            await codexService.deleteGodCategory(cat.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── God CRUD ──

    const startGodCreate = () => {
        setGodForm({ name: '', description: '', icon_url: '', god_id: null, field_values: {}, tag_ids: [] })
    }

    const startGodEdit = (god) => {
        setGodForm({ ...god, field_values: { ...(god.field_values || {}) }, tag_ids: [...(god.tag_ids || [])] })
        setGalleryAddCat(null)
    }

    const setGodField = (key, value) => {
        setGodForm(prev => ({ ...prev, [key]: value }))
    }

    const setGodFieldValue = (slug, value) => {
        setGodForm(prev => ({ ...prev, field_values: { ...prev.field_values, [slug]: value } }))
    }

    const setGroupSubValue = (fieldSlug, subKey, value) => {
        setGodForm(prev => ({
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

    const toggleGodTag = (tagId) => {
        setGodForm(prev => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(tagId)
                ? prev.tag_ids.filter(id => id !== tagId)
                : [...prev.tag_ids, tagId]
        }))
    }

    const linkGodDatabase = (godId) => {
        const linked = linkedGods.find(g => g.id === godId)
        if (linked) {
            setGodForm(prev => ({
                ...prev,
                god_id: godId,
                name: prev.name || linked.name,
                icon_url: prev.icon_url || linked.image_url || '',
            }))
        } else {
            setGodForm(prev => ({ ...prev, god_id: null }))
        }
    }

    const saveGod = async () => {
        if (!godForm.name?.trim()) return
        setSaving(true)
        try {
            if (godForm.id) {
                await codexService.updateGod(godForm)
            } else {
                await codexService.createGod(godForm)
            }
            setGodForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteGod = async (god) => {
        if (!confirm(`Delete god "${god.name}"?`)) return
        try {
            await codexService.deleteGod(god.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Gallery ──

    const getGodImageCount = (godId) => godImages.filter(gi => gi.codex_god_id === godId).length
    const getGodImagesForCategory = (godId, catId) => godImages.filter(gi => gi.codex_god_id === godId && gi.category_id === catId)

    const addImageToGod = async (imageObj, categoryId) => {
        if (!godForm?.id) return
        try {
            await codexService.addGodImage({ codex_god_id: godForm.id, codex_image_id: imageObj.id, category_id: categoryId })
            setGalleryAddCat(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const removeImageFromGod = async (godImageId) => {
        try {
            await codexService.removeGodImage(godImageId)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Filtering ──

    const filteredGods = gods.filter(god => {
        if (search && !god.name.toLowerCase().includes(search.toLowerCase())) return false
        if (filterTag && !god.tag_ids?.includes(filterTag)) return false
        return true
    })

    const getTagById = (id) => tags.find(t => t.id === id)
    const getLinkedGod = (godId) => linkedGods.find(g => g.id === godId)

    const categoryTree = buildCategoryTree(categories)
    const flatCategories = flattenTree(categoryTree)

    // ── Render helpers ──

    const renderCategoryNode = (cat, depth = 0) => (
        <div key={cat.id}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.02] group" style={{ paddingLeft: `${12 + depth * 20}px` }}>
                {cat.children?.length > 0 && <FolderTree className="w-3 h-3 text-violet-400/50" />}
                <span className="text-sm font-medium text-(--color-text)">{cat.name}</span>
                <code className="text-xs text-(--color-text-secondary)/50 bg-white/5 px-1.5 py-0.5 rounded">{cat.slug}</code>
                {cat.parent_id && <span className="text-xs text-(--color-text-secondary)/30">sub</span>}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
                    <button onClick={() => startCategoryCreate(cat.id)} className="p-1 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-violet-400 transition-colors cursor-pointer" title="Add sub-category">
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startCategoryEdit(cat)} className="p-1 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteCategory(cat)} className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {cat.children?.map(child => renderCategoryNode(child, depth + 1))}
        </div>
    )

    const renderGalleryCategory = (cat, godId, depth = 0) => {
        const images = getGodImagesForCategory(godId, cat.id)
        const isAdding = galleryAddCat === cat.id
        return (
            <div key={cat.id} style={{ marginLeft: `${depth * 16}px` }}>
                <div className="flex items-center gap-2 mb-1.5">
                    <FolderTree className="w-3 h-3 text-violet-400/60" />
                    <span className="text-xs font-semibold text-(--color-text) uppercase tracking-wider">{cat.name}</span>
                    <span className="text-xs text-(--color-text-secondary)/40">({images.length})</span>
                    <button
                        onClick={() => setGalleryAddCat(isAdding ? null : cat.id)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-violet-400 hover:bg-violet-400/10 transition-colors cursor-pointer ml-auto"
                    >
                        <ImagePlus className="w-3 h-3" />
                        {isAdding ? 'Cancel' : 'Add'}
                    </button>
                </div>

                {/* Image picker for adding */}
                {isAdding && (
                    <div className="mb-2 ml-5">
                        <CodexImagePicker
                            value={null}
                            onChange={() => {}}
                            onSelectFull={(img) => addImageToGod(img, cat.id)}
                        />
                    </div>
                )}

                {/* Image thumbnails */}
                {images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 ml-5">
                        {images.map(gi => (
                            <div key={gi.id} className="relative group/img">
                                <img src={gi.url} alt={gi.filename || ''} className="w-12 h-12 rounded-lg object-contain bg-black/20 border border-white/5" />
                                <button
                                    onClick={() => removeImageFromGod(gi.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                                    title="Remove"
                                >
                                    <X className="w-2.5 h-2.5" />
                                </button>
                                {gi.caption && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 rounded-b-lg px-1 py-0.5 text-[9px] text-white truncate">
                                        {gi.caption}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Sub-categories */}
                {cat.children?.map(child => renderGalleryCategory(child, godId, depth + 1))}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent border-white/20 mx-auto" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <PageTitle title="Codex - Gods" noindex />

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
                    <Settings2 className="w-4 h-4 text-cyan-400" />
                    <span className="font-heading text-sm font-bold text-(--color-text)">Fields</span>
                    <span className="text-xs text-(--color-text-secondary)">({fields.length})</span>
                    <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Define the attributes for gods</span>
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
                                        <span className="text-xs text-(--color-text-secondary) bg-white/5 px-1.5 py-0.5 rounded">
                                            {field.field_type}
                                            {field.field_type === 'group' && field.options?.sub_fields && (
                                                <span className="text-(--color-text-secondary)/40 ml-1">({field.options.sub_fields.length})</span>
                                            )}
                                        </span>
                                        {field.field_type === 'group' && field.options?.sub_fields && (
                                            <span className="text-xs text-(--color-text-secondary)/30">[{field.options.sub_fields.map(sf => sf.label).join(', ')}]</span>
                                        )}
                                        {field.required && <span className="text-xs text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">required</span>}
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
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="e.g. Pantheon" />
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
                                            <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Sub-fields</label>
                                            <div className="space-y-2">
                                                {(fieldForm.options?.sub_fields || []).map((sf, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
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
                                                        </select>
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
                                        </div>
                                    )}
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
                    <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Categorize gods with tags</span>
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

            {/* ═══ Image Categories Section ═══ */}
            <div className="mb-6">
                <button
                    onClick={() => setShowCategories(!showCategories)}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                >
                    {showCategories ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" /> : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />}
                    <FolderTree className="w-4 h-4 text-violet-400" />
                    <span className="font-heading text-sm font-bold text-(--color-text)">Image Categories</span>
                    <span className="text-xs text-(--color-text-secondary)">({categories.length})</span>
                    <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Organize god images into categories</span>
                </button>

                {showCategories && (
                    <div className="mt-2 bg-(--color-secondary) border border-white/10 rounded-xl p-4">
                        {/* Category tree */}
                        {categoryTree.length > 0 && (
                            <div className="space-y-0.5 mb-4">
                                {categoryTree.map(cat => renderCategoryNode(cat))}
                            </div>
                        )}

                        {/* Category form */}
                        {categoryForm ? (
                            <div className="border border-white/10 rounded-lg p-4 bg-black/10">
                                <h4 className="text-sm font-bold text-(--color-text) mb-3">
                                    {categoryForm.id ? 'Edit Category' : 'New Category'}
                                    {!categoryForm.id && categoryForm.parent_id && (
                                        <span className="text-xs text-violet-400 font-normal ml-2">
                                            sub-category of {categories.find(c => c.id === categoryForm.parent_id)?.name}
                                        </span>
                                    )}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                        <input type="text" value={categoryForm.name} onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="e.g. Skins" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Slug</label>
                                        <input type="text" value={categoryForm.slug} onChange={e => setCategoryForm(p => ({ ...p, slug: e.target.value }))}
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="auto-generated" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Parent</label>
                                        <select value={categoryForm.parent_id || ''} onChange={e => setCategoryForm(p => ({ ...p, parent_id: e.target.value ? parseInt(e.target.value) : null }))}
                                            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) cursor-pointer">
                                            <option value="">-- Top level --</option>
                                            {flatCategories
                                                .filter(c => c.id !== categoryForm.id)
                                                .map(c => (
                                                    <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>
                                                ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                    <button onClick={saveCategory} disabled={saving || !categoryForm.name?.trim()}
                                        className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                        {saving ? 'Saving...' : (categoryForm.id ? 'Update' : 'Create')}
                                    </button>
                                    <button onClick={() => setCategoryForm(null)}
                                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => startCategoryCreate()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) text-sm transition-colors cursor-pointer">
                                <Plus className="w-3.5 h-3.5" /> Add Category
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Gods Section ═══ */}
            <div>
                {/* Gods header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Swords className="w-6 h-6 text-(--color-accent)" />
                        <h2 className="font-heading text-2xl font-bold text-(--color-text)">Gods</h2>
                        <span className="text-sm text-(--color-text-secondary)">({filteredGods.length}{filteredGods.length !== gods.length ? ` / ${gods.length}` : ''})</span>
                    </div>
                    <button onClick={startGodCreate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer">
                        <Plus className="w-4 h-4" /> New God
                    </button>
                </div>

                {/* Search + filter bar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        className="flex-1 px-3 py-2 bg-(--color-secondary) border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)"
                        placeholder="Search gods..." />
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

                {/* God form */}
                {godForm && (
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-5 mb-4">
                        <h3 className="font-heading text-lg font-bold text-(--color-text) mb-4">
                            {godForm.id ? 'Edit God' : 'Create God'}
                        </h3>

                        {/* God database link */}
                        <div className="mb-4 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                            <label className="flex items-center gap-2 text-xs text-cyan-400 uppercase tracking-wider mb-2 font-semibold">
                                <Link2 className="w-3.5 h-3.5" />
                                Link to God Database
                            </label>
                            <select
                                value={godForm.god_id || ''}
                                onChange={e => linkGodDatabase(e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-cyan-400 cursor-pointer"
                            >
                                <option value="">-- No link (standalone entry) --</option>
                                {linkedGods.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-(--color-text-secondary)/50 mt-1">Link this entry to an existing god in the database. Selecting a god will auto-fill name and icon if empty.</p>
                        </div>

                        {/* Core fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                <input type="text" value={godForm.name} onChange={e => setGodField('name', e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="God name" />
                            </div>
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Icon</label>
                                <CodexImagePicker value={godForm.icon_url || null} onChange={url => setGodField('icon_url', url || '')} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Description</label>
                                <textarea value={godForm.description || ''} onChange={e => setGodField('description', e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent) resize-y min-h-[60px]" placeholder="God description" rows={2} />
                            </div>
                        </div>

                        {/* Dynamic fields */}
                        {fields.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs text-(--color-text-secondary) uppercase tracking-wider mb-2 font-semibold">Custom Fields</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fields.map(field => (
                                        <div key={field.id} className={field.field_type === 'group' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                                            <label className="flex items-center gap-1.5 text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">
                                                {field.icon_url && <img src={field.icon_url} alt="" className="w-3.5 h-3.5 rounded" />}
                                                {field.name}
                                                {field.required && <span className="text-cyan-400">*</span>}
                                            </label>
                                            {field.field_type === 'group' && field.options?.sub_fields ? (
                                                <div className="flex gap-2">
                                                    {field.options.sub_fields.map(sf => (
                                                        <div key={sf.key} className="flex-1">
                                                            <label className="block text-[10px] text-(--color-text-secondary)/60 mb-0.5">{sf.label}</label>
                                                            {sf.type === 'boolean' ? (
                                                                <label className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-lg cursor-pointer">
                                                                    <input type="checkbox"
                                                                        checked={!!(godForm.field_values[field.slug] || {})[sf.key]}
                                                                        onChange={e => setGroupSubValue(field.slug, sf.key, e.target.checked)}
                                                                        className="rounded border-white/20 bg-black/20 text-(--color-accent) focus:ring-(--color-accent)" />
                                                                    <span className="text-sm text-(--color-text)">{(godForm.field_values[field.slug] || {})[sf.key] ? 'Yes' : 'No'}</span>
                                                                </label>
                                                            ) : (
                                                                <div className={sf.type === 'percentage' ? 'relative' : ''}>
                                                                    <input
                                                                        type={sf.type === 'number' || sf.type === 'percentage' ? 'number' : 'text'}
                                                                        value={(godForm.field_values[field.slug] || {})[sf.key] ?? ''}
                                                                        onChange={e => setGroupSubValue(field.slug, sf.key, e.target.value)}
                                                                        className={`w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)${sf.type === 'percentage' ? ' pr-7' : ''}`}
                                                                        placeholder={sf.label}
                                                                    />
                                                                    {sf.type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)/40 text-sm">%</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : field.field_type === 'boolean' ? (
                                                <label className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-lg cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={!!godForm.field_values[field.slug]}
                                                        onChange={e => setGodFieldValue(field.slug, e.target.checked)}
                                                        className="rounded border-white/20 bg-black/20 text-(--color-accent) focus:ring-(--color-accent)" />
                                                    <span className="text-sm text-(--color-text)">{godForm.field_values[field.slug] ? 'Yes' : 'No'}</span>
                                                </label>
                                            ) : (
                                                <div className={field.field_type === 'percentage' ? 'relative' : ''}>
                                                    <input
                                                        type={field.field_type === 'number' || field.field_type === 'percentage' ? 'number' : 'text'}
                                                        value={godForm.field_values[field.slug] ?? ''}
                                                        onChange={e => setGodFieldValue(field.slug, e.target.value)}
                                                        className={`w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)${field.field_type === 'percentage' ? ' pr-7' : ''}`}
                                                        placeholder={field.description || field.name}
                                                    />
                                                    {field.field_type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)/40 text-sm">%</span>}
                                                </div>
                                            )}
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
                                        const selected = godForm.tag_ids.includes(tag.id)
                                        return (
                                            <button key={tag.id} onClick={() => toggleGodTag(tag.id)}
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

                        {/* Gallery (only for existing gods) */}
                        {godForm.id && categories.length > 0 && (
                            <div className="mb-4 p-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
                                <h4 className="flex items-center gap-2 text-xs text-violet-400 uppercase tracking-wider mb-3 font-semibold">
                                    <ImagePlus className="w-3.5 h-3.5" />
                                    Gallery
                                    <span className="text-(--color-text-secondary)/40 font-normal normal-case">({godImages.filter(gi => gi.codex_god_id === godForm.id).length} images)</span>
                                </h4>
                                <div className="space-y-3">
                                    {categoryTree.map(cat => renderGalleryCategory(cat, godForm.id))}
                                </div>
                            </div>
                        )}

                        {godForm.id && categories.length === 0 && (
                            <div className="mb-4 p-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
                                <p className="text-xs text-(--color-text-secondary)/50">
                                    Create image categories above to start adding gallery images to this god.
                                </p>
                            </div>
                        )}

                        {/* Save / Cancel */}
                        <div className="flex items-center gap-3">
                            <button onClick={saveGod} disabled={saving || !godForm.name?.trim()}
                                className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                {saving ? 'Saving...' : (godForm.id ? 'Update' : 'Create')}
                            </button>
                            <button onClick={() => setGodForm(null)}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Gods list */}
                <div className="space-y-2">
                    {filteredGods.map(god => {
                        const linked = god.god_id ? getLinkedGod(god.god_id) : null
                        const imgCount = getGodImageCount(god.id)
                        return (
                            <div key={god.id} className="bg-(--color-secondary) border border-white/10 rounded-xl p-4 hover:border-white/15 transition-colors group">
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    {god.icon_url ? (
                                        <img src={god.icon_url} alt="" className="w-10 h-10 rounded-lg shrink-0 bg-black/20" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg shrink-0 bg-white/5 flex items-center justify-center">
                                            <Swords className="w-5 h-5 text-(--color-text-secondary)/30" />
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-heading text-sm font-bold text-(--color-text)">{god.name}</span>
                                            {linked && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-cyan-400 bg-cyan-400/10" title={`Linked to ${linked.name} in god database`}>
                                                    <Link2 className="w-3 h-3" />
                                                    DB
                                                </span>
                                            )}
                                            {imgCount > 0 && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-violet-400 bg-violet-400/10">
                                                    <ImagePlus className="w-3 h-3" />
                                                    {imgCount}
                                                </span>
                                            )}
                                            {/* Tags */}
                                            {god.tag_ids?.map(tagId => {
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
                                        {god.description && (
                                            <p className="text-xs text-(--color-text-secondary)/60 mb-1 line-clamp-1">{god.description}</p>
                                        )}
                                        {/* Field values preview */}
                                        {fields.length > 0 && Object.keys(god.field_values || {}).length > 0 && (
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                {fields.filter(f => {
                                                    const val = god.field_values[f.slug]
                                                    if (f.field_type === 'group') return val && typeof val === 'object' && Object.values(val).some(v => v !== '' && v != null)
                                                    if (f.field_type === 'boolean') return val !== undefined
                                                    return val !== undefined && val !== ''
                                                }).map(field => (
                                                    <span key={field.slug} className="text-xs text-(--color-text-secondary)/50">
                                                        {field.icon_url && <img src={field.icon_url} alt="" className="w-3 h-3 rounded inline mr-0.5 -mt-0.5" />}
                                                        <span className="text-(--color-text-secondary)/40">{field.name}:</span>{' '}
                                                        <span className="text-(--color-text-secondary)">
                                                            {field.field_type === 'group' && field.options?.sub_fields
                                                                ? field.options.sub_fields
                                                                    .filter(sf => {
                                                                        const v = (god.field_values[field.slug] || {})[sf.key]
                                                                        return sf.type === 'boolean' ? v !== undefined : !!v
                                                                    })
                                                                    .map(sf => {
                                                                        const v = (god.field_values[field.slug] || {})[sf.key]
                                                                        return `${sf.label}: ${sf.type === 'boolean' ? (v ? 'Yes' : 'No') : sf.type === 'percentage' ? `${v}%` : v}`
                                                                    })
                                                                    .join(' / ')
                                                                : field.field_type === 'boolean'
                                                                    ? (god.field_values[field.slug] ? 'Yes' : 'No')
                                                                    : field.field_type === 'percentage'
                                                                        ? `${god.field_values[field.slug]}%`
                                                                        : god.field_values[field.slug]
                                                            }
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startGodEdit(god)} className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer" title="Edit">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => deleteGod(god)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {gods.length === 0 && !godForm && (
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-12 text-center">
                        <Swords className="w-12 h-12 mx-auto mb-4 text-(--color-text-secondary)/30" />
                        <p className="text-(--color-text-secondary) text-lg font-medium font-heading">No gods yet</p>
                        <p className="text-(--color-text-secondary)/50 text-sm mt-1">
                            {fields.length === 0 ? 'Start by defining some fields above, then create your first god' : 'Create your first god to get started'}
                        </p>
                    </div>
                )}

                {filteredGods.length === 0 && gods.length > 0 && (
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-8 text-center">
                        <p className="text-(--color-text-secondary) text-sm">No gods match your filters</p>
                    </div>
                )}
            </div>
        </div>
    )
}
