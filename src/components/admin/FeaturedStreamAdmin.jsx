import { useState, useEffect, useCallback, useRef } from 'react'
import { adminFetch } from '../../services/adminApi'
import { featuredStreamerService } from '../../services/database'
import { Tv, Play, Pencil, Trash2, Plus, X, Check } from 'lucide-react'

export default function FeaturedStreamAdmin() {
    const [queue, setQueue] = useState([])
    const [current, setCurrent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)

    // Add form
    const [showAdd, setShowAdd] = useState(false)
    const [addChannel, setAddChannel] = useState('')
    const [addDisplayName, setAddDisplayName] = useState('')
    const [adding, setAdding] = useState(false)

    // User search
    const [userSearch, setUserSearch] = useState('')
    const [userResults, setUserResults] = useState([])
    const [selectedUser, setSelectedUser] = useState(null)
    const [showUserDropdown, setShowUserDropdown] = useState(false)
    const userSearchRef = useRef(null)

    // Inline edit
    const [editingId, setEditingId] = useState(null)
    const [editChannel, setEditChannel] = useState('')
    const [editSeconds, setEditSeconds] = useState('')

    const showToast = (type, message) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 3000)
    }

    const loadData = useCallback(async () => {
        try {
            const [currentData, queueData] = await Promise.all([
                featuredStreamerService.getCurrent(),
                adminFetch('featured-streamer', { method: 'GET', params: { action: 'queue' } }),
            ])
            setCurrent(currentData)
            setQueue(queueData.queue || [])
        } catch (err) {
            console.error('Failed to load featured streamers:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // Debounced user search
    useEffect(() => {
        if (!userSearch || userSearch.length < 2 || selectedUser) {
            setUserResults([])
            return
        }
        const timer = setTimeout(async () => {
            try {
                const data = await adminFetch('featured-streamer', {
                    method: 'GET',
                    params: { action: 'admin-search-users', q: userSearch },
                })
                setUserResults(data.users || [])
                setShowUserDropdown(true)
            } catch (err) {
                console.error('User search failed:', err)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [userSearch, selectedUser])

    // Click outside to close dropdown
    useEffect(() => {
        if (!showUserDropdown) return
        const handle = (e) => {
            if (userSearchRef.current && !userSearchRef.current.contains(e.target)) {
                setShowUserDropdown(false)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [showUserDropdown])

    const handleSelectUser = (user) => {
        setSelectedUser(user)
        setUserSearch(user.discord_username)
        setAddDisplayName(user.discord_username)
        setShowUserDropdown(false)
    }

    const handleClearUser = () => {
        setSelectedUser(null)
        setUserSearch('')
        setAddDisplayName('')
    }

    const handleSwap = async (streamerId) => {
        try {
            await adminFetch('featured-streamer', { params: { action: 'admin-swap' }, body: { streamer_id: streamerId } })
            showToast('success', 'Swapped!')
            loadData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleRemove = async (streamerId) => {
        try {
            await adminFetch('featured-streamer', { params: { action: 'admin-remove' }, body: { streamer_id: streamerId } })
            showToast('success', 'Removed')
            loadData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleAdd = async () => {
        if (!addChannel.trim()) return
        if (!selectedUser && !addDisplayName.trim()) return
        setAdding(true)
        try {
            await adminFetch('featured-streamer', {
                params: { action: 'admin-add' },
                body: {
                    user_id: selectedUser?.id || null,
                    twitch_channel: addChannel.trim(),
                    display_name: addDisplayName.trim() || null,
                },
            })
            showToast('success', 'Added!')
            setShowAdd(false)
            setSelectedUser(null)
            setUserSearch('')
            setAddChannel('')
            setAddDisplayName('')
            loadData()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setAdding(false)
        }
    }

    const closeAdd = () => {
        setShowAdd(false)
        setSelectedUser(null)
        setUserSearch('')
        setAddChannel('')
        setAddDisplayName('')
    }

    const startEdit = (s) => {
        setEditingId(s.streamerId)
        setEditChannel(s.channel)
        setEditSeconds(String(s.totalFeaturedSeconds || 0))
    }

    const cancelEdit = () => {
        setEditingId(null)
    }

    const saveEdit = async (streamerId) => {
        try {
            await adminFetch('featured-streamer', {
                params: { action: 'admin-edit' },
                body: {
                    streamer_id: streamerId,
                    twitch_channel: editChannel.trim(),
                    total_featured_seconds: parseInt(editSeconds) || 0,
                },
            })
            showToast('success', 'Updated')
            setEditingId(null)
            loadData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleToggleActive = async (streamerId, currentlyActive) => {
        try {
            await adminFetch('featured-streamer', {
                params: { action: 'admin-edit' },
                body: { streamer_id: streamerId, is_active: !currentlyActive },
            })
            loadData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    if (loading) return null

    const avatarUrl = (u) => u.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=32`
        : null

    return (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Tv className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-(--color-text)">Featured Streamers</h3>
                    <span className="text-xs text-(--color-text-secondary)">({queue.length} in queue)</span>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-(--color-text-secondary) hover:text-(--color-text) transition-colors cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                </button>
            </div>

            {/* Current streamer */}
            {current?.active && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-3">
                    <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-(--color-text)">{current.displayName}</span>
                        <span className="text-xs text-purple-400 ml-2">{current.channel}</span>
                    </div>
                    <span className="text-xs text-(--color-text-secondary)">
                        {formatTime(current.sessionElapsed || 0)} featured
                    </span>
                </div>
            )}

            {/* Add form */}
            {showAdd && (
                <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                    {/* User search */}
                    <div className="relative" ref={userSearchRef}>
                        <label className="block text-[10px] text-(--color-text-secondary) mb-1">
                            User <span className="text-(--color-text-secondary)/50">(optional)</span>
                        </label>
                        {selectedUser ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-white/5 border border-white/10">
                                {avatarUrl(selectedUser) && (
                                    <img src={avatarUrl(selectedUser)} className="w-5 h-5 rounded-full" alt="" />
                                )}
                                <span className="text-xs text-(--color-text) flex-1">{selectedUser.discord_username}</span>
                                <button onClick={handleClearUser} className="text-(--color-text-secondary) hover:text-(--color-text) cursor-pointer">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <input
                                type="text"
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                placeholder="Search users... (leave empty for external)"
                                className="w-full px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)/50"
                            />
                        )}
                        {showUserDropdown && userResults.length > 0 && !selectedUser && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-(--color-secondary) border border-white/10 shadow-xl">
                                {userResults.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleSelectUser(u)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        {avatarUrl(u) && (
                                            <img src={avatarUrl(u)} className="w-5 h-5 rounded-full" alt="" />
                                        )}
                                        <span className="text-(--color-text)">{u.discord_username}</span>
                                        <span className="text-(--color-text-secondary) ml-auto">#{u.id}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Twitch Channel + Display Name + buttons */}
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <label className="block text-[10px] text-(--color-text-secondary) mb-1">Twitch Channel</label>
                            <input
                                type="text"
                                value={addChannel}
                                onChange={e => setAddChannel(e.target.value)}
                                placeholder="channel_name"
                                className="w-full px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)/50"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] text-(--color-text-secondary) mb-1">
                                Display Name {!selectedUser && <span className="text-red-400">*</span>}
                            </label>
                            <input
                                type="text"
                                value={addDisplayName}
                                onChange={e => setAddDisplayName(e.target.value)}
                                placeholder={selectedUser ? selectedUser.discord_username : 'Stream display name'}
                                className="w-full px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)/50"
                            />
                        </div>
                        <button
                            onClick={handleAdd}
                            disabled={adding || !addChannel.trim() || (!selectedUser && !addDisplayName.trim())}
                            className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                        >
                            {adding ? '...' : 'Add'}
                        </button>
                        <button
                            onClick={closeAdd}
                            className="p-1.5 rounded text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Queue list */}
            {queue.length === 0 ? (
                <p className="text-sm text-(--color-text-secondary) text-center py-4">No featured streamers registered</p>
            ) : (
                <div className="space-y-1">
                    {queue.map((s) => (
                        <div key={s.streamerId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors group">
                            <span className="text-xs font-bold text-(--color-text-secondary) w-5 text-right">#{s.position}</span>

                            {editingId === s.streamerId ? (
                                <>
                                    <input
                                        type="text"
                                        value={editChannel}
                                        onChange={e => setEditChannel(e.target.value)}
                                        className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)/50"
                                    />
                                    <input
                                        type="number"
                                        value={editSeconds}
                                        onChange={e => setEditSeconds(e.target.value)}
                                        className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-(--color-text) text-xs focus:outline-none focus:border-(--color-accent)/50"
                                        title="Featured seconds"
                                    />
                                    <button onClick={() => saveEdit(s.streamerId)} className="p-1 rounded text-green-400 hover:bg-white/10 cursor-pointer">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={cancelEdit} className="p-1 rounded text-(--color-text-secondary) hover:bg-white/10 cursor-pointer">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium text-(--color-text)">{s.displayName}</span>
                                        <span className="text-xs text-purple-400 ml-1.5">{s.channel}</span>
                                        {!s.userId && (
                                            <span className="text-[9px] text-(--color-text-secondary)/50 ml-1.5">ext</span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-(--color-text-secondary) tabular-nums">
                                        {formatTime(s.totalFeaturedSeconds)}
                                    </span>
                                    {s.isCurrent && (
                                        <span className="text-[9px] font-bold text-red-400 uppercase">Now</span>
                                    )}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleSwap(s.streamerId)}
                                            className="p-1 rounded text-(--color-text-secondary) hover:text-green-400 hover:bg-white/10 cursor-pointer"
                                            title="Make current"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => startEdit(s)}
                                            className="p-1 rounded text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-white/10 cursor-pointer"
                                            title="Edit"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleRemove(s.streamerId)}
                                            className="p-1 rounded text-(--color-text-secondary) hover:text-red-400 hover:bg-white/10 cursor-pointer"
                                            title="Remove"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {toast && (
                <div className={`mt-3 text-sm ${toast.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}

function formatTime(seconds) {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}
