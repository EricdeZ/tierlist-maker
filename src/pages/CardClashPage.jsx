import { lazy, Suspense } from 'react'
import { CardClashProvider, useCardClash } from './cardclash/CardClashContext'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { Package, BookOpen, Settings, Library, ArrowRightLeft } from 'lucide-react'
import vaultLogo from '../assets/vault_square.png'
import VaultHeroBanner from './cardclash/VaultHeroBanner'
import './cardclash/compdeck.css'

const CCPackShop = lazy(() => import('./cardclash/CCPackShop'))
const CCCardCatalog = lazy(() => import('./cardclash/CCCardCatalog'))
const CCPlayerCards = lazy(() => import('./cardclash/CCPlayerCards'))
const CCSettings = lazy(() => import('./cardclash/CCSettings'))
const CCCollection = lazy(() => import('./cardclash/CCCollection'))
const CCConverter = lazy(() => import('./cardclash/CCConverter'))

const TABS = [
    { key: 'packs', label: 'Packs', icon: Package },
    { key: 'collection', label: 'Collection', icon: Library },
    { key: 'convert', label: 'Convert', icon: ArrowRightLeft },
    // { key: 'players', label: 'Players', icon: UserSearch },
    { key: 'catalog', label: 'Catalog', icon: BookOpen },
    { key: 'settings', label: 'Settings', icon: Settings, authOnly: true },
]

const TAB_COMPONENTS = {
    packs: CCPackShop,
    catalog: CCCardCatalog,
    collection: CCCollection,
    convert: CCConverter,
    players: CCPlayerCards,
    settings: CCSettings,
}

export default function CardClashPage() {
    const { user } = useAuth()

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h1 className="text-2xl font-bold mb-2">The Vault</h1>
                <p className="text-(--color-text-secondary) mb-4">Log in to access The Vault</p>
            </div>
        )
    }

    return (
        <CardClashProvider>
            <CardClashInner />
        </CardClashProvider>
    )
}

function CardClashInner() {
    const { user } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const { testMode, setTestMode, loading, loaded } = useCardClash()
    const activeTab = searchParams.get('tab') || 'packs'
    const visibleTabs = TABS.filter(tab => !tab.authOnly || user)

    const setTab = (key) => {
        setSearchParams(key === 'packs' ? {} : { tab: key })
    }

    const ActiveComponent = TAB_COMPONENTS[activeTab] || CCPackShop

    const branding = (
        <div className="flex items-center gap-2">
            <img src={vaultLogo} alt="" className="h-6 cd-icon-glow" />
            <span className="cd-head text-sm font-black" style={{ letterSpacing: '0.15em' }}>
                <span className="text-[var(--cd-cyan)] cd-text-glow">THE</span>
                <span className="text-white">{'\u00A0'}VAULT</span>
            </span>
        </div>
    )

    return (
        <div className="compdeck">
            <Navbar branding={branding} />

            <div className="relative" style={{ zIndex: 1 }}>
                <VaultHeroBanner />
            </div>

            <main className="relative z-1 max-w-[1400px] mx-auto px-4 pt-6">
                {/* Tab switcher */}
                <div className="relative z-10 flex items-center gap-6 border-b border-[var(--cd-border)] pb-0">
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
                                {active && (
                                    <span className="absolute bottom-0 left-0 right-0 cd-tab-active cd-neon-shine" />
                                )}
                            </button>
                        )
                    })}

                    <div className="ml-auto flex items-center gap-3 pb-3">
                        <button
                            onClick={() => setTestMode(!testMode)}
                            className={`cd-clip-tag text-[11px] px-4 py-1 font-bold uppercase tracking-wider transition-all cursor-pointer border cd-head ${
                                testMode
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                            }`}
                        >
                            {testMode ? 'TEST' : 'LIVE'}
                        </button>
                    </div>
                </div>

                <p className="text-[10px] text-white/25 mt-2 mb-6">
                    SMITE 2 is a registered trademark of Hi-Rez Studios. Trademarks are the property of their respective owners. Game materials copyright Hi-Rez Studios. Hi-Rez Studios has not endorsed and is not responsible for this site or its content.
                </p>

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
            </main>
        </div>
    )
}
