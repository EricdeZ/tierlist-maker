import { useRef, useEffect } from 'react'
import BaseModal from '../../../components/BaseModal'

export default function EditInfoModal({ player, onChange, onSave, onClose, saving }) {
    const inputRef = useRef(null)
    useEffect(() => { inputRef.current?.focus() }, [])

    return (
        <BaseModal onClose={onClose} className="p-6">
                <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
                    Edit — {player.name}
                </h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Discord Username</label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={player.discord_name}
                            onChange={e => onChange({ ...player, discord_name: e.target.value })}
                            placeholder="e.g. username#1234"
                            className="w-full rounded-lg px-3 py-2 text-sm border"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Tracker.gg URL</label>
                        <input
                            type="text"
                            value={player.tracker_url}
                            onChange={e => onChange({ ...player, tracker_url: e.target.value })}
                            placeholder="https://tracker.gg/smite/profile/..."
                            className="w-full rounded-lg px-3 py-2 text-sm border"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Main Role</label>
                            <select
                                value={player.main_role}
                                onChange={e => onChange({ ...player, main_role: e.target.value })}
                                className="w-full rounded-lg px-3 py-2 text-sm border"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="">None</option>
                                {['Solo', 'Jungle', 'Mid', 'Support', 'ADC'].map(r => (
                                    <option key={r} value={r.toLowerCase()}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Secondary Role</label>
                            <select
                                value={player.secondary_role}
                                onChange={e => onChange({ ...player, secondary_role: e.target.value })}
                                className="w-full rounded-lg px-3 py-2 text-sm border"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="">None</option>
                                {['Solo', 'Jungle', 'Mid', 'Support', 'ADC'].map(r => (
                                    <option key={r} value={r.toLowerCase()}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
        </BaseModal>
    )
}
