import { lazy, Suspense, useEffect, useState, useRef } from 'react'
import { VaultProvider, useVault } from './vault/VaultContext'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { FEATURE_FLAGS } from '../config/featureFlags'
import { tradematchService } from '../services/database'
import Navbar from '../components/layout/Navbar'
import PageTitle from '../components/PageTitle'
import { Package, BookOpen, Settings, Library, ArrowRightLeft, Star, Store, Gift, Handshake, Hammer, Users, BookMarked, Crosshair, MoreHorizontal, Gem, Heart } from 'lucide-react'
import VaultHeroBanner from './vault/VaultHeroBanner'
import VaultTabBar from './vault/VaultTabBar'
import './vault/compdeck.css'

function lazyRetry(fn) {
    return lazy(() => fn().catch(() => {
        // Retry once after a brief delay (transient network failure).
        // Persistent chunk failures (stale deploy) are handled by ErrorBoundary.
        return new Promise(resolve => setTimeout(resolve, 1000)).then(fn)
    }))
}

const CCPackShop = lazyRetry(() => import('./vault/CCPackShop'))
const CCCardCatalog = lazyRetry(() => import('./vault/CCCardCatalog'))
const CCPlayerCards = lazyRetry(() => import('./vault/CCPlayerCards'))
const CCSettings = lazyRetry(() => import('./vault/CCSettings'))
const CCCollection = lazyRetry(() => import('./vault/CCCollection'))
const CCConverter = lazyRetry(() => import('./vault/CCConverter'))
const CCChallenges = lazyRetry(() => import('./vault/CCChallenges'))
const CCMarketplace = lazyRetry(() => import('./vault/CCMarketplace'))
const CCGifts = lazyRetry(() => import('./vault/CCGifts'))
const CCTrading = lazyRetry(() => import('./vault/CCTrading'))
const CCDismantle = lazyRetry(() => import('./vault/CCDismantle'))
const CCStartingFive = lazyRetry(() => import('./vault/CCStartingFive'))
const CCBinder = lazyRetry(() => import('./vault/CCBinder'))
const CCBountyBoard = lazyRetry(() => import('./vault/CCBountyBoard'))
const CCSignatureRequests = lazyRetry(() => import('./vault/CCSignatureRequests'))
const CCSignatureApprovals = lazyRetry(() => import('./vault/CCSignatureApprovals'))
const CCUniqueCards = lazyRetry(() => import('./vault/CCUniqueCards'))
const CCTradematch = lazyRetry(() => import('./vault/CCTradematch'))

const TABS = [
    { key: 'packs', label: 'Packs', icon: Package },
    { key: 'lineup', label: 'Starting 5', icon: Users },
    { key: 'collection', label: 'Collection', icon: Library },
    { key: 'challenges', label: 'Challenges', icon: Star },
    { key: 'gifts', label: 'Gifts', icon: Gift },
    { key: 'trade', label: 'Trade', icon: Handshake },
    { key: 'market', label: 'Market', icon: Store },
    { key: 'bounty', label: 'Bounties', icon: Crosshair, authOnly: true },
    { key: 'tradematch', label: 'Tradematch', icon: Heart, authOnly: true },
    { key: 'dismantle', label: 'Dismantle', icon: Hammer },
    { key: 'convert', label: 'Convert', icon: ArrowRightLeft },
    { key: 'binder', label: 'Binder', icon: BookMarked },
    // { key: 'players', label: 'Players', icon: UserSearch },
    { key: 'catalog', label: 'Catalog', icon: BookOpen },
    { key: 'unique', label: 'Unique Cards', icon: Gem, authOnly: true },
    { key: 'settings', label: 'Settings', icon: Settings, authOnly: true },
]

const DESKTOP_MORE_KEYS = new Set(['settings', 'binder', 'catalog', 'unique', 'convert'])

const TAB_COMPONENTS = {
    packs: CCPackShop,
    lineup: CCStartingFive,
    catalog: CCCardCatalog,
    collection: CCCollection,
    binder: CCBinder,
    gifts: CCGifts,
    trade: CCTrading,
    tradematch: CCTradematch,
    market: CCMarketplace,
    bounty: CCBountyBoard,
    dismantle: CCDismantle,
    convert: CCConverter,
    challenges: CCChallenges,
    players: CCPlayerCards,
    unique: CCUniqueCards,
    settings: CCSettings,
}

export default function VaultPage() {
    const { user, login, loading, hasPermission, vaultBanned } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (vaultBanned) navigate('/', { replace: true })
    }, [vaultBanned, navigate])

    if (loading) {
        return null
    }

    if (vaultBanned) {
        return null
    }

    if (!user) {
        return (
            <div className="compdeck">
                <Navbar branding={
                    <div className="hidden sm:flex items-center gap-1.5">
                        <span className="cd-head text-[0.6rem] tracking-[0.4em] text-[var(--cd-cyan)] opacity-55">THE</span>
                        <span className="cd-head text-sm font-bold tracking-[0.12em]" style={{ background: 'linear-gradient(180deg, #e0e8f0 20%, #00e5ff 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>VAULT</span>
                    </div>
                } />
                <VaultHeroBanner />
                <div className="relative z-1 flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-white/50 mb-6 text-sm">Sign in to collect cards, open packs, and trade with other players.</p>
                    <button
                        onClick={login}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                        </svg>
                        Sign in with Discord
                    </button>
                </div>
            </div>
        )
    }

    if (!FEATURE_FLAGS.VAULT_OPEN && !hasPermission('vault_early_access')) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h1 className="text-2xl font-bold mb-2">The Vault</h1>
                <p className="text-(--color-text-secondary) mb-4">The Vault is not yet available. Check back soon!</p>
            </div>
        )
    }

    if (FEATURE_FLAGS.VAULT_MAINTENANCE && !hasPermission('vault_early_access')) {
        return (
            <div className="compdeck min-h-screen flex flex-col items-center justify-center text-center px-4">
                <Navbar branding={
                    <div className="hidden sm:flex items-center gap-1.5">
                        <span className="cd-head text-[0.6rem] tracking-[0.4em] text-[var(--cd-cyan)] opacity-55">THE</span>
                        <span className="cd-head text-sm font-bold tracking-[0.12em]" style={{ background: 'linear-gradient(180deg, #e0e8f0 20%, #00e5ff 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>VAULT</span>
                    </div>
                } />
                <div className="flex flex-col items-center gap-4">
                    <svg className="w-16 h-16 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    <h2 className="text-xl font-bold text-white/70">Under Maintenance</h2>
                    <p className="text-white/40 text-sm max-w-xs">The Vault is temporarily down for maintenance. We'll be right back!</p>
                </div>
            </div>
        )
    }

    return (
        <VaultProvider>
            <VaultInner />
        </VaultProvider>
    )
}

function VaultInner() {
    const { user } = useAuth()
    const { vaultClaimableCount, refreshBalance } = usePassion()
    const [searchParams, setSearchParams] = useSearchParams()
    const { loading, loaded, vaultBanned, accountTooNew, giftData, pendingTradeCount, matchTradeCount, matchTradePendingCount, setMatchTradePendingCount, setMatchTradeCount, pendingSignatureCount, pendingApprovalCount, inventory } = useVault()
    const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
    const desktopMoreRef = useRef(null)
    const unseenGifts = giftData?.unseenCount || 0
    const [showTradematchPromo, setShowTradematchPromo] = useState(() => !localStorage.getItem('tradematch-promo-dismissed'))

    // Poll vaultClaimableCount every 60s while vault is visible
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') refreshBalance()
        }, 60_000)
        return () => clearInterval(id)
    }, [refreshBalance])
    // Refetch match trade pending count on every tab switch
    const activeTab = searchParams.get('tab') || 'packs'
    useEffect(() => {
        if (!user || activeTab === 'tradematch') return
        tradematchService.pendingCount().then(data => {
            setMatchTradeCount(data.total || 0)
            setMatchTradePendingCount(data.pending || 0)
        }).catch(() => {})
    }, [activeTab, user, setMatchTradeCount, setMatchTradePendingCount])
    const activeTabLabel = TABS.find(t => t.key === activeTab)?.label
    const pageTitle = activeTabLabel && activeTab !== 'packs'
        ? `${activeTabLabel} - The Vault`
        : 'The Vault'
    const visibleTabs = TABS.filter(tab => !tab.hidden && (!tab.authOnly || user))
    const desktopPrimaryTabs = visibleTabs.filter(t => !DESKTOP_MORE_KEYS.has(t.key))
    const desktopSecondaryTabs = visibleTabs.filter(t => DESKTOP_MORE_KEYS.has(t.key))
    const activeIsDesktopSecondary = DESKTOP_MORE_KEYS.has(activeTab)

    // Close desktop "More" dropdown on outside click
    useEffect(() => {
        if (!desktopMoreOpen) return
        const handler = (e) => {
            if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target)) {
                setDesktopMoreOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [desktopMoreOpen])

    const unopenedGifts = (giftData?.received || []).filter(g => !g.opened).length
    const myPacksCount = (inventory?.length || 0) + unopenedGifts
    const defaultPackMode = myPacksCount > 0 ? 'my-packs' : 'shop'
    const packMode = searchParams.get('packMode') || defaultPackMode
    const setPackMode = (m) => {
        const next = new URLSearchParams(searchParams)
        if (m === defaultPackMode) next.delete('packMode'); else next.set('packMode', m)
        setSearchParams(next)
    }

    const setTab = (key) => {
        setSearchParams(key === 'packs' ? {} : { tab: key })
    }

    const ActiveComponent = TAB_COMPONENTS[activeTab] || CCPackShop

    const branding = (
        <div className="hidden sm:flex items-center gap-1.5">
            <span className="cd-head text-[0.6rem] tracking-[0.4em] text-[var(--cd-cyan)] opacity-55">THE</span>
            <span className="cd-head text-sm font-bold tracking-[0.12em]" style={{ background: 'linear-gradient(180deg, #e0e8f0 20%, #00e5ff 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>VAULT</span>
        </div>
    )

    if (vaultBanned) {
        return (
            <div className="compdeck">
                <Navbar branding={branding} />
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <h1 className="text-2xl font-bold text-red-400 mb-2">Account Banned</h1>
                    <p className="text-white/50">Your account has been banned from The Vault.</p>
                </div>
            </div>
        )
    }

    if (accountTooNew != null) {
        return (
            <div className="compdeck">
                <Navbar branding={branding} />
                <VaultHeroBanner />
                <div className="relative z-1 flex flex-col items-center justify-center py-20 text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">Account Too New</h1>
                    <p className="text-white/50">Your account must be at least 30 days old to access The Vault.</p>
                    <p className="text-white/30 text-sm mt-2">Come back in {accountTooNew} day{accountTooNew !== 1 ? 's' : ''}.</p>
                </div>
            </div>
        )
    }

    return (
        <>
        <div className="compdeck">
            <PageTitle title={pageTitle} />
            <Navbar branding={branding} />

            <div className={`relative ${activeTab === 'packs' ? 'hidden sm:block' : ''}`} style={{ zIndex: 1 }}>
                <VaultHeroBanner />
            </div>

            <main className={`relative z-1 max-w-[1400px] mx-auto px-4 pb-20 sidebar:pb-0 ${activeTab === 'packs' ? 'pt-18 sm:pt-6' : 'pt-6'}`}>
                {/* Tab switcher — desktop only (>=1400px) */}
                <div className="relative z-10 hidden sidebar:flex items-center gap-6 border-b border-[var(--cd-border)] pb-0">
                    {desktopPrimaryTabs.map(tab => {
                        const Icon = tab.icon
                        const active = activeTab === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setTab(tab.key)}
                                className={`relative flex items-center gap-2 px-1 pb-3 text-sm font-bold uppercase tracking-widest transition-all cursor-pointer cd-head ${
                                    active
                                        ? 'text-[var(--cd-cyan)] cd-tab-glow'
                                        : 'text-white/30 hover:text-white/60'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${active ? 'cd-icon-glow' : ''}`} />
                                {tab.label}
                                {tab.key === 'gifts' && unseenGifts > 0 && (
                                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--cd-cyan)] text-[10px] font-bold text-black flex items-center justify-center cd-text-glow">
                                        {unseenGifts}
                                    </span>
                                )}
                                {tab.key === 'trade' && pendingTradeCount > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
                                )}
                                {tab.key === 'tradematch' && matchTradeCount > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
                                )}
                                {tab.key === 'challenges' && vaultClaimableCount > 0 && (
                                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center animate-pulse">
                                        {vaultClaimableCount}
                                    </span>
                                )}
                                {active && (
                                    <span className="absolute bottom-0 left-0 right-0 cd-tab-active cd-neon-shine" />
                                )}
                            </button>
                        )
                    })}

                    {/* More dropdown for secondary tabs */}
                    <div className="relative" ref={desktopMoreRef}>
                        <button
                            onClick={() => setDesktopMoreOpen(!desktopMoreOpen)}
                            className={`relative flex items-center gap-2 px-1 pb-3 text-sm font-bold uppercase tracking-widest transition-all cursor-pointer cd-head ${
                                desktopMoreOpen || activeIsDesktopSecondary
                                    ? 'text-[var(--cd-cyan)] cd-tab-glow'
                                    : 'text-white/30 hover:text-white/60'
                            }`}
                        >
                            <MoreHorizontal className={`w-4 h-4 ${desktopMoreOpen || activeIsDesktopSecondary ? 'cd-icon-glow' : ''}`} />
                            More
                            {(desktopMoreOpen || activeIsDesktopSecondary) && (
                                <span className="absolute bottom-0 left-0 right-0 cd-tab-active cd-neon-shine" />
                            )}
                        </button>
                        {desktopMoreOpen && (
                            <div className="absolute top-full right-0 mt-2 min-w-[180px] bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg py-1 shadow-2xl z-50">
                                {desktopSecondaryTabs.map(tab => {
                                    const Icon = tab.icon
                                    const active = activeTab === tab.key
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => { setTab(tab.key); setDesktopMoreOpen(false) }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold uppercase tracking-widest transition-all cursor-pointer cd-head ${
                                                active
                                                    ? 'text-[var(--cd-cyan)] bg-[var(--cd-cyan)]/10'
                                                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 ${active ? 'cd-icon-glow' : ''}`} />
                                            {tab.label}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <p className={`hidden sm:block text-[10px] text-white/25 mt-2 ${unseenGifts > 0 && activeTab !== 'gifts' ? 'mb-2' : 'mb-6'}`}>
                    SMITE 2 is a registered trademark of Hi-Rez Studios. Trademarks are the property of their respective owners. Game materials copyright Hi-Rez Studios. Hi-Rez Studios has not endorsed and is not responsible for this site or its content.
                </p>
                <div className={`sm:hidden ${activeTab === 'packs' ? 'mb-1' : 'mb-4'}`} />

                {unseenGifts > 0 && activeTab !== 'gifts' && (
                    <button
                        onClick={() => setTab('gifts')}
                        className="w-full mb-4 py-2 px-4 rounded-lg bg-[var(--cd-cyan)]/[0.06] border border-[var(--cd-cyan)]/20 flex items-center justify-center gap-2 text-xs font-bold text-[var(--cd-cyan)] cd-head tracking-wider hover:bg-[var(--cd-cyan)]/[0.12] transition-all cursor-pointer"
                        style={{ animation: 'vault-shimmer-banner 3s ease-in-out infinite' }}
                    >
                        <Gift className="w-3.5 h-3.5" />
                        You have {unseenGifts} new gift{unseenGifts > 1 ? 's' : ''} waiting!
                    </button>
                )}

                {matchTradePendingCount > 0 && activeTab !== 'tradematch' && (
                    <button
                        onClick={() => setTab('tradematch')}
                        className="w-full mb-4 py-2 px-4 rounded-lg bg-[var(--cd-magenta)]/[0.06] border border-[var(--cd-magenta)]/20 flex items-center justify-center gap-2 text-xs font-bold text-[var(--cd-magenta)] cd-head tracking-wider hover:bg-[var(--cd-magenta)]/[0.12] transition-all cursor-pointer"
                        style={{ animation: 'vault-shimmer-banner 3s ease-in-out infinite' }}
                    >
                        <Heart className="w-3.5 h-3.5" />
                        {matchTradePendingCount} trade {matchTradePendingCount > 1 ? 'offers need' : 'offer needs'} your attention!
                    </button>
                )}

                {pendingApprovalCount > 0 && (
                    <Suspense fallback={null}>
                        <CCSignatureApprovals />
                    </Suspense>
                )}

                {pendingSignatureCount > 0 && (
                    <Suspense fallback={null}>
                        <CCSignatureRequests />
                    </Suspense>
                )}

                {/* Content */}
                {loading && !loaded ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="cd-spinner w-8 h-8" />
                    </div>
                ) : (
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-20">
                            <div className="cd-spinner w-8 h-8" />
                        </div>
                    }>
                        <ActiveComponent />
                    </Suspense>
                )}
                {/* Mobile footer trademark */}
                <p className="sm:hidden text-[9px] text-white/15 mt-2 mb-20 text-center leading-relaxed px-2">
                    SMITE 2 is a registered trademark of Hi-Rez Studios. Trademarks are the property of their respective owners. Game materials copyright Hi-Rez Studios. Hi-Rez Studios has not endorsed and is not responsible for this site or its content.
                </p>
            </main>

            {/* Mobile/tablet bottom tab bar — shown below 1400px */}
            <div className="sidebar:hidden vault-tab-bar-wrap">
                <VaultTabBar
                    tabs={visibleTabs}
                    activeTab={activeTab}
                    onTabChange={setTab}
                    unseenGifts={unseenGifts}
                    pendingTradeCount={pendingTradeCount}
                    matchTradeCount={matchTradeCount}
                    vaultClaimableCount={vaultClaimableCount}
                    packMode={packMode}
                    onPackModeChange={setPackMode}
                    myPacksCount={myPacksCount}
                />
            </div>

        </div>

        {showTradematchPromo && user && activeTab !== 'tradematch' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setShowTradematchPromo(false); localStorage.setItem('tradematch-promo-dismissed', '1') }}>
                <div
                    className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden p-6 text-center"
                    style={{ background: 'var(--cd-surface)', border: '1px solid rgba(236,72,153,0.3)', boxShadow: '0 0 40px rgba(236,72,153,0.15)', animation: 'cd-fade-in 0.3s ease-out' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="text-4xl mb-3">🔥</div>
                    <h2 className="text-lg font-bold cd-head tracking-wider mb-2" style={{ color: 'var(--cd-magenta)' }}>
                        Hot new cards in your area
                    </h2>
                    <p className="text-sm mb-5" style={{ color: 'var(--cd-text-dim)' }}>
                        Swipe through cards other players want to trade. Match, negotiate, and swap — no awkward DMs required.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => { setShowTradematchPromo(false); localStorage.setItem('tradematch-promo-dismissed', '1'); setTab('tradematch') }}
                            className="w-full py-2.5 rounded-xl text-sm font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', boxShadow: '0 0 20px rgba(236,72,153,0.3)' }}
                        >
                            Start Swiping
                        </button>
                        <button
                            onClick={() => { setShowTradematchPromo(false); localStorage.setItem('tradematch-promo-dismissed', '1') }}
                            className="w-full py-2 text-xs font-bold cd-head tracking-wider transition-all cursor-pointer"
                            style={{ color: 'var(--cd-text-dim)' }}
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
