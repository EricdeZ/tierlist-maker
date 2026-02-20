import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import ReporterBell from '../ReporterBell'
import { Home, User, Wrench, ChevronDown, ChevronRight, ListOrdered, Swords, Trophy, Coins, ShoppingBag, Crown, Calendar } from 'lucide-react'

const tools = [
    { to: '/tierlist',      icon: ListOrdered,  label: 'Tier List' },
    { to: '/god-tierlist',  icon: Crown,        label: 'God Tier List' },
    { to: '/draft',         icon: Swords,       label: 'Draft Simulator' },
    { to: '/scrims',        icon: Calendar,     label: 'Scrims' },
    { to: '/coinflip',      icon: Coins,        label: 'Coin Flip' },
    { to: '/shop',          icon: ShoppingBag,  label: 'Passion Shop' },
]

/**
 * Unified Navbar component.
 *
 * @param {string}      [title]    - Text shown after the logo (hidden on mobile)
 * @param {ReactNode}   [branding] - Custom JSX after the logo (always visible)
 * @param {Array}       [tabs]     - Nav tab objects: { path, label, exact? }
 *                                   When present, uses wider `nav` breakpoint
 */
export default function Navbar({ title, branding, tabs }) {
    const { user, linkedPlayer } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const location = useLocation()
    const [toolsOpen, setToolsOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const toolsRef = useRef(null)
    const menuRef = useRef(null)

    // Breakpoint classes — must be full literal strings so Tailwind can scan them
    const bpShow = tabs ? 'nav:flex' : 'sm:flex'
    const bpHide = tabs ? 'nav:hidden' : 'sm:hidden'

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.path
        return location.pathname.startsWith(item.path)
    }

    // Close menus on route change
    useEffect(() => {
        setMobileOpen(false)
        setToolsOpen(false)
    }, [location.pathname])

    // Close tools dropdown on click outside
    useEffect(() => {
        if (!toolsOpen) return
        const handle = (e) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [toolsOpen])

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

    // Prevent body scroll when mobile menu open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    return (
        <nav ref={menuRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                <div className="flex items-center gap-3 sm:gap-6">
                    {/* Sidebar trigger — visible below 1400px */}
                    <button
                        onClick={() => { toggleSidebar(); setMobileOpen(false); }}
                        className="sidebar:hidden flex items-center justify-center w-8 h-8 rounded-lg text-(--color-accent) hover:bg-white/10 transition-colors cursor-pointer border border-(--color-accent)/25"
                        aria-label="Open menu"
                    >
                        <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                    </button>

                    {/* Logo → home */}
                    <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                        <img src={smiteLogo} alt="SMITE 2" className="h-8 sm:h-10 w-auto" />
                    </Link>

                    {/* Title (hidden on mobile — redundant with page heading) */}
                    {title && (
                        <div className={`hidden ${bpShow} items-center border-l border-white/10 pl-3 sm:pl-4`}>
                            <span className="text-xs sm:text-sm font-bold text-(--color-text)">{title}</span>
                        </div>
                    )}

                    {/* Branding (always visible — league/division info) */}
                    {branding && (
                        <div className="flex items-center gap-2 flex-shrink-0 border-l border-white/10 pl-3 sm:pl-4">
                            {branding}
                        </div>
                    )}

                    {/* ── Desktop: tabs + icon bar ── */}
                    <div className={`hidden ${bpShow} items-center gap-1 ml-auto`}>
                        {/* Tab links */}
                        {tabs && (
                            <>
                                <div className="flex items-center gap-1 text-(--nav-text)">
                                    {tabs.map((item) => (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`text-sm font-bold uppercase px-3 py-2 rounded-lg transition-all duration-200 ${
                                                isActive(item)
                                                    ? 'text-(--color-accent)'
                                                    : 'hover:text-(--color-accent)'
                                            }`}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                                <div className="border-l border-white/10 ml-2 pl-2" />
                            </>
                        )}

                        {/* Icon bar */}
                        <div className="flex items-center gap-1">
                            <Link
                                to="/"
                                title="Home"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Home className="w-4 h-4" />
                            </Link>
                            <Link
                                to="/leagues"
                                title="Browse Leagues"
                                className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                            >
                                <Trophy className="w-4 h-4" />
                            </Link>
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
                                        className="p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200 cursor-pointer"
                                    >
                                        <User className="w-4 h-4" />
                                    </button>
                                )
                            )}
                            <div ref={toolsRef} className="relative">
                                <button
                                    onClick={() => setToolsOpen(!toolsOpen)}
                                    title="Tools"
                                    className={`p-2 rounded-lg flex items-center gap-0.5 transition-all duration-200 cursor-pointer ${
                                        toolsOpen ? 'text-(--color-accent) bg-white/10' : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10'
                                    }`}
                                >
                                    <Wrench className="w-4 h-4" />
                                    <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {toolsOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="py-1">
                                            {tools.map((tool) => (
                                                <Link
                                                    key={tool.to}
                                                    to={tool.to}
                                                    onClick={() => setToolsOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                                                >
                                                    <tool.icon className="w-4 h-4 text-(--color-text-secondary)" />
                                                    {tool.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <ReporterBell />
                            {user && <PassionDisplay />}
                            <UserMenu compact />
                        </div>
                    </div>

                    {/* ── Mobile: passion + user + hamburger ── */}
                    <div className={`flex ${bpHide} items-center gap-2 ml-auto`}>
                        <div onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                            <ReporterBell />
                            {user && <PassionDisplay compact />}
                            <UserMenu compact />
                        </div>
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

            {/* ── Mobile dropdown menu ── */}
            <div
                className={`${bpHide} overflow-hidden transition-all duration-300 ease-in-out`}
                style={{ maxHeight: mobileOpen ? '600px' : '0px', opacity: mobileOpen ? 1 : 0 }}
            >
                <div className="mt-2 bg-(--color-primary)/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl p-2">
                    {/* Tab links (division pages) */}
                    {tabs && tabs.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
                                isActive(item)
                                    ? 'text-(--color-accent) bg-(--color-accent)/10'
                                    : 'text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isActive(item) ? 'bg-(--color-accent)' : 'bg-white/20'
                            }`} />
                            {item.label}
                        </Link>
                    ))}

                    {/* Navigation links */}
                    <div className={tabs ? 'border-t border-white/5 mt-1 pt-1' : ''}>
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
                        <Link
                            to="/leagues"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                        >
                            <Trophy className="w-4 h-4" />
                            Leagues
                        </Link>
                    </div>

                    {/* Tools section */}
                    <div className="border-t border-white/5 mt-1 pt-1">
                        <div className="px-4 py-2 text-[10px] font-bold text-(--color-text-secondary) uppercase tracking-widest">
                            Tools
                        </div>
                        {tools.map((tool) => (
                            <Link
                                key={tool.to}
                                to={tool.to}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-(--nav-text) hover:text-(--color-accent) hover:bg-white/5 transition-all duration-200"
                            >
                                <tool.icon className="w-4 h-4" />
                                {tool.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Backdrop overlay when menu is open */}
            {mobileOpen && (
                <div className={`fixed inset-0 -z-10 ${bpHide}`} />
            )}
        </nav>
    )
}
