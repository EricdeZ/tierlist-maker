// src/pages/admin/DiscordReview.jsx — Auto-match review dashboard
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Zap } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

export default function DiscordReview() {
    const [tab, setTab] = useState('review')
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)

    // Match review state
    const [unmatched, setUnmatched] = useState([])
    const [matched, setMatched] = useState([])
    const [scheduledMatches, setScheduledMatches] = useState([])

    // Member sync state
    const [teamPlayers, setTeamPlayers] = useState([])
    const [syncSummary, setSyncSummary] = useState(null)

    // Activity log state
    const [activityEntries, setActivityEntries] = useState([])

    // Assignment state
    const [selectedItems, setSelectedItems] = useState(new Set())
    const [assignMatchId, setAssignMatchId] = useState('')
    const [assigning, setAssigning] = useState(false)

    // Poll/Match state
    const [polling, setPolling] = useState(false)
    const [matching, setMatching] = useState(false)
    const [matchDivisionIds, setMatchDivisionIds] = useState([])

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ id, type, message })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // Fetch match review data
    const fetchReview = useCallback(async () => {
        try {
            const res = await fetch(`${API}/discord-queue?action=match-review`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setUnmatched(data.unmatched || [])
            setMatched(data.matched || [])
            setScheduledMatches(data.scheduledMatches || [])
        } catch (err) {
            showToast('error', err.message)
        }
    }, [showToast])

    // Fetch member sync data
    const fetchMemberSync = useCallback(async () => {
        try {
            const res = await fetch(`${API}/discord-queue?action=member-sync-status`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setTeamPlayers(data.teamPlayers || [])
            setSyncSummary(data.summary || null)
        } catch (err) {
            showToast('error', err.message)
        }
    }, [showToast])

    // Fetch activity log
    const fetchActivity = useCallback(async () => {
        try {
            const res = await fetch(`${API}/discord-queue?action=discord-activity`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setActivityEntries(data.entries || [])
        } catch (err) {
            showToast('error', err.message)
        }
    }, [showToast])

    // Poll Discord channels for new screenshots
    const handlePollNow = useCallback(async () => {
        setPolling(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'poll-now' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            const newImages = data.results?.reduce((s, r) => s + (r.newImages || 0), 0) || 0
            showToast('success', `Polled ${data.results?.length || 0} channel(s) — ${newImages} new image(s)`)
            await Promise.all([fetchReview(), fetchActivity()])
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setPolling(false)
        }
    }, [showToast, fetchReview, fetchActivity])

    // Re-run auto-matching on unmatched items (optionally filtered by division)
    const handleMatchNow = useCallback(async () => {
        setMatching(true)
        try {
            const payload = { action: 'match-now' }
            if (matchDivisionIds.length > 0) payload.divisionIds = matchDivisionIds
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', `Matched ${data.matched} of ${data.total} item(s)`)
            await Promise.all([fetchReview(), fetchActivity()])
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setMatching(false)
        }
    }, [showToast, fetchReview, fetchActivity, matchDivisionIds])

    useEffect(() => {
        setLoading(true)
        Promise.all([fetchReview(), fetchMemberSync(), fetchActivity()])
            .finally(() => setLoading(false))
    }, [fetchReview, fetchMemberSync, fetchActivity])

    // Toggle item selection
    const toggleItem = (id) => {
        setSelectedItems(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const filteredUnmatched = matchDivisionIds.length > 0
        ? unmatched.filter(item => matchDivisionIds.includes(item.division_id))
        : unmatched

    // Select all unmatched (respects division filter)
    const selectAllUnmatched = () => {
        setSelectedItems(new Set(filteredUnmatched.map(i => i.id)))
    }

    // Assign selected items to a match
    const assignToMatch = async () => {
        if (!selectedItems.size || !assignMatchId) return
        setAssigning(true)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'update-suggested-match',
                    queue_item_ids: [...selectedItems],
                    scheduled_match_id: parseInt(assignMatchId),
                }),
            })
            if (!res.ok) throw new Error('Failed to assign')
            showToast('success', `Assigned ${selectedItems.size} item(s) to match`)
            setSelectedItems(new Set())
            setAssignMatchId('')
            await fetchReview()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setAssigning(false)
        }
    }

    // Skip (dismiss) unmatched items
    const skipItems = async (itemIds) => {
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'update-status',
                    queue_item_ids: itemIds,
                    status: 'skipped',
                }),
            })
            if (!res.ok) throw new Error('Failed to skip')
            showToast('success', `Skipped ${itemIds.length} item(s)`)
            setSelectedItems(prev => {
                const next = new Set(prev)
                itemIds.forEach(id => next.delete(id))
                return next
            })
            await fetchReview()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    // Unlink items from a match
    const unlinkFromMatch = async (itemIds) => {
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'update-suggested-match',
                    queue_item_ids: itemIds,
                    scheduled_match_id: null,
                }),
            })
            if (!res.ok) throw new Error('Failed to unlink')
            showToast('success', `Unlinked ${itemIds.length} item(s)`)
            await fetchReview()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    // Group team players by team for member sync tab
    const teamGroups = teamPlayers.reduce((acc, row) => {
        const key = row.team_id
        if (!acc[key]) {
            acc[key] = {
                team_id: row.team_id,
                team_name: row.team_name,
                color: row.color,
                discord_role_id: row.discord_role_id,
                division_name: row.division_name,
                players: [],
            }
        }
        if (row.player_id) {
            acc[key].players.push({
                id: row.player_id,
                name: row.player_name,
                discord_id: row.discord_id,
                discord_name: row.discord_name,
            })
        }
        return acc
    }, {})

    // Unique divisions from unmatched items (for Match Now filter)
    const unmatchedDivisions = [...new Map(
        unmatched.map(item => [item.division_id, { id: item.division_id, name: item.division_name }])
    ).values()].sort((a, b) => a.name.localeCompare(b.name))

    const tabs = [
        { key: 'review', label: 'Auto-Match Review', count: filteredUnmatched.length },
        { key: 'members', label: 'Member Sync', count: syncSummary?.players_unlinked || 0 },
        { key: 'activity', label: 'Activity Log', count: null },
    ]

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            <PageTitle title="Discord Review" noindex />

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">
                        Discord Review Dashboard
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        Review auto-matched screenshots, member sync status, and recent activity
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handlePollNow}
                        disabled={polling || matching}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${polling ? 'animate-spin' : ''}`} />
                        Poll Now
                    </button>
                    {unmatchedDivisions.length > 1 && (
                        <div className="flex flex-wrap gap-1">
                            {unmatchedDivisions.map(div => {
                                const active = matchDivisionIds.includes(div.id)
                                return (
                                    <button
                                        key={div.id}
                                        onClick={() => setMatchDivisionIds(prev =>
                                            active ? prev.filter(id => id !== div.id) : [...prev, div.id]
                                        )}
                                        className={`px-2 py-1 rounded text-[11px] border transition ${
                                            active
                                                ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                                                : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]'
                                        }`}
                                    >
                                        {div.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    <button
                        onClick={handleMatchNow}
                        disabled={polling || matching || unmatched.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition disabled:opacity-50"
                    >
                        <Zap className={`w-3.5 h-3.5 ${matching ? 'animate-pulse' : ''}`} />
                        {matchDivisionIds.length > 0 ? `Match (${matchDivisionIds.length})` : 'Match All'}
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
                    toast.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    'bg-green-500/20 text-green-300 border border-green-500/30'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Summary cards */}
            {syncSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <StatCard label="Matched Items" value={matched.reduce((s, m) => s + m.screenshot_count, 0)} color="green" />
                    <StatCard label="Unmatched Items" value={unmatched.length} color={unmatched.length > 0 ? 'amber' : 'green'} />
                    <StatCard label="Players Linked" value={syncSummary.players_linked} color="green" />
                    <StatCard label="Players Unlinked" value={syncSummary.players_unlinked} color={syncSummary.players_unlinked > 0 ? 'amber' : 'green'} />
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            tab === t.key
                                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        {t.label}
                        {t.count != null && t.count > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-20 text-[var(--color-text-secondary)]">Loading...</div>
            ) : (
                <>
                    {tab === 'review' && (
                        <ReviewTab
                            unmatched={filteredUnmatched}
                            matched={matched}
                            scheduledMatches={scheduledMatches}
                            selectedItems={selectedItems}
                            toggleItem={toggleItem}
                            selectAllUnmatched={selectAllUnmatched}
                            assignMatchId={assignMatchId}
                            setAssignMatchId={setAssignMatchId}
                            assignToMatch={assignToMatch}
                            assigning={assigning}
                            unlinkFromMatch={unlinkFromMatch}
                            skipItems={skipItems}
                        />
                    )}
                    {tab === 'members' && (
                        <MembersTab teamGroups={teamGroups} summary={syncSummary} />
                    )}
                    {tab === 'activity' && (
                        <ActivityTab entries={activityEntries} />
                    )}
                </>
            )}
        </div>
    )
}


// ─── Sub-components ────────────────────────────────

function StatCard({ label, value, color }) {
    const colors = {
        green: 'border-green-500/20 bg-green-500/5',
        amber: 'border-amber-500/20 bg-amber-500/5',
        blue: 'border-blue-500/20 bg-blue-500/5',
    }
    const textColors = { green: 'text-green-400', amber: 'text-amber-400', blue: 'text-blue-400' }

    return (
        <div className={`rounded-lg border p-3 ${colors[color]}`}>
            <div className={`text-2xl font-bold ${textColors[color]}`}>{value}</div>
            <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
        </div>
    )
}


function ReviewTab({ unmatched, matched, scheduledMatches, selectedItems, toggleItem, selectAllUnmatched, assignMatchId, setAssignMatchId, assignToMatch, assigning, unlinkFromMatch, skipItems }) {
    const [skipping, setSkipping] = useState(false)

    const handleSkipSelected = async () => {
        setSkipping(true)
        await skipItems([...selectedItems])
        setSkipping(false)
    }

    return (
        <div className="space-y-8">
            {/* Unmatched items section */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Unmatched Screenshots ({unmatched.length})
                    </h2>
                    {unmatched.length > 0 && (
                        <button onClick={selectAllUnmatched} className="text-xs text-[var(--color-accent)] hover:underline">
                            Select All
                        </button>
                    )}
                </div>

                {unmatched.length === 0 ? (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-6 text-center text-sm text-green-400">
                        All pending screenshots have been matched to scheduled matches.
                    </div>
                ) : (
                    <>
                        {/* Assignment bar */}
                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-3 mb-3 p-3 bg-[var(--color-card)] border border-[var(--color-accent)]/30 rounded-lg">
                                <span className="text-sm text-[var(--color-text)]">
                                    {selectedItems.size} selected
                                </span>
                                <select
                                    value={assignMatchId}
                                    onChange={e => setAssignMatchId(e.target.value)}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--color-secondary)] border border-[var(--color-border)] text-[var(--color-text)] text-sm"
                                >
                                    <option value="">Assign to match...</option>
                                    {scheduledMatches.map(sm => (
                                        <option key={sm.id} value={sm.id}>
                                            {sm.team1_name} vs {sm.team2_name} — {sm.division_name}
                                            {sm.week ? ` W${sm.week}` : ''}
                                            {sm.scheduled_date ? ` (${new Date(sm.scheduled_date).toLocaleDateString()})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={assignToMatch}
                                    disabled={!assignMatchId || assigning || skipping}
                                    className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition"
                                >
                                    {assigning ? 'Assigning...' : 'Assign'}
                                </button>
                                <button
                                    onClick={handleSkipSelected}
                                    disabled={assigning || skipping}
                                    className="px-3 py-1.5 rounded-lg text-sm text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 transition"
                                >
                                    {skipping ? 'Skipping...' : 'Skip'}
                                </button>
                                <button
                                    onClick={() => setSelectedItems(new Set())}
                                    className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-white/5 transition"
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        {/* Unmatched items list */}
                        <div className="space-y-2">
                            {unmatched.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                        selectedItems.has(item.id)
                                            ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                                            : 'bg-[var(--color-card)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.has(item.id)}
                                        onChange={() => {}}
                                        className="shrink-0"
                                    />
                                    <img
                                        src={`${API}/discord-image?queueId=${item.id}&token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                                        alt=""
                                        className="w-12 h-12 rounded object-cover shrink-0 bg-black/30"
                                        loading="lazy"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-[var(--color-text)] truncate">
                                                {item.attachment_filename}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-text-secondary)]">
                                                {item.division_name}
                                            </span>
                                        </div>
                                        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                            {item.author_name || 'Unknown'} &middot; {new Date(item.message_timestamp).toLocaleString()}
                                        </div>
                                        {item.message_content && (
                                            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate max-w-md">
                                                {item.message_content}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); skipItems([item.id]) }}
                                        className="shrink-0 px-2.5 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-amber-400 bg-white/5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition"
                                        title="Skip this screenshot"
                                    >
                                        Skip
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {/* Matched items section */}
            <section>
                <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                    Auto-Matched ({matched.length} matches, {matched.reduce((s, m) => s + m.screenshot_count, 0)} screenshots)
                </h2>

                {matched.length === 0 ? (
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-6 text-center text-sm text-[var(--color-text-secondary)]">
                        No auto-matched screenshots yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {matched.map(group => (
                            <MatchedGroup key={group.match_id} group={group} unlinkFromMatch={unlinkFromMatch} skipItems={skipItems} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}


function MatchedGroup({ group, unlinkFromMatch, skipItems }) {
    // Derive group confidence from items (lowest confidence wins)
    const confidenceRank = { high: 2, medium: 1, low: 0 }
    const groupConfidence = (group.items || []).reduce((worst, item) => {
        const c = item.match_confidence || 'low'
        return (confidenceRank[c] ?? 0) < (confidenceRank[worst] ?? 0) ? c : worst
    }, 'high')

    const confidenceStyles = {
        high: { dot: 'bg-green-500', badge: 'bg-green-500/20 text-green-400', label: 'High confidence' },
        medium: { dot: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-400', label: 'Needs review' },
        low: { dot: 'bg-red-500', badge: 'bg-red-500/20 text-red-400', label: 'Low confidence' },
    }
    const conf = confidenceStyles[groupConfidence] || confidenceStyles.low
    // Auto-expand low confidence matches so admins notice them immediately
    const [expanded, setExpanded] = useState(groupConfidence === 'low')

    return (
        <div className={`bg-[var(--color-card)] border rounded-lg overflow-hidden ${
            groupConfidence === 'low' ? 'border-red-500/40' :
            groupConfidence === 'medium' ? 'border-amber-500/30' :
            'border-[var(--color-border)]'
        }`}>
            <div
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
            >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${conf.dot}`} />
                <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">#{group.match_id}</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.team1_color }} />
                    <span className="text-sm font-semibold text-[var(--color-text)] truncate">{group.team1_name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">vs</span>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.team2_color }} />
                    <span className="text-sm font-semibold text-[var(--color-text)] truncate">{group.team2_name}</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{group.division_name}</span>
                {group.week && <span className="text-xs text-[var(--color-text-secondary)]">W{group.week}</span>}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    {group.screenshot_count} screenshot{group.screenshot_count !== 1 ? 's' : ''}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.badge}`}>
                    {conf.label}
                </span>
                <svg
                    className={`w-4 h-4 text-[var(--color-text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {expanded && (
                <div className="border-t border-[var(--color-border)] p-3 space-y-2">
                    {group.items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 text-sm">
                            <img
                                src={`${API}/discord-image?queueId=${item.id}&token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                                alt=""
                                className="w-10 h-10 rounded object-cover shrink-0 bg-black/30"
                                loading="lazy"
                            />
                            <span className="text-[var(--color-text)] truncate flex-1">{item.attachment_filename}</span>
                            <span className="text-xs text-[var(--color-text-secondary)]">{item.author_name}</span>
                            <span className="text-xs text-[var(--color-text-secondary)]">
                                {new Date(item.message_timestamp).toLocaleString()}
                            </span>
                        </div>
                    ))}
                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            onClick={() => unlinkFromMatch(group.items.map(i => i.id))}
                            className="text-xs text-red-400 hover:text-red-300 hover:underline"
                        >
                            Unlink All
                        </button>
                        <button
                            onClick={() => skipItems(group.items.map(i => i.id))}
                            className="text-xs text-amber-400 hover:text-amber-300 hover:underline"
                        >
                            Skip All
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}


function MembersTab({ teamGroups, summary }) {
    const teams = Object.values(teamGroups)

    return (
        <div className="space-y-6">
            {/* Summary */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Teams w/ Roles" value={summary.teams_with_roles} color="green" />
                    <StatCard label="Teams w/o Roles" value={summary.teams_without_roles} color={summary.teams_without_roles > 0 ? 'amber' : 'green'} />
                    <StatCard label="Players Linked" value={summary.players_linked} color="green" />
                    <StatCard label="Players Unlinked" value={summary.players_unlinked} color={summary.players_unlinked > 0 ? 'amber' : 'green'} />
                </div>
            )}

            {teams.length === 0 ? (
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-6 text-center">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        No teams with Discord role mappings found.
                    </p>
                    <Link
                        to="/admin/roster-sync"
                        className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 transition"
                    >
                        Configure Team Roles
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {teams.map(team => (
                        <div key={team.team_id} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                                <span className="text-sm font-semibold text-[var(--color-text)]">{team.team_name}</span>
                                <span className="text-xs text-[var(--color-text-secondary)]">{team.division_name}</span>
                            </div>

                            {team.players.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-secondary)] italic">No players on roster</p>
                            ) : (
                                <div className="space-y-1">
                                    {team.players.map(p => (
                                        <div key={p.id} className="flex items-center gap-2 text-sm">
                                            <span className={`w-2 h-2 rounded-full ${p.discord_id ? 'bg-green-500' : p.discord_name ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                            <span className="text-[var(--color-text)]">{p.name}</span>
                                            {p.discord_name && (
                                                <span className="text-xs text-[var(--color-text-secondary)]">({p.discord_name})</span>
                                            )}
                                            {!p.discord_id && !p.discord_name && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                                    No Discord link
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}


function ActivityTab({ entries }) {
    const actionLabels = {
        'discord-poll-now': 'Manual Poll',
        'map-team-role': 'Role Mapped',
        'add-discord-channel': 'Channel Added',
        'remove-discord-channel': 'Channel Removed',
        'update-suggested-match': 'Match Reassigned',
    }

    const actionColors = {
        'discord-poll-now': 'bg-blue-500/20 text-blue-400',
        'map-team-role': 'bg-purple-500/20 text-purple-400',
        'add-discord-channel': 'bg-green-500/20 text-green-400',
        'remove-discord-channel': 'bg-red-500/20 text-red-400',
        'update-suggested-match': 'bg-amber-500/20 text-amber-400',
    }

    if (!entries.length) {
        return (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-6 text-center text-sm text-[var(--color-text-secondary)]">
                No recent Discord-related activity.
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {entries.map(entry => {
                const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : (entry.details || {})
                return (
                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${actionColors[entry.action] || 'bg-white/10 text-[var(--color-text-secondary)]'}`}>
                            {actionLabels[entry.action] || entry.action}
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className="text-sm text-[var(--color-text)]">
                                {entry.admin_name || `User #${entry.user_id}`}
                            </span>
                            {details.channel_name && (
                                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                                    #{details.channel_name}
                                </span>
                            )}
                            {details.discord_role_id && (
                                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                                    Role: {details.discord_role_id}
                                </span>
                            )}
                            {details.channels != null && (
                                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                                    {details.channels} ch, {details.newImages || 0} new
                                </span>
                            )}
                            {details.scheduled_match_id != null && (
                                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                                    Match #{details.scheduled_match_id}
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleString()}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
