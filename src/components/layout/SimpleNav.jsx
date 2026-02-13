import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { leagueService } from '../../services/database'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import { Home, User, Wrench, ChevronDown, ListOrdered, Swords, Trophy, Coins, ShoppingBag } from 'lucide-react'

export default function SimpleNav({ title }) {
    const { user, linkedPlayer } = useAuth()
    const location = useLocation()
    const [toolsOpen, setToolsOpen] = useState(false)
    const [leaguesOpen, setLeaguesOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [leagues, setLeagues] = useState([])
    const toolsRef = useRef(null)
    const leaguesRef = useRef(null)
    const menuRef = useRef(null)

    useEffect(() => {
        leagueService.getAll()
            .then(data => setLeagues(data.filter(l => l.name?.toLowerCase() !== 'test league')))
            .catch(() => {})
    }, [])

    // Close menus on route change
    useEffect(() => {
        setMobileOpen(false)
        setToolsOpen(false)
        setLeaguesOpen(false)
    }, [location.pathname])

    useEffect(() => {
        if (!toolsOpen) return
        const handle = (e) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [toolsOpen])

    useEffect(() => {
        if (!leaguesOpen) return
        const handle = (e) => {
            if (leaguesRef.current && !leaguesRef.current.contains(e.target)) setLeaguesOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [leaguesOpen])

    // Close mobile menu on click outside
    useEffect(() => {
        if (!mobileOpen) return
        const handle = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMobileOpen(false)
        }
        document.addEventListener('mousedown', handle)
        document.addEventListener('touchstart', handle)
        return () => {
            document.removeEventListener('mousedown', handle)
            document.removeEventListener('touchstart', handle)
        }
    }, [mobileOpen])

    // Prevent body scroll when menu open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    return (
        <nav ref={menuRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                <div className="flex items-center gap-3 sm:gap-6">
                    <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                        <img src={smiteLogo} alt="SMITE 2" className="h-8 sm:h-10 w-auto" />
                    </Link>

                    {title && (
                        <div className="flex hidden sm:flex items-center border-l border-white/10 pl-3 sm:pl-4">
                            <span className="text-xs sm:text-sm font-bold text-(--color-text)">
                                {title}
                            </span>
                        </div>
                    )}

                    {/* Desktop nav items */}
                    <div className="hidden sm:flex items-center gap-1 ml-auto">
                        <Link
                            to="/"
                            title="Home"
                            className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                        >
                            <Home className="w-4 h-4" />
                        </Link>

                        {/* Leagues dropdown */}
                        {leagues.length > 0 && (
                            <div ref={leaguesRef} className="relative">
                                <button
                                    onClick={() => { setLeaguesOpen(!leaguesOpen); setToolsOpen(false) }}
                                    title="Leagues"
                                    className={`p-2 rounded-lg flex items-center gap-0.5 transition-all duration-200 ${
                                        leaguesOpen ? 'text-(--color-accent) bg-white/10' : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'
                                    }`}
                                >
                                    <Trophy className="w-4 h-4" />
                                    <ChevronDown className={`w-3 h-3 transition-transform ${leaguesOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {leaguesOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="py-1">
                                            {leagues.map(l => (
                                                <Link
                                                    key={l.id}
                                                    to={`/${l.slug}`}
                                                    onClick={() => setLeaguesOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                                >
                                                    <Trophy className="w-4 h-4 text-(--color-text-secondary)" />
                                                    {l.name}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {user && (
                            linkedPlayer ? (
                                <Link
                                    to={`/profile/${linkedPlayer.slug}`}
                                    title="My Profile"
                                    className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                                >
                                    <User className="w-4 h-4" />
                                </Link>
                            ) : (
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal'))}
                                    title="Claim Your Profile"
                                    className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                                >
                                    <User className="w-4 h-4" />
                                </button>
                            )
                        )}
                        <div ref={toolsRef} className="relative">
                            <button
                                onClick={() => { setToolsOpen(!toolsOpen); setLeaguesOpen(false) }}
                                title="Tools"
                                className={`p-2 rounded-lg flex items-center gap-0.5 transition-all duration-200 ${
                                    toolsOpen ? 'text-(--color-accent) bg-white/10' : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'
                                }`}
                            >
                                <Wrench className="w-4 h-4" />
                                <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {toolsOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                    <div className="py-1">
                                        <Link
                                            to="/tierlist"
                                            onClick={() => setToolsOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                        >
                                            <ListOrdered className="w-4 h-4 text-(--color-text-secondary)" />
                                            Tier List
                                        </Link>
                                        <Link
                                            to="/draft"
                                            onClick={() => setToolsOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                        >
                                            <Swords className="w-4 h-4 text-(--color-text-secondary)" />
                                            Draft Simulator
                                        </Link>
                                        <Link
                                            to="/coinflip"
                                            onClick={() => setToolsOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                        >
                                            <Coins className="w-4 h-4 text-(--color-text-secondary)" />
                                            Coin Flip
                                        </Link>
                                        <Link
                                            to="/shop"
                                            onClick={() => setToolsOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                        >
                                            <ShoppingBag className="w-4 h-4 text-(--color-text-secondary)" />
                                            Passion Shop
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                        {user && <PassionDisplay />}
                        <UserMenu compact />
                    </div>

                    {/* Mobile: passion + user menu + hamburger */}
                    <div className="flex sm:hidden items-center gap-2 ml-auto">
                        {user && <PassionDisplay compact />}
                        <UserMenu compact />
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                            aria-label="Toggle navigation menu"
                        >
                            <div className="w-5 h-4 flex flex-col justify-between">
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                    style={{ transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none' }}
                                />
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300"
                                    style={{ opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)' }}
                                />
                                <span
                                    className="block w-full h-0.5 bg-(--color-text) rounded-full transition-all duration-300 origin-center"
                                    style={{ transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }}
                                />
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile dropdown menu */}
            <div
                className="sm:hidden overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: mobileOpen ? '600px' : '0px', opacity: mobileOpen ? 1 : 0 }}
            >
                <div className="mt-2 bg-(--color-primary)/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl p-2">
                    <Link
                        to="/"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                    >
                        <Home className="w-4 h-4" />
                        Home
                    </Link>

                    {user && linkedPlayer && (
                        <Link
                            to={`/profile/${linkedPlayer.slug}`}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <User className="w-4 h-4" />
                            My Profile
                        </Link>
                    )}

                    {/* Leagues */}
                    {leagues.length > 0 && (
                        <div className="border-t border-white/5 mt-1 pt-1">
                            <div className="px-4 py-2 text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest">
                                Leagues
                            </div>
                            {leagues.map(l => (
                                <Link
                                    key={l.id}
                                    to={`/${l.slug}`}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                                >
                                    <Trophy className="w-4 h-4" />
                                    {l.name}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Tools */}
                    <div className="border-t border-white/5 mt-1 pt-1">
                        <div className="px-4 py-2 text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest">
                            Tools
                        </div>
                        <Link
                            to="/tierlist"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <ListOrdered className="w-4 h-4" />
                            Tier List
                        </Link>
                        <Link
                            to="/draft"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <Swords className="w-4 h-4" />
                            Draft Simulator
                        </Link>
                        <Link
                            to="/coinflip"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <Coins className="w-4 h-4" />
                            Coin Flip
                        </Link>
                        <Link
                            to="/shop"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <ShoppingBag className="w-4 h-4" />
                            Passion Shop
                        </Link>
                    </div>
                </div>
            </div>

            {/* Backdrop overlay when menu is open */}
            {mobileOpen && (
                <div className="fixed inset-0 -z-10 sm:hidden" />
            )}
        </nav>
    )
}
