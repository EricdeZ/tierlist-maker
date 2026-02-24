// src/pages/admin/roster/RenameModal.jsx
import { useState, useEffect, useRef } from 'react'

export function RenameModal({ playerId, playerName, onClose, onRename, opLoading }) {
    const [newName, setNewName] = useState(playerName)
    const [saveAlias, setSaveAlias] = useState(true)
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    const handleRename = async () => {
        const trimmed = newName.trim()
        if (!trimmed) { setError('Enter a name'); return }
        if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return }
        if (trimmed === playerName) { onClose(); return }
        setError(null)
        try {
            await onRename(trimmed, saveAlias)
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
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-base font-bold text-[var(--color-text)]">
                        Rename Player
                    </h3>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                            Current: <span className="text-[var(--color-text)]">{playerName}</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={newName}
                            onChange={e => { setNewName(e.target.value); setError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            placeholder="New name..."
                            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={saveAlias}
                            onChange={e => setSaveAlias(e.target.checked)}
                            className="rounded accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Save "{playerName}" as an alias
                        </span>
                    </label>

                    {error && (
                        <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleRename}
                        disabled={isAnyLoading || !newName.trim() || newName.trim() === playerName}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                        {isAnyLoading ? 'Renaming...' : 'Rename'}
                    </button>
                </div>
            </div>
        </div>
    )
}
