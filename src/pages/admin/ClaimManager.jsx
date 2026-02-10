// src/pages/admin/ClaimManager.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Home, Shield, UserCheck, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi'
import smiteLogo from '../../assets/smite2.png'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'

export default function ClaimManager() {
    const [claims, setClaims] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionMsg, setActionMsg] = useState(null)
    const [showResolved, setShowResolved] = useState(false)

    const fetchClaims = async () => {
        try {
            const res = await fetch(`${API}/claim-manage`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error('Failed to load claims')
            const data = await res.json()
            setClaims(data.claims || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchClaims() }, [])

    const handleResolve = async (claimId, status) => {
        setActionMsg(null)
        try {
            const res = await fetch(`${API}/claim-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'resolve-claim', claim_id: claimId, status }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Action failed')
            setActionMsg({ success: status === 'approved' ? 'Claim approved!' : 'Claim denied.' })
            fetchClaims()
        } catch (err) {
            setActionMsg({ error: err.message })
        }
    }

    const pendingClaims = claims.filter(c => c.status === 'pending')
    const resolvedClaims = claims.filter(c => c.status !== 'pending')

    const avatarUrl = (claim) => claim.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${claim.user_discord_id}/${claim.discord_avatar}.png?size=32`
        : null

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
                        <h1 className="font-heading text-2xl font-bold text-(--color-text)">Claim Requests</h1>
                        <p className="text-(--color-text-secondary) text-sm">Review and resolve player profile claims</p>
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

            {/* Pending Claims */}
            <h2 className="font-heading text-lg font-bold text-(--color-text) mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-(--color-accent)" />
                Pending Claims
                <span className="px-2 py-0.5 rounded-full bg-(--color-accent)/10 text-(--color-accent) text-xs font-bold">{pendingClaims.length}</span>
            </h2>

            {pendingClaims.length === 0 ? (
                <div className="mb-8 p-8 rounded-xl bg-(--color-secondary) border border-white/10 text-center text-(--color-text-secondary) text-sm">
                    No pending claims
                </div>
            ) : (
                <div className="mb-8 space-y-3">
                    {pendingClaims.map(claim => (
                        <div key={claim.id} className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 flex items-center gap-4">
                            {avatarUrl(claim) ? (
                                <img src={avatarUrl(claim)} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                                    {claim.discord_username?.[0]?.toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-(--color-text)">{claim.discord_username}</div>
                                <div className="text-xs text-(--color-text-secondary)">
                                    wants to claim <strong>{claim.player_name}</strong>
                                    {claim.message && ` — "${claim.message}"`}
                                </div>
                                <div className="text-xs text-(--color-text-secondary)/50 mt-0.5">
                                    {new Date(claim.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleResolve(claim.id, 'approved')}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                    onClick={() => handleResolve(claim.id, 'denied')}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" /> Deny
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Resolved Claims History */}
            {resolvedClaims.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowResolved(!showResolved)}
                        className="font-heading text-lg font-bold text-(--color-text) mb-4 flex items-center gap-2 hover:text-(--color-accent) transition-colors"
                    >
                        {showResolved ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        Resolved Claims
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-(--color-text-secondary) text-xs font-bold">{resolvedClaims.length}</span>
                    </button>

                    {showResolved && (
                        <div className="space-y-3">
                            {resolvedClaims.map(claim => (
                                <div key={claim.id} className="bg-(--color-secondary) rounded-xl border border-white/5 p-4 flex items-center gap-4 opacity-70">
                                    {avatarUrl(claim) ? (
                                        <img src={avatarUrl(claim)} alt="" className="w-8 h-8 rounded-full" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                                            {claim.discord_username?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-(--color-text)">{claim.discord_username}</div>
                                        <div className="text-xs text-(--color-text-secondary)">
                                            claimed <strong>{claim.player_name}</strong>
                                            {claim.message && ` — "${claim.message}"`}
                                        </div>
                                        {claim.admin_note && (
                                            <div className="text-xs text-(--color-text-secondary)/50 mt-0.5">
                                                Note: {claim.admin_note}
                                            </div>
                                        )}
                                        <div className="text-xs text-(--color-text-secondary)/50 mt-0.5">
                                            {claim.resolved_by_username && `by ${claim.resolved_by_username} · `}
                                            {claim.resolved_at && new Date(claim.resolved_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        claim.status === 'approved'
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                        {claim.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
