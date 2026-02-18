import { useState, useEffect } from 'react'
import { feedbackService } from '../../services/database'
import { MessageSquare, Trash2, Bug, Lightbulb, MessageCircle } from 'lucide-react'

const CATEGORY_META = {
    bug:     { label: 'Bug Report',       icon: Bug,           color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    feature: { label: 'Feature Request',  icon: Lightbulb,     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    general: { label: 'General Feedback', icon: MessageCircle, color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
}

export default function FeedbackManager() {
    const [feedback, setFeedback] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [deleting, setDeleting] = useState(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await feedbackService.adminGetAll()
            setFeedback(data.feedback || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleDelete = async (item) => {
        if (!confirm(`Delete feedback from ${item.username}?`)) return
        setDeleting(item.id)
        try {
            await feedbackService.remove(item.id)
            await fetchData()
        } catch (err) {
            setError(err.message)
        } finally {
            setDeleting(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-(--color-accent)/10">
                    <MessageSquare className="w-6 h-6 text-(--color-accent)" />
                </div>
                <div>
                    <h1 className="text-xl font-heading font-bold text-(--color-text)">Feedback</h1>
                    <p className="text-xs text-(--color-text-secondary)">{feedback.length} submission{feedback.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-6">
                    {error}
                </div>
            )}

            {feedback.length === 0 ? (
                <div className="py-16 text-center">
                    <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No feedback yet</h3>
                    <p className="text-white/40 text-sm">Feedback submitted by users will appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {feedback.map(item => {
                        const meta = CATEGORY_META[item.category] || CATEGORY_META.general
                        const Icon = meta.icon
                        return (
                            <div key={item.id} className="bg-(--color-secondary) border border-white/10 rounded-xl p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Top row: category badge + username + time */}
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                                style={{ background: meta.bg, color: meta.color }}
                                            >
                                                <Icon className="w-3 h-3" />
                                                {meta.label}
                                            </span>
                                            <span className="text-xs text-(--color-text-secondary)">
                                                from <span className="font-medium text-(--color-text)">{item.username}</span>
                                            </span>
                                            <span className="text-xs text-(--color-text-secondary)">
                                                {new Date(item.created_at).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                            </span>
                                        </div>

                                        {/* Message */}
                                        <p className="text-sm text-(--color-text) whitespace-pre-wrap break-words">
                                            {item.message}
                                        </p>
                                    </div>

                                    {/* Delete button */}
                                    <button
                                        onClick={() => handleDelete(item)}
                                        disabled={deleting === item.id}
                                        className="shrink-0 p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
                                        title="Delete feedback"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
