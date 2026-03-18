import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { tournamentService } from '../services/database'
import { Calendar, Shield, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react'

function StatusBadge({ status }) {
    const config = {
        pending: { label: 'Pending Review', icon: Clock, cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        approved: { label: 'Approved', icon: CheckCircle, cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
        rejected: { label: 'Rejected', icon: XCircle, cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    }
    const c = config[status] || config.pending
    const Icon = c.icon
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${c.cls}`}>
            <Icon className="w-4 h-4" /> {c.label}
        </span>
    )
}

function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
}

export default function TournamentSignup() {
    const { slug } = useParams()
    const { user, login, loading: authLoading } = useAuth()

    const [tournament, setTournament] = useState(null)
    const [signup, setSignup] = useState(null)
    const [linkedPlayer, setLinkedPlayer] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [submitSuccess, setSubmitSuccess] = useState(false)

    // Form state
    const [smiteName, setSmiteName] = useState('')
    const [trackerUrl, setTrackerUrl] = useState('')
    const [nameChanged, setNameChanged] = useState(false)
    const [signupRole, setSignupRole] = useState('player')
    const [availableDraftDate, setAvailableDraftDate] = useState(false)
    const [availableGameDates, setAvailableGameDates] = useState([])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const t = await tournamentService.getBySlug(slug)
            setTournament(t)

            if (user) {
                const { signup: s, linkedPlayer: lp } = await tournamentService.getSignup(t.id)
                setSignup(s)
                setLinkedPlayer(lp)
                if (lp && !s) {
                    setSmiteName(lp.name || '')
                    setTrackerUrl(lp.tracker_url || '')
                }
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [slug, user])

    useEffect(() => { fetchData() }, [fetchData])

    const handleSmiteNameChange = (val) => {
        setSmiteName(val)
        setNameChanged(linkedPlayer ? val.toLowerCase() !== linkedPlayer.name.toLowerCase() : true)
    }

    const toggleGameDate = (date) => {
        setAvailableGameDates(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setSubmitError(null)
        try {
            await tournamentService.signup({
                tournamentId: tournament.id,
                smiteName,
                trackerUrl: nameChanged ? trackerUrl : undefined,
                signupRole,
                availableGameDates,
                availableDraftDate,
            })
            setSubmitSuccess(true)
            fetchData()
        } catch (err) {
            setSubmitError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading || authLoading) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
            </div>
        )
    }

    if (!tournament) return null

    const gameDates = tournament.game_dates || []

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-(--color-text) mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                    {tournament.name}
                </h1>
                <div className="flex items-center gap-2 text-(--color-text-secondary) text-sm">
                    {tournament.status === 'upcoming' && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">Upcoming</span>}
                    {tournament.status === 'in_progress' && <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium">In Progress</span>}
                    {tournament.status === 'completed' && <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 text-xs font-medium">Completed</span>}
                </div>
            </div>

            {/* Description / Marketing Copy */}
            {tournament.description && (
                <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-(--color-text) whitespace-pre-wrap leading-relaxed">{tournament.description}</div>
                </div>
            )}

            {/* Dates */}
            <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
                <h2 className="text-lg font-semibold text-(--color-text) mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-(--color-accent)" /> Tournament Dates
                </h2>
                {tournament.draft_date && (
                    <div className="mb-3">
                        <span className="text-(--color-text-secondary) text-sm">Draft Day (Captains Only):</span>
                        <div className="text-(--color-text) font-medium">{formatDate(tournament.draft_date)}</div>
                    </div>
                )}
                {gameDates.length > 0 && (
                    <div>
                        <span className="text-(--color-text-secondary) text-sm">Game Days:</span>
                        {gameDates.map(d => (
                            <div key={d} className="text-(--color-text) font-medium">{formatDate(d)}</div>
                        ))}
                    </div>
                )}
            </div>

            {/* Discord Requirement */}
            {tournament.discord_invite_url && (
                <div className="mb-8 p-4 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20">
                    <div className="flex items-center gap-3">
                        <div className="text-(--color-text) text-sm font-medium">You must join the SmiteComp Discord to participate</div>
                        <a
                            href={tournament.discord_invite_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752C4] transition-colors"
                        >
                            Join Discord <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            )}

            {/* Signup Section */}
            {!user ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-(--color-text-secondary) mb-4">You must be logged in to sign up for this tournament.</p>
                    <button onClick={login} className="px-6 py-2.5 rounded-lg bg-(--color-accent) text-black font-semibold hover:opacity-90 transition-opacity">
                        Log in with Discord
                    </button>
                </div>
            ) : signup || submitSuccess ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                    <h2 className="text-lg font-semibold text-(--color-text) mb-3">Your Signup</h2>
                    <div className="flex items-center gap-3 mb-2">
                        <StatusBadge status={signup?.status || 'pending'} />
                    </div>
                    {signup && (
                        <div className="mt-3 space-y-1 text-sm text-(--color-text-secondary)">
                            <div>Smite Name: <span className="text-(--color-text)">{signup.smite_name}</span></div>
                            <div>Role: <span className="text-(--color-text) capitalize">{signup.signup_role}</span></div>
                        </div>
                    )}
                </div>
            ) : !tournament.signups_open ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-(--color-text-secondary)">Signups are currently closed for this tournament.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-6">
                    <h2 className="text-lg font-semibold text-(--color-text)">Sign Up</h2>

                    {submitError && (
                        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{submitError}</div>
                    )}

                    {/* Smite Name */}
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Smite Name</label>
                        <input
                            type="text"
                            value={smiteName}
                            onChange={e => handleSmiteNameChange(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                            placeholder="Your SMITE 2 in-game name"
                        />
                        {linkedPlayer && !nameChanged && (
                            <p className="mt-1 text-xs text-green-400">Matched to existing player record</p>
                        )}
                    </div>

                    {/* Tracker URL — shown only if name changed or no linked player */}
                    {(nameChanged || !linkedPlayer) && (
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Tracker URL</label>
                            <input
                                type="url"
                                value={trackerUrl}
                                onChange={e => setTrackerUrl(e.target.value)}
                                required
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                                placeholder="https://www.smitetracker.com/profile/..."
                            />
                        </div>
                    )}

                    {/* Game Day Availability — all dates required */}
                    {gameDates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-2">Game Day Availability</label>
                            <p className="text-xs text-(--color-text-secondary) mb-2">You must be available for all game days to participate.</p>
                            <div className="space-y-2">
                                {gameDates.map(date => (
                                    <label key={date} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={availableGameDates.includes(date)}
                                            onChange={() => toggleGameDate(date)}
                                            className="w-4 h-4 rounded accent-(--color-accent)"
                                        />
                                        <span className="text-(--color-text) text-sm">{formatDate(date)}</span>
                                    </label>
                                ))}
                            </div>
                            {gameDates.length > 0 && availableGameDates.length < gameDates.length && (
                                <p className="mt-1.5 text-xs text-red-400">All game dates must be selected</p>
                            )}
                        </div>
                    )}

                    {/* Signup Role */}
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-2">Signing up as</label>
                        <div className="space-y-2">
                            {[
                                { value: 'player', label: 'Player', desc: 'Get drafted onto a team' },
                                { value: 'captain', label: 'Captain', desc: 'Draft and lead your own team' },
                                { value: 'both', label: 'Both', desc: 'Open to either role' },
                            ].map(opt => (
                                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    signupRole === opt.value
                                        ? 'bg-(--color-accent)/10 border-(--color-accent)/30'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}>
                                    <input
                                        type="radio"
                                        name="signupRole"
                                        value={opt.value}
                                        checked={signupRole === opt.value}
                                        onChange={() => {
                                            setSignupRole(opt.value)
                                            if (opt.value === 'player') setAvailableDraftDate(false)
                                        }}
                                        className="w-4 h-4 accent-(--color-accent)"
                                    />
                                    <div>
                                        <div className="text-(--color-text) text-sm font-medium flex items-center gap-1.5">
                                            {opt.value !== 'player' && <Shield className="w-4 h-4 text-(--color-accent)" />}
                                            {opt.label}
                                        </div>
                                        <div className="text-(--color-text-secondary) text-xs mt-0.5">{opt.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Draft Date Availability — shown if captain or both */}
                    {signupRole !== 'player' && tournament.draft_date && (
                        <div>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 cursor-pointer hover:bg-yellow-500/10 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={availableDraftDate}
                                    onChange={e => setAvailableDraftDate(e.target.checked)}
                                    required
                                    className="w-4 h-4 rounded accent-(--color-accent)"
                                />
                                <div>
                                    <div className="text-(--color-text) text-sm font-medium">Available for Draft Day</div>
                                    <div className="text-(--color-text-secondary) text-xs mt-0.5">{formatDate(tournament.draft_date)} — required for captains</div>
                                </div>
                            </label>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || availableGameDates.length < gameDates.length || (signupRole !== 'player' && !availableDraftDate)}
                        className="w-full py-3 rounded-lg bg-(--color-accent) text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                        {submitting ? 'Submitting...' : 'Sign Up'}
                    </button>
                </form>
            )}
        </div>
    )
}
