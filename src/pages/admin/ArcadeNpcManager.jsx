import { useState, useEffect } from 'react'
import { arcadeNpcService } from '../../services/database'
import { NPC_SPRITES, NPC_SPRITE_MAP } from '../arcade/npcSprites'
import PageTitle from '../../components/PageTitle'

const EMPTY_FORM = {
    name: '',
    quote: '',
    sprite_key: '',
    active: true,
    spawn_qx: '',
    spawn_qy: '',
}

export default function ArcadeNpcManager() {
    const [npcs, setNpcs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const loadNpcs = async () => {
        try {
            const data = await arcadeNpcService.adminList()
            setNpcs(data.npcs || [])
        } catch (err) {
            console.error('Failed to load NPCs:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadNpcs() }, [])

    const openCreate = () => {
        setForm(EMPTY_FORM)
        setEditingId(null)
        setError(null)
        setShowModal(true)
    }

    const openEdit = (npc) => {
        setForm({
            name: npc.name,
            quote: npc.quote,
            sprite_key: npc.image_url || '',
            active: npc.active,
            spawn_qx: npc.spawn_qx ?? '',
            spawn_qy: npc.spawn_qy ?? '',
        })
        setEditingId(npc.id)
        setError(null)
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.name.trim() || !form.quote.trim()) {
            setError('Name and quote are required.')
            return
        }
        if (!form.sprite_key) {
            setError('Please select a sprite.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const payload = {
                name: form.name.trim(),
                quote: form.quote.trim(),
                image_url: form.sprite_key,
                active: form.active,
                spawn_qx: form.spawn_qx === '' ? null : parseInt(form.spawn_qx),
                spawn_qy: form.spawn_qy === '' ? null : parseInt(form.spawn_qy),
            }

            if (editingId) {
                await arcadeNpcService.update({ id: editingId, ...payload })
            } else {
                await arcadeNpcService.create(payload)
            }
            setShowModal(false)
            loadNpcs()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (id) => {
        try {
            await arcadeNpcService.toggle(id)
            loadNpcs()
        } catch (err) {
            console.error('Toggle failed:', err)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this NPC permanently?')) return
        try {
            await arcadeNpcService.remove(id)
            loadNpcs()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

    const getSpriteThumb = (key) => NPC_SPRITE_MAP[key]?.src

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text) p-4 sm:p-8">
            <PageTitle title="Arcade NPC Manager" noindex />

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Arcade NPC Manager</h1>
                    <button onClick={openCreate}
                        className="px-4 py-2 rounded-lg bg-(--color-accent) hover:opacity-90 text-(--color-primary) font-bold text-sm transition-colors">
                        + New NPC
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-(--color-text-secondary)">Loading...</div>
                ) : npcs.length === 0 ? (
                    <div className="text-center py-12 text-(--color-text-secondary)">
                        No NPCs created yet. Click "New NPC" to add characters to the arcade.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {npcs.map(npc => {
                            const thumb = getSpriteThumb(npc.image_url)
                            return (
                                <div key={npc.id}
                                    className={`bg-(--color-secondary) rounded-xl border border-white/10 p-4 flex items-start gap-4 ${!npc.active ? 'opacity-50' : ''}`}>
                                    {/* Sprite */}
                                    <div className="shrink-0 w-12 h-12 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                                        {thumb ? (
                                            <img src={thumb} alt={npc.name}
                                                className="w-10 h-10 object-cover object-top"
                                                style={{ imageRendering: 'pixelated' }} />
                                        ) : (
                                            <span className="text-lg text-(--color-text-secondary)/30">?</span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold">
                                            {npc.name}
                                            {npc.image_url && (
                                                <span className="text-xs text-(--color-text-secondary) font-normal ml-2">
                                                    ({NPC_SPRITE_MAP[npc.image_url]?.label || npc.image_url})
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-(--color-text-secondary) mt-0.5 line-clamp-2">"{npc.quote}"</div>
                                        {(npc.spawn_qx != null || npc.spawn_qy != null) && (
                                            <div className="text-xs text-(--color-text-secondary)/60 mt-1">
                                                Position: ({npc.spawn_qx}, {npc.spawn_qy})
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        <button onClick={() => handleToggle(npc.id)}
                                            className={`w-8 h-5 rounded-full transition-colors ${npc.active ? 'bg-green-500' : 'bg-white/20'}`}>
                                            <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${npc.active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                        </button>
                                        <button onClick={() => openEdit(npc)}
                                            className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                                        <button onClick={() => handleDelete(npc.id)}
                                            className="text-xs text-red-400 hover:text-red-300">Delete</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowModal(false)}>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit NPC' : 'New NPC'}</h2>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Sprite picker */}
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-2">Sprite</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {NPC_SPRITES.map(s => (
                                        <button key={s.key}
                                            type="button"
                                            onClick={() => setField('sprite_key', s.key)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                                                form.sprite_key === s.key
                                                    ? 'border-(--color-accent) bg-(--color-accent)/10'
                                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <img src={s.src} alt={s.label}
                                                className="w-8 h-8 object-cover object-top"
                                                style={{ imageRendering: 'pixelated' }} />
                                            <span className="text-[0.55rem] text-(--color-text-secondary) leading-tight text-center">
                                                {s.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Name</label>
                                <input value={form.name} onChange={e => setField('name', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                    placeholder="e.g., Cool Trainer" maxLength={50} />
                            </div>

                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Quote</label>
                                <textarea value={form.quote} onChange={e => setField('quote', e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                    placeholder="What this NPC says when interacted with..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Spawn X (optional)</label>
                                    <input type="number" value={form.spawn_qx} onChange={e => setField('spawn_qx', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                        placeholder="Random" min={0} max={19} />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Spawn Y (optional)</label>
                                    <input type="number" value={form.spawn_qy} onChange={e => setField('spawn_qy', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                        placeholder="Random" min={0} max={13} />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.active}
                                    onChange={e => setField('active', e.target.checked)}
                                    className="rounded accent-(--color-accent)" />
                                <span className="text-sm">Active (visible in arcade)</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 rounded-lg bg-(--color-accent) hover:opacity-90 text-(--color-primary) font-bold text-sm transition-colors disabled:opacity-50">
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create NPC'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
