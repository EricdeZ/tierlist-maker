// src/components/Layout.jsx
import { Link, useLocation } from 'react-router-dom'
import { FEATURE_FLAGS } from '../config/featureFlags'

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
        <div className="min-h-screen bg-gray-50">
            {/* Conditionally render navigation based on feature flag */}
            {FEATURE_FLAGS.SHOW_NAVIGATION && (
                <nav className="bg-white shadow-sm border-b z-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between py-2">
                            <div className="flex-shrink-0 flex items-center">
                                <img src={'/babylon.png'} alt="" className='h-8 w-8 sm:h-10 sm:w-10 mr-2 sm:mr-5'/>
                                {/* Hide title text on small screens */}
                                <h1 className="hidden sm:block text-lg sm:text-xl font-bold text-gray-900">
                                    Babylon League Ishtar
                                </h1>
                                {/* Short title for small screens */}
                                <h1 className="block sm:hidden text-lg font-bold text-gray-900">
                                    BLI
                                </h1>
                            </div>
                            {navItems.length > 1 && (
                                <div className="ml-2 sm:ml-6 flex space-x-2 sm:space-x-8">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                                                location.pathname === item.path
                                                    ? 'border-blue-500 text-gray-900'
                                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            }`}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                            {/* Remove the spacer div that was causing layout issues */}
                        </div>
                    </div>
                </nav>
            )}

            {/* Main content */}
            <main className="flex-1 bg-(--color-primary)">
                {children}
            </main>
        </div>
    )
}

export default Layout