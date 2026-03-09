import { inputStyle, inputClass, numInputClass } from './constants'

export default function GroupForm({ isNew, form, setForm, onSubmit, onCancel, saving, hasMultipleDivisions, leagueName }) {
    return (
        <div className="bg-[var(--color-secondary)] border border-cyan-500/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-4">{isNew ? 'New Group' : 'Edit Group'}</h2>
            <form onSubmit={onSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            required
                            placeholder="e.g. Group A, Conference East"
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Sort Order</label>
                        <input
                            type="number"
                            value={form.sort_order}
                            onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                            className={numInputClass}
                            style={inputStyle}
                        />
                    </div>
                </div>
                {isNew && hasMultipleDivisions && (
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!form.league_wide}
                            onChange={e => setForm(p => ({ ...p, league_wide: e.target.checked }))}
                            className="rounded border-white/20 bg-[var(--color-primary)] text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Create in all {leagueName} divisions
                        </span>
                    </label>
                )}
                <div className="flex gap-2 mt-4">
                    <button type="submit" disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving...' : isNew ? 'Create Group' : 'Update Group'}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}
