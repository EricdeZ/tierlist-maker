import { useState } from 'react'
import { Check, X, Clock, Users } from 'lucide-react'

export default function InvitationsPanel({ invites, outgoingRequests, incomingRequests, onRespond, onCancel }) {
    const [loading, setLoading] = useState(null)

    const handleRespond = async (id, accept) => {
        setLoading(id)
        try {
            await onRespond(id, accept)
        } finally {
            setLoading(null)
        }
    }

    const handleCancel = async (id) => {
        setLoading(id)
        try {
            await onCancel(id)
        } finally {
            setLoading(null)
        }
    }

    const totalCount = (invites?.length || 0) + (outgoingRequests?.length || 0) + (incomingRequests?.length || 0)
    if (totalCount === 0) return null

    return (
        <div className="space-y-4">
            {/* Invites TO you */}
            {invites?.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) mb-2">
                        Team Invitations ({invites.length})
                    </h3>
                    <div className="space-y-2">
                        {invites.map(inv => (
                            <div key={inv.id} className="rounded-lg border border-white/10 bg-(--color-secondary) p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                    {inv.team_logo ? (
                                        <img src={inv.team_logo} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Users className="w-4 h-4 text-(--color-text-secondary)/40" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-(--color-text) truncate">{inv.team_name}</div>
                                    <div className="text-[10px] text-(--color-text-secondary)">
                                        Invited by {inv.from_username}
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => handleRespond(inv.id, true)}
                                        disabled={loading === inv.id}
                                        className="p-1.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-40"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleRespond(inv.id, false)}
                                        disabled={loading === inv.id}
                                        className="p-1.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-40"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Requests TO your teams (captain view) */}
            {incomingRequests?.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) mb-2">
                        Join Requests ({incomingRequests.length})
                    </h3>
                    <div className="space-y-2">
                        {incomingRequests.map(req => (
                            <div key={req.id} className="rounded-lg border border-white/10 bg-(--color-secondary) p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                    {req.from_avatar && req.from_discord_id ? (
                                        <img src={`https://cdn.discordapp.com/avatars/${req.from_discord_id}/${req.from_avatar}.png?size=64`} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-bold text-(--color-text-secondary)">{req.from_username?.[0]?.toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-(--color-text) truncate">
                                        {req.from_player_name || req.from_username}
                                    </div>
                                    <div className="text-[10px] text-(--color-text-secondary)">
                                        Wants to join {req.team_name}
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => handleRespond(req.id, true)}
                                        disabled={loading === req.id}
                                        className="p-1.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-40"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleRespond(req.id, false)}
                                        disabled={loading === req.id}
                                        className="p-1.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-40"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Your outgoing join requests */}
            {outgoingRequests?.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) mb-2">
                        Your Pending Requests ({outgoingRequests.length})
                    </h3>
                    <div className="space-y-2">
                        {outgoingRequests.map(req => (
                            <div key={req.id} className="rounded-lg border border-white/10 bg-(--color-secondary) p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                    {req.team_logo ? (
                                        <img src={req.team_logo} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Users className="w-4 h-4 text-(--color-text-secondary)/40" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-(--color-text) truncate">{req.team_name}</div>
                                    <div className="text-[10px] text-(--color-text-secondary) flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Waiting for response
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCancel(req.id)}
                                    disabled={loading === req.id}
                                    className="text-[10px] px-2 py-1 rounded bg-white/5 text-(--color-text-secondary) hover:text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
