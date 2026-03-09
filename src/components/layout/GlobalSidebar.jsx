import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSidebar } from '../../context/SidebarContext'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { formatRank } from '../../config/ranks'
import RankBadge from '../RankBadge'
import { leagueService, communityTeamService } from '../../services/database'
import { getLeagueLogo } from '../../utils/leagueImages'
import { getDivisionImage } from '../../utils/divisionImages'
import passionCoin from '../../assets/passion/passion.png'
import {
    X, User, Trophy, Flame, Wrench, Shield,
    ChevronDown, UserCheck, LogOut, Sparkles, Tv, MessageSquare, Heart, UserPlus, Swords, Users, Mail, Check, Cpu, ArrowLeftRight
} from 'lucide-react'
import { FEATURE_FLAGS } from '../../config/featureFlags'

function SidebarSection({ icon: Icon, label, defaultOpen = false, children, badge }) {
    const [expanded, setExpanded] = useState(defaultOpen)

    return (
        <div className="mb-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5 transition-colors cursor-pointer"
            >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {badge}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <div
                className="overflow-hidden transition-all duration-200 ease-in-out"
                style={{ maxHeight: expanded ? '800px' : '0px', opacity: expanded ? 1 : 0 }}
            >
                <div className="py-1 pl-2 pr-1">
                    {children}
                </div>
            </div>
        </div>
    )
}

function SidebarLink({ to, icon: Icon, children, onClick, badge, active }) {
    const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
    const activeClass = "text-(--color-accent) bg-(--color-accent)/10"
    const inactiveClass = "text-(--nav-text) hover:text-(--color-text) hover:bg-white/5"

    if (onClick) {
        return (
            <button onClick={onClick} className={`w-full ${base} ${inactiveClass} cursor-pointer`}>
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <span className="flex-1 text-left">{children}</span>
                {badge}
            </button>
        )
    }

    return (
        <Link to={to} className={`${base} ${active ? activeClass : inactiveClass}`}>
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{children}</span>
            {badge}
        </Link>
    )
}

export default function GlobalSidebar() {
    const { isOpen, open, close } = useSidebar()
    const { user, linkedPlayer, login, logout, isAdmin, hasPermission, hasAnyPermission, avatarUrl } = useAuth()
    const passion = usePassion()
    const location = useLocation()
    const sidebarRef = useRef(null)

    const [leagues, setLeagues] = useState([])
    const [leaguesLoading, setLeaguesLoading] = useState(false)
    const hasFetchedLeagues = useRef(false)
    const [teamInviteCount, setTeamInviteCount] = useState(0)
    const [showInvitesModal, setShowInvitesModal] = useState(false)
    const [pendingInvites, setPendingInvites] = useState(null)
    const [inviteResponding, setInviteResponding] = useState(null)
    // Close on route change
    useEffect(() => {
        close()
    }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return
        const handleKey = (e) => {
            if (e.key === 'Escape') close()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [isOpen, close])

    // Swipe gesture: right-to-open from left edge, left-to-close on sidebar
    useEffect(() => {
        const EDGE_ZONE = 30 // px from left edge to start swipe-to-open
        const SWIPE_THRESHOLD = 60 // px minimum distance to trigger
        let touchStartX = null
        let touchStartY = null
        let isEdgeSwipe = false

        const onTouchStart = (e) => {
            const touch = e.touches[0]
            touchStartX = touch.clientX
            touchStartY = touch.clientY

            if (!isOpen && touch.clientX <= EDGE_ZONE) {
                isEdgeSwipe = true
            } else if (isOpen && sidebarRef.current?.contains(e.target)) {
                isEdgeSwipe = true
            } else {
                isEdgeSwipe = false
            }
        }

        const onTouchEnd = (e) => {
            if (!isEdgeSwipe || touchStartX === null) {
                touchStartX = null
                touchStartY = null
                isEdgeSwipe = false
                return
            }

            const touch = e.changedTouches[0]
            const dx = touch.clientX - touchStartX
            const dy = Math.abs(touch.clientY - touchStartY)

            // Ignore if vertical scroll is dominant
            if (dy > Math.abs(dx)) {
                touchStartX = null
                touchStartY = null
                isEdgeSwipe = false
                return
            }

            if (!isOpen && dx >= SWIPE_THRESHOLD) {
                open()
            } else if (isOpen && dx <= -SWIPE_THRESHOLD) {
                close()
            }

            touchStartX = null
            touchStartY = null
            isEdgeSwipe = false
        }

        document.addEventListener('touchstart', onTouchStart, { passive: true })
        document.addEventListener('touchend', onTouchEnd, { passive: true })
        return () => {
            document.removeEventListener('touchstart', onTouchStart)
            document.removeEventListener('touchend', onTouchEnd)
        }
    }, [isOpen, open, close])

    // Lazy-fetch leagues on first open
    useEffect(() => {
        if (!isOpen || hasFetchedLeagues.current) return
        hasFetchedLeagues.current = true
        setLeaguesLoading(true)

        const load = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                const detailed = await Promise.all(
                    allLeagues.map(l => leagueService.getBySlug(l.slug))
                )
                setLeagues(
                    detailed
                        .filter(l => l.name?.toLowerCase() !== 'test league')
                        .sort((a, b) => {
                            const aActive = a.divisions?.some(d => d.seasons?.some(s => s.is_active)) ? 0 : 1
                            const bActive = b.divisions?.some(d => d.seasons?.some(s => s.is_active)) ? 0 : 1
                            return aActive - bActive
                        })
                )
            } catch (err) {
                console.error('Sidebar: failed to load leagues', err)
            } finally {
                setLeaguesLoading(false)
            }
        }
        load()
    }, [isOpen])

    // Fetch pending team invite count for badge
    useEffect(() => {
        if (!user || !(FEATURE_FLAGS.BYOT_RELEASED || isAdmin)) return
        communityTeamService.getPendingCount()
            .then(data => setTeamInviteCount(data.count || 0))
            .catch(() => {})
    }, [user, isAdmin])

    const isActive = (path, exact = false) => {
        if (exact) return location.pathname === path
        return location.pathname === path || location.pathname.startsWith(path + '/')
    }

    const rank = passion?.rank
    const nextRank = passion?.nextRank
    const totalEarned = passion?.totalEarned || 0
    const progressPct = nextRank
        ? ((totalEarned - rank?.minPassion) / (nextRank.minPassion - rank?.minPassion)) * 100
        : 100

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[59] bg-black/50 transition-opacity duration-300
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                onClick={close}
                aria-hidden="true"
            />

            {/* Sidebar Panel */}
            <div
                ref={sidebarRef}
                className={`fixed inset-y-0 left-0 z-[60] w-80 max-w-[85vw]
                    bg-(--color-secondary) border-r border-white/10 shadow-2xl shadow-black/50
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="h-full flex flex-col">
                    {/* Close button — always visible */}
                    <button
                        onClick={close}
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Everything scrolls together */}
                    <div className="flex-1 overflow-y-auto panel-scrollbar">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 border-b border-white/5">

                        {user ? (
                            <div className="flex flex-col items-center text-center pt-2">
                                {/* Rank badge */}
                                {rank && (
                                    <div className="mb-3">
                                        <RankBadge rank={rank} size="2xl" />
                                    </div>
                                )}

                                {/* Rank name */}
                                {rank && (
                                    <div className="text-lg font-heading font-bold text-(--color-text) mb-1">
                                        {formatRank(rank)}
                                    </div>
                                )}

                                {/* Passion balance */}
                                <div className="flex items-center gap-2 mb-3">
                                    <img src={passionCoin} alt="Passion" className="w-5 h-5" />
                                    <span className="text-xl font-bold text-(--color-accent) tabular-nums">
                                        {passion?.balance?.toLocaleString() ?? 0}
                                    </span>
                                </div>

                                {/* Progress bar */}
                                {nextRank && rank && (
                                    <div className="w-full max-w-[220px]">
                                        <div className="flex justify-between text-[10px] text-(--color-text-secondary) mb-1">
                                            <span>{formatRank(rank)}</span>
                                            <span>{formatRank(nextRank)}</span>
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(progressPct, 100)}%`,
                                                    background: 'linear-gradient(90deg, #d4a04a, #f8c56a)',
                                                }}
                                            />
                                        </div>
                                        <div className="text-[10px] text-(--color-text-secondary) mt-1">
                                            {nextRank.passionNeeded} more to {formatRank(nextRank)}
                                        </div>
                                    </div>
                                )}
                                {rank && !nextRank && (
                                    <div className="text-xs text-(--color-accent) font-medium">Max Rank!</div>
                                )}

                                {/* User info */}
                                <div className="flex items-center gap-2 mt-3 text-xs text-(--color-text-secondary)">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[9px] font-bold">
                                            {user.discord_username?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <span>{user.discord_username}</span>
                                    <span className="text-(--color-text-secondary)/50">
                                        {isAdmin ? '• Admin' : hasAnyPermission ? '• Staff' : ''}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center pt-6 pb-2">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <User className="w-8 h-8 text-(--color-text-secondary)/40" />
                                </div>
                                <p className="text-sm text-(--color-text-secondary) mb-4">
                                    Log in to track your rank and progress
                                </p>
                                <button
                                    onClick={() => { close(); login() }}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors cursor-pointer"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                    </svg>
                                    Login with Discord
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sections */}
                    <div className="px-2 py-3">
                        {/* Profile */}
                        {user && linkedPlayer && (
                            <SidebarLink
                                to={`/profile/${linkedPlayer.slug}`}
                                icon={UserCheck}
                                active={isActive(`/profile/${linkedPlayer.slug}`)}
                            >
                                My Profile
                            </SidebarLink>
                        )}
                        {user && !linkedPlayer && (
                            <SidebarLink
                                icon={User}
                                onClick={() => {
                                    close()
                                    window.dispatchEvent(new CustomEvent('open-claim-modal'))
                                }}
                            >
                                <span className="text-[#5865F2]">Claim Your Profile</span>
                            </SidebarLink>
                        )}
                        {FEATURE_FLAGS.FORGE_RELEASED && (
                            <>
                                <SidebarLink to={isActive('/forge') ? location.pathname : '/forge'} active={isActive('/forge')}>
                                    <span className="flex items-center gap-3">
                                        <Flame className="w-4 h-4 shrink-0 text-orange-400" />
                                        Fantasy Forge
                                    </span>
                                </SidebarLink>
                                {(FEATURE_FLAGS.CARD_CLASH_RELEASED || isAdmin || hasPermission('codex_edit')) && (
                                    <SidebarLink to="/cardclash" active={isActive('/cardclash')}>
                                        <span className="flex items-center gap-3">
                                            <Cpu className="w-4 h-4 shrink-0 text-[#00e5ff]" />
                                            Compdeck
                                        </span>
                                    </SidebarLink>
                                )}
                                <SidebarLink to="/scrims" active={isActive('/scrims')}>
                                    <span className="flex items-center gap-3">
                                        <Swords className="w-4 h-4 shrink-0 text-emerald-400" />
                                        Scrim Planner
                                    </span>
                                </SidebarLink>
                                {user && (FEATURE_FLAGS.BYOT_RELEASED || isAdmin) && (
                                    <SidebarLink to="/team" active={isActive('/team')}>
                                        <span className="flex items-center gap-3">
                                            <Users className="w-4 h-4 shrink-0 text-blue-400" />
                                            Build your Team
                                        </span>
                                    </SidebarLink>
                                )}
                                <SidebarLink to="/leagues" active={isActive('/leagues', true)}>
                                    <span className="flex items-center gap-3">
                                        <Trophy className="w-4 h-4 shrink-0 text-yellow-400" />
                                        Browse All Leagues
                                    </span>
                                </SidebarLink>
                                {user && teamInviteCount > 0 && (
                                    <SidebarLink
                                        onClick={async () => {
                                            setShowInvitesModal(true)
                                            try {
                                                const data = await communityTeamService.getPending()
                                                setPendingInvites(data)
                                            } catch {}
                                        }}
                                        badge={
                                            <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-amber-500/20 text-amber-400">
                                                {teamInviteCount}
                                            </span>
                                        }
                                    >
                                        <span className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 shrink-0 text-amber-400" />
                                            Pending Invites
                                        </span>
                                    </SidebarLink>
                                )}
                                {!passion?.inDiscord && (
                                    <a
                                        href="https://discord.gg/vAdQMp65nK"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
                                    >
                                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                        </svg>
                                        Join Our Discord
                                    </a>
                                )}
                                <div className="border-b border-white/5 my-2 mx-3" />
                            </>
                        )}
                        {!FEATURE_FLAGS.FORGE_RELEASED && (
                            <div className="border-b border-white/5 my-2 mx-3" />
                        )}

                        {/* Leagues section */}
                        <SidebarSection icon={Trophy} label="Leagues" defaultOpen={false}>
                            {leaguesLoading && (
                                <div className="flex items-center gap-2 px-3 py-2 text-xs text-(--color-text-secondary)">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-(--color-accent)" />
                                    Loading...
                                </div>
                            )}

                            {leagues.map(league => {
                                const logo = getLeagueLogo(league.slug)
                                const activeDivisions = (league.divisions || []).filter(
                                    d => d.seasons?.some(s => s.is_active)
                                )

                                return (
                                    <div key={league.id} className="mt-1">
                                        <Link
                                            to={league.slug === 'agl' ? '/agl/signup' : `/${league.slug}`}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                                                isActive(`/${league.slug}`, true)
                                                    ? 'text-(--color-accent) bg-(--color-accent)/10'
                                                    : 'text-(--nav-text) hover:text-(--color-text) hover:bg-white/5'
                                            }`}
                                        >
                                            {logo ? (
                                                <img src={logo} alt="" className="w-5 h-5 object-contain rounded" />
                                            ) : (
                                                <Trophy className="w-4 h-4 shrink-0" />
                                            )}
                                            <span className="truncate font-medium">{league.name}</span>
                                        </Link>

                                        {/* Active divisions indented */}
                                        {activeDivisions.map(div => {
                                            const divImg = getDivisionImage(league.slug, div.slug, div.tier)
                                            const divPath = `/${league.slug}/${div.slug}`
                                            return (
                                                <Link
                                                    key={div.id}
                                                    to={divPath}
                                                    className={`flex items-center gap-2.5 pl-8 pr-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                        isActive(divPath)
                                                            ? 'text-(--color-accent) bg-(--color-accent)/10'
                                                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                                                    }`}
                                                >
                                                    {divImg ? (
                                                        <img src={divImg} alt="" className="w-4 h-4 object-contain" />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                                                    )}
                                                    <span className="truncate">{div.name}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </SidebarSection>

                        <SidebarLink
                            to="/players"
                            icon={Users}
                            active={isActive('/players', true)}
                        >
                            Players
                        </SidebarLink>

                        <SidebarLink
                            to="/transactions"
                            icon={ArrowLeftRight}
                            active={isActive('/transactions', true)}
                        >
                            Transactions
                        </SidebarLink>

                        {/* Passion section */}
                        <SidebarSection
                            icon={Flame}
                            label="Passion"
                            defaultOpen={true}
                            badge={passion?.claimableCount > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                                    style={{ background: '#f8c56a', color: '#0a0f1a' }}>
                                    {passion.claimableCount}
                                </span>
                            )}
                        >
                            <SidebarLink
                                to="/challenges"
                                icon={Sparkles}
                                active={isActive('/challenges')}
                                badge={passion?.claimableCount > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'rgba(248,197,106,0.15)', color: '#f8c56a' }}>
                                        {passion.claimableCount} ready
                                    </span>
                                )}
                            >
                                Challenges
                            </SidebarLink>
                            <SidebarLink to="/leaderboard" active={isActive('/leaderboard')}>
                                Leaderboard
                            </SidebarLink>
                            <SidebarLink to="/coinflip" active={isActive('/coinflip')}>
                                Coin Flip
                            </SidebarLink>
                            <SidebarLink to="/shop" active={isActive('/shop')}
                                badge={
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'rgba(248,197,106,0.15)', color: '#f8c56a' }}>
                                        Soon
                                    </span>
                                }
                            >
                                Passion Shop
                            </SidebarLink>
                        </SidebarSection>

                        {/* Tools section */}
                        <SidebarSection icon={Wrench} label="Tools" defaultOpen={true}>
                            <SidebarLink to="/tierlist" active={isActive('/tierlist')}>
                                Tier List
                            </SidebarLink>
                            <SidebarLink to="/god-tierlist" active={isActive('/god-tierlist')}>
                                God Tier List
                            </SidebarLink>
                            <SidebarLink to="/draft" active={isActive('/draft')}>
                                Draft Simulator
                            </SidebarLink>
                            <SidebarLink to="/twitch" icon={Tv} active={isActive('/twitch')}>
                                Featured Stream
                            </SidebarLink>
                        </SidebarSection>

                        {/* Support & Feedback */}
                        <div className="border-b border-white/5 my-2 mx-3" />
                        {user && (
                            <SidebarLink to="/referral" icon={UserPlus} active={isActive('/referral')}>
                                Refer a Friend
                            </SidebarLink>
                        )}
                        <SidebarLink
                            icon={Sparkles}
                            onClick={() => {
                                close()
                                window.dispatchEvent(new CustomEvent('open-whats-new'))
                            }}
                        >
                            What's New
                        </SidebarLink>
                        <SidebarLink
                            to="/support"
                            icon={Heart}
                            active={isActive('/support')}
                        >
                            Support
                        </SidebarLink>
                        {user && (
                            <SidebarLink
                                to="/feedback"
                                icon={MessageSquare}
                                active={isActive('/feedback')}
                            >
                                Submit Feedback
                            </SidebarLink>
                        )}

                        {/* Admin section — conditional */}
                        {(isAdmin || hasAnyPermission) && (
                            <SidebarSection icon={Shield} label="Admin" defaultOpen={true}>
                                <SidebarLink
                                    to="/admin"
                                    icon={Shield}
                                    active={isActive('/admin')}
                                >
                                    Dashboard
                                </SidebarLink>
                            </SidebarSection>
                        )}

                        {/* Log Out — bottom */}
                        {user && (
                            <>
                                <div className="border-b border-white/5 my-2 mx-3" />
                                <SidebarLink
                                    icon={LogOut}
                                    onClick={() => { close(); logout() }}
                                >
                                    <span className="text-red-400">Log Out</span>
                                </SidebarLink>
                            </>
                        )}
                    </div>
                    </div>{/* end scroll wrapper */}
                </div>
            </div>

        {/* Pending Invites Modal */}
        {showInvitesModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowInvitesModal(false)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative w-full max-w-sm bg-(--color-primary) border border-white/10 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                        <h2 className="text-base font-bold text-(--color-text)">Pending Invites</h2>
                        <button onClick={() => setShowInvitesModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) transition-colors cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto panel-scrollbar">
                        {!pendingInvites ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <>
                                {pendingInvites.invites?.map(inv => (
                                    <div key={inv.id} className="border border-white/[0.06] rounded-lg overflow-hidden">
                                        {/* Team header */}
                                        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02]">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                                {inv.team_logo ? (
                                                    <img src={inv.team_logo} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Users className="w-4 h-4 text-(--color-text-secondary)/40" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-(--color-text) truncate">{inv.team_name}</div>
                                                <div className="text-[10px] text-(--color-text-secondary)">Invited by {inv.from_username}</div>
                                            </div>
                                        </div>
                                        {/* Members */}
                                        {inv.members?.length > 0 && (
                                            <div className="px-3.5 py-2 border-t border-white/[0.04]">
                                                <div className="text-[9px] uppercase tracking-widest text-(--color-text-secondary)/40 mb-1.5 font-semibold">Members</div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                    {inv.members.map((m, i) => {
                                                        const name = m.player_name || m.discord_username || '?'
                                                        const profileSlug = m.player_slug || m.discord_username
                                                        return (
                                                            <div key={i} className="flex items-center gap-1.5 py-0.5">
                                                                {m.discord_avatar && m.discord_id ? (
                                                                    <img src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.discord_avatar}.png?size=64`} alt="" className="w-4 h-4 rounded-full shrink-0" />
                                                                ) : (
                                                                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-(--color-text-secondary) shrink-0">
                                                                        {name[0].toUpperCase()}
                                                                    </div>
                                                                )}
                                                                {profileSlug ? (
                                                                    <Link to={`/profile/${profileSlug}`} onClick={() => setShowInvitesModal(false)} className="text-[11px] text-(--color-text)/70 hover:text-(--color-text) transition-colors">
                                                                        {name}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-[11px] text-(--color-text)/70">{name}</span>
                                                                )}
                                                                {m.role === 'captain' && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                                                                {m.role === 'co_captain' && <Crown className="w-2.5 h-2.5 text-amber-400/60 shrink-0" />}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {/* Actions */}
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-white/[0.04]">
                                            <button
                                                onClick={async () => {
                                                    setInviteResponding(inv.id)
                                                    try {
                                                        await communityTeamService.respond(inv.id, true)
                                                        setPendingInvites(prev => ({ ...prev, invites: prev.invites.filter(i => i.id !== inv.id) }))
                                                        setTeamInviteCount(c => Math.max(0, c - 1))
                                                    } catch {}
                                                    setInviteResponding(null)
                                                }}
                                                disabled={inviteResponding === inv.id}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-40"
                                            >
                                                <Check className="w-3.5 h-3.5" /> Accept
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setInviteResponding(inv.id)
                                                    try {
                                                        await communityTeamService.respond(inv.id, false)
                                                        setPendingInvites(prev => ({ ...prev, invites: prev.invites.filter(i => i.id !== inv.id) }))
                                                        setTeamInviteCount(c => Math.max(0, c - 1))
                                                    } catch {}
                                                    setInviteResponding(null)
                                                }}
                                                disabled={inviteResponding === inv.id}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                                            >
                                                <X className="w-3.5 h-3.5" /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {pendingInvites.incomingRequests?.map(req => (
                                    <div key={req.id} className="border border-white/[0.06] rounded-lg overflow-hidden">
                                        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02]">
                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                                {req.from_avatar && req.from_discord_id ? (
                                                    <img src={`https://cdn.discordapp.com/avatars/${req.from_discord_id}/${req.from_avatar}.png?size=64`} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-bold text-(--color-text-secondary)">{req.from_username?.[0]?.toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-(--color-text) truncate">{req.from_player_name || req.from_username}</div>
                                                <div className="text-[10px] text-(--color-text-secondary)">Wants to join {req.team_name}</div>
                                            </div>
                                        </div>
                                        {/* Team members */}
                                        {req.members?.length > 0 && (
                                            <div className="px-3.5 py-2 border-t border-white/[0.04]">
                                                <div className="text-[9px] uppercase tracking-widest text-(--color-text-secondary)/40 mb-1.5 font-semibold">Current Members</div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                    {req.members.map((m, i) => {
                                                        const name = m.player_name || m.discord_username || '?'
                                                        const profileSlug = m.player_slug || m.discord_username
                                                        return (
                                                            <div key={i} className="flex items-center gap-1.5 py-0.5">
                                                                {m.discord_avatar && m.discord_id ? (
                                                                    <img src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.discord_avatar}.png?size=64`} alt="" className="w-4 h-4 rounded-full shrink-0" />
                                                                ) : (
                                                                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-(--color-text-secondary) shrink-0">
                                                                        {name[0].toUpperCase()}
                                                                    </div>
                                                                )}
                                                                {profileSlug ? (
                                                                    <Link to={`/profile/${profileSlug}`} onClick={() => setShowInvitesModal(false)} className="text-[11px] text-(--color-text)/70 hover:text-(--color-text) transition-colors">
                                                                        {name}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-[11px] text-(--color-text)/70">{name}</span>
                                                                )}
                                                                {m.role === 'captain' && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                                                                {m.role === 'co_captain' && <Crown className="w-2.5 h-2.5 text-amber-400/60 shrink-0" />}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-white/[0.04]">
                                            <button
                                                onClick={async () => {
                                                    setInviteResponding(req.id)
                                                    try {
                                                        await communityTeamService.respond(req.id, true)
                                                        setPendingInvites(prev => ({ ...prev, incomingRequests: prev.incomingRequests.filter(r => r.id !== req.id) }))
                                                        setTeamInviteCount(c => Math.max(0, c - 1))
                                                    } catch {}
                                                    setInviteResponding(null)
                                                }}
                                                disabled={inviteResponding === req.id}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-40"
                                            >
                                                <Check className="w-3.5 h-3.5" /> Accept
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setInviteResponding(req.id)
                                                    try {
                                                        await communityTeamService.respond(req.id, false)
                                                        setPendingInvites(prev => ({ ...prev, incomingRequests: prev.incomingRequests.filter(r => r.id !== req.id) }))
                                                        setTeamInviteCount(c => Math.max(0, c - 1))
                                                    } catch {}
                                                    setInviteResponding(null)
                                                }}
                                                disabled={inviteResponding === req.id}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                                            >
                                                <X className="w-3.5 h-3.5" /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(!pendingInvites.invites?.length && !pendingInvites.incomingRequests?.length) && (
                                    <p className="text-sm text-(--color-text-secondary) text-center py-4">No pending invites</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
    )
}
