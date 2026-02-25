import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { scrimService, godService, setImpersonation, clearImpersonation } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import passionCoin from '../assets/passion/passion.png'
import xpBg from '../assets/xp-bg.jpg'
import { Plus, Search, Shield, Ban, Swords, Trophy } from 'lucide-react'
import DraggableXpWindow from '../components/xp/DraggableXpWindow'
import XpProgressBar from '../components/xp/XpProgressBar'
import XpDinoGame from '../components/xp/XpDinoGame'
import XpClock from '../components/xp/XpClock'
import XpCoinFlip from '../components/xp/XpCoinFlip'
import XP_STYLES from '../components/xp/xpStyles'
import DesktopIconGrid from './scrims/DesktopIconGrid'
import OpenScrimsTab from './scrims/OpenScrimsTab'
import MyScrimsTab from './scrims/MyScrimsTab'
import XpImpersonateWindow from './scrims/XpImpersonateWindow'
import XpScrimHelpWindow from './scrims/XpScrimHelpWindow'
import XpBlacklistWindow from './scrims/XpBlacklistWindow'
import XpScrimCalendarWindow from './scrims/XpScrimCalendarWindow'
import PostScrimWizard from './scrims/PostScrimWizard'
import XpScrimChallengesWindow from './scrims/XpScrimChallengesWindow'

export default function ScrimPlanner() {
    const { user, login, hasPermission } = useAuth()
    const [activeTab, setActiveTab] = useState('open')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [startMenuOpen, setStartMenuOpen] = useState(false)
    const startRef = useRef(null)
    const [desktopGods, setDesktopGods] = useState([])
    const [topPlayers, setTopPlayers] = useState({})

    const [openScrims, setOpenScrims] = useState([])
    const [leagueFilter, setLeagueFilter] = useState('')
    const [tierFilter, setTierFilter] = useState('')
    const [regionFilter, setRegionFilter] = useState('')
    const [divisionFilter, setDivisionFilter] = useState('')
    const [activeDivisions, setActiveDivisions] = useState([])

    const [myScrims, setMyScrims] = useState([])
    const [captainTeams, setCaptainTeams] = useState([])
    const [myTeams, setMyTeams] = useState([])
    const [incomingScrims, setIncomingScrims] = useState([])

    const [allTeams, setAllTeams] = useState([])
    const [showPostWindow, setShowPostWindow] = useState(false)
    const [showHelp, setShowHelp] = useState(false)
    const [minimizedWindows, setMinimizedWindows] = useState({})
    const setWinMinimized = (id, v) => setMinimizedWindows(prev => ({ ...prev, [id]: v }))

    const [actionLoading, setActionLoading] = useState(null)

    // Reliability + blacklist state
    const [reliabilityScores, setReliabilityScores] = useState({})
    const [blacklist, setBlacklist] = useState([])
    const [blockedByMe, setBlockedByMe] = useState([])
    const [blockedMe, setBlockedMe] = useState([])

    // Impersonation state (Owner only)
    const [impersonatedUser, setImpersonatedUser] = useState(null)
    const isOwner = hasPermission('permission_manage')

    const isCaptain = captainTeams.length > 0

    // ── Mobile detection ──────────────────────────────────────────
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    )
    const [mobileTab, setMobileTab] = useState('open')

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)')
        const handler = (e) => setIsMobile(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    // Reset mobile tab when auth state changes
    useEffect(() => {
        if (!user && (mobileTab === 'my' || mobileTab === 'post' || mobileTab === 'blacklist' || mobileTab === 'challenges'))
            setMobileTab('open')
    }, [user]) // eslint-disable-line
    useEffect(() => {
        if (!isCaptain && (mobileTab === 'post' || mobileTab === 'blacklist'))
            setMobileTab(user ? 'my' : 'open')
    }, [isCaptain]) // eslint-disable-line

    // Load allTeams when navigating to Post tab on mobile
    useEffect(() => {
        if (isMobile && mobileTab === 'post' && allTeams.length === 0)
            scrimService.getAllActiveTeams().then(d => setAllTeams(d.teams || [])).catch(() => {})
    }, [isMobile, mobileTab]) // eslint-disable-line

    const TABS = [
        { key: 'open', label: 'Open Scrims' },
        ...(user ? [{ key: 'my', label: 'My Scrims' }] : []),
    ]

    const loadOpenScrims = useCallback(async () => {
        try {
            const filters = {}
            if (leagueFilter) filters.league_id = leagueFilter
            if (tierFilter) filters.division_tier = tierFilter
            if (regionFilter) filters.region = regionFilter
            if (divisionFilter) filters.division_id = divisionFilter
            const data = await scrimService.list(filters)
            setOpenScrims(data.scrims || [])
        } catch (err) { console.error('Failed to load scrims:', err) }
    }, [leagueFilter, tierFilter, regionFilter, divisionFilter])

    const loadMyScrims = useCallback(async () => {
        if (!user) return
        try {
            const [myData, incomingData] = await Promise.all([scrimService.getMyScrims(), scrimService.getIncoming()])
            setMyScrims(myData.scrims || [])
            setCaptainTeams(myData.captainTeams || [])
            setMyTeams(myData.myTeams || [])
            setBlockedByMe(myData.blockedByMe || [])
            setBlockedMe(myData.blockedMe || [])
            setIncomingScrims(incomingData.scrims || [])
        } catch (err) { console.error('Failed to load my scrims:', err) }
    }, [user])

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                await loadOpenScrims()
                if (user) await loadMyScrims()
            } catch (err) { setError(err.message) }
            finally { setLoading(false) }
        }
        load()
    }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { if (!loading) loadOpenScrims() }, [leagueFilter, tierFilter, regionFilter, divisionFilter]) // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch active divisions for filters
    useEffect(() => {
        scrimService.getActiveDivisions().then(data => setActiveDivisions(data.divisions || [])).catch(() => {})
    }, [])

    useEffect(() => {
        if (showPostWindow && allTeams.length === 0) {
            scrimService.getAllActiveTeams().then(data => setAllTeams(data.teams || [])).catch(() => {})
        }
    }, [showPostWindow]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load allTeams for blacklist window too (captain only)
    useEffect(() => {
        if (isCaptain && allTeams.length === 0) {
            scrimService.getAllActiveTeams().then(data => setAllTeams(data.teams || [])).catch(() => {})
        }
    }, [isCaptain]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load blacklist
    const loadBlacklist = useCallback(async () => {
        if (!user) return
        try {
            const data = await scrimService.getBlacklist()
            setBlacklist(data.blacklist || [])
        } catch (err) { console.error('Failed to load blacklist:', err) }
    }, [user])

    useEffect(() => { if (user && isCaptain) loadBlacklist() }, [user, isCaptain]) // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch reliability scores for visible teams
    useEffect(() => {
        const teamIds = new Set()
        openScrims.forEach(s => { teamIds.add(s.teamId); if (s.acceptedTeamId) teamIds.add(s.acceptedTeamId) })
        myScrims.forEach(s => { teamIds.add(s.teamId); if (s.acceptedTeamId) teamIds.add(s.acceptedTeamId) })
        incomingScrims.forEach(s => { teamIds.add(s.teamId) })
        const ids = [...teamIds].filter(Boolean)
        if (ids.length === 0) return
        scrimService.getTeamReliability(ids)
            .then(data => setReliabilityScores(data.reliability || {}))
            .catch(() => {})
    }, [openScrims, myScrims, incomingScrims])

    // Client-side blacklist filtering for open scrims
    const filteredOpenScrims = useMemo(() => {
        if (!user || blockedMe.length === 0) return openScrims
        const myTeamIds = new Set(myTeams.map(t => t.teamId))
        const blockerTeamIds = new Set(
            blockedMe
                .filter(b => myTeamIds.has(b.blockedTeamId))
                .map(b => b.teamId)
        )
        return openScrims.filter(s => !blockerTeamIds.has(s.teamId))
    }, [openScrims, blockedMe, myTeams, user])

    // Outcome reporting handlers
    const handleReportOutcome = async (scrimId, outcome) => {
        setActionLoading(scrimId)
        try {
            await scrimService.reportOutcome({ scrim_id: scrimId, outcome })
            await loadMyScrims()
        } catch (err) { alert(err.message || 'Failed to report outcome') }
        finally { setActionLoading(null) }
    }

    const handleDisputeOutcome = async (scrimId) => {
        setActionLoading(scrimId)
        try {
            await scrimService.disputeOutcome(scrimId)
            await loadMyScrims()
        } catch (err) { alert(err.message || 'Failed to dispute') }
        finally { setActionLoading(null) }
    }

    // Confirmation handlers
    const handleConfirmAccept = async (scrimId) => {
        setActionLoading(scrimId)
        try {
            await scrimService.confirmAccept(scrimId)
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) { alert(err.message || 'Failed to confirm') }
        finally { setActionLoading(null) }
    }

    const handleDenyAccept = async (scrimId) => {
        setActionLoading(scrimId)
        try {
            await scrimService.denyAccept(scrimId)
            await Promise.all([loadOpenScrims(), loadMyScrims()])
        } catch (err) { alert(err.message || 'Failed to deny') }
        finally { setActionLoading(null) }
    }

    // DM confirmation polling — check for Discord DM replies when pending scrims exist
    const hasPendingScrims = useMemo(() => myScrims.some(s => s.status === 'pending_confirmation'), [myScrims])

    useEffect(() => {
        if (!user || !hasPendingScrims) return
        // Check immediately
        scrimService.checkDMConfirmations().then(data => {
            if (data.processed > 0) { loadMyScrims(); loadOpenScrims() }
        }).catch(() => {})
        // Poll every 30s
        const interval = setInterval(() => {
            scrimService.checkDMConfirmations().then(data => {
                if (data.processed > 0) { loadMyScrims(); loadOpenScrims() }
            }).catch(() => {})
        }, 30000)
        return () => clearInterval(interval)
    }, [user, hasPendingScrims]) // eslint-disable-line react-hooks/exhaustive-deps

    // Blacklist handlers
    const handleBlacklistAdd = async (teamId, blockedTeamId) => {
        try {
            await scrimService.addToBlacklist(teamId, blockedTeamId)
            await loadBlacklist()
            await loadMyScrims()
        } catch (err) { alert(err.message || 'Failed to add to blacklist') }
    }

    const handleBlacklistRemove = async (teamId, blockedTeamId) => {
        try {
            await scrimService.removeFromBlacklist(teamId, blockedTeamId)
            await loadBlacklist()
            await loadMyScrims()
        } catch (err) { alert(err.message || 'Failed to remove from blacklist') }
    }

    // Impersonation handlers
    const handleImpersonate = (u) => {
        setImpersonatedUser(u)
        setImpersonation(u.id)
        // Reload data as the impersonated user
        loadMyScrims()
        loadOpenScrims()
    }

    const handleClearImpersonation = () => {
        setImpersonatedUser(null)
        clearImpersonation()
        loadMyScrims()
        loadOpenScrims()
    }

    // Clear impersonation on unmount
    useEffect(() => {
        return () => clearImpersonation()
    }, [])

    // Close start menu on click outside
    useEffect(() => {
        if (!startMenuOpen) return
        const handle = (e) => {
            if (startRef.current && !startRef.current.contains(e.target)) setStartMenuOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [startMenuOpen])

    // Load random gods for desktop icons + top players per god
    useEffect(() => {
        godService.getAll().then(data => {
            const gods = data.gods || data || []
            if (gods.length === 0) return
            const shuffled = [...gods].sort(() => Math.random() - 0.5)
            setDesktopGods(shuffled.slice(0, 24))
        }).catch(() => {})
        godService.getTopPlayers().then(data => {
            setTopPlayers(data.topPlayers || {})
        }).catch(() => {})
    }, [])

    const handleAccept = async (scrimId, teamId) => {
        setActionLoading(scrimId)
        try { await scrimService.accept({ scrim_id: scrimId, team_id: teamId }); await Promise.all([loadOpenScrims(), loadMyScrims()]) }
        catch (err) { alert(err.message || 'Failed to accept scrim') }
        finally { setActionLoading(null) }
    }

    const handleCancel = async (scrimId) => {
        setActionLoading(scrimId)
        try { await scrimService.cancel(scrimId); await Promise.all([loadOpenScrims(), loadMyScrims()]) }
        catch (err) { alert(err.message || 'Failed to cancel scrim') }
        finally { setActionLoading(null) }
    }

    const handleDecline = async (scrimId) => {
        setActionLoading(scrimId)
        try { await scrimService.decline(scrimId); await Promise.all([loadOpenScrims(), loadMyScrims()]) }
        catch (err) { alert(err.message || 'Failed to decline challenge') }
        finally { setActionLoading(null) }
    }

    const uniqueLeagues = [...new Map(openScrims.map(s => [s.leagueSlug, { slug: s.leagueSlug, name: s.leagueName }])).values()]
    const uniqueTiers = [...new Set(openScrims.map(s => s.divisionTier).filter(Boolean))].sort((a, b) => a - b)
    const [acceptModal, setAcceptModal] = useState(null)

    // Calculate default window position (centered, below banner)
    const defaultWinX = typeof window !== 'undefined' ? Math.max(20, (window.innerWidth - 800) * 0.3) : 100
    const defaultWinY = typeof window !== 'undefined' ? Math.min(420, window.innerHeight * 0.38) : 420

    // ── Mobile Layout ─────────────────────────────────────────────
    if (isMobile) {
        const mobileTabs = [
            { key: 'open', label: 'Open', icon: Search },
            ...(user ? [{ key: 'my', label: 'My Scrims', icon: Shield }] : []),
            ...(user ? [{ key: 'challenges', label: 'Challenges', icon: Trophy }] : []),
            ...(isCaptain ? [{ key: 'post', label: 'Post', icon: Plus }] : []),
            ...(isCaptain ? [{ key: 'blacklist', label: 'Blacklist', icon: Ban }] : []),
        ]
        return (
            <>
                <PageTitle title="Scrim Planner" description="Find and schedule scrimmage matches." />
                <Navbar />
                <div className="sm-mobile-view">
                    <div className="sm-hero">
                        <Swords size={28} className="sm-hero-icon" />
                        <div>
                            <h1 className="sm-hero-title">Scrim Battles</h1>
                            <p className="sm-hero-sub">Challenge teams, schedule scrims, and prove your squad.</p>
                        </div>
                    </div>
                    <div className="sm-content">
                        {loading && (
                            <div className="sm-loading">
                                <div className="sm-spinner" />
                                <span>Loading scrims…</span>
                            </div>
                        )}
                        {error && <div className="sm-error-box">⚠ {error}</div>}

                        {!loading && !error && (
                            <>
                                {mobileTab === 'open' && (
                                    <OpenScrimsTab
                                        scrims={filteredOpenScrims} user={user} currentUserId={user?.id}
                                        captainTeams={captainTeams} leagueFilter={leagueFilter} setLeagueFilter={setLeagueFilter}
                                        tierFilter={tierFilter} setTierFilter={setTierFilter}
                                        regionFilter={regionFilter} setRegionFilter={setRegionFilter}
                                        divisionFilter={divisionFilter} setDivisionFilter={setDivisionFilter}
                                        uniqueLeagues={uniqueLeagues} uniqueTiers={uniqueTiers}
                                        activeDivisions={activeDivisions}
                                        onAccept={handleAccept} actionLoading={actionLoading}
                                        login={login} acceptModal={acceptModal} setAcceptModal={setAcceptModal}
                                        reliabilityScores={reliabilityScores}
                                    />
                                )}
                                {mobileTab === 'my' && user && (
                                    <MyScrimsTab
                                        scrims={myScrims} incomingScrims={incomingScrims} captainTeams={captainTeams}
                                        currentUserId={user?.id} onAccept={handleAccept} onCancel={handleCancel}
                                        onDecline={handleDecline} actionLoading={actionLoading} acceptModal={acceptModal}
                                        setAcceptModal={setAcceptModal} reliabilityScores={reliabilityScores}
                                        onReportOutcome={handleReportOutcome} onDisputeOutcome={handleDisputeOutcome}
                                        onConfirmAccept={handleConfirmAccept} onDenyAccept={handleDenyAccept}
                                        activeDivisions={activeDivisions}
                                    />
                                )}
                                {mobileTab === 'post' && (
                                    <PostScrimWizard
                                        captainTeams={captainTeams} allTeams={allTeams} myScrims={myScrims}
                                        onSuccess={() => { loadOpenScrims(); loadMyScrims(); setMobileTab('my') }}
                                    />
                                )}
                                {mobileTab === 'challenges' && user && (
                                    <div>
                                        <div className="sm-section-header">
                                            <h2 className="sm-section-title">Scrim Challenges</h2>
                                            <p className="sm-section-sub">Earn Passion by posting and completing scrims.</p>
                                        </div>
                                        <XpScrimChallengesWindow />
                                    </div>
                                )}
                                {mobileTab === 'blacklist' && (
                                    <div>
                                        <div className="sm-section-header">
                                            <h2 className="sm-section-title">Blacklist</h2>
                                            <p className="sm-section-sub">Teams you've blocked from accepting your open scrims.</p>
                                        </div>
                                        <XpBlacklistWindow
                                            captainTeams={captainTeams} allTeams={allTeams}
                                            blacklist={blacklist} onAdd={handleBlacklistAdd} onRemove={handleBlacklistRemove}
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {!user && mobileTab === 'open' && !loading && (
                            <div className="sm-login-cta">
                                <button className="sm-login-btn" onClick={login}>
                                    Log in to accept or post scrims
                                </button>
                            </div>
                        )}
                    </div>

                    <nav className="sm-bottom-nav">
                        {mobileTabs.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                className={`sm-nav-btn${mobileTab === key ? ' active' : ''}`}
                                onClick={() => setMobileTab(key)}
                            >
                                <Icon size={22} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                <style>{XP_STYLES}</style>
            </>
        )
    }

    // ── Desktop Layout (XP theme) ─────────────────────────────────
    return (
        <>
            <PageTitle title="Scrim Planner" description="Find and schedule scrimmage matches." />
            <Navbar />

            <div className="xp-theme" style={{ backgroundImage: `url(${xpBg})` }}>
                {/* ═══ DESKTOP GOD ICONS (left-aligned grid, draggable + snapping) ═══ */}
                {desktopGods.length > 0 && <DesktopIconGrid gods={desktopGods} topPlayers={topPlayers} />}

                {/* ═══ DINO BANNER (draggable window) ═══ */}
                <DraggableXpWindow
                    title="SmiteRunner.exe"
                    icon="&#9876;"
                    defaultX={typeof window !== 'undefined' ? Math.max(0, (window.innerWidth - Math.min(900, window.innerWidth * 0.92)) / 2) : 0}
                    defaultY={80}
                    className="xp-dino-window"
                    resizable={false}
                    minimized={!!minimizedWindows.runner}
                    onMinimize={(v) => setWinMinimized('runner', v)}
                >
                    <XpDinoGame />
                </DraggableXpWindow>

                {/* ═══ COIN FLIP WINDOW ═══ */}
                <DraggableXpWindow
                    title="CoinFlip.exe"
                    icon="&#128176;"
                    defaultX={typeof window !== 'undefined' ? Math.min(window.innerWidth - 280, window.innerWidth * 0.55) : 500}
                    defaultY={120}
                    className="xp-coinflip-window"
                    resizable={false}
                    minimized={!!minimizedWindows.coinflip}
                    onMinimize={(v) => setWinMinimized('coinflip', v)}
                >
                    <XpCoinFlip />
                </DraggableXpWindow>

                {/* ═══ SCRIM CALENDAR WINDOW ═══ */}
                {user && myTeams.length > 0 && (
                    <DraggableXpWindow
                        title="Scrim Calendar"
                        icon="&#128197;"
                        defaultX={typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 360) : 400}
                        defaultY={80}
                        className="xp-scrim-cal-window"
                        resizable={true}
                        minimized={!!minimizedWindows.calendar}
                        onMinimize={(v) => setWinMinimized('calendar', v)}
                    >
                        <XpScrimCalendarWindow myScrims={myScrims} myTeams={myTeams} />
                    </DraggableXpWindow>
                )}

                {/* ═══ BLACKLIST WINDOW ═══ */}
                {user && isCaptain && (
                    <DraggableXpWindow
                        title="Blacklist"
                        icon="&#128683;"
                        defaultX={typeof window !== 'undefined' ? Math.max(20, window.innerWidth * 0.55) : 400}
                        defaultY={380}
                        className="xp-blacklist-window"
                        resizable={true}
                        minimized={!!minimizedWindows.blacklist}
                        onMinimize={(v) => setWinMinimized('blacklist', v)}
                    >
                        <XpBlacklistWindow
                            captainTeams={captainTeams}
                            allTeams={allTeams}
                            blacklist={blacklist}
                            onAdd={handleBlacklistAdd}
                            onRemove={handleBlacklistRemove}
                        />
                    </DraggableXpWindow>
                )}

                {/* ═══ SCRIM CHALLENGES WINDOW ═══ */}
                {user && (
                    <DraggableXpWindow
                        title="Scrim Challenges"
                        icon="&#127942;"
                        defaultX={typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 340) : 400}
                        defaultY={340}
                        className="xp-scrim-challenges-window"
                        resizable={false}
                        minimized={!!minimizedWindows.challenges}
                        onMinimize={(v) => setWinMinimized('challenges', v)}
                    >
                        <XpScrimChallengesWindow />
                    </DraggableXpWindow>
                )}

                {/* ═══ IMPERSONATION WINDOW (Owner only) ═══ */}
                {user && isOwner && (
                    <DraggableXpWindow
                        title="Impersonate"
                        icon="&#128373;"
                        defaultX={typeof window !== 'undefined' ? Math.max(20, window.innerWidth * 0.6) : 400}
                        defaultY={560}
                        className="xp-impersonate-window"
                        resizable={false}
                        minimized={!!minimizedWindows.impersonate}
                        onMinimize={(v) => setWinMinimized('impersonate', v)}
                    >
                        <XpImpersonateWindow
                            impersonatedUser={impersonatedUser}
                            onImpersonate={handleImpersonate}
                            onClear={handleClearImpersonation}
                        />
                    </DraggableXpWindow>
                )}

                {/* ═══ HELP WINDOW ═══ */}
                {showHelp && (
                    <DraggableXpWindow
                        title="Scrim Help"
                        icon="&#10068;"
                        defaultX={typeof window !== 'undefined' ? Math.max(20, window.innerWidth * 0.35) : 200}
                        defaultY={100}
                        className="xp-help-window"
                        resizable={true}
                        onClose={() => setShowHelp(false)}
                        minimized={!!minimizedWindows.help}
                        onMinimize={(v) => setWinMinimized('help', v)}
                    >
                        <XpScrimHelpWindow />
                    </DraggableXpWindow>
                )}

                {/* ═══ DRAGGABLE SCRIM PLANNER WINDOW ═══ */}
                <DraggableXpWindow
                    title="Scrim Planner"
                    icon="&#9876;"
                    defaultX={defaultWinX}
                    defaultY={defaultWinY}
                    className="xp-main-window"
                    minimized={!!minimizedWindows.main}
                    onMinimize={(v) => setWinMinimized('main', v)}
                >
                    {/* Tabs + Post button */}
                    <div className="xp-tab-bar" style={{ justifyContent: 'space-between' }}>
                        <div className="flex">
                            {TABS.map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`xp-tab ${activeTab === tab.key ? 'xp-tab-active' : ''}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setShowHelp(true)}
                                className="xp-btn" style={{ fontSize: 10, padding: '2px 8px', alignSelf: 'center' }}>
                                ?
                            </button>
                            {isCaptain && (
                                <button onClick={() => setShowPostWindow(true)}
                                    className="xp-btn xp-btn-primary xp-post-scrim-btn" style={{ fontSize: 10, padding: '2px 10px', marginRight: 4, alignSelf: 'center' }}>
                                    <Plus size={11} /> Post Scrim
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="xp-tab-content">
                        {loading && <XpProgressBar />}

                        {error && (
                            <div className="flex items-center gap-3 p-4">
                                <div className="xp-error-icon">X</div>
                                <span className="xp-text">{error}</span>
                            </div>
                        )}

                        {!loading && !error && (
                            <>
                                {activeTab === 'open' && (
                                    <OpenScrimsTab scrims={filteredOpenScrims} user={user} currentUserId={user?.id}
                                        captainTeams={captainTeams} leagueFilter={leagueFilter} setLeagueFilter={setLeagueFilter}
                                        tierFilter={tierFilter} setTierFilter={setTierFilter}
                                        regionFilter={regionFilter} setRegionFilter={setRegionFilter}
                                        divisionFilter={divisionFilter} setDivisionFilter={setDivisionFilter}
                                        uniqueLeagues={uniqueLeagues} uniqueTiers={uniqueTiers}
                                        activeDivisions={activeDivisions}
                                        onAccept={handleAccept} actionLoading={actionLoading}
                                        login={login} acceptModal={acceptModal} setAcceptModal={setAcceptModal}
                                        reliabilityScores={reliabilityScores} />
                                )}
                                {activeTab === 'my' && user && (
                                    <MyScrimsTab scrims={myScrims} incomingScrims={incomingScrims} captainTeams={captainTeams}
                                        currentUserId={user?.id} onAccept={handleAccept} onCancel={handleCancel}
                                        onDecline={handleDecline} actionLoading={actionLoading} acceptModal={acceptModal}
                                        setAcceptModal={setAcceptModal} reliabilityScores={reliabilityScores}
                                        onReportOutcome={handleReportOutcome} onDisputeOutcome={handleDisputeOutcome}
                                        onConfirmAccept={handleConfirmAccept} onDenyAccept={handleDenyAccept}
                                        activeDivisions={activeDivisions} />
                                )}
                            </>
                        )}
                    </div>
                </DraggableXpWindow>

                {/* ═══ POST SCRIM WIZARD WINDOW ═══ */}
                {showPostWindow && isCaptain && (
                    <DraggableXpWindow
                        title="Post Scrim Wizard"
                        icon="&#128228;"
                        defaultX={typeof window !== 'undefined' ? Math.max(40, (window.innerWidth - 520) / 2) : 100}
                        defaultY={typeof window !== 'undefined' ? Math.min(120, window.innerHeight * 0.15) : 120}
                        className="xp-post-window"
                        resizable={false}
                        onClose={() => setShowPostWindow(false)}
                        zIndex={30}
                        minimized={!!minimizedWindows.post}
                        onMinimize={(v) => setWinMinimized('post', v)}
                    >
                        <PostScrimWizard captainTeams={captainTeams} allTeams={allTeams}
                            myScrims={myScrims}
                            onSuccess={() => { loadOpenScrims(); loadMyScrims(); setShowPostWindow(false) }} />
                    </DraggableXpWindow>
                )}

                {/* ═══ XP TASKBAR ═══ */}
                <div className="xp-taskbar">
                    {/* Start button + menu */}
                    <div ref={startRef} className="relative">
                        <button
                            onClick={() => !user ? login() : setStartMenuOpen(prev => !prev)}
                            className={`xp-start-btn ${startMenuOpen ? 'xp-start-pressed' : ''}`}
                        >
                            <span className="xp-start-flag">&#10063;</span>
                            <span>start</span>
                        </button>

                        {/* Start Menu popup */}
                        {startMenuOpen && (
                            <div className="xp-start-menu">
                                <div className="xp-start-menu-banner">
                                    <span className="xp-start-menu-banner-text">SmiteComp</span>
                                </div>
                                <div className="xp-start-menu-body">
                                    <Link
                                        to="/coinflip"
                                        onClick={() => setStartMenuOpen(false)}
                                        className="xp-start-menu-item"
                                    >
                                        <div className="xp-start-menu-item-icon-wrap">
                                            <img src={passionCoin} alt="" className="xp-start-menu-icon" />
                                        </div>
                                        <span>Coin Flip</span>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick launch divider */}
                    <div className="xp-taskbar-divider" />

                    {/* Active window buttons — click to minimize/restore */}
                    <button
                        className={`xp-taskbar-window-btn ${minimizedWindows.runner ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                        onClick={() => setWinMinimized('runner', !minimizedWindows.runner)}
                    >
                        <span style={{ fontSize: 12 }}>⚡</span>
                        <span>SmiteRunner</span>
                    </button>
                    <button
                        className={`xp-taskbar-window-btn ${minimizedWindows.main ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                        onClick={() => setWinMinimized('main', !minimizedWindows.main)}
                    >
                        <span style={{ fontSize: 12 }}>&#9876;</span>
                        <span>Scrim Planner</span>
                    </button>
                    <button
                        className={`xp-taskbar-window-btn ${minimizedWindows.coinflip ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                        onClick={() => setWinMinimized('coinflip', !minimizedWindows.coinflip)}
                    >
                        <span style={{ fontSize: 12 }}>&#128176;</span>
                        <span>CoinFlip</span>
                    </button>
                    {user && myTeams.length > 0 && (
                        <button
                            className={`xp-taskbar-window-btn ${minimizedWindows.calendar ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                            onClick={() => setWinMinimized('calendar', !minimizedWindows.calendar)}
                        >
                            <span style={{ fontSize: 12 }}>&#128197;</span>
                            <span>Calendar</span>
                        </button>
                    )}
                    {user && (
                        <button
                            className={`xp-taskbar-window-btn ${minimizedWindows.challenges ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                            onClick={() => setWinMinimized('challenges', !minimizedWindows.challenges)}
                        >
                            <span style={{ fontSize: 12 }}>&#127942;</span>
                            <span>Challenges</span>
                        </button>
                    )}
                    {showPostWindow && (
                        <button
                            className={`xp-taskbar-window-btn ${minimizedWindows.post ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                            onClick={() => setWinMinimized('post', !minimizedWindows.post)}
                        >
                            <span style={{ fontSize: 12 }}>&#128228;</span>
                            <span>Post Scrim</span>
                        </button>
                    )}
                    {user && isCaptain && (
                        <button
                            className={`xp-taskbar-window-btn ${minimizedWindows.blacklist ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                            onClick={() => setWinMinimized('blacklist', !minimizedWindows.blacklist)}
                        >
                            <span style={{ fontSize: 12 }}>&#128683;</span>
                            <span>Blacklist</span>
                        </button>
                    )}
                    {user && isOwner && (
                        <button
                            className={`xp-taskbar-window-btn ${minimizedWindows.impersonate ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}${impersonatedUser ? ' xp-taskbar-impersonating' : ''}`}
                            onClick={() => setWinMinimized('impersonate', !minimizedWindows.impersonate)}
                        >
                            <span style={{ fontSize: 12 }}>&#128373;</span>
                            <span>{impersonatedUser ? impersonatedUser.discordUsername : 'Impersonate'}</span>
                        </button>
                    )}
                    {showHelp && (
                        <button
                            className={`xp-taskbar-window-btn ${minimizedWindows.help ? 'xp-taskbar-window-minimized' : 'xp-taskbar-window-active'}`}
                            onClick={() => setWinMinimized('help', !minimizedWindows.help)}
                        >
                            <span style={{ fontSize: 12 }}>&#10068;</span>
                            <span>Help</span>
                        </button>
                    )}

                    <div className="flex-1" />

                    {/* System tray */}
                    <div className="xp-tray">
                        {!user && <span className="xp-tray-text">Log in to post or accept scrims</span>}
                        {user && <span className="xp-tray-text">{user.discord_username}</span>}
                        <div className="xp-tray-divider" />
                        <XpClock />
                    </div>
                </div>
            </div>

            <style>{XP_STYLES}</style>
        </>
    )
}
