// src/pages/admin/roster/SaveBar.jsx

export function SaveBar({ pendingChanges, saving, onDiscard, onSave }) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 px-6 py-3 flex items-center justify-between shadow-xl"
             style={{ backgroundColor: 'var(--color-secondary)' }}>
            <div className="text-sm">
                <span className="font-bold text-[var(--color-accent)]">{pendingChanges.length}</span>
                <span className="text-[var(--color-text-secondary)]"> unsaved change{pendingChanges.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={onDiscard}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    Discard
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {saving ? 'Saving...' : `Save ${pendingChanges.length} Change${pendingChanges.length !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    )
}
