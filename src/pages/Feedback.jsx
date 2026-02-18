import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { feedbackService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { MessageSquare, Bug, Lightbulb, MessageCircle, Send, CheckCircle } from 'lucide-react'

const CATEGORIES = [
    { value: 'bug', label: 'Bug Report', icon: Bug, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    { value: 'general', label: 'General Feedback', icon: MessageCircle, color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
]

export default function Feedback() {
    const { user, login } = useAuth()
    const [category, setCategory] = useState(null)
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!category || !message.trim()) return

        setSubmitting(true)
        setError(null)
        try {
            await feedbackService.submit({ category, message: message.trim() })
            setSubmitted(true)
            setCategory(null)
            setMessage('')
        } catch (err) {
            setError(err.message || 'Failed to submit feedback')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <PageTitle title="Submit Feedback" />
            <Navbar title="Feedback" />

            <div className="max-w-2xl mx-auto px-4 py-8 pt-24">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--color-accent)/10 mb-4">
                        <MessageSquare className="w-7 h-7 text-(--color-accent)" />
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-(--color-text)">Submit Feedback</h1>
                    <p className="mt-2 text-sm text-(--color-text-secondary)">
                        Found a bug? Have an idea? We'd love to hear from you.
                    </p>
                </div>

                {!user ? (
                    <div className="py-16 text-center">
                        <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <h3 className="text-base font-heading font-bold text-white/60 mb-1">Log in to submit feedback</h3>
                        <p className="text-white/40 text-sm mb-5">You need to be logged in to send feedback.</p>
                        <button onClick={login}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                            style={{ backgroundColor: '#5865F2' }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                            </svg>
                            Login with Discord
                        </button>
                    </div>
                ) : submitted ? (
                    <div className="py-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                        <h3 className="text-lg font-heading font-bold text-(--color-text) mb-2">Thank you!</h3>
                        <p className="text-sm text-(--color-text-secondary) mb-6">Your feedback has been submitted successfully.</p>
                        <button
                            onClick={() => setSubmitted(false)}
                            className="px-5 py-2.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer"
                        >
                            Submit More Feedback
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Category selector */}
                        <div>
                            <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-3">
                                Category
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {CATEGORIES.map(cat => {
                                    const Icon = cat.icon
                                    const selected = category === cat.value
                                    return (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setCategory(cat.value)}
                                            className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer"
                                            style={{
                                                borderColor: selected ? cat.color : 'rgba(255,255,255,0.1)',
                                                background: selected ? cat.bg : 'rgba(0,0,0,0.2)',
                                            }}
                                        >
                                            <Icon className="w-5 h-5" style={{ color: selected ? cat.color : 'rgba(255,255,255,0.4)' }} />
                                            <span className="text-xs font-semibold" style={{ color: selected ? cat.color : 'rgba(255,255,255,0.6)' }}>
                                                {cat.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-2">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe your feedback..."
                                rows={6}
                                maxLength={5000}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-(--color-text) text-sm placeholder:text-white/20 focus:outline-none focus:border-(--color-accent)/50 resize-y"
                            />
                            <div className="text-right text-xs text-(--color-text-secondary) mt-1">
                                {message.length} / 5000
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!category || !message.trim() || submitting}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Send className="w-4 h-4" />
                            {submitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </form>
                )}
            </div>
        </>
    )
}
