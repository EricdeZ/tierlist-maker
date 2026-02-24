// src/pages/admin/roster/AliasModal.jsx
import { useState, useEffect, useRef } from 'react'

export function AliasModal({ playerName, aliases, onClose, onAddAlias, onRemoveAlias, opLoading }) {
    const [newAlias, setNewAlias] = useState('')
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    const handleAdd = async () => {
        const trimmed = newAlias.trim()
        if (!trimmed) { setError('Enter an alias'); return }
        if (trimmed.length < 2) { setError('Alias must be at least 2 characters'); return }
        if (trimmed.toLowerCase() === playerName.toLowerCase()) { setError('Alias cannot be the same as the player name'); return }
        setError(null)
        try {
            await onAddAlias(trimmed)
            setNewAlias('')
        } catch {
            // Error shown via toast
        }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)]">
                            Aliases for {playerName}
                        </h3>
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                            Old names that should resolve to this player
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                {/* Existing aliases */}
                <div className="px-5 py-3">
                    {aliases.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-secondary)] text-center py-3 italic">
                            No aliases yet
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {aliases.map(a => (
                                <div key={a.alias_id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 group">
                                    <span className="text-sm text-[var(--color-text)]">{a.alias}</span>
                                    <button
                                        onClick={() => onRemoveAlias(a.alias_id)}
                                        disabled={isAnyLoading}
                                        className="text-xs text-red-400/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add new alias */}
                <div className="px-5 pb-4 border-t border-white/10 pt-3">
                    {error && (
                        <div className="mb-2 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                            {error}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newAlias}
                            onChange={e => { setNewAlias(e.target.value); setError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder="Add old name..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={isAnyLoading || !newAlias.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
