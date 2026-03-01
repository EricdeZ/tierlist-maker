import { useState, useEffect, useRef } from 'react'
import { codexService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Plus, Pencil, Trash2, X, Search, Check } from 'lucide-react'

const emptyForm = { name: '', tag_id: null, difficulty: 5 }

export default function CodexWordle() {
    const [categories, setCategories] = useState([])
    const [tags, setTags] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState(emptyForm)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [tagSearch, setTagSearch] = useState('')
    const [showTagDropdown, setShowTagDropdown] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const tagDropdownRef = useRef(null)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        function handleClickOutside(e) {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
                setShowTagDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function loadData() {
        try {
            const data = await codexService.getWordleCategories()
            setCategories(data.categories || [])
            setTags(data.tags || [])
        } catch (err) {
            console.error('Failed to load wordle categories:', err)
        } finally {
            setLoading(false)
        }
    }

    function startCreate() {
        setForm(emptyForm)
        setEditingId(null)
        setTagSearch('')
        setShowForm(true)
    }

    function startEdit(cat) {
        setForm({ name: cat.name, tag_id: cat.tag_id, difficulty: cat.difficulty })
        setEditingId(cat.id)
        const tag = tags.find(t => t.id === cat.tag_id)
        setTagSearch(tag ? tag.name : '')
        setShowForm(true)
    }

    function cancelForm() {
        setShowForm(false)
        setEditingId(null)
        setForm(emptyForm)
        setTagSearch('')
    }

    async function handleSave() {
        if (!form.name.trim()) return
        setSaving(true)
        try {
            if (editingId) {
                const res = await codexService.updateWordleCategory({ id: editingId, ...form })
                if (res.success) {
                    setCategories(prev => prev.map(c => c.id === editingId ? res.category : c))
                }
            } else {
                const res = await codexService.createWordleCategory(form)
                if (res.success) {
                    setCategories(prev => [...prev, res.category].sort((a, b) => a.name.localeCompare(b.name)))
                }
            }
            cancelForm()
        } catch (err) {
            console.error('Failed to save category:', err)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        try {
            const res = await codexService.deleteWordleCategory(id)
            if (res.success) {
                setCategories(prev => prev.filter(c => c.id !== id))
            }
        } catch (err) {
            console.error('Failed to delete category:', err)
        } finally {
            setDeleteConfirm(null)
        }
    }

    function selectTag(tag) {
        setForm(prev => ({ ...prev, tag_id: tag.id }))
        setTagSearch(tag.name)
        setShowTagDropdown(false)
    }

    function clearTag() {
        setForm(prev => ({ ...prev, tag_id: null }))
        setTagSearch('')
    }

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(tagSearch.toLowerCase())
    )

    const getTagById = (id) => tags.find(t => t.id === id)

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto pb-8 px-4">
                <PageTitle title="Wordle Categories" noindex />
                <div className="text-center py-12 text-(--color-text-secondary)">Loading...</div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto pb-8 px-4">
            <PageTitle title="Wordle Categories" noindex />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-heading text-2xl sm:text-3xl font-bold text-(--color-text) mb-1">Wordle Categories</h1>
                    <p className="text-(--color-text-secondary) text-sm">Manage categories for the Wordle game. Each category links to a god tag.</p>
                </div>
                {!showForm && (
                    <button
                        onClick={startCreate}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Category
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="rounded-xl border border-white/10 p-4 sm:p-6 mb-6" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                    <h3 className="font-heading text-lg font-semibold text-(--color-text) mb-4">
                        {editingId ? 'Edit Category' : 'New Category'}
                    </h3>

                    <div className="grid gap-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Name</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Category name..."
                                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>

                        {/* Tag Selector */}
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">God Tag</label>
                            <div className="relative" ref={tagDropdownRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)/50" />
                                    <input
                                        type="text"
                                        value={tagSearch}
                                        onChange={e => {
                                            setTagSearch(e.target.value)
                                            setShowTagDropdown(true)
                                            if (!e.target.value) setForm(prev => ({ ...prev, tag_id: null }))
                                        }}
                                        onFocus={() => setShowTagDropdown(true)}
                                        placeholder="Search tags..."
                                        className="w-full pl-9 pr-8 py-2 rounded-lg border border-white/10 bg-white/5 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-emerald-500/50"
                                    />
                                    {form.tag_id && (
                                        <button onClick={clearTag} className="absolute right-2 top-1/2 -translate-y-1/2 text-(--color-text-secondary) hover:text-(--color-text)">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {showTagDropdown && (
                                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-(--color-secondary) shadow-lg">
                                        {filteredTags.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-(--color-text-secondary)">No tags found</div>
                                        ) : (
                                            filteredTags.map(tag => (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => selectTag(tag)}
                                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/5 transition-colors ${form.tag_id === tag.id ? 'bg-white/10' : ''}`}
                                                >
                                                    <span
                                                        className="w-3 h-3 rounded-full shrink-0"
                                                        style={{ backgroundColor: tag.color || '#6366f1' }}
                                                    />
                                                    <span className="text-(--color-text)">{tag.name}</span>
                                                    {form.tag_id === tag.id && <Check className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">
                                Difficulty: <span className="text-(--color-text) font-bold">{form.difficulty}</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={form.difficulty}
                                onChange={e => setForm(prev => ({ ...prev, difficulty: parseInt(e.target.value) }))}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-(--color-text-secondary)/50 mt-1">
                                <span>1 (Easy)</span>
                                <span>10 (Hard)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.name.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                        </button>
                        <button
                            onClick={cancelForm}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-(--color-text-secondary) bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            {categories.length === 0 ? (
                <div className="text-center py-12 text-(--color-text-secondary)">
                    No wordle categories yet. Click "Add Category" to create one.
                </div>
            ) : (
                <div className="grid gap-2">
                    {categories.map(cat => {
                        const tag = getTagById(cat.tag_id)
                        return (
                            <div
                                key={cat.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-(--color-text)">{cat.name}</span>
                                        {tag && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: tag.color || '#6366f1' }}
                                                />
                                                <span className="text-(--color-text-secondary)">{tag.name}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-xs text-(--color-text-secondary) shrink-0">
                                    <span>Diff:</span>
                                    <span className="font-bold text-(--color-text)">{cat.difficulty}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => startEdit(cat)}
                                        className="p-1.5 rounded-lg text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    {deleteConfirm === cat.id ? (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="px-2 py-1 rounded text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="px-2 py-1 rounded text-xs font-medium text-(--color-text-secondary) hover:bg-white/5 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(cat.id)}
                                            className="p-1.5 rounded-lg text-(--color-text-secondary) hover:text-red-400 hover:bg-white/5 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
