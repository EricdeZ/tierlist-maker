import { useState, useMemo } from 'react'
import { Swords, Plus, HelpCircle, Monitor, Clock, ChevronRight, X, Search, Shield, Ban, User, Flame } from 'lucide-react'
import OpenScrimsTab from './OpenScrimsTab'
import MyScrimsTab from './MyScrimsTab'
import PostScrimWizard from './PostScrimWizard'
import XpScrimCalendarWindow from './XpScrimCalendarWindow'
import XpScrimChallengesWindow from './XpScrimChallengesWindow'
import XpBlacklistWindow from './XpBlacklistWindow'
import XpScrimHelpWindow from './XpScrimHelpWindow'
import XpImpersonateWindow from './XpImpersonateWindow'
import TeamLogo from '../../components/TeamLogo'
import { formatDateEST, formatRelativeDate, XP_PICK_BADGE, formatPickMode } from './scrimUtils'

function SidebarCard({ title, icon, children, defaultOpen = true, badge }) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="sd-card">
            <button className="sd-card-header" onClick={() => setOpen(!open)}>
                <div className="sd-card-header-left">
                    {icon && <span className="sd-card-icon">{icon}</span>}
                    <span>{title}</span>
                    {badge && <span className="sd-card-badge">{badge}</span>}
                </div>
                <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', opacity: 0.5 }} />
            </button>
            {open && <div className="sd-card-body">{children}</div>}
        </div>
    )
}

function NextUpSection({ scrims }) {
    if (scrims.length === 0) return null
    return (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scrims.map(s => (
                <div key={s.id} className="sd-next-up-item">
                    <div className="flex items-center gap-2">
                        <Clock size={11} style={{ color: '#4fa0e8', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#e0e6ed' }}>
                            {formatDateEST(s.scheduledDate)}
                        </span>
                        <span style={{ fontSize: 10, color: '#6a8aa8' }}>
                            ({formatRelativeDate(s.scheduledDate)})
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span style={{ fontSize: 10, color: '#6a8aa8' }}>vs</span>
                        <TeamLogo
                            slug={s.acceptedTeamId === s._myTeamId ? s.teamSlug : s.acceptedTeamSlug}
                            name={s.acceptedTeamId === s._myTeamId ? s.teamName : s.acceptedTeamName}
                            size={16}
                            color={s.acceptedTeamId === s._myTeamId ? s.teamColor : s.acceptedTeamColor}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#c8d8e8' }}>
                            {s.acceptedTeamId === s._myTeamId ? s.teamName : s.acceptedTeamName}
                        </span>
                        <span className={`xp-badge ${XP_PICK_BADGE[s.pickMode] || 'xp-badge-blue'}`} style={{ fontSize: 9 }}>
                            {formatPickMode(s.pickMode)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function ScrimDashboard({
    user, login, isCaptain, isOwner,
    // Open scrims
    openScrims, leagueFilter, setLeagueFilter, tierFilter, setTierFilter,
    regionFilter, setRegionFilter, divisionFilter, setDivisionFilter,
    uniqueLeagues, uniqueTiers, activeDivisions,
    // My scrims
    myScrims, incomingScrims, captainTeams, myTeams,
    // Actions
    onAccept, onCancel, onEdit, onDecline, handleReportOutcome, handleDisputeOutcome,
    handleConfirmAccept, handleDenyAccept, actionLoading,
    acceptModal, setAcceptModal, reliabilityScores,
    // Blacklist
    blacklist, allTeams, onBlacklistAdd, onBlacklistRemove,
    // Impersonation
    impersonatedUser, onImpersonate, onClearImpersonation,
    // Post
    onPostSuccess, loadOpenScrims, loadMyScrims,
    // Theme
    onToggleTheme,
    // Loading
    loading, error,
}) {
    const [activeTab, setActiveTab] = useState('open')
    const [showPost, setShowPost] = useState(false)
    const [editingScrim, setEditingScrim] = useState(null)
    const [showHelp, setShowHelp] = useState(false)

    const handleDashboardEdit = (scrim) => {
        setEditingScrim(scrim)
        setShowPost(true)
    }

    // Action items that need attention
    const actionItems = useMemo(() => {
        if (!user) return []
        const items = []
        const incoming = incomingScrims?.length || 0
        if (incoming > 0) items.push({ type: 'incoming', count: incoming, label: `${incoming} incoming challenge${incoming > 1 ? 's' : ''}`, color: '#d090ff' })
        const pending = myScrims.filter(s => s.status === 'pending_confirmation').length
        if (pending > 0) items.push({ type: 'pending', count: pending, label: `${pending} pending confirmation${pending > 1 ? 's' : ''}`, color: '#f0c040' })
        const needsReport = myScrims.filter(s => s.status === 'accepted' && new Date(s.scheduledDate) < new Date() && !s.outcome).length
        if (needsReport > 0) items.push({ type: 'report', count: needsReport, label: `${needsReport} need${needsReport > 1 ? '' : 's'} report`, color: '#f08080' })
        return items
    }, [user, myScrims, incomingScrims])

    // Next upcoming confirmed scrims (max 3)
    const nextUpScrims = useMemo(() => {
        if (!user) return []
        const myTeamIds = new Set(myTeams.map(t => t.teamId))
        return myScrims
            .filter(s => s.status === 'accepted' && new Date(s.scheduledDate) >= new Date())
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
            .slice(0, 3)
            .map(s => ({
                ...s,
                _myTeamId: myTeamIds.has(s.teamId) ? s.teamId : s.acceptedTeamId,
            }))
    }, [user, myScrims, myTeams])

    // Captain teams with no open scrim posted
    const passionlessTeams = useMemo(() => {
        if (!isCaptain) return []
        const teamsWithOpenScrim = new Set(
            myScrims.filter(s => s.status === 'open').map(s => s.teamId)
        )
        return captainTeams.filter(t => !teamsWithOpenScrim.has(t.teamId))
    }, [isCaptain, captainTeams, myScrims])

    const TABS = [
        { key: 'open', label: 'Open Scrims', icon: Search },
        ...(user ? [{ key: 'my', label: 'My Scrims', icon: Shield }] : []),
    ]

    const hasSidebar = !!user

    return (
        <div className="sm-mobile-view sd-dashboard">
            {/* Hero Header */}
            <div className="sm-hero sd-hero">
                <div className="sd-hero-left">
                    <Swords size={26} className="sm-hero-icon" />
                    <div>
                        <h1 className="sm-hero-title">Scrim Battles</h1>
                        <p className="sm-hero-sub">Challenge teams, schedule scrims, and prove your squad.</p>
                    </div>
                </div>
                <div className="sd-hero-actions">
                    {isCaptain && (
                        <button className="sd-action-btn sd-action-btn-primary" onClick={() => { setEditingScrim(null); setShowPost(true) }}>
                            <Plus size={14} /> Post Scrim
                        </button>
                    )}
                    <button className="sd-action-btn" onClick={() => setShowHelp(true)}>
                        <HelpCircle size={14} />
                    </button>
                    <button className="sd-theme-toggle" onClick={onToggleTheme} title="Switch to XP Theme">
                        <Monitor size={14} />
                        <span>XP Theme</span>
                    </button>
                </div>
            </div>

            {/* Impersonation banner */}
            {impersonatedUser && (
                <div className="sd-impersonate-bar">
                    <User size={14} />
                    <span>Viewing as <strong>{impersonatedUser.discordUsername}</strong></span>
                    <button onClick={onClearImpersonation} className="sd-action-btn" style={{ padding: '2px 8px', fontSize: 11 }}>
                        Clear
                    </button>
                </div>
            )}

            {/* Passionless banner */}
            {passionlessTeams.length > 0 && !loading && (
                <div className="sd-passionless-banner" onClick={() => setShowPost(true)} style={{ cursor: 'pointer' }}>
                    <div className="sd-passionless-inner">
                        <Flame size={18} className="sd-passionless-icon" />
                        <div className="sd-passionless-text">
                            <span className="sd-passionless-title">
                                {passionlessTeams.length === 1
                                    ? <><strong>{passionlessTeams[0].teamName}</strong> has ZERO scrims posted. Absolutely passionless.</>
                                    : <>{passionlessTeams.map(t => <strong key={t.teamId}>{t.teamName}</strong>).reduce((a, b) => <>{a}, {b}</>)} have ZERO scrims posted. Embarrassing.</>
                                }
                            </span>
                            <span className="sd-passionless-sub">
                                Your team is collecting dust while everyone else is grinding. Post a scrim or accept your irrelevance.
                            </span>
                        </div>
                        <span className="sd-passionless-cta">Post Scrim</span>
                    </div>
                </div>
            )}

            {/* Dashboard Grid */}
            <div className={`sd-grid${hasSidebar ? '' : ' sd-no-sidebar'}`}>
                {/* Main Content Panel */}
                <div className="sd-main">
                    {/* Tabs */}
                    <div className="sd-tabs">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                className={`sd-tab${activeTab === key ? ' sd-tab-active' : ''}`}
                                onClick={() => setActiveTab(key)}
                            >
                                <Icon size={14} />
                                {label}
                                {key === 'my' && actionItems.length > 0 && (
                                    <span className="sd-tab-badge">{actionItems.reduce((sum, i) => sum + i.count, 0)}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="sd-main-content">
                        {loading && (
                            <div className="sm-loading">
                                <div className="sm-spinner" />
                                <span>Loading scrims...</span>
                            </div>
                        )}
                        {error && <div className="sm-error-box">{error}</div>}

                        {!loading && !error && (
                            <>
                                {activeTab === 'open' && (
                                    <OpenScrimsTab
                                        scrims={openScrims} user={user} currentUserId={user?.id}
                                        captainTeams={captainTeams}
                                        leagueFilter={leagueFilter} setLeagueFilter={setLeagueFilter}
                                        tierFilter={tierFilter} setTierFilter={setTierFilter}
                                        regionFilter={regionFilter} setRegionFilter={setRegionFilter}
                                        divisionFilter={divisionFilter} setDivisionFilter={setDivisionFilter}
                                        uniqueLeagues={uniqueLeagues} uniqueTiers={uniqueTiers}
                                        activeDivisions={activeDivisions}
                                        onAccept={onAccept} onCancel={onCancel} onEdit={handleDashboardEdit}
                                        actionLoading={actionLoading}
                                        login={login} acceptModal={acceptModal} setAcceptModal={setAcceptModal}
                                        reliabilityScores={reliabilityScores}
                                    />
                                )}
                                {activeTab === 'my' && user && (
                                    <MyScrimsTab
                                        scrims={myScrims} incomingScrims={incomingScrims} captainTeams={captainTeams}
                                        currentUserId={user?.id} onAccept={onAccept} onCancel={onCancel}
                                        onEdit={handleDashboardEdit}
                                        onDecline={onDecline} actionLoading={actionLoading}
                                        acceptModal={acceptModal} setAcceptModal={setAcceptModal}
                                        reliabilityScores={reliabilityScores}
                                        onReportOutcome={handleReportOutcome} onDisputeOutcome={handleDisputeOutcome}
                                        onConfirmAccept={handleConfirmAccept} onDenyAccept={handleDenyAccept}
                                        activeDivisions={activeDivisions}
                                    />
                                )}
                            </>
                        )}

                        {!user && !loading && (
                            <div className="sd-login-cta">
                                <button className="sd-action-btn sd-action-btn-primary" onClick={login} style={{ fontSize: 13, padding: '8px 24px' }}>
                                    Log in to accept or post scrims
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                {hasSidebar && (
                    <div className="sd-sidebar">
                        {/* Calendar */}
                        {myTeams.length > 0 && (
                            <SidebarCard title="Scrim Calendar" icon="&#128197;">
                                <XpScrimCalendarWindow myScrims={myScrims} myTeams={myTeams} dark />
                            </SidebarCard>
                        )}

                        {/* Next Up */}
                        {nextUpScrims.length > 0 && (
                            <SidebarCard title="Next Up" icon="&#9889;" badge={`${nextUpScrims.length}`}>
                                <NextUpSection scrims={nextUpScrims} />
                            </SidebarCard>
                        )}

                        {/* Challenges */}
                        <SidebarCard title="Challenges" icon="&#127942;">
                            <XpScrimChallengesWindow dark />
                        </SidebarCard>

                        {/* Blacklist */}
                        {isCaptain && (
                            <SidebarCard title="Blacklist" icon="&#128683;" defaultOpen={false}>
                                <XpBlacklistWindow
                                    captainTeams={captainTeams} allTeams={allTeams}
                                    blacklist={blacklist} onAdd={onBlacklistAdd} onRemove={onBlacklistRemove}
                                    dark
                                />
                            </SidebarCard>
                        )}

                        {/* Impersonation (Owner) */}
                        {isOwner && (
                            <SidebarCard title="Impersonate" icon="&#128373;" defaultOpen={false}>
                                <XpImpersonateWindow
                                    impersonatedUser={impersonatedUser}
                                    onImpersonate={onImpersonate}
                                    onClear={onClearImpersonation}
                                    dark
                                />
                            </SidebarCard>
                        )}
                    </div>
                )}
            </div>

            {/* Post Scrim Modal */}
            {showPost && isCaptain && (
                <div className="sd-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowPost(false); setEditingScrim(null) } }}>
                    <div className="sd-modal">
                        <div className="sd-modal-header">
                            <span>{editingScrim ? 'Edit Scrim' : 'Post a Scrim'}</span>
                            <button onClick={() => { setShowPost(false); setEditingScrim(null) }} className="sd-modal-close">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="sd-modal-body">
                            <PostScrimWizard
                                key={editingScrim?.id || 'new'}
                                captainTeams={captainTeams} allTeams={allTeams} myScrims={myScrims}
                                editScrim={editingScrim}
                                onSuccess={() => { onPostSuccess(); setShowPost(false); setEditingScrim(null) }}
                                onCancel={() => { setShowPost(false); setEditingScrim(null) }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Help Modal */}
            {showHelp && (
                <div className="sd-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false) }}>
                    <div className="sd-modal">
                        <div className="sd-modal-header">
                            <span>Scrim Help</span>
                            <button onClick={() => setShowHelp(false)} className="sd-modal-close">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="sd-modal-body">
                            <XpScrimHelpWindow dark />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
