import { lazy, Suspense, useEffect } from 'react'
import { VaultProvider, useVault } from './vault/VaultContext'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePassion } from '../context/PassionContext'
import { FEATURE_FLAGS } from '../config/featureFlags'
import Navbar from '../components/layout/Navbar'
import PageTitle from '../components/PageTitle'
import { Package, BookOpen, Settings, Library, ArrowRightLeft, Star, Store, Gift, Handshake, Hammer, Users, BookMarked } from 'lucide-react'
import vaultLogo from '../assets/vault_square.png'
import VaultHeroBanner from './vault/VaultHeroBanner'
import VaultTabBar from './vault/VaultTabBar'
import './vault/compdeck.css'

const CCPackShop = lazy(() => import('./vault/CCPackShop'))
const CCCardCatalog = lazy(() => import('./vault/CCCardCatalog'))
const CCPlayerCards = lazy(() => import('./vault/CCPlayerCards'))
const CCSettings = lazy(() => import('./vault/CCSettings'))
const CCCollection = lazy(() => import('./vault/CCCollection'))
const CCConverter = lazy(() => import('./vault/CCConverter'))
const CCChallenges = lazy(() => import('./vault/CCChallenges'))
const CCMarketplace = lazy(() => import('./vault/CCMarketplace'))
const CCGifts = lazy(() => import('./vault/CCGifts'))
const CCTrading = lazy(() => import('./vault/CCTrading'))
const CCDismantle = lazy(() => import('./vault/CCDismantle'))
const CCStartingFive = lazy(() => import('./vault/CCStartingFive'))
const CCBinder = lazy(() => import('./vault/CCBinder'))

const TABS = [
    { key: 'packs', label: 'Packs', icon: Package },
    { key: 'lineup', label: 'Starting 5', icon: Users },
    { key: 'collection', label: 'Collection', icon: Library },
    { key: 'challenges', label: 'Challenges', icon: Star },
    { key: 'gifts', label: 'Gifts', icon: Gift },
    { key: 'trade', label: 'Trade', icon: Handshake },
    { key: 'market', label: 'Market', icon: Store },
    { key: 'dismantle', label: 'Dismantle', icon: Hammer },
    { key: 'convert', label: 'Convert', icon: ArrowRightLeft },
    { key: 'binder', label: 'Binder', icon: BookMarked },
    // { key: 'players', label: 'Players', icon: UserSearch },
    { key: 'catalog', label: 'Catalog', icon: BookOpen },
    { key: 'settings', label: 'Settings', icon: Settings, authOnly: true },
]

const TAB_COMPONENTS = {
    packs: CCPackShop,
    lineup: CCStartingFive,
    catalog: CCCardCatalog,
    collection: CCCollection,
    binder: CCBinder,
    gifts: CCGifts,
    trade: CCTrading,
    market: CCMarketplace,
    dismantle: CCDismantle,
    convert: CCConverter,
    challenges: CCChallenges,
    players: CCPlayerCards,
    settings: CCSettings,
}

export default function VaultPage() {
    const { user, hasPermission } = useAuth()

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h1 className="text-2xl font-bold mb-2">The Vault</h1>
                <p className="text-(--color-text-secondary) mb-4">Log in to access The Vault</p>
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

    return (
        <VaultProvider>
            <VaultInner />
        </VaultProvider>
    )
}

function VaultInner() {
    const { user } = useAuth()
    const { claimableCount, refreshBalance } = usePassion()
    const [searchParams, setSearchParams] = useSearchParams()
    const { loading, loaded, giftData, pendingTradeCount, inventory } = useVault()
    const unseenGifts = giftData?.unseenCount || 0

    // Poll claimableCount every 60s while vault is visible
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') refreshBalance()
        }, 60_000)
        return () => clearInterval(id)
    }, [refreshBalance])
    const activeTab = searchParams.get('tab') || 'packs'
    const activeTabLabel = TABS.find(t => t.key === activeTab)?.label
    const pageTitle = activeTabLabel && activeTab !== 'packs'
        ? `${activeTabLabel} - The Vault`
        : 'The Vault'
    const visibleTabs = TABS.filter(tab => !tab.authOnly || user)

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
        <div className="hidden sm:flex items-center gap-2">
            <img src={vaultLogo} alt="" className="h-6 cd-icon-glow" />
            <span className="cd-head text-sm font-black" style={{ letterSpacing: '0.15em' }}>
                <span className="text-[var(--cd-cyan)] cd-text-glow">THE</span>
                <span className="text-white">{'\u00A0'}VAULT</span>
            </span>
        </div>
    )

    return (
        <div className="compdeck">
            <PageTitle title={pageTitle} />
            <Navbar branding={branding} />

            <div className={`relative ${activeTab === 'packs' ? 'hidden sm:block' : ''}`} style={{ zIndex: 1 }}>
                <VaultHeroBanner />
            </div>

            <main className={`relative z-1 max-w-[1400px] mx-auto px-4 pb-20 sidebar:pb-0 ${activeTab === 'packs' ? 'pt-18 sm:pt-6' : 'pt-6'}`}>
                {/* Tab switcher — desktop only (>=1400px) */}
                <div className="relative z-10 hidden sidebar:flex items-center gap-6 border-b border-[var(--cd-border)] pb-0">
                    {visibleTabs.map(tab => {
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
                                {tab.key === 'challenges' && claimableCount > 0 && (
                                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center animate-pulse">
                                        {claimableCount}
                                    </span>
                                )}
                                {active && (
                                    <span className="absolute bottom-0 left-0 right-0 cd-tab-active cd-neon-shine" />
                                )}
                            </button>
                        )
                    })}

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
                    claimableCount={claimableCount}
                    packMode={packMode}
                    onPackModeChange={setPackMode}
                    myPacksCount={myPacksCount}
                />
            </div>
        </div>
    )
}
