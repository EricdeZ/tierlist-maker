import { useState, useRef, useEffect } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import BaseModal from '../../../components/BaseModal'

export default function AliasModal({ player, onAdd, onRemove, onClose, saving }) {
    const [newAlias, setNewAlias] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [editValue, setEditValue] = useState('')
    const inputRef = useRef(null)
    useEffect(() => { inputRef.current?.focus() }, [])

    const handleAdd = () => {
        const trimmed = newAlias.trim()
        if (trimmed.length < 2) return
        if (trimmed.toLowerCase() === player.name.toLowerCase()) return
        onAdd(player.id, trimmed)
        setNewAlias('')
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAdd()
    }

    const startEdit = (alias) => {
        setEditingId(alias.alias_id)
        setEditValue(alias.alias)
    }

    const handleSaveEdit = async () => {
        const trimmed = editValue.trim()
        if (trimmed.length < 2 || trimmed.toLowerCase() === player.name.toLowerCase()) {
            setEditingId(null)
            return
        }
        const alias = player.aliases.find(a => a.alias_id === editingId)
        if (!alias || trimmed === alias.alias) {
            setEditingId(null)
            return
        }
        // Remove old, add new
        await onRemove(editingId, alias.alias)
        await onAdd(player.id, trimmed)
        setEditingId(null)
        setEditValue('')
    }

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') handleSaveEdit()
        if (e.key === 'Escape') setEditingId(null)
    }

    return (
        <BaseModal onClose={onClose} className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                        Aliases — {player.name}
                    </h3>
                    <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                        {player.aliases.length} alias{player.aliases.length !== 1 ? 'es' : ''}
                    </span>
                </div>

                {/* Existing aliases */}
                <div className="space-y-1.5 mb-4">
                    {player.aliases.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-secondary)] opacity-50 py-2">No aliases yet. Add one below.</p>
                    ) : player.aliases.map(a => (
                        <div key={a.alias_id} className="flex items-center gap-2 group">
                            {editingId === a.alias_id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={() => setEditingId(null)}
                                        autoFocus
                                        className="flex-1 rounded-lg px-2.5 py-1.5 text-sm border"
                                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.2)' }}
                                    />
                                    <button
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={handleSaveEdit}
                                        className="text-green-400 hover:text-green-300 transition-colors p-1"
                                        title="Save"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="flex-1 text-sm text-[var(--color-text)] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
                                        onClick={() => startEdit(a)}
                                        title="Click to edit"
                                    >
                                        {a.alias}
                                    </span>
                                    <button
                                        onClick={() => onRemove(a.alias_id, a.alias)}
                                        disabled={saving}
                                        className="text-[var(--color-text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1 disabled:opacity-30"
                                        title="Remove alias"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add new alias */}
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newAlias}
                        onChange={e => setNewAlias(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add new alias..."
                        className="flex-1 rounded-lg px-3 py-2 text-sm border"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={saving || newAlias.trim().length < 2}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                    </button>
                </div>

                <div className="flex justify-end mt-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                    >
                        Done
                    </button>
                </div>
        </BaseModal>
    )
}
