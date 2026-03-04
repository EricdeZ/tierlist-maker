import { useState, useEffect } from 'react'
import { X, Search, Link2, Copy, Check, UserPlus } from 'lucide-react'
import { communityTeamService } from '../../services/database'

export default function InviteMembersModal({ team, onClose }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [inviteLink, setInviteLink] = useState(null)
    const [linkCopied, setLinkCopied] = useState(false)
    const [linkLoading, setLinkLoading] = useState(false)
    const [sentIds, setSentIds] = useState(new Set())
    const [sending, setSending] = useState(null)
    const [error, setError] = useState(null)

    const color = team.color || '#6366f1'
    const existingMemberIds = new Set((team.members || []).map(m => m.user_id))

    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); return }
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const data = await communityTeamService.searchUsers(searchQuery)
                setSearchResults(
                    (data.users || []).filter(u => !existingMemberIds.has(u.id) && !sentIds.has(u.id))
                )
            } catch { setSearchResults([]) }
            finally { setSearching(false) }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleInvite = async (user) => {
        setSending(user.id)
        setError(null)
        try {
            await communityTeamService.invite(team.id, user.id)
            setSentIds(prev => new Set([...prev, user.id]))
            setSearchResults(prev => prev.filter(u => u.id !== user.id))
        } catch (err) {
            setError(err.message)
        } finally {
            setSending(null)
        }
    }

    const handleGenerateLink = async () => {
        setLinkLoading(true)
        setError(null)
        try {
            const { invite_code } = await communityTeamService.generateLink(team.id)
            setInviteLink(`${window.location.origin}/team?join=${invite_code}`)
        } catch (err) {
            setError(err.message)
        } finally {
            setLinkLoading(false)
        }
    }

    const handleCopyLink = async () => {
        if (!inviteLink) return
        await navigator.clipboard.writeText(inviteLink)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-md bg-(--color-primary) border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-(--color-text)">Invite Members</h2>
                        <p className="text-xs text-(--color-text-secondary) mt-0.5">{team.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto panel-scrollbar">
                    {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded px-3 py-2">{error}</div>
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)/50" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by Discord or SMITE name..."
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                            autoFocus
                        />
                        {searching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                        )}
                    </div>

                    {/* Results */}
                    {searchResults.length > 0 && (
                        <div className="rounded-lg border border-white/10 bg-(--color-primary) max-h-48 overflow-y-auto panel-scrollbar">
                            {searchResults.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => handleInvite(user)}
                                    disabled={sending === user.id}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer text-left disabled:opacity-50"
                                >
                                    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#5865F2] shrink-0 flex items-center justify-center">
                                        {user.discord_avatar && user.discord_id ? (
                                            <img src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-white">{user.discord_username?.[0]?.toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-(--color-text) truncate">{user.discord_username}</div>
                                        {user.player_name && (
                                            <div className="text-[10px] text-(--color-text-secondary) truncate">{user.player_name}</div>
                                        )}
                                    </div>
                                    <UserPlus className="w-3.5 h-3.5 text-(--color-text-secondary)/50 shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Sent confirmation */}
                    {sentIds.size > 0 && (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                            <Check className="w-3.5 h-3.5" />
                            {sentIds.size} invite{sentIds.size !== 1 ? 's' : ''} sent
                        </div>
                    )}

                    {/* Invite link */}
                    <div className="border-t border-white/10 pt-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) mb-2">
                            Invite Link
                        </div>
                        <p className="text-xs text-(--color-text-secondary) mb-2">
                            Share a link for players not yet on the site.
                        </p>
                        {inviteLink ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={inviteLink}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-(--color-text) font-mono truncate"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                                    style={{ backgroundColor: `${color}15`, color }}
                                >
                                    {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {linkCopied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleGenerateLink}
                                disabled={linkLoading}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Link2 className="w-4 h-4" />
                                {linkLoading ? 'Generating...' : 'Generate invite link'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
