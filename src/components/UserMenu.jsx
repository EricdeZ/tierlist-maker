// src/components/UserMenu.jsx
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, Shield, User, UserCheck } from 'lucide-react'

export default function UserMenu({ compact = false }) {
    const { user, linkedPlayer, login, logout, isAdmin, avatarUrl } = useAuth()
    const [open, setOpen] = useState(false)
    const menuRef = useRef(null)

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    console.log('[UserMenu] linkedPlayer:', linkedPlayer)

    if (!user) {
        return (
            <button
                onClick={login}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium transition-colors ${compact ? 'text-xs px-2 py-1' : ''}`}
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                {!compact && 'Login'}
            </button>
        )
    }

    return (
        <div ref={menuRef} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-lg hover:bg-white/10 transition-colors px-2 py-1"
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                        {user.discord_username?.[0]?.toUpperCase()}
                    </div>
                )}
                {!compact && (
                    <span className="text-sm text-(--color-text) font-medium max-w-[100px] truncate">
                        {user.discord_username}
                    </span>
                )}
                <svg className={`w-3 h-3 text-(--color-text-secondary) transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <div className="text-sm font-medium text-(--color-text)">{user.discord_username}</div>
                        <div className="text-xs text-(--color-text-secondary)">
                            {isAdmin ? 'Admin' : 'Player'}
                            {linkedPlayer && ` \u2022 ${linkedPlayer.name}`}
                        </div>
                    </div>

                    <div className="py-1">
                        {linkedPlayer && linkedPlayer.league_slug && linkedPlayer.division_slug && (
                            <Link
                                to={`/${linkedPlayer.league_slug}/${linkedPlayer.division_slug}/players/${linkedPlayer.slug}`}
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                            >
                                <UserCheck className="w-4 h-4 text-(--color-text-secondary)" />
                                My Profile
                            </Link>
                        )}

                        {!linkedPlayer && (
                            <button
                                onClick={() => {
                                    setOpen(false)
                                    window.dispatchEvent(new CustomEvent('open-claim-modal'))
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#5865F2] hover:bg-white/5 transition-colors"
                            >
                                <User className="w-4 h-4" />
                                Claim Your Profile
                            </button>
                        )}

                        {isAdmin && (
                            <Link
                                to="/admin"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-(--color-text) hover:bg-white/5 transition-colors"
                            >
                                <Shield className="w-4 h-4 text-(--color-text-secondary)" />
                                Admin Dashboard
                            </Link>
                        )}
                    </div>

                    <div className="border-t border-white/10 py-1">
                        <button
                            onClick={() => { setOpen(false); logout() }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Log Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
