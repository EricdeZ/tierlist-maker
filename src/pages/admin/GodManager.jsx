import { useState, useEffect, useCallback } from 'react'
import { godService } from '../../services/database'
import PageTitle from '../../components/PageTitle'

export default function GodManager() {
    const [gods, setGods] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editing, setEditing] = useState(null) // null | { id?, name, image_url }
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(null) // god id being deleted
    const [toast, setToast] = useState(null)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const loadGods = useCallback(async () => {
        try {
            const data = await godService.getAll()
            setGods(data)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setLoading(false)
        }
    }, [showToast])

    useEffect(() => { loadGods() }, [loadGods])

    const handleSave = async () => {
        if (!editing?.name?.trim()) {
            showToast('error', 'Name is required')
            return
        }
        setSaving(true)
        try {
            if (editing.id) {
                const { god } = await godService.update(editing.id, editing.name, editing.image_url)
                setGods(prev => prev.map(g => g.id === god.id ? god : g).sort((a, b) => a.name.localeCompare(b.name)))
                showToast('success', `Updated ${god.name}`)
            } else {
                const { god } = await godService.create(editing.name, editing.image_url)
                setGods(prev => [...prev, god].sort((a, b) => a.name.localeCompare(b.name)))
                showToast('success', `Added ${god.name}`)
            }
            setEditing(null)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (god) => {
        if (!confirm(`Delete "${god.name}"? This cannot be undone.`)) return
        setDeleting(god.id)
        try {
            await godService.delete(god.id)
            setGods(prev => prev.filter(g => g.id !== god.id))
            showToast('success', `Deleted ${god.name}`)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setDeleting(null)
        }
    }

    const filtered = gods.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <PageTitle title="God Manager" noindex />
                <div className="flex items-center justify-center py-20 text-[var(--color-text-secondary)]">Loading...</div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 pb-8">
            <PageTitle title="God Manager" noindex />

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
                    toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-heading font-bold text-[var(--color-text)]">Gods</h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">{gods.length} gods in database</p>
                </div>
                <button
                    onClick={() => setEditing({ name: '', image_url: '' })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    Add God
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search gods..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-secondary)] border border-white/10 rounded-lg text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-blue-500/50"
                />
            </div>

            {/* God list */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-white/5 text-[var(--color-text-secondary)] text-left">
                            <th className="px-4 py-3 font-medium w-16">Image</th>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium hidden sm:table-cell">Slug</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filtered.map(god => (
                            <tr key={god.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-2">
                                    {god.image_url ? (
                                        <img
                                            src={god.image_url}
                                            alt={god.name}
                                            className="w-10 h-10 rounded object-cover bg-black/20"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-[var(--color-text-secondary)] text-xs">
                                            ?
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-[var(--color-text)] font-medium">{god.name}</td>
                                <td className="px-4 py-2 text-[var(--color-text-secondary)] hidden sm:table-cell">{god.slug}</td>
                                <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setEditing({ id: god.id, name: god.name, image_url: god.image_url || '' })}
                                            className="px-3 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(god)}
                                            disabled={deleting === god.id}
                                            className="px-3 py-1 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                        >
                                            {deleting === god.id ? '...' : 'Delete'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                                    {search ? 'No gods match your search' : 'No gods in database'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit/Add Modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !saving && setEditing(null)}>
                    <div className="bg-[var(--color-bg)] border border-white/10 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-4">
                            {editing.id ? 'Edit God' : 'Add God'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editing.name}
                                    onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--color-secondary)] border border-white/10 rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-blue-500/50"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Image URL</label>
                                <input
                                    type="text"
                                    value={editing.image_url}
                                    onChange={e => setEditing(prev => ({ ...prev, image_url: e.target.value }))}
                                    placeholder="https://..."
                                    className="w-full px-3 py-2 bg-[var(--color-secondary)] border border-white/10 rounded-lg text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)]/50 focus:outline-none focus:border-blue-500/50"
                                />
                                {editing.image_url && (
                                    <img
                                        src={editing.image_url}
                                        alt="Preview"
                                        className="mt-2 w-16 h-16 rounded object-cover bg-black/20"
                                        onError={e => { e.target.style.display = 'none' }}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditing(null)}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !editing.name?.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add God'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
