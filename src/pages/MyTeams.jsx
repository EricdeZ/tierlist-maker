import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { communityTeamService } from '../services/database'
import PageTitle from '../components/PageTitle'
import { Plus, Users, Search, User } from 'lucide-react'
import { RANK_LABELS, getDivisionImage } from '../utils/divisionImages'
import TeamCard from './myteams/TeamCard'
import InvitationsPanel from './myteams/InvitationsPanel'
import CreateTeamWizard from './myteams/CreateTeamWizard'

export default function MyTeams() {
    const { user, login } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()

    const [teams, setTeams] = useState([])
    const [pending, setPending] = useState({ invites: [], outgoingRequests: [], incomingRequests: [] })
    const [loading, setLoading] = useState(true)
    const [showWizard, setShowWizard] = useState(false)
    const [error, setError] = useState(null)

    // Browse state
    const [browseTeams, setBrowseTeams] = useState([])
    const [browseTier, setBrowseTier] = useState(null)
    const [browseLoading, setBrowseLoading] = useState(false)
    const [joinLoading, setJoinLoading] = useState(null)

    // Handle invite link joins
    useEffect(() => {
        const joinCode = searchParams.get('join')
        if (joinCode && user) {
            communityTeamService.joinLink(joinCode)
                .then(() => {
                    setSearchParams({}, { replace: true })
                    loadData()
                })
                .catch(err => setError(err.message))
        }
    }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    const loadData = async () => {
        if (!user) { setLoading(false); return }
        setLoading(true)
        try {
            const [teamsData, pendingData] = await Promise.all([
                communityTeamService.getMyTeams(),
                communityTeamService.getPending(),
            ])
            setTeams(teamsData.teams || [])
            setPending(pendingData)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    // Browse teams by tier
    useEffect(() => {
        if (!browseTier) { setBrowseTeams([]); return }
        setBrowseLoading(true)
        communityTeamService.browse(browseTier)
            .then(data => setBrowseTeams(data.teams || []))
            .catch(() => setBrowseTeams([]))
            .finally(() => setBrowseLoading(false))
    }, [browseTier])

    const handleRespond = async (invitationId, accept) => {
        await communityTeamService.respond(invitationId, accept)
        loadData()
    }

    const handleCancel = async (invitationId) => {
        await communityTeamService.respond(invitationId, false)
        loadData()
    }

    const handleLeave = async (team) => {
        if (!confirm(`Leave ${team.name}?`)) return
        try {
            await communityTeamService.leave(team.id)
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDisband = async (team) => {
        if (!confirm(`Disband ${team.name}? This cannot be undone.`)) return
        try {
            await communityTeamService.disband(team.id)
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleRequestJoin = async (teamId) => {
        setJoinLoading(teamId)
        try {
            await communityTeamService.requestJoin(teamId)
            loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setJoinLoading(null)
        }
    }

    // Login gate
    if (!user) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-16">
                <PageTitle title="My Teams" />
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-(--color-text-secondary)/40" />
                    </div>
                    <h1 className="text-2xl font-bold text-(--color-text) mb-2">Bring Your Own Team</h1>
                    <p className="text-sm text-(--color-text-secondary) mb-6">
                        Create your team, invite players, and find your competitive division.
                    </p>
                    <button
                        onClick={login}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                        </svg>
                        Login with Discord
                    </button>
                </div>
            </div>
        )
    }

    const hasCaptainTeam = teams.some(t => t.role === 'captain')
    const myTeamIds = new Set(teams.map(t => t.id))
    const browsableTeams = browseTeams.filter(t => !myTeamIds.has(t.id))

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <PageTitle title="My Teams" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-(--color-text)">My Teams</h1>
                    <p className="text-sm text-(--color-text-secondary) mt-0.5">Create, join, and manage your teams</p>
                </div>
                {!hasCaptainTeam && (
                    <button
                        onClick={() => setShowWizard(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary)] font-semibold hover:opacity-90 transition-colors cursor-pointer text-sm"
                    >
                        <Plus className="w-4 h-4" /> Create Team
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-sm text-red-400">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">dismiss</button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* My Teams Grid */}
                    {teams.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {teams.map(team => (
                                <TeamCard
                                    key={team.id}
                                    team={team}
                                    onLeave={handleLeave}
                                    onDisband={handleDisband}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 rounded-xl border border-white/5 bg-white/[0.01]">
                            <Users className="w-10 h-10 text-(--color-text-secondary)/30 mx-auto mb-3" />
                            <p className="text-sm text-(--color-text-secondary) mb-4">You haven't joined any teams yet.</p>
                            {!hasCaptainTeam && (
                                <button
                                    onClick={() => setShowWizard(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary)] font-semibold hover:opacity-90 transition-colors cursor-pointer text-sm"
                                >
                                    <Plus className="w-4 h-4" /> Create Your Team
                                </button>
                            )}
                        </div>
                    )}

                    {/* Pending Invitations/Requests */}
                    <InvitationsPanel
                        invites={pending.invites}
                        outgoingRequests={pending.outgoingRequests}
                        incomingRequests={pending.incomingRequests}
                        onRespond={handleRespond}
                        onCancel={handleCancel}
                    />

                    {/* Browse Teams */}
                    <div>
                        <h2 className="text-lg font-bold text-(--color-text) mb-3">Browse Teams</h2>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {[1, 2, 3, 4, 5].map(tier => {
                                const img = getDivisionImage(null, null, tier)
                                const selected = browseTier === tier
                                return (
                                    <button
                                        key={tier}
                                        onClick={() => setBrowseTier(selected ? null : tier)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                            selected
                                                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                                                : 'bg-white/5 text-(--color-text-secondary) border border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        {img && <img src={img} alt="" className="w-4 h-4" />}
                                        {RANK_LABELS[tier]}
                                    </button>
                                )
                            })}
                        </div>

                        {browseLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : browseTier && browsableTeams.length === 0 ? (
                            <div className="text-center py-8 text-sm text-(--color-text-secondary)">
                                No other teams at {RANK_LABELS[browseTier]} level yet.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {browsableTeams.map(team => (
                                    <div key={team.id} className="rounded-xl border border-white/10 bg-(--color-secondary) p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                            {team.logo_url ? (
                                                <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Users className="w-5 h-5 text-(--color-text-secondary)/40" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-(--color-text) truncate">{team.name}</div>
                                            <div className="text-[10px] text-(--color-text-secondary)">
                                                {team.member_count} member{team.member_count !== 1 ? 's' : ''} · by {team.owner_name}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRequestJoin(team.id)}
                                            disabled={joinLoading === team.id}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                                        >
                                            {joinLoading === team.id ? 'Requesting...' : 'Request to Join'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Team Wizard */}
            {showWizard && (
                <CreateTeamWizard
                    onSuccess={() => { setShowWizard(false); loadData() }}
                    onClose={() => setShowWizard(false)}
                />
            )}
        </div>
    )
}
