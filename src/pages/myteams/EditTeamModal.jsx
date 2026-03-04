import { useState } from 'react'
import { X, Check } from 'lucide-react'
import ImageUpload from '../../components/ImageUpload'
import { communityTeamService } from '../../services/database'

const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#a855f7',
]

export default function EditTeamModal({ team, onSuccess, onClose }) {
    const [name, setName] = useState(team.name)
    const [color, setColor] = useState(team.color || '#6366f1')
    const [logoUrl, setLogoUrl] = useState(team.logo_url || null)
    const [logoError, setLogoError] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const nameChanged = name.trim() !== team.name
    const colorChanged = color !== (team.color || '#6366f1')
    const hasChanges = nameChanged || colorChanged
    const nameValid = name.trim().length >= 2 && name.trim().length <= 50

    const handleSave = async () => {
        if (!hasChanges || !nameValid) return
        setSaving(true)
        setError(null)
        try {
            const payload = { team_id: team.id }
            if (nameChanged) payload.name = name.trim()
            if (colorChanged) payload.color = color
            await communityTeamService.update(payload)
            onSuccess()
        } catch (err) {
            setError(err.message || 'Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-lg w-full bg-(--color-secondary) flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-base font-bold text-(--color-text)">Edit Team</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 panel-scrollbar space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-(--color-text) mb-1.5">Team Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={50}
                            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                        />
                        <div className="text-[10px] text-(--color-text-secondary) mt-1">{name.length}/50</div>
                    </div>

                    {/* Logo */}
                    <div>
                        <label className="block text-sm font-medium text-(--color-text) mb-1.5">Team Logo</label>
                        <div className="flex items-start gap-4">
                            <ImageUpload
                                currentUrl={logoUrl}
                                uploadFn={async (file) => {
                                    const data = await communityTeamService.uploadLogo(team.id, file)
                                    setLogoUrl(data.logoUrl)
                                }}
                                onRemove={async () => {
                                    await communityTeamService.deleteLogo(team.id)
                                    setLogoUrl(null)
                                }}
                                onComplete={() => setLogoError(null)}
                                onError={setLogoError}
                                size={80}
                                maxDim={256}
                            />
                            <div className="text-xs text-(--color-text-secondary) space-y-1 pt-1">
                                <p>Square images work best (1:1 ratio).</p>
                                <p>Images with a <span className="text-(--color-text)">transparent background</span> will look better.</p>
                                <p className="text-[10px]">Auto-resized to 256x256. Max 10MB input.</p>
                            </div>
                        </div>
                        {logoError && <div className="mt-2 text-xs text-red-400">{logoError}</div>}
                    </div>

                    {/* Color */}
                    <div>
                        <label className="block text-sm font-medium text-(--color-text) mb-1.5">Team Color</label>
                        <div className="flex flex-wrap gap-2">
                            {COLOR_PRESETS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className="w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110"
                                    style={{
                                        backgroundColor: c,
                                        outline: color === c ? '2px solid white' : '2px solid transparent',
                                        outlineOffset: '2px',
                                    }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-6 h-6 rounded" style={{ backgroundColor: color }} />
                            <input
                                type="text"
                                value={color}
                                onChange={e => {
                                    const v = e.target.value
                                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                                }}
                                maxLength={7}
                                className="w-24 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-(--color-text) font-mono focus:outline-none focus:border-(--color-accent)/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                    {error && <div className="text-xs text-red-400 flex-1 mr-3">{error}</div>}
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-3 py-2 rounded-lg bg-white/5 text-sm text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || !nameValid || saving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary)] text-sm font-semibold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-40"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" /> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
