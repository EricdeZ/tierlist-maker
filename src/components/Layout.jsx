// src/components/Layout.jsx
import { Link, useLocation } from 'react-router-dom'
import { FEATURE_FLAGS } from '../config/featureFlags'
import smiteLogo from '../assets/smite.svg'

const Layout = ({ children }) => {
    const location = useLocation()

    const navItems = [
        { path: '/', label: 'Home' },
        { path: '/rankings', label: 'Rankings' },
        { path: '/stats', label: 'Stats' }
    ].filter(item => {
        // Filter out home page link if home page is disabled
        return !(item.path === '/' && !FEATURE_FLAGS.ENABLE_HOME_PAGE);
    })

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            {/* Conditionally render navigation based on feature flag */}
            {FEATURE_FLAGS.SHOW_NAVIGATION && (
                <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%]">
                    <div className="bg-(--color-primary)/75 backdrop-blur-xl rounded-xl px-4 py-2 shadow-lg border border-white/10">
                        <div className="flex items-center gap-8">
                            {/* Logo */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <img
                                    src={smiteLogo}
                                    alt="SMITE 2"
                                    className="h-15 w-auto smite-logo"
                                />
                                <h1 className="block sm:hidden text-lg font-bold text-(--color-text)">
                                    S2C
                                </h1>
                            </div>

                            {/* Navigation Links */}
                            {navItems.length > 1 && (
                                <div className="flex gap-6 text-(--nav-text)">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`text-m font-bold uppercase px-3 py-2 rounded-lg transition-all duration-200 ${
                                                location.pathname === item.path
                                                    ? 'underline underline-offset-5 decoration-(--color-accent) hover:text-(--color-accent)'
                                                    : 'hover:text-(--color-accent)'
                                            }`}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </nav>
            )}

            {/* Main content with top padding to account for fixed header */}
            <main className="pt-24">
                {children}
            </main>
        </div>
    )
}

export default Layout