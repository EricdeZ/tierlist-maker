import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { communityTeamService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { Plus, Users, Swords, ArrowRight, Info, ChevronDown, Crown } from 'lucide-react'
import { RANK_LABELS, getDivisionImage } from '../utils/divisionImages'
import TeamCard from './myteams/TeamCard'
import InvitationsPanel from './myteams/InvitationsPanel'
import CreateTeamWizard from './myteams/CreateTeamWizard'
import InviteMembersModal from './myteams/InviteMembersModal'
import JoinTeamModal from './myteams/JoinTeamModal'

export default function MyTeams() {
    const { user, login, linkedPlayer, loading: authLoading } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()

    const [communityTeams, setCommunityTeams] = useState([])
    const [leagueTeams, setLeagueTeams] = useState([])
    const [pending, setPending] = useState({ invites: [], outgoingRequests: [], incomingRequests: [] })
    const [loading, setLoading] = useState(true)
    const [showWizard, setShowWizard] = useState(false)
    const [inviteTeam, setInviteTeam] = useState(null)
    const [error, setError] = useState(null)

    // Browse state
    const [browseTeams, setBrowseTeams] = useState([])
    const [browseTier, setBrowseTier] = useState(null)
    const [browseLoading, setBrowseLoading] = useState(false)
    const [joinLoading, setJoinLoading] = useState(null)
    const [expandedBrowseTeam, setExpandedBrowseTeam] = useState(null)

    // Show join modal when ?join=CODE is present
    const joinCode = searchParams.get('join')
    const [showJoinModal, setShowJoinModal] = useState(!!joinCode)

    const loadData = async () => {
        if (!user) return
        setLoading(true)
        try {
            const requests = [
                communityTeamService.getMyTeams(),
                communityTeamService.getPending(),
            ]
            if (linkedPlayer) {
                requests.push(communityTeamService.getLeagueTeams())
            }
            const [teamsData, pendingData, leagueData] = await Promise.all(requests)
            setCommunityTeams(teamsData.teams || [])
            setPending(pendingData)
            setLeagueTeams(leagueData?.teams || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    // Browse teams by tier
    useEffect(() => {
        if (!user) return
        setBrowseLoading(true)
        communityTeamService.browse(browseTier)
            .then(data => setBrowseTeams(data.teams || []))
            .catch(() => setBrowseTeams([]))
            .finally(() => setBrowseLoading(false))
    }, [browseTier, user])

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

    const handleKick = async (team, userId, displayName) => {
        if (!confirm(`Remove ${displayName} from ${team.name}?`)) return
        try {
            await communityTeamService.kick(team.id, userId)
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

    const hasCaptainTeam = communityTeams.some(t => t.role === 'captain')
    const allMyTeams = [...leagueTeams, ...communityTeams]
    const isCaptainAnywhere = leagueTeams.some(t => t.role === 'captain') || hasCaptainTeam
    const myTeamIds = new Set(communityTeams.map(t => t.id))
    const browsableTeams = browseTeams.filter(t => !myTeamIds.has(t.id))
    const pendingTotal = (pending.invites?.length || 0) + (pending.outgoingRequests?.length || 0) + (pending.incomingRequests?.length || 0)

    // Page is ready when auth is resolved AND either no user or data finished loading
    const pageReady = !authLoading && (!user || !loading)
    const showLoginGate = !authLoading && !user

    return (
        <>
            <Navbar title="My Teams" />
            <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
                <PageTitle title="My Teams" />

                {!pageReady ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : showLoginGate ? (
                    <div className="text-center pt-8">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/15 to-blue-500/10 border border-white/10 flex items-center justify-center mx-auto mb-5">
                            <Users className="w-10 h-10 text-[var(--color-accent)]" />
                        </div>
                        <h1 className="text-2xl font-bold text-(--color-text) mb-2">Bring Your Own Team</h1>
                        <p className="text-sm text-(--color-text-secondary) mb-2 max-w-md mx-auto">
                            Create your team, invite players, and compete in scrims against other teams.
                        </p>
                        <p className="text-xs text-(--color-text-secondary)/60 mb-6">
                            Log in to get started.
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
                ) : (
                    <div className="space-y-8">
                        {/* Scrim CTA — only for captains */}
                        {isCaptainAnywhere && (
                            <Link
                                to="/scrims"
                                className="block bg-gradient-to-r from-emerald-500/[0.08] to-transparent border-l-2 border-emerald-500 px-5 py-3.5 hover:from-emerald-500/[0.14] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Swords className="w-5 h-5 text-emerald-400 shrink-0" />
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-emerald-300">Ready to compete?</span>
                                        <span className="text-xs text-(--color-text-secondary) ml-2">Post a scrim or find opponents.</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-emerald-400/40 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                                </div>
                            </Link>
                        )}

                        {/* Create Team CTA — when user has no community team as captain */}
                        {!hasCaptainTeam && (
                            <div
                                className="relative overflow-hidden border border-dashed border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04] hover:bg-[var(--color-accent)]/[0.07] transition-colors cursor-pointer group"
                                onClick={() => setShowWizard(true)}
                            >
                                <div className="flex items-center gap-4 px-5 py-4">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                                        <Plus className="w-5 h-5 text-[var(--color-accent)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-(--color-text)">Create Your Community Team</div>
                                        <div className="text-xs text-(--color-text-secondary) mt-0.5">
                                            Pick a name, logo & color, choose your competitive tier, and invite your squad.
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-[var(--color-accent)]/40 group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-all shrink-0" />
                                </div>
                            </div>
                        )}

                        {/* My Teams */}
                        {allMyTeams.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-(--color-text)">My Teams</h2>
                                    <div className="relative group/tip">
                                        <Info className="w-3.5 h-3.5 text-(--color-text-secondary)/40 cursor-help" />
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded bg-gray-900 border border-white/10 text-xs text-(--color-text-secondary) whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">
                                            You can create and captain one community team per person.
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {allMyTeams.map(team => (
                                        <TeamCard
                                            key={`${team.is_league ? 'l' : 'c'}-${team.id}`}
                                            team={team}
                                            onLeave={team.is_league ? undefined : handleLeave}
                                            onDisband={team.is_league ? undefined : handleDisband}
                                            onInvite={team.is_league ? undefined : setInviteTeam}
                                            onKick={team.is_league ? undefined : handleKick}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Invitations/Requests */}
                        {pendingTotal > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-(--color-text) mb-3">
                                    Notifications
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold">
                                        {pendingTotal}
                                    </span>
                                </h2>
                                <InvitationsPanel
                                    invites={pending.invites}
                                    outgoingRequests={pending.outgoingRequests}
                                    incomingRequests={pending.incomingRequests}
                                    onRespond={handleRespond}
                                    onCancel={handleCancel}
                                />
                            </div>
                        )}

                        {/* Browse Teams */}
                        <div>
                            <h2 className="text-lg font-bold text-(--color-text) mb-1">Find Teams</h2>
                            <p className="text-xs text-(--color-text-secondary) mb-3">Browse teams by competitive tier and request to join.</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <button
                                    onClick={() => setBrowseTier(null)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                                        browseTier === null
                                            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                                            : 'bg-white/[0.04] text-(--color-text-secondary) border border-white/[0.06] hover:bg-white/[0.08]'
                                    }`}
                                >
                                    All
                                </button>
                                {[1, 2, 3, 4, 5].map(tier => {
                                    const img = getDivisionImage(null, null, tier)
                                    const selected = browseTier === tier
                                    return (
                                        <button
                                            key={tier}
                                            onClick={() => setBrowseTier(selected ? null : tier)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                                                selected
                                                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                                                    : 'bg-white/[0.04] text-(--color-text-secondary) border border-white/[0.06] hover:bg-white/[0.08]'
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
                            ) : browsableTeams.length === 0 ? (
                                <div className="text-center py-8 text-sm text-(--color-text-secondary)">
                                    {browseTier ? `No other teams at ${RANK_LABELS[browseTier]} level yet.` : 'No other teams yet.'}
                                    {!hasCaptainTeam && (
                                        <button
                                            onClick={() => setShowWizard(true)}
                                            className="ml-2 text-[var(--color-accent)] hover:underline cursor-pointer"
                                        >
                                            Be the first
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {browsableTeams.map(team => {
                                        const isExpanded = expandedBrowseTeam === team.id
                                        const members = team.members || []
                                        const color = team.color || '#6366f1'
                                        const tierImg = getDivisionImage(null, null, team.skill_tier)
                                        return (
                                            <div key={team.id} className="relative overflow-hidden">
                                                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: isExpanded ? color : 'transparent' }} />
                                                <div
                                                    className="relative flex items-center gap-3 px-5 py-3 bg-white/[0.02] border-l border-white/[0.06] hover:bg-white/[0.04] transition-colors cursor-pointer"
                                                    onClick={() => setExpandedBrowseTeam(isExpanded ? null : team.id)}
                                                >
                                                    <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                                                        {team.logo_url ? (
                                                            <img src={team.logo_url} alt="" className="w-9 h-9 object-contain" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded bg-white/[0.06] flex items-center justify-center text-sm font-bold text-(--color-text-secondary)/40">
                                                                {team.name[0]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-(--color-text) truncate">{team.name}</div>
                                                        <div className="text-[10px] text-(--color-text-secondary)/60 flex items-center gap-1.5">
                                                            {tierImg && <img src={tierImg} alt="" className="w-3.5 h-3.5" />}
                                                            {RANK_LABELS[team.skill_tier] && <span>{RANK_LABELS[team.skill_tier]}</span>}
                                                            <span>· {team.member_count} player{team.member_count !== 1 ? 's' : ''} · {team.owner_name}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleRequestJoin(team.id) }}
                                                        disabled={joinLoading === team.id}
                                                        className="text-xs px-3 py-1.5 rounded bg-white/[0.04] text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                                                    >
                                                        {joinLoading === team.id ? 'Sending...' : 'Request to Join'}
                                                    </button>
                                                    <ChevronDown className={`w-4 h-4 text-(--color-text-secondary)/40 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                                <div
                                                    className="overflow-hidden transition-all duration-200 ease-in-out"
                                                    style={{ maxHeight: isExpanded ? '400px' : '0px', opacity: isExpanded ? 1 : 0 }}
                                                >
                                                    <div className="bg-white/[0.02] border-b border-r border-white/[0.06] pl-5 pr-5 py-3">
                                                        {members.length > 0 ? (
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-(--color-text-secondary)/40 mb-2 font-semibold">Members</div>
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                                                                    {members.map((m, i) => {
                                                                        const displayName = m.player_name || m.discord_username || '?'
                                                                        const profileSlug = m.player_slug || m.discord_username
                                                                        const isCaptain = m.role === 'captain'
                                                                        return (
                                                                            <div key={i} className="flex items-center gap-2 py-0.5">
                                                                                {m.discord_avatar && m.discord_id ? (
                                                                                    <img
                                                                                        src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.discord_avatar}.png?size=64`}
                                                                                        alt="" className="w-5 h-5 rounded-full shrink-0"
                                                                                    />
                                                                                ) : (
                                                                                    <div
                                                                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                                                                                        style={{ backgroundColor: `${color}20`, color }}
                                                                                    >
                                                                                        {displayName[0].toUpperCase()}
                                                                                    </div>
                                                                                )}
                                                                                {profileSlug ? (
                                                                                    <Link
                                                                                        to={`/profile/${profileSlug}`}
                                                                                        className="text-xs text-(--color-text)/80 truncate hover:text-(--color-text) transition-colors"
                                                                                        onClick={e => e.stopPropagation()}
                                                                                    >
                                                                                        {displayName}
                                                                                    </Link>
                                                                                ) : (
                                                                                    <span className="text-xs text-(--color-text)/80 truncate">{displayName}</span>
                                                                                )}
                                                                                {isCaptain && <Crown className="w-3 h-3 shrink-0" style={{ color }} />}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-(--color-text-secondary)/40">No members found</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showWizard && (
                    <CreateTeamWizard
                        onSuccess={() => { setShowWizard(false); loadData() }}
                        onClose={() => setShowWizard(false)}
                    />
                )}
                {inviteTeam && (
                    <InviteMembersModal
                        team={inviteTeam}
                        onClose={() => setInviteTeam(null)}
                    />
                )}
                {showJoinModal && joinCode && (
                    <JoinTeamModal
                        code={joinCode}
                        onJoined={() => {
                            setShowJoinModal(false)
                            setSearchParams({}, { replace: true })
                            loadData()
                        }}
                        onClose={() => {
                            setShowJoinModal(false)
                            setSearchParams({}, { replace: true })
                        }}
                    />
                )}
            </div>
        </>
    )
}
