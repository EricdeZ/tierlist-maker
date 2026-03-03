import { useState, useEffect } from 'react'
import { Search, Users, Link as LinkIcon, Trophy } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi'

const API = import.meta.env.VITE_API_URL || '/api'

export default function ReferralManager() {
    const [search, setSearch] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [referrals, setReferrals] = useState([])
    const [loadingReferrals, setLoadingReferrals] = useState(false)
    const [topReferrers, setTopReferrers] = useState([])
    const [loadingTop, setLoadingTop] = useState(true)

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/referrals?action=admin-top`, { headers: getAuthHeaders() })
                const data = await res.json()
                setTopReferrers(data.top || [])
            } catch { /* ignore */ }
            finally { setLoadingTop(false) }
        })()
    }, [])

    const handleSearch = async (q) => {
        setSearch(q)
        if (q.trim().length < 2) {
            setResults([])
            return
        }
        setSearching(true)
        try {
            const res = await fetch(`${API}/referrals?action=admin-search&q=${encodeURIComponent(q)}`, {
                headers: getAuthHeaders(),
            })
            const data = await res.json()
            setResults(data.users || [])
        } catch {
            setResults([])
        } finally {
            setSearching(false)
        }
    }

    const selectUser = async (user) => {
        setSelectedUser(user)
        setSearch('')
        setResults([])
        setLoadingReferrals(true)
        try {
            const res = await fetch(`${API}/referrals?action=admin-referrals&userId=${user.id}`, {
                headers: getAuthHeaders(),
            })
            const data = await res.json()
            setReferrals(data.referrals || [])
        } catch {
            setReferrals([])
        } finally {
            setLoadingReferrals(false)
        }
    }

    const websiteReferrals = referrals.filter(r => r.type === 'website')
    const forgeReferrals = referrals.filter(r => r.type === 'forge')

    return (
        <div className="max-w-3xl mx-auto pb-8 px-4">
            <div className="mb-8">
                <h1 className="font-heading text-2xl font-bold">Referral Manager</h1>
                <p className="text-(--color-text-secondary) text-sm">Search for a user to view who they've referred.</p>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)" />
                <input
                    type="text"
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search by Discord username..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--color-secondary) border border-white/10 focus:border-white/30 focus:outline-none text-sm"
                />
                {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}

                {/* Dropdown results */}
                {results.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-(--color-secondary) border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {results.map(user => (
                            <button
                                key={user.id}
                                onClick={() => selectUser(user)}
                                className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between gap-2 text-sm"
                            >
                                <span className="font-medium truncate">{user.discord_username}</span>
                                <span className="text-xs text-(--color-text-secondary) shrink-0">
                                    {user.referral_count} referral{user.referral_count !== 1 ? 's' : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Top Referrers */}
            {!selectedUser && (
                <div className="mb-6">
                    <h2 className="font-heading text-sm font-bold mb-3 flex items-center gap-2 text-(--color-text-secondary) uppercase tracking-wider">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                        Top 10 Referrers
                    </h2>
                    {loadingTop ? (
                        <div className="text-center py-8 text-(--color-text-secondary) text-sm">Loading...</div>
                    ) : topReferrers.length === 0 ? (
                        <div className="text-center py-8 text-(--color-text-secondary) text-sm">No referrals yet.</div>
                    ) : (
                        <div className="space-y-1">
                            {topReferrers.map((user, i) => (
                                <button
                                    key={user.id}
                                    onClick={() => selectUser(user)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-(--color-secondary) border border-white/5 hover:border-white/15 transition-colors text-left"
                                >
                                    <span className={`w-6 text-center font-bold text-sm ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-(--color-text-secondary)'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 font-medium text-sm truncate">{user.discord_username}</span>
                                    <span className="text-xs text-(--color-text-secondary) tabular-nums">
                                        {user.website_count > 0 && <span className="text-blue-400">{user.website_count}w</span>}
                                        {user.website_count > 0 && user.forge_count > 0 && <span className="mx-1">/</span>}
                                        {user.forge_count > 0 && <span className="text-orange-400">{user.forge_count}f</span>}
                                    </span>
                                    <span className="font-bold text-sm tabular-nums w-8 text-right">{user.referral_count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Selected user */}
            {selectedUser && (
                <div>
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-(--color-secondary) border border-white/10">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-heading font-bold text-lg">{selectedUser.discord_username}</div>
                            <div className="text-xs text-(--color-text-secondary) flex items-center gap-2">
                                <LinkIcon className="w-3 h-3" />
                                Code: <span className="font-mono text-(--color-text)">{selectedUser.referral_code}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">{referrals.length}</div>
                            <div className="text-xs text-(--color-text-secondary)">total referrals</div>
                        </div>
                    </div>

                    {loadingReferrals ? (
                        <div className="text-center py-12 text-(--color-text-secondary)">Loading referrals...</div>
                    ) : referrals.length === 0 ? (
                        <div className="text-center py-12 text-(--color-text-secondary)">No referrals found for this user.</div>
                    ) : (
                        <div className="space-y-6">
                            {websiteReferrals.length > 0 && (
                                <div>
                                    <h2 className="font-heading text-sm font-bold mb-3 flex items-center gap-2 text-(--color-text-secondary) uppercase tracking-wider">
                                        Website Referrals
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{websiteReferrals.length}</span>
                                    </h2>
                                    <div className="space-y-1">
                                        {websiteReferrals.map(r => (
                                            <ReferralRow key={r.id} referral={r} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {forgeReferrals.length > 0 && (
                                <div>
                                    <h2 className="font-heading text-sm font-bold mb-3 flex items-center gap-2 text-(--color-text-secondary) uppercase tracking-wider">
                                        Forge Referrals
                                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{forgeReferrals.length}</span>
                                    </h2>
                                    <div className="space-y-1">
                                        {forgeReferrals.map(r => (
                                            <ReferralRow key={r.id} referral={r} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ReferralRow({ referral }) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-(--color-secondary) border border-white/5 hover:border-white/10 transition-colors">
            <div className="font-medium text-sm">{referral.refereeUsername}</div>
            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                {referral.rewarded && <span className="text-green-400">Rewarded</span>}
                <span>{new Date(referral.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
    )
}
