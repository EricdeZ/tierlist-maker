import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { getContrastColor } from '../utils/colorContrast'

const ROLES = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']
const ROLE_LABELS = { SOLO: 'Solo', JUNGLE: 'Jng', MID: 'Mid', SUPPORT: 'Sup', ADC: 'ADC' }

const PublishTierListModal = ({ rankings, teams, league, division, season, onPublish, onClose }) => {
    const [title, setTitle] = useState('')
    const [publishing, setPublishing] = useState(false)
    const [error, setError] = useState(null)

    // Build player → team color lookup
    const playerColorMap = {}
    if (teams) {
        for (const team of teams) {
            const color = team.color || '#6b7280'
            for (const p of team.players || []) {
                playerColorMap[p.name || p] = color
            }
        }
    }

    const hasAnyRankings = ROLES.some(r => rankings[r]?.length > 0)

    const handleSubmit = async () => {
        if (publishing || !hasAnyRankings) return
        setPublishing(true)
        setError(null)
        try {
            await onPublish(rankings, title.trim() || null)
            onClose()
        } catch (err) {
            setError(err.message || 'Failed to publish')
        } finally {
            setPublishing(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60" />
            <div
                className="relative bg-(--color-secondary) rounded-xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-(--color-text) font-heading">Post to Feed</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-(--color-text-secondary) hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    {/* Title input */}
                    <div>
                        <label className="block text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-1.5">
                            Title (optional)
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={100}
                            placeholder="e.g. My Week 5 power rankings"
                            className="w-full px-3 py-2 bg-(--color-primary) border border-white/10 rounded-lg text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:border-(--color-accent)/50"
                        />
                        <div className="text-right text-[10px] text-(--color-text-secondary)/50 mt-1">
                            {title.length}/100
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <div className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-2">
                            Preview
                        </div>
                        <div className="bg-(--color-primary) rounded-lg border border-white/10 overflow-hidden">
                            {/* Tier list header */}
                            <div className="text-center py-2 border-b border-white/5">
                                <div className="text-sm font-bold text-(--color-text) font-heading">
                                    {league?.slug?.toUpperCase()} Tierlist
                                </div>
                                <div className="text-[11px] text-(--color-text-secondary)">
                                    {division?.name}{season ? ` — ${season.name}` : ''}
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-px p-3">
                                {ROLES.map(role => {
                                    const players = rankings[role] || []
                                    return (
                                        <div key={role} className="min-w-0">
                                            <div className="text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-wider text-center mb-1.5">
                                                {ROLE_LABELS[role]}
                                            </div>
                                            <div className="space-y-1">
                                                {players.map((name, i) => {
                                                    const color = playerColorMap[name] || '#6b7280'
                                                    const textColor = getContrastColor(color)
                                                    return (
                                                        <div
                                                            key={`${role}-${name}-${i}`}
                                                            className="text-[11px] font-medium px-1.5 py-1 rounded truncate text-center"
                                                            style={{ backgroundColor: color, color: textColor }}
                                                            title={name}
                                                        >
                                                            {name}
                                                        </div>
                                                    )
                                                })}
                                                {players.length === 0 && (
                                                    <div className="text-[10px] text-(--color-text-secondary)/30 italic text-center py-2">
                                                        --
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                    <span className="text-xs text-(--color-text-secondary)">
                        1 post per day per division
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={publishing || !hasAnyRankings}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                    >
                        <Send className="w-4 h-4" />
                        {publishing ? 'Publishing...' : 'Publish'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PublishTierListModal
