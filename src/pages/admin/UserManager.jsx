// src/pages/admin/UserManager.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Home, Shield, User, UserX, Link2, Unlink } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi'
import smiteLogo from '../../assets/smite2.png'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'

export default function UserManager() {
    const [users, setUsers] = useState([])
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionMsg, setActionMsg] = useState(null)

    // Link player modal state
    const [linkModal, setLinkModal] = useState(null) // { userId, userName }
    const [linkSearch, setLinkSearch] = useState('')
    const [selectedPlayerId, setSelectedPlayerId] = useState(null)

    const fetchData = async () => {
        try {
            const [usersRes, playersRes] = await Promise.all([
                fetch(`${API}/user-manage`, { headers: getAuthHeaders() }),
                fetch(`${API}/player-manage`, { headers: getAuthHeaders() }),
            ])

            if (!usersRes.ok) throw new Error('Failed to load users')

            const usersData = await usersRes.json()
            setUsers(usersData.users || [])

            if (playersRes.ok) {
                const playersData = await playersRes.json()
                setPlayers(playersData.players || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const doAction = async (endpoint, body) => {
        setActionMsg(null)
        try {
            const res = await fetch(`${API}/${endpoint}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Action failed')
            setActionMsg({ success: data.success ? 'Done!' : data.error })
            fetchData()
        } catch (err) {
            setActionMsg({ error: err.message })
        }
    }

    const handleSetRole = (userId, role) => doAction('user-manage', { action: 'set-role', user_id: userId, role })
    const handleUnlink = (userId) => doAction('user-manage', { action: 'unlink-player', user_id: userId })

    const handleLinkPlayer = () => {
        if (!linkModal || !selectedPlayerId) return
        doAction('user-manage', { action: 'link-player', user_id: linkModal.userId, player_id: selectedPlayerId })
        setLinkModal(null)
    }

    const avatarUrl = (u) => u.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=32`
        : null

    const filteredPlayers = linkSearch.trim()
        ? players.filter(p => p.name?.toLowerCase().includes(linkSearch.toLowerCase()))
        : players.slice(0, 20)

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto py-12 px-4">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src={smiteLogo} alt="" className="h-10 w-auto" />
                    <div>
                        <h1 className="font-heading text-2xl font-bold text-(--color-text)">User Manager</h1>
                        <p className="text-(--color-text-secondary) text-sm">Manage users, roles, and player links</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/admin" className="p-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-white/5 transition-colors" title="Admin">
                        <Shield className="w-5 h-5" />
                    </Link>
                    <Link to="/" className="p-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-white/5 transition-colors" title="Home">
                        <Home className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}
            {actionMsg?.error && (
                <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{actionMsg.error}</div>
            )}
            {actionMsg?.success && (
                <div className="mb-6 p-4 rounded-lg bg-green-900/20 border border-green-500/20 text-green-400 text-sm">{actionMsg.success}</div>
            )}

            {/* Users Table */}
            <h2 className="font-heading text-lg font-bold text-(--color-text) mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-(--color-text-secondary)" />
                All Users ({users.length})
            </h2>

            <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Linked Player</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {avatarUrl(u) ? (
                                                <img src={avatarUrl(u)} alt="" className="w-7 h-7 rounded-full" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">{u.discord_username?.[0]?.toUpperCase()}</div>
                                            )}
                                            <span className="text-sm font-medium text-(--color-text)">{u.discord_username}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                            u.role === 'admin'
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                : 'bg-white/5 text-(--color-text-secondary) border border-white/10'
                                        }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {u.player_name ? (
                                            <span className="text-(--color-text)">{u.player_name}</span>
                                        ) : (
                                            <span className="text-(--color-text-secondary)/50">None</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {u.role === 'user' ? (
                                                <button
                                                    onClick={() => handleSetRole(u.id, 'admin')}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-amber-400 transition-colors"
                                                    title="Promote to admin"
                                                >
                                                    <Shield className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSetRole(u.id, 'user')}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-amber-400 hover:text-(--color-text-secondary) transition-colors"
                                                    title="Demote to user"
                                                >
                                                    <UserX className="w-4 h-4" />
                                                </button>
                                            )}
                                            {u.linked_player_id ? (
                                                <button
                                                    onClick={() => handleUnlink(u.id)}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-red-400 transition-colors"
                                                    title="Unlink player"
                                                >
                                                    <Unlink className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { setLinkModal({ userId: u.id, userName: u.discord_username }); setLinkSearch(''); setSelectedPlayerId(null) }}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-[#5865F2] transition-colors"
                                                    title="Link to player"
                                                >
                                                    <Link2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Link Player Modal */}
            {linkModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="w-full max-w-md bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl p-6">
                        <h3 className="font-heading text-lg font-bold text-(--color-text) mb-4">
                            Link player to {linkModal.userName}
                        </h3>
                        <input
                            type="text"
                            placeholder="Search players..."
                            value={linkSearch}
                            onChange={e => setLinkSearch(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 mb-3"
                        />
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 mb-4">
                            {filteredPlayers.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPlayerId(p.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                                        selectedPlayerId === p.id ? 'bg-[#5865F2]/10 text-[#5865F2]' : 'text-(--color-text) hover:bg-white/5'
                                    }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setLinkModal(null)} className="px-4 py-2 rounded-lg text-sm text-(--color-text-secondary) hover:bg-white/5">Cancel</button>
                            <button
                                onClick={handleLinkPlayer}
                                disabled={!selectedPlayerId}
                                className="px-5 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold disabled:opacity-40"
                            >
                                Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
