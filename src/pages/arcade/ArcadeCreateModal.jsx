import { useState } from 'react'
import { X } from 'lucide-react'

export default function ArcadeCreateModal({ onClose, onCreate, embedded }) {
    const [title, setTitle] = useState('')
    const [mode, setMode] = useState('live')
    const [accessScope, setAccessScope] = useState('open')
    const [scheduledAt, setScheduledAt] = useState('')
    const [pickTimer, setPickTimer] = useState(30)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title.trim()) { setError('Title is required'); return }
        if (mode === 'scheduled' && !scheduledAt) { setError('Schedule time is required'); return }

        setSubmitting(true)
        setError(null)
        try {
            await onCreate({
                title: title.trim(),
                mode,
                accessScope,
                scheduledAt: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
                pickTimer,
            })
        } catch (err) {
            setError(err.message || 'Failed to create lobby')
            setSubmitting(false)
        }
    }

    const formContent = (
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                    {/* Title */}
                    <div>
                        <label className="arcade-label block mb-1.5" style={{ color: 'var(--arcade-text-mid)' }}>
                            TITLE
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Friday Night Fights"
                            maxLength={255}
                            className="w-full px-3 py-2 rounded text-sm"
                            style={{
                                background: 'var(--arcade-surface)',
                                border: '1px solid var(--arcade-border)',
                                color: 'var(--arcade-text)',
                            }}
                        />
                    </div>

                    {/* Mode */}
                    <div>
                        <label className="arcade-label block mb-1.5" style={{ color: 'var(--arcade-text-mid)' }}>
                            MODE
                        </label>
                        <div className="flex gap-2">
                            {[
                                { key: 'live', label: 'LIVE QUEUE' },
                                { key: 'scheduled', label: 'SCHEDULED' },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setMode(opt.key)}
                                    className="arcade-label flex-1 py-2 rounded transition-all"
                                    style={{
                                        background: mode === opt.key ? 'var(--arcade-cyan-dim)' : 'var(--arcade-surface)',
                                        color: mode === opt.key ? 'var(--arcade-cyan)' : 'var(--arcade-text-dim)',
                                        border: `1px solid ${mode === opt.key ? 'var(--arcade-cyan-dim)' : 'var(--arcade-border)'}`,
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scheduled at */}
                    {mode === 'scheduled' && (
                        <div>
                            <label className="arcade-label block mb-1.5" style={{ color: 'var(--arcade-text-mid)' }}>
                                DATE & TIME
                            </label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                className="w-full px-3 py-2 rounded text-sm"
                                style={{
                                    background: 'var(--arcade-surface)',
                                    border: '1px solid var(--arcade-border)',
                                    color: 'var(--arcade-text)',
                                }}
                            />
                        </div>
                    )}

                    {/* Access scope */}
                    <div>
                        <label className="arcade-label block mb-1.5" style={{ color: 'var(--arcade-text-mid)' }}>
                            WHO CAN JOIN
                        </label>
                        <div className="flex gap-2">
                            {[
                                { key: 'open', label: 'ANYONE' },
                                { key: 'league', label: 'LEAGUE' },
                                { key: 'division', label: 'DIVISION' },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setAccessScope(opt.key)}
                                    className="arcade-label flex-1 py-2 rounded transition-all"
                                    style={{
                                        background: accessScope === opt.key ? 'var(--arcade-cyan-dim)' : 'var(--arcade-surface)',
                                        color: accessScope === opt.key ? 'var(--arcade-cyan)' : 'var(--arcade-text-dim)',
                                        border: `1px solid ${accessScope === opt.key ? 'var(--arcade-cyan-dim)' : 'var(--arcade-border)'}`,
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pick timer */}
                    <div>
                        <label className="arcade-label block mb-1.5" style={{ color: 'var(--arcade-text-mid)' }}>
                            PICK TIMER: {pickTimer}S
                        </label>
                        <input
                            type="range"
                            min={10}
                            max={120}
                            step={5}
                            value={pickTimer}
                            onChange={e => setPickTimer(Number(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs" style={{ color: 'var(--arcade-text-dim)' }}>
                            <span>10s</span>
                            <span>120s</span>
                        </div>
                    </div>

                    {error && (
                        <p className="text-xs" style={{ color: 'var(--arcade-loss)' }}>{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="arcade-label w-full py-3 rounded transition-all hover:scale-[1.02] disabled:opacity-50"
                        style={{
                            background: 'var(--arcade-cyan)',
                            color: 'var(--arcade-bg)',
                        }}
                    >
                        {submitting ? 'CREATING...' : 'CREATE CABINET'}
                    </button>
                </form>
    )

    if (embedded) return formContent

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="w-full max-w-md rounded-lg p-6 arcade-scanlines"
                style={{ background: 'var(--arcade-panel)', border: '1.5px solid var(--arcade-border-lt)' }}
            >
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h2 className="arcade-title text-sm" style={{ color: 'var(--arcade-cyan)' }}>
                        NEW GAME
                    </h2>
                    <button onClick={onClose} className="p-1 hover:opacity-70">
                        <X className="w-4 h-4" style={{ color: 'var(--arcade-text-mid)' }} />
                    </button>
                </div>
                {formContent}
            </div>
        </div>
    )
}
