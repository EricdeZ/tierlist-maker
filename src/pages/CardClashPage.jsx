import { lazy, Suspense } from 'react'
import { CardClashProvider, useCardClash } from './cardclash/CardClashContext'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { Package, BookOpen, UserSearch, Crown } from 'lucide-react'

const CCPackShop = lazy(() => import('./cardclash/CCPackShop'))
const CCCardCatalog = lazy(() => import('./cardclash/CCCardCatalog'))
const CCPlayerCards = lazy(() => import('./cardclash/CCPlayerCards'))

const TABS = [
    { key: 'packs', label: 'Packs', icon: Package },
    { key: 'catalog', label: 'Catalog', icon: BookOpen },
    { key: 'players', label: 'Players', icon: UserSearch },
]

const TAB_COMPONENTS = {
    packs: CCPackShop,
    catalog: CCCardCatalog,
    players: CCPlayerCards,
}

export default function CardClashPage() {
    const { user } = useAuth()

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h1 className="text-2xl font-bold mb-2">Card Clash</h1>
                <p className="text-(--color-text-secondary) mb-4">Log in to play Card Clash</p>
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
    const [searchParams, setSearchParams] = useSearchParams()
    const { testMode, setTestMode, loading, loaded } = useCardClash()
    const activeTab = searchParams.get('tab') || 'packs'

    const setTab = (key) => {
        setSearchParams(key === 'packs' ? {} : { tab: key })
    }

    const ActiveComponent = TAB_COMPONENTS[activeTab] || CCPackShop

    const branding = (
        <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-black tracking-wide">
                <span className="text-amber-400">CARD</span>{' '}
                <span className="text-white">CLASH</span>
            </span>
        </div>
    )

    return (
        <>
            <Navbar branding={branding} />

            <main className="pt-24 max-w-[1400px] mx-auto px-4">
                {/* Valorant-style tab switcher */}
                <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-0">
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        const active = activeTab === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setTab(tab.key)}
                                className={`relative flex items-center gap-2 px-1 pb-3 text-sm font-bold uppercase tracking-widest transition-all cursor-pointer ${
                                    active
                                        ? 'text-white'
                                        : 'text-white/40 hover:text-white/70'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                                {active && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-red-400 to-transparent" />
                                )}
                            </button>
                        )
                    })}

                    <div className="ml-auto pb-3">
                        <button
                            onClick={() => setTestMode(!testMode)}
                            className={`text-[11px] px-3 py-1 font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                                testMode
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                        >
                            {testMode ? 'TEST' : 'LIVE'}
                        </button>
                    </div>
                </div>

                {/* Content */}
                {loading && !loaded ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
                    </div>
                ) : (
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
                        </div>
                    }>
                        <ActiveComponent />
                    </Suspense>
                )}
            </main>
        </>
    )
}
