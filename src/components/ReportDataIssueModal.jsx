import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAuthHeaders } from '../services/adminApi'
import { X, Flag, ChevronLeft, Send, AlertTriangle, CheckCircle } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

const CATEGORIES = [
    { key: 'wrong_score', label: 'Wrong Score', desc: 'The match or game score is incorrect', placeholder: 'Which game has the wrong score? What should it be?' },
    { key: 'wrong_stats', label: 'Wrong Player Stats', desc: 'Kills, deaths, assists, damage, or mitigated values are wrong', placeholder: 'Which player and stat is wrong? What is the correct value?' },
    { key: 'wrong_god', label: 'Wrong God', desc: "A player's god is listed incorrectly", placeholder: 'Which player has the wrong god? What god did they actually play?' },
    { key: 'missing_data', label: 'Missing Data', desc: 'Player stats or game data is missing', placeholder: 'What data is missing? Which game or player is affected?' },
    { key: 'other', label: 'Other Issue', desc: 'Something else is wrong with this match data', placeholder: 'Describe what is wrong with this match data.' },
]

const MIN_CHARS = 20

export default function ReportDataIssueModal() {
    const { user } = useAuth()
    const [open, setOpen] = useState(false)
    const [matchContext, setMatchContext] = useState(null)
    const [step, setStep] = useState(1)
    const [category, setCategory] = useState(null)
    const [details, setDetails] = useState('')
    const [eligibility, setEligibility] = useState(null)
    const [eligLoading, setEligLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const modalRef = useRef(null)

    // Listen for open event
    useEffect(() => {
        const handler = (e) => {
            setMatchContext(e.detail)
            setStep(1)
            setCategory(null)
            setDetails('')
            setResult(null)
            setEligibility(null)
            setOpen(true)
        }
        window.addEventListener('open-report-modal', handler)
        return () => window.removeEventListener('open-report-modal', handler)
    }, [])

    // Check eligibility on open
    useEffect(() => {
        if (!open || !matchContext?.matchId || !user) return

        const checkEligibility = async () => {
            setEligLoading(true)
            try {
                const res = await fetch(
                    `${API}/data-reports?check=true&match_id=${matchContext.matchId}`,
                    { headers: getAuthHeaders() },
                )
                if (res.ok) {
                    setEligibility(await res.json())
                } else {
                    setEligibility({ canReport: false, error: 'Failed to check eligibility' })
                }
            } catch {
                setEligibility({ canReport: false, error: 'Network error' })
            } finally {
                setEligLoading(false)
            }
        }
        checkEligibility()
    }, [open, matchContext, user])

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    // Close on escape
    useEffect(() => {
        if (!open) return
        const handle = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', handle)
        return () => document.removeEventListener('keydown', handle)
    }, [open])

    const handleSubmit = async () => {
        if (!category || details.trim().length < MIN_CHARS || submitting) return
        setSubmitting(true)
        setResult(null)

        try {
            const res = await fetch(`${API}/data-reports`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'submit',
                    match_id: matchContext.matchId,
                    category,
                    details: details.trim(),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setResult({ error: data.error || 'Failed to submit report' })
            } else {
                setResult({ success: true })
                setStep(3)
            }
        } catch (err) {
            setResult({ error: err.message })
        } finally {
            setSubmitting(false)
        }
    }

    if (!open || !user) return null

    const selectedCat = CATEGORIES.find(c => c.key === category)
    const charCount = details.trim().length
    const canSubmit = category && charCount >= MIN_CHARS && !submitting

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div ref={modalRef} className="w-full max-w-lg bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Flag className="w-5 h-5 text-orange-400" />
                        <h2 className="font-heading text-lg font-bold text-(--color-text)">Report Data Issue</h2>
                    </div>
                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                        <X className="w-5 h-5 text-(--color-text-secondary)" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Loading eligibility */}
                    {eligLoading && (
                        <div className="py-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent) mx-auto mb-3" />
                            <p className="text-sm text-(--color-text-secondary)">Checking eligibility...</p>
                        </div>
                    )}

                    {/* Not eligible */}
                    {!eligLoading && eligibility && !eligibility.canReport && (
                        <div className="py-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-6 h-6 text-orange-400" />
                            </div>
                            {eligibility.matchCooldown ? (
                                <>
                                    <h3 className="font-heading text-base font-bold text-(--color-text) mb-2">Already Reported</h3>
                                    <p className="text-sm text-(--color-text-secondary) mb-4">
                                        You already reported this match in the last 24 hours. Please check back later.
                                    </p>
                                </>
                            ) : eligibility.dailyRemaining === 0 ? (
                                <>
                                    <h3 className="font-heading text-base font-bold text-(--color-text) mb-2">Daily Limit Reached</h3>
                                    <p className="text-sm text-(--color-text-secondary) mb-4">
                                        You've used all 5 daily reports. Try again tomorrow.
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-(--color-text-secondary) mb-4">
                                    {eligibility.error || 'Unable to submit reports right now.'}
                                </p>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="px-5 py-2 rounded-lg bg-white/10 text-(--color-text) font-semibold text-sm hover:bg-white/15 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {/* Step 1: Category */}
                    {!eligLoading && eligibility?.canReport && step === 1 && (
                        <>
                            <p className="text-sm text-(--color-text-secondary) mb-1">
                                {matchContext?.team1Name} vs {matchContext?.team2Name}
                            </p>
                            <p className="text-xs text-(--color-text-secondary)/60 mb-4">
                                What type of issue did you find?
                            </p>

                            <div className="space-y-2 mb-5">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.key}
                                        onClick={() => setCategory(cat.key)}
                                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all cursor-pointer ${
                                            category === cat.key
                                                ? 'border-orange-400/50 bg-orange-400/10'
                                                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className={`text-sm font-medium ${category === cat.key ? 'text-orange-400' : 'text-(--color-text)'}`}>
                                            {cat.label}
                                        </div>
                                        <div className="text-xs text-(--color-text-secondary) mt-0.5">{cat.desc}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-xs text-(--color-text-secondary)/50">
                                    {eligibility.dailyRemaining} report{eligibility.dailyRemaining !== 1 ? 's' : ''} remaining today
                                </span>
                                <button
                                    onClick={() => { setStep(2); setDetails('') }}
                                    disabled={!category}
                                    className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 2: Details */}
                    {!eligLoading && eligibility?.canReport && step === 2 && (
                        <>
                            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="text-xs text-(--color-text-secondary)/60 mb-0.5">Reporting</div>
                                <div className="text-sm text-(--color-text)">
                                    {matchContext?.team1Name} vs {matchContext?.team2Name}
                                    <span className="text-(--color-text-secondary) ml-1.5">#{matchContext?.matchId}</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-400/10 text-orange-400">
                                        {selectedCat?.label}
                                    </span>
                                </div>
                            </div>

                            {result?.error && (
                                <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-sm text-red-400">
                                    {result.error}
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-(--color-text-secondary) mb-1.5 uppercase tracking-wider">
                                    Details
                                </label>
                                <textarea
                                    value={details}
                                    onChange={e => setDetails(e.target.value)}
                                    placeholder={selectedCat?.placeholder}
                                    rows={4}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-orange-400/50 resize-none"
                                    autoFocus
                                />
                                <div className={`text-xs mt-1 text-right ${charCount >= MIN_CHARS ? 'text-(--color-text-secondary)/50' : 'text-orange-400/70'}`}>
                                    {charCount}/{MIN_CHARS} min characters
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => { setStep(1); setResult(null) }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Send className="w-4 h-4" />
                                    {submitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && result?.success && (
                        <div className="py-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="font-heading text-lg font-bold text-(--color-text) mb-2">Report Submitted</h3>
                            <p className="text-sm text-(--color-text-secondary) mb-4">
                                Your report has been received and will be reviewed by an admin. Thank you for helping improve data accuracy.
                            </p>
                            <button
                                onClick={() => setOpen(false)}
                                className="px-5 py-2 rounded-lg bg-(--color-accent) text-(--color-primary) font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
