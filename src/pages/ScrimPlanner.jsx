import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { scrimService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import TeamLogo from '../components/TeamLogo'
import {
    Swords, Clock, Shield, MessageSquare, Search,
    Plus, X, Check, ChevronDown, Send, Users, Trophy,
    Calendar, Filter, Loader2, AlertCircle, Target,
} from 'lucide-react'

const PICK_MODES = [
    { value: 'regular', label: 'Regular' },
    { value: 'fearless', label: 'Fearless' },
    { value: 'fearless_picks', label: 'Fearless Picks' },
    { value: 'fearless_bans', label: 'Fearless Bans' },
]

const PICK_MODE_COLORS = {
    regular: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    fearless: 'bg-red-500/20 text-red-400 border-red-500/30',
    fearless_picks: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    fearless_bans: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

function formatPickMode(mode) {
    return PICK_MODES.find(m => m.value === mode)?.label || mode
}

function formatDateEST(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }) + ' EST'
}

function formatRelativeDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date - now
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > 1) return `in ${diffDays} days`
    if (diffDays === 1) return 'tomorrow'
    if (diffHours > 1) return `in ${diffHours} hours`
    if (diffHours === 1) return 'in 1 hour'
    return 'soon'
}


// ═══════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════
export default function ScrimPlanner() {
    const { user, login } = useAuth()
    const [activeTab, setActiveTab] = useState('open')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Open scrims state
    const [openScrims, setOpenScrims] = useState([])
    const [leagueFilter, setLeagueFilter] = useState('')
    const [tierFilter, setTierFilter] = useState('')

    // My scrims state
    const [myScrims, setMyScrims] = useState([])
    const [captainTeams, setCaptainTeams] = useState([])
    const [incomingScrims, setIncomingScrims] = useState([])

    // Post scrim state
    const [postForm, setPostForm] = useState({
        team_id: '',
        scheduled_date: '',
        pick_mode: 'regular',
        banned_content_league: '',
        notes: '',
        challenged_team_id: '',
    })
    const [posting, setPosting] = useState(false)
    const [postError, setPostError] = useState(null)
    const [postSuccess, setPostSuccess] = useState(false)

    // All teams (for challenge picker)
    const [allTeams, setAllTeams] = useState([])
    const [teamSearch, setTeamSearch] = useState('')
    const [showTeamPicker, setShowTeamPicker] = useState(false)

    // Action loading
    const [actionLoading, setActionLoading] = useState(null)

    const isCaptain = captainTeams.length > 0

    const TABS = [
        { key: 'open', label: 'Open Scrims', icon: Swords },
        ...(user ? [{ key: 'my', label: 'My Scrims', icon: Users }] : []),
        ...(isCaptain ? [{ key: 'post', label: 'Post Scrim', icon: Plus }] : []),
    ]

    // Load open scrims
    const loadOpenScrims = useCallback(async () => {
        try {
            const filters = {}
            if (leagueFilter) filters.league_id = leagueFilter
            if (tierFilter) filters.division_tier = tierFilter
            const data = await scrimService.list(filters)
            setOpenScrims(data.scrims || [])
        } catch (err) {
            console.error('Failed to load scrims:', err)
        }
    }, [leagueFilter, tierFilter])

    // Load my scrims + captain teams
    const loadMyScrims = useCallback(async () => {
        if (!user) return
        try {
            const [myData, incomingData] = await Promise.all([
                scrimService.getMyScrims(),
                scrimService.getIncoming(),
            ])
            setMyScrims(myData.scrims || [])
            setCaptainTeams(myData.captainTeams || [])
            setIncomingScrims(incomingData.scrims || [])
        } catch (err) {
            console.error('Failed to load my scrims:', err)
        }
    }, [user])

    // Initial load
    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                await loadOpenScrims()
                if (user) {
                    await loadMyScrims()
                }
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    // Reload open scrims when filters change
    useEffect(() => {
        if (!loading) loadOpenScrims()
    }, [leagueFilter, tierFilter]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load all teams when switching to post tab
    useEffect(() => {
        if (activeTab === 'post' && allTeams.length === 0) {
            scrimService.getAllActiveTeams().then(data => {
                setAllTeams(data.teams || [])
            }).catch(err => console.error('Failed to load teams:', err))
        }
    }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-select first captain team
    useEffect(() => {
        if (captainTeams.length > 0 && !postForm.team_id) {
            setPostForm(prev => ({ ...prev, team_id: captainTeams[0].teamId }))
        }
    }, [captainTeams]) // eslint-disable-line react-hooks/exhaustive-deps

    // Handlers
    const handlePost = async (e) => {
        e.preventDefault()
        setPosting(true)
        setPostError(null)
        setPostSuccess(false)

        try {
            await scrimService.create({
                team_id: Number(postForm.team_id),
                scheduled_date: new Date(postForm.scheduled_date).toISOString(),
                pick_mode: postForm.pick_mode,
                banned_content_league: postForm.banned_content_league || null,
                notes: postForm.notes || null,
                challenged_team_id: postForm.challenged_team_id ? Number(postForm.challenged_team_id) : null,
            })
            setPostSuccess(true)
            setPostForm(prev => ({
                ...prev,
                scheduled_date: '',
                banned_content_league: '',
                notes: '',
                challenged_team_id: '',
            }))
            setTeamSearch('')
            // Refresh data
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) {
            setPostError(err.message || 'Failed to post scrim')
        } finally {
            setPosting(false)
        }
    }

    const handleAccept = async (scrimId, teamId) => {
        setActionLoading(scrimId)
        try {
            await scrimService.accept({ scrim_id: scrimId, team_id: teamId })
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) {
            alert(err.message || 'Failed to accept scrim')
        } finally {
            setActionLoading(null)
        }
    }

    const handleCancel = async (scrimId) => {
        setActionLoading(scrimId)
        try {
            await scrimService.cancel(scrimId)
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) {
            alert(err.message || 'Failed to cancel scrim')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDecline = async (scrimId) => {
        setActionLoading(scrimId)
        try {
            await scrimService.decline(scrimId)
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) {
            alert(err.message || 'Failed to decline challenge')
        } finally {
            setActionLoading(null)
        }
    }

    // Get unique leagues/tiers from open scrims for filter dropdowns
    const uniqueLeagues = [...new Map(openScrims.map(s => [s.leagueSlug, { slug: s.leagueSlug, name: s.leagueName }])).values()]
    const uniqueTiers = [...new Set(openScrims.map(s => s.divisionTier).filter(Boolean))].sort((a, b) => a - b)

    // Selected captain team info
    const selectedTeam = captainTeams.find(t => t.teamId === Number(postForm.team_id))

    // Filter challenge teams (exclude own captain teams)
    const captainTeamIds = new Set(captainTeams.map(t => t.teamId))
    const filteredChallengeTeams = allTeams.filter(t =>
        !captainTeamIds.has(t.id) &&
        (teamSearch === '' ||
            t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
            t.leagueName.toLowerCase().includes(teamSearch.toLowerCase()) ||
            t.divisionName.toLowerCase().includes(teamSearch.toLowerCase()))
    )

    // Accept team selection - for open scrims, need to pick which captain team accepts
    const [acceptModal, setAcceptModal] = useState(null)

    return (
        <>
            <PageTitle title="Scrim Planner" description="Find and schedule scrimmage matches. Post open requests or challenge teams directly." />
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Swords className="text-amber-400" size={28} />
                        <h1 className="text-3xl font-bold text-(--color-text)">Scrim Planner</h1>
                    </div>
                    <p className="text-(--color-text-secondary) text-sm">
                        Find scrimmage partners or challenge teams directly. Only team captains can post and accept scrims.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex justify-center gap-1 mb-6">
                    {TABS.map(tab => (
                        <button key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.key
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'text-(--color-text-secondary)/60 hover:text-(--color-text) hover:bg-(--color-secondary)/30'
                            }`}>
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-amber-400" size={32} />
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="text-center py-10">
                        <AlertCircle className="mx-auto text-red-400 mb-2" size={32} />
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {activeTab === 'open' && (
                            <OpenScrimsTab
                                scrims={openScrims}
                                user={user}
                                captainTeams={captainTeams}
                                leagueFilter={leagueFilter}
                                setLeagueFilter={setLeagueFilter}
                                tierFilter={tierFilter}
                                setTierFilter={setTierFilter}
                                uniqueLeagues={uniqueLeagues}
                                uniqueTiers={uniqueTiers}
                                onAccept={handleAccept}
                                actionLoading={actionLoading}
                                login={login}
                                acceptModal={acceptModal}
                                setAcceptModal={setAcceptModal}
                            />
                        )}

                        {activeTab === 'my' && user && (
                            <MyScrimsTab
                                scrims={myScrims}
                                incomingScrims={incomingScrims}
                                captainTeams={captainTeams}
                                onAccept={handleAccept}
                                onCancel={handleCancel}
                                onDecline={handleDecline}
                                actionLoading={actionLoading}
                                acceptModal={acceptModal}
                                setAcceptModal={setAcceptModal}
                            />
                        )}

                        {activeTab === 'post' && isCaptain && (
                            <PostScrimTab
                                form={postForm}
                                setForm={setPostForm}
                                captainTeams={captainTeams}
                                selectedTeam={selectedTeam}
                                onSubmit={handlePost}
                                posting={posting}
                                postError={postError}
                                postSuccess={postSuccess}
                                teamSearch={teamSearch}
                                setTeamSearch={setTeamSearch}
                                showTeamPicker={showTeamPicker}
                                setShowTeamPicker={setShowTeamPicker}
                                filteredChallengeTeams={filteredChallengeTeams}
                                allTeams={allTeams}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Login prompt for non-authed users */}
            {!user && !loading && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-(--color-secondary) border border-(--color-border) rounded-lg px-6 py-3 shadow-xl flex items-center gap-3">
                    <span className="text-(--color-text-secondary) text-sm">Log in to post or accept scrims</span>
                    <button onClick={login} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-medium transition-colors">
                        Log In
                    </button>
                </div>
            )}
        </>
    )
}


// ═══════════════════════════════════════════════════
// Scrim Card component
// ═══════════════════════════════════════════════════
function ScrimCard({ scrim, showActions, captainTeams, onAccept, onCancel, onDecline, actionLoading, acceptModal, setAcceptModal, isChallenge }) {
    const isLoading = actionLoading === scrim.id

    // For accept, need to pick which captain team
    const handleAcceptClick = () => {
        if (captainTeams.length === 1) {
            onAccept(scrim.id, captainTeams[0].teamId)
        } else {
            setAcceptModal(scrim.id)
        }
    }

    const canAccept = captainTeams.length > 0 && captainTeams.some(t => t.teamId !== scrim.teamId)
    const isOwnScrim = captainTeams.some(t => t.teamId === scrim.teamId)

    return (
        <div className="bg-(--color-secondary) border border-(--color-border) rounded-lg p-4 hover:border-amber-500/30 transition-colors">
            <div className="flex items-start gap-4">
                {/* Team logo + info */}
                <div className="flex-shrink-0">
                    <TeamLogo slug={scrim.teamSlug} name={scrim.teamName} size={48} />
                </div>

                <div className="flex-1 min-w-0">
                    {/* Team name + league/division */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-(--color-text) truncate">{scrim.teamName}</h3>
                        <span className="text-xs text-(--color-text-secondary)">
                            {scrim.leagueName} &middot; {scrim.divisionName}
                        </span>
                    </div>

                    {/* Date & time */}
                    <div className="flex items-center gap-1.5 text-sm text-(--color-text-secondary) mb-2">
                        <Clock size={14} />
                        <span>{formatDateEST(scrim.scheduledDate)}</span>
                        <span className="text-xs text-(--color-text-secondary)/50">({formatRelativeDate(scrim.scheduledDate)})</span>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        {/* Pick mode badge */}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${PICK_MODE_COLORS[scrim.pickMode] || PICK_MODE_COLORS.regular}`}>
                            {formatPickMode(scrim.pickMode)}
                        </span>

                        {/* Division tier badge */}
                        {scrim.divisionName && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {scrim.divisionName}
                            </span>
                        )}

                        {/* Banned content */}
                        {scrim.bannedContentLeague && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                <Shield size={10} />
                                {scrim.bannedContentLeague}
                            </span>
                        )}

                        {/* Challenge indicator */}
                        {isChallenge && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Target size={10} />
                                Challenge
                            </span>
                        )}
                    </div>

                    {/* Notes */}
                    {scrim.notes && (
                        <div className="flex items-start gap-1.5 text-sm text-(--color-text-secondary)/80 mb-2">
                            <MessageSquare size={14} className="mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{scrim.notes}</span>
                        </div>
                    )}

                    {/* Challenge target */}
                    {scrim.challengedTeamName && (
                        <div className="flex items-center gap-2 text-sm text-purple-400 mb-2">
                            <Target size={14} />
                            <span>Challenging: </span>
                            <TeamLogo slug={scrim.challengedTeamSlug} name={scrim.challengedTeamName} size={20} />
                            <span className="font-medium">{scrim.challengedTeamName}</span>
                        </div>
                    )}

                    {/* Accepted team info */}
                    {scrim.status === 'accepted' && scrim.acceptedTeamName && (
                        <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                            <Check size={14} />
                            <span>Accepted by: </span>
                            <TeamLogo slug={scrim.acceptedTeamSlug} name={scrim.acceptedTeamName} size={20} />
                            <span className="font-medium">{scrim.acceptedTeamName}</span>
                        </div>
                    )}

                    {/* Posted by */}
                    <div className="text-xs text-(--color-text-secondary)/40">
                        Posted by {scrim.postedBy}
                    </div>
                </div>

                {/* Actions */}
                {showActions && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        {/* Accept button (for other captains on open scrims) */}
                        {scrim.status === 'open' && canAccept && !isOwnScrim && (
                            <>
                                <button
                                    onClick={handleAcceptClick}
                                    disabled={isLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    Accept
                                </button>
                                {/* Accept team picker modal */}
                                {acceptModal === scrim.id && captainTeams.length > 1 && (
                                    <div className="bg-(--color-primary) border border-(--color-border) rounded-lg p-2 shadow-xl">
                                        <p className="text-xs text-(--color-text-secondary) mb-1">Accept as:</p>
                                        {captainTeams.filter(t => t.teamId !== scrim.teamId).map(t => (
                                            <button key={t.teamId}
                                                onClick={() => { onAccept(scrim.id, t.teamId); setAcceptModal(null) }}
                                                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-(--color-secondary) text-sm text-(--color-text)"
                                            >
                                                <TeamLogo slug={t.teamSlug} name={t.teamName} size={16} />
                                                {t.teamName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Decline button (for challenges) */}
                        {scrim.status === 'open' && isChallenge && (
                            <button
                                onClick={() => onDecline(scrim.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                Decline
                            </button>
                        )}

                        {/* Cancel button (for own scrims) */}
                        {scrim.status === 'open' && isOwnScrim && (
                            <button
                                onClick={() => onCancel(scrim.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                Cancel
                            </button>
                        )}

                        {/* Status badges */}
                        {scrim.status === 'accepted' && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30 text-center">
                                Accepted
                            </span>
                        )}
                        {scrim.status === 'cancelled' && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30 text-center">
                                Cancelled
                            </span>
                        )}
                        {scrim.status === 'expired' && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-gray-500/20 text-gray-400 border border-gray-500/30 text-center">
                                Expired
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Open Scrims Tab
// ═══════════════════════════════════════════════════
function OpenScrimsTab({ scrims, user, captainTeams, leagueFilter, setLeagueFilter, tierFilter, setTierFilter, uniqueLeagues, uniqueTiers, onAccept, actionLoading, login, acceptModal, setAcceptModal }) {
    return (
        <div>
            {/* Filters */}
            {scrims.length > 0 && (
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <Filter size={16} className="text-(--color-text-secondary)" />

                    <select
                        value={leagueFilter}
                        onChange={e => setLeagueFilter(e.target.value)}
                        className="bg-(--color-secondary) border border-(--color-border) rounded-lg px-3 py-1.5 text-sm text-(--color-text) focus:outline-none focus:border-amber-500/50"
                    >
                        <option value="">All Leagues</option>
                        {uniqueLeagues.map(l => (
                            <option key={l.slug} value={l.slug}>{l.name}</option>
                        ))}
                    </select>

                    <select
                        value={tierFilter}
                        onChange={e => setTierFilter(e.target.value)}
                        className="bg-(--color-secondary) border border-(--color-border) rounded-lg px-3 py-1.5 text-sm text-(--color-text) focus:outline-none focus:border-amber-500/50"
                    >
                        <option value="">All Tiers</option>
                        {uniqueTiers.map(t => (
                            <option key={t} value={t}>Tier {t}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Scrim list */}
            <div className="space-y-3">
                {scrims.map(scrim => (
                    <ScrimCard
                        key={scrim.id}
                        scrim={scrim}
                        showActions={!!user}
                        captainTeams={captainTeams}
                        onAccept={onAccept}
                        onCancel={() => {}}
                        onDecline={() => {}}
                        actionLoading={actionLoading}
                        acceptModal={acceptModal}
                        setAcceptModal={setAcceptModal}
                        isChallenge={false}
                    />
                ))}
            </div>

            {/* Empty state */}
            {scrims.length === 0 && (
                <div className="text-center py-16">
                    <Swords className="mx-auto text-(--color-text-secondary)/30 mb-3" size={48} />
                    <h3 className="text-lg font-medium text-(--color-text) mb-1">No open scrims right now</h3>
                    <p className="text-(--color-text-secondary) text-sm">
                        {user ? 'Be the first to post a scrim request!' : 'Check back later or log in to post one.'}
                    </p>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// My Scrims Tab
// ═══════════════════════════════════════════════════
function MyScrimsTab({ scrims, incomingScrims, captainTeams, onAccept, onCancel, onDecline, actionLoading, acceptModal, setAcceptModal }) {
    const openScrims = scrims.filter(s => s.status === 'open' && !incomingScrims.some(i => i.id === s.id))
    const acceptedScrims = scrims.filter(s => s.status === 'accepted')
    const pastScrims = scrims.filter(s => s.status === 'cancelled' || s.status === 'expired')

    return (
        <div className="space-y-8">
            {/* Incoming Challenges */}
            {incomingScrims.length > 0 && (
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-purple-400 mb-3">
                        <Target size={20} />
                        Incoming Challenges ({incomingScrims.length})
                    </h2>
                    <div className="space-y-3">
                        {incomingScrims.map(scrim => (
                            <ScrimCard
                                key={scrim.id}
                                scrim={scrim}
                                showActions={true}
                                captainTeams={captainTeams}
                                onAccept={onAccept}
                                onCancel={onCancel}
                                onDecline={onDecline}
                                actionLoading={actionLoading}
                                acceptModal={acceptModal}
                                setAcceptModal={setAcceptModal}
                                isChallenge={true}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Open Requests */}
            {openScrims.length > 0 && (
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-400 mb-3">
                        <Swords size={20} />
                        Your Open Requests ({openScrims.length})
                    </h2>
                    <div className="space-y-3">
                        {openScrims.map(scrim => (
                            <ScrimCard
                                key={scrim.id}
                                scrim={scrim}
                                showActions={true}
                                captainTeams={captainTeams}
                                onAccept={onAccept}
                                onCancel={onCancel}
                                onDecline={onDecline}
                                actionLoading={actionLoading}
                                acceptModal={acceptModal}
                                setAcceptModal={setAcceptModal}
                                isChallenge={!!scrim.challengedTeamId}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Accepted */}
            {acceptedScrims.length > 0 && (
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-green-400 mb-3">
                        <Check size={20} />
                        Confirmed Scrims ({acceptedScrims.length})
                    </h2>
                    <div className="space-y-3">
                        {acceptedScrims.map(scrim => (
                            <ScrimCard
                                key={scrim.id}
                                scrim={scrim}
                                showActions={true}
                                captainTeams={captainTeams}
                                onAccept={onAccept}
                                onCancel={onCancel}
                                onDecline={onDecline}
                                actionLoading={actionLoading}
                                acceptModal={acceptModal}
                                setAcceptModal={setAcceptModal}
                                isChallenge={false}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Past */}
            {pastScrims.length > 0 && (
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-(--color-text-secondary) mb-3">
                        <Clock size={20} />
                        Past Scrims ({pastScrims.length})
                    </h2>
                    <div className="space-y-3 opacity-60">
                        {pastScrims.map(scrim => (
                            <ScrimCard
                                key={scrim.id}
                                scrim={scrim}
                                showActions={true}
                                captainTeams={captainTeams}
                                onAccept={onAccept}
                                onCancel={onCancel}
                                onDecline={onDecline}
                                actionLoading={actionLoading}
                                acceptModal={acceptModal}
                                setAcceptModal={setAcceptModal}
                                isChallenge={false}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {scrims.length === 0 && incomingScrims.length === 0 && (
                <div className="text-center py-16">
                    <Users className="mx-auto text-(--color-text-secondary)/30 mb-3" size={48} />
                    <h3 className="text-lg font-medium text-(--color-text) mb-1">No scrims yet</h3>
                    <p className="text-(--color-text-secondary) text-sm">
                        {captainTeams.length > 0 ? 'Post a scrim request or accept one from the Open Scrims tab.' : 'You need to be a team captain to manage scrims.'}
                    </p>
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// Post Scrim Tab
// ═══════════════════════════════════════════════════
function PostScrimTab({ form, setForm, captainTeams, selectedTeam, onSubmit, posting, postError, postSuccess, teamSearch, setTeamSearch, showTeamPicker, setShowTeamPicker, filteredChallengeTeams, allTeams }) {
    const challengedTeam = allTeams.find(t => t.id === Number(form.challenged_team_id))

    return (
        <div className="max-w-xl mx-auto">
            <form onSubmit={onSubmit} className="space-y-5">
                {/* Team selector */}
                <div>
                    <label className="block text-sm font-medium text-(--color-text) mb-1.5">Your Team</label>
                    {captainTeams.length === 1 ? (
                        <div className="flex items-center gap-3 bg-(--color-secondary) border border-(--color-border) rounded-lg px-4 py-3">
                            <TeamLogo slug={captainTeams[0].teamSlug} name={captainTeams[0].teamName} size={32} />
                            <div>
                                <div className="font-medium text-(--color-text)">{captainTeams[0].teamName}</div>
                                <div className="text-xs text-(--color-text-secondary)">{captainTeams[0].leagueName} &middot; {captainTeams[0].divisionName}</div>
                            </div>
                        </div>
                    ) : (
                        <select
                            value={form.team_id}
                            onChange={e => setForm({ ...form, team_id: e.target.value })}
                            className="w-full bg-(--color-secondary) border border-(--color-border) rounded-lg px-4 py-2.5 text-(--color-text) focus:outline-none focus:border-amber-500/50"
                        >
                            {captainTeams.map(t => (
                                <option key={t.teamId} value={t.teamId}>
                                    {t.teamName} ({t.leagueName} - {t.divisionName})
                                </option>
                            ))}
                        </select>
                    )}
                    {selectedTeam && (
                        <div className="mt-1 text-xs text-amber-400">
                            Division: {selectedTeam.divisionName}
                        </div>
                    )}
                </div>

                {/* Date & Time */}
                <div>
                    <label className="block text-sm font-medium text-(--color-text) mb-1.5">
                        <Calendar size={14} className="inline mr-1" />
                        Date & Time (EST)
                    </label>
                    <input
                        type="datetime-local"
                        value={form.scheduled_date}
                        onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                        required
                        className="w-full bg-(--color-secondary) border border-(--color-border) rounded-lg px-4 py-2.5 text-(--color-text) focus:outline-none focus:border-amber-500/50"
                    />
                    <p className="text-xs text-(--color-text-secondary) mt-1">All times are in Eastern Standard Time (EST)</p>
                </div>

                {/* Pick Mode */}
                <div>
                    <label className="block text-sm font-medium text-(--color-text) mb-1.5">Pick Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                        {PICK_MODES.map(mode => (
                            <button
                                key={mode.value}
                                type="button"
                                onClick={() => setForm({ ...form, pick_mode: mode.value })}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                                    form.pick_mode === mode.value
                                        ? PICK_MODE_COLORS[mode.value]
                                        : 'bg-(--color-secondary) border-(--color-border) text-(--color-text-secondary) hover:border-(--color-text-secondary)'
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Banned Content */}
                <div>
                    <label className="block text-sm font-medium text-(--color-text) mb-1.5">
                        <Shield size={14} className="inline mr-1" />
                        Banned Content
                    </label>
                    <input
                        type="text"
                        value={form.banned_content_league}
                        onChange={e => setForm({ ...form, banned_content_league: e.target.value })}
                        placeholder="e.g., AGL Deity bans, No bans, Custom ban list..."
                        className="w-full bg-(--color-secondary) border border-(--color-border) rounded-lg px-4 py-2.5 text-(--color-text) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:border-amber-500/50"
                    />
                </div>

                {/* Challenge Team (optional) */}
                <div>
                    <label className="block text-sm font-medium text-(--color-text) mb-1.5">
                        <Target size={14} className="inline mr-1" />
                        Challenge a Team (optional)
                    </label>
                    <p className="text-xs text-(--color-text-secondary) mb-2">
                        Leave empty to post an open scrim request visible to all teams.
                    </p>

                    {challengedTeam ? (
                        <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-lg px-4 py-3">
                            <TeamLogo slug={challengedTeam.slug} name={challengedTeam.name} size={28} />
                            <div className="flex-1">
                                <div className="font-medium text-purple-400">{challengedTeam.name}</div>
                                <div className="text-xs text-(--color-text-secondary)">{challengedTeam.leagueName} &middot; {challengedTeam.divisionName}</div>
                            </div>
                            <button type="button" onClick={() => { setForm({ ...form, challenged_team_id: '' }); setTeamSearch('') }}
                                className="text-(--color-text-secondary) hover:text-red-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex items-center gap-2 bg-(--color-secondary) border border-(--color-border) rounded-lg px-4 py-2.5">
                                <Search size={16} className="text-(--color-text-secondary)" />
                                <input
                                    type="text"
                                    value={teamSearch}
                                    onChange={e => { setTeamSearch(e.target.value); setShowTeamPicker(true) }}
                                    onFocus={() => setShowTeamPicker(true)}
                                    placeholder="Search for a team to challenge..."
                                    className="flex-1 bg-transparent text-(--color-text) placeholder:text-(--color-text-secondary)/40 focus:outline-none"
                                />
                            </div>

                            {showTeamPicker && teamSearch && (
                                <div className="absolute z-10 w-full mt-1 bg-(--color-primary) border border-(--color-border) rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {filteredChallengeTeams.slice(0, 20).map(team => (
                                        <button key={team.id} type="button"
                                            onClick={() => {
                                                setForm({ ...form, challenged_team_id: String(team.id) })
                                                setShowTeamPicker(false)
                                                setTeamSearch('')
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-(--color-secondary) transition-colors text-left"
                                        >
                                            <TeamLogo slug={team.slug} name={team.name} size={24} />
                                            <div>
                                                <div className="text-sm font-medium text-(--color-text)">{team.name}</div>
                                                <div className="text-xs text-(--color-text-secondary)">{team.leagueName} &middot; {team.divisionName}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredChallengeTeams.length === 0 && (
                                        <div className="px-4 py-3 text-sm text-(--color-text-secondary)">No teams found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-(--color-text) mb-1.5">
                        <MessageSquare size={14} className="inline mr-1" />
                        Notes (optional)
                    </label>
                    <textarea
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Any additional details, contact info, or requirements..."
                        rows={3}
                        maxLength={500}
                        className="w-full bg-(--color-secondary) border border-(--color-border) rounded-lg px-4 py-2.5 text-(--color-text) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:border-amber-500/50 resize-none"
                    />
                </div>

                {/* Error / Success */}
                {postError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                        <AlertCircle size={16} />
                        {postError}
                    </div>
                )}
                {postSuccess && (
                    <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
                        <Check size={16} />
                        Scrim request posted successfully!
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={posting || !form.team_id || !form.scheduled_date}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {posting ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : form.challenged_team_id ? (
                        <Send size={18} />
                    ) : (
                        <Swords size={18} />
                    )}
                    {posting ? 'Posting...' : form.challenged_team_id ? 'Send Challenge' : 'Post Open Scrim'}
                </button>
            </form>
        </div>
    )
}
