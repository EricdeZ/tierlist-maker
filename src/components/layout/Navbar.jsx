import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import ReporterBell from '../ReporterBell'
import { Home, User, Wrench, ChevronDown, Menu, ListOrdered, Swords, Trophy, Coins, ShoppingBag, Crown, Calendar, Flame } from 'lucide-react'
import { FEATURE_FLAGS } from '../../config/featureFlags'

const tools = [
    { to: '/tierlist',      icon: ListOrdered,  label: 'Tier List' },
    { to: '/god-tierlist',  icon: Crown,        label: 'God Tier List' },
    { to: '/draft',         icon: Swords,       label: 'Draft Simulator' },
    { to: '/scrims',        icon: Calendar,     label: 'Scrims' },
    { to: '/coinflip',      icon: Coins,        label: 'Coin Flip' },
    { to: '/shop',          icon: ShoppingBag,  label: 'Passion Shop' },
    ...(FEATURE_FLAGS.FORGE_RELEASED ? [{ to: '/forge', icon: Flame, label: 'Fantasy Forge' }] : []),
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
    const toolsRef = useRef(null)

    // Breakpoint classes — must be full literal strings so Tailwind can scan them
    const bpShow = tabs ? 'nav:flex' : 'sm:flex'
    const bpHide = tabs ? 'nav:hidden' : 'sm:hidden'

    // If already on a tool's route, link to current path so clicking doesn't reset state
    const resolveToolTo = (tool) =>
        location.pathname.startsWith(tool.to) ? location.pathname : tool.to

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.path
        return location.pathname.startsWith(item.path)
    }

    // Close menus on route change
    useEffect(() => {
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

    return (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
            <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-3 py-1.5 shadow-lg border border-white/10">
                <div className="flex items-center gap-3 sm:gap-6">
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
                                                    to={resolveToolTo(tool)}
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
                            <button
                                onClick={toggleSidebar}
                                className="flex items-center justify-center w-10 h-10 rounded-lg text-(--color-accent) hover:bg-white/10 transition-colors cursor-pointer border border-(--color-accent)/25"
                                aria-label="Open menu"
                            >
                                <Menu className="w-5 h-5" strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* ── Mobile: passion + user + burger ── */}
                    <div className={`flex ${bpHide} items-center gap-2 ml-auto`}>
                        <ReporterBell />
                        {user && <PassionDisplay compact />}
                        <UserMenu compact />
                        <button
                            onClick={toggleSidebar}
                            className="flex items-center justify-center -mr-1.5 text-white/50 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            aria-label="Open menu"
                        >
                            <Menu className="w-7 h-7" />
                        </button>
                    </div>
                </div>
            </div>

        </nav>
    )
}
