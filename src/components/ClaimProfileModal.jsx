// src/components/ClaimProfileModal.jsx
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { X, Search, User, Send } from 'lucide-react'
import { getAuthHeaders } from '../services/adminApi'

const API_BASE = import.meta.env.VITE_API_URL || '/.netlify/functions'

export default function ClaimProfileModal() {
    const { user, linkedPlayer } = useAuth()
    const [open, setOpen] = useState(false)
    const [preselected, setPreselected] = useState(null) // { playerId, playerName }
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null) // { success, error }
    const [loadError, setLoadError] = useState(null)
    const modalRef = useRef(null)

    // Listen for custom event to open modal
    useEffect(() => {
        const handler = (e) => {
            if (linkedPlayer) return // Already linked, don't open
            setPreselected(e.detail || null)
            setSelectedPlayer(e.detail ? { id: e.detail.playerId, name: e.detail.playerName } : null)
            setSearch('')
            setMessage('')
            setResult(null)
            setLoadError(null)
            setOpen(true)
        }
        window.addEventListener('open-claim-modal', handler)
        return () => window.removeEventListener('open-claim-modal', handler)
    }, [linkedPlayer])

    // Load all players when modal opens
    useEffect(() => {
        if (!open) return

        const fetchPlayers = async () => {
            setLoading(true)
            setLoadError(null)
            try {
                const res = await fetch(`${API_BASE}/claim-manage?list=players`, { headers: getAuthHeaders() })
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.error || `Failed to load players (${res.status})`)
                }
                const data = await res.json()
                setPlayers(data.players || [])
            } catch (err) {
                setPlayers([])
                setLoadError(err.message)
            } finally {
                setLoading(false)
            }
        }
        fetchPlayers()
    }, [open])

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    // Close on escape
    useEffect(() => {
        if (!open) return
        const handle = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', handle)
        return () => document.removeEventListener('keydown', handle)
    }, [open])

    const handleSubmit = async () => {
        if (!selectedPlayer || submitting) return
        setSubmitting(true)
        setResult(null)

        try {
            const res = await fetch(`${API_BASE}/claim-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'submit-claim',
                    player_id: selectedPlayer.id,
                    message: message || null,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                setResult({ error: data.error || 'Failed to submit claim' })
            } else {
                setResult({ success: true })
            }
        } catch (err) {
            setResult({ error: err.message })
        } finally {
            setSubmitting(false)
        }
    }

    if (!open || !user) return null

    const filteredPlayers = search.trim()
        ? players.filter(p =>
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.discord_name?.toLowerCase().includes(search.toLowerCase())
        )
        : players

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div ref={modalRef} className="w-full max-w-lg bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-[#5865F2]" />
                        <h2 className="font-heading text-lg font-bold text-(--color-text)">Claim Your Profile</h2>
                    </div>
                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5 text-(--color-text-secondary)" />
                    </button>
                </div>

                <div className="p-6">
                    {result?.success ? (
                        <div className="text-center py-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <Send className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="font-heading text-lg font-bold text-(--color-text) mb-2">Claim Submitted!</h3>
                            <p className="text-sm text-(--color-text-secondary) mb-4">
                                Your claim for <strong className="text-(--color-text)">{selectedPlayer?.name}</strong> has been submitted. An admin will review it soon.
                            </p>
                            <button
                                onClick={() => setOpen(false)}
                                className="px-5 py-2 rounded-lg bg-(--color-accent) text-(--color-primary) font-semibold text-sm hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-(--color-text-secondary) mb-4">
                                Select the player profile that belongs to you. An admin will review and approve your claim.
                            </p>

                            {(result?.error || loadError) && (
                                <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-sm text-red-400">
                                    {result?.error || loadError}
                                </div>
                            )}

                            {/* Player search */}
                            {!preselected && (
                                <>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)" />
                                        <input
                                            type="text"
                                            placeholder="Search players..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                                        />
                                    </div>

                                    <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 mb-4">
                                        {loading ? (
                                            <div className="p-4 text-center text-sm text-(--color-text-secondary)">Loading players...</div>
                                        ) : loadError ? (
                                            <div className="p-4 text-center text-sm text-red-400">Failed to load players</div>
                                        ) : filteredPlayers.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-(--color-text-secondary)">No players found</div>
                                        ) : (
                                            filteredPlayers.slice(0, 50).map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setSelectedPlayer(p)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                                        selectedPlayer?.id === p.id
                                                            ? 'bg-[#5865F2]/10 text-[#5865F2]'
                                                            : 'text-(--color-text) hover:bg-white/5'
                                                    }`}
                                                >
                                                    <User className="w-4 h-4 shrink-0 text-(--color-text-secondary)" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{p.name}</div>
                                                        {p.discord_name && (
                                                            <div className="text-xs text-(--color-text-secondary) truncate">{p.discord_name}</div>
                                                        )}
                                                    </div>
                                                    {selectedPlayer?.id === p.id && (
                                                        <span className="text-xs font-medium">Selected</span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Preselected player display */}
                            {preselected && selectedPlayer && (
                                <div className="mb-4 p-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center gap-3">
                                    <User className="w-5 h-5 text-[#5865F2]" />
                                    <span className="text-sm font-medium text-(--color-text)">{selectedPlayer.name}</span>
                                </div>
                            )}

                            {/* Message */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-(--color-text-secondary) mb-1.5 uppercase tracking-wider">
                                    Why is this your profile? (optional)
                                </label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="e.g. This is my in-game name, my Discord is..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 resize-none"
                                />
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!selectedPlayer || submitting}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-4 h-4" />
                                    {submitting ? 'Submitting...' : 'Submit Claim'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
