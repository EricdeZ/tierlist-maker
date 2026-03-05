import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { CardClashProvider, useCardClash } from './cardclash/CardClashContext'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import PassionDisplay from '../components/PassionDisplay'
import UserMenu from '../components/UserMenu'
import {
    Home, Layers, Package, Users, Swords, ClipboardList, BookOpen, UserSearch,
    ChevronRight, Crown,
} from 'lucide-react'

const CCHome = lazy(() => import('./cardclash/CCHome'))
const CCCollection = lazy(() => import('./cardclash/CCCollection'))
const CCPackShop = lazy(() => import('./cardclash/CCPackShop'))
const CCStartingFive = lazy(() => import('./cardclash/CCStartingFive'))
const CCBattle = lazy(() => import('./cardclash/CCBattle'))
const CCTodo = lazy(() => import('./cardclash/CCTodo'))
const CCCardCatalog = lazy(() => import('./cardclash/CCCardCatalog'))
const CCPlayerCards = lazy(() => import('./cardclash/CCPlayerCards'))

const TABS = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'collection', label: 'Collection', icon: Layers },
    { key: 'packs', label: 'Packs', icon: Package },
    { key: 'lineup', label: 'Starting 5', icon: Users },
    { key: 'clash', label: 'Battle', icon: Swords },
    { key: 'catalog', label: 'Catalog', icon: BookOpen },
    { key: 'players', label: 'Players', icon: UserSearch },
    { key: 'todo', label: 'Roadmap', icon: ClipboardList },
]

const TAB_COMPONENTS = {
    home: CCHome,
    collection: CCCollection,
    packs: CCPackShop,
    lineup: CCStartingFive,
    clash: CCBattle,
    catalog: CCCardCatalog,
    players: CCPlayerCards,
    todo: CCTodo,
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
    const { toggle: toggleSidebar } = useSidebar()
    const { user } = useAuth()
    const activeTab = searchParams.get('tab') || 'home'
    const [mobileOpen, setMobileOpen] = useState(false)
    const menuRef = useRef(null)

    const setTab = (key) => {
        setSearchParams(key === 'home' ? {} : { tab: key })
        setMobileOpen(false)
    }

    // Close mobile menu on click outside
    useEffect(() => {
        if (!mobileOpen) return
        const handle = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMobileOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [mobileOpen])

    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    const ActiveComponent = TAB_COMPONENTS[activeTab] || CCHome

    return (
        <div className="max-w-[1400px] mx-auto">
            {/* Card Clash Navbar */}
            <nav ref={menuRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
                <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* Sidebar trigger */}
                        <button
                            onClick={() => { toggleSidebar(); setMobileOpen(false) }}
                            className="sidebar:hidden flex items-center justify-center w-8 h-8 rounded-lg text-(--color-accent) hover:bg-white/10 transition-colors cursor-pointer border border-(--color-accent)/25"
                            aria-label="Open menu"
                        >
                            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                        </button>

                        {/* Branding */}
                        <Link to="/cardclash" onClick={() => setTab('home')} className="flex items-center gap-2 shrink-0">
                            <Crown className="w-6 h-6 text-amber-400" />
                            <span className="text-sm font-black tracking-wide hidden sm:block">
                                <span className="text-amber-400">CARD</span>{' '}
                                <span className="text-white">CLASH</span>
                            </span>
                        </Link>

                        {/* Desktop tabs */}
                        <div className="hidden nav:flex items-center gap-1 ml-2">
                            {TABS.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setTab(tab.key)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold uppercase transition-all cursor-pointer ${
                                            activeTab === tab.key
                                                ? 'text-(--color-accent)'
                                                : 'text-(--nav-text) hover:text-(--color-accent)'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Right side — test mode + passion + user */}
                        <div className="flex items-center gap-2 ml-auto">
                            {/* Test mode badge */}
                            <button
                                onClick={() => setTestMode(!testMode)}
                                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                                    testMode
                                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                }`}
                            >
                                {testMode ? 'TEST' : 'LIVE'}
                            </button>

                            {user && <PassionDisplay compact />}
                            <UserMenu compact />

                            {/* Mobile hamburger */}
                            <button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                className="nav:hidden relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors shrink-0"
                                aria-label="Toggle navigation"
                            >
                                <div className="w-5 h-4 flex flex-col justify-between">
                                    <span className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                        style={{ transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
                                    <span className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300"
                                        style={{ opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)' }} />
                                    <span className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                        style={{ transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile dropdown */}
                <div
                    className="nav:hidden overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: mobileOpen ? '500px' : '0px', opacity: mobileOpen ? 1 : 0 }}
                >
                    <div className="mt-2 bg-(--color-primary)/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl p-2">
                        {TABS.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setTab(tab.key)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        activeTab === tab.key
                                            ? 'text-(--color-accent) bg-(--color-accent)/10'
                                            : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            )
                        })}

                        <div className="border-t border-white/5 mt-1 pt-1">
                            <Link
                                to="/"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all"
                            >
                                <Home className="w-4 h-4" />
                                Back to SmiteComp
                            </Link>
                        </div>
                    </div>
                </div>

                {mobileOpen && <div className="fixed inset-0 -z-10 nav:hidden" />}
            </nav>

            {/* Content — offset for fixed navbar */}
            <div className="pt-20">
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
            </div>
        </div>
    )
}
