import React, { useState, useEffect } from 'react'
import { adminFetch } from '../../services/adminApi'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'

const CONFIG_FIELDS = [
    { key: 'game_decay', label: 'Game Decay', description: 'Per-game regression toward 1.0 — prevents runaway compounding', step: 0.01, min: 0, max: 1 },
    { key: 'supply_weight', label: 'Supply Weight', description: 'How much spark supply mutes score deviation (higher = popular players more stable)', step: 0.001, min: 0, max: 1 },
    { key: 'expectation_weight', label: 'Expectation Weight', description: 'How much supply raises the "par" performance baseline — at 100 sparks with 0.002, a player needs 1.2 raw score just to break even', step: 0.001, min: 0, max: 0.05 },
    { key: 'inactivity_decay', label: 'Inactivity Decay', description: 'Per-week multiplicative decay for players who don\'t play', step: 0.01, min: 0, max: 1 },
    { key: 'perf_floor', label: 'Perf Floor', description: 'Hard floor on the performance multiplier', step: 0.01, min: 0, max: 1 },
    { key: 'perf_ceiling', label: 'Perf Ceiling', description: 'Soft ceiling asymptote (gains compress toward this, never reached)', step: 0.1, min: 1, max: 10 },
    { key: 'compress_k', label: 'Compress K', description: 'How aggressively gains compress above 1.0 (higher = more compression)', step: 0.01, min: 0, max: 5 },
    { key: 'opponent_weight', label: 'Opponent Weight', description: 'How much opponent quality affects the score (strong opponents = boost)', step: 0.01, min: 0, max: 1 },
    { key: 'teammate_weight', label: 'Teammate Weight', description: 'How much teammate quality affects the score (strong teammates = slight penalty)', step: 0.01, min: 0, max: 1 },
    { key: 'god_weight', label: 'God Weight', description: 'How much god meta affects the score (strong god = slight penalty)', step: 0.01, min: 0, max: 1 },
    { key: 'win_bonus', label: 'Win Bonus', description: 'Flat multiplier boost for winning the game', step: 0.01, min: 0, max: 0.5 },
    { key: 'decay_half_life', label: 'Decay Half-Life', description: 'Days for 50% recency decay on role averages', step: 1, min: 1, max: 30 },
    { key: 'sell_pressure_half_life', label: 'Sell Pressure Half-Life', description: 'Days for sell pressure to halve (lower = faster recovery after mass sells)', step: 0.5, min: 0.5, max: 14 },
    { key: 'sell_pressure_factor', label: 'Sell Pressure Factor', description: 'Price depression per unit of sell pressure (matches supply factor for symmetry)', step: 0.005, min: 0, max: 0.1 },
]

export default function ForgeConfig() {
    const { permissions } = useAuth()
    const isOwner = permissions.global.includes('permission_manage')

    const [config, setConfig] = useState(null)
    const [draft, setDraft] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    // Pending updates state
    const [pending, setPending] = useState([])
    const [pendingLoading, setPendingLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [pendingMessage, setPendingMessage] = useState(null)
    const [recalcing, setRecalcing] = useState(false)
    const [expandedSparkId, setExpandedSparkId] = useState(null)
    const [breakdown, setBreakdown] = useState(null)
    const [breakdownLoading, setBreakdownLoading] = useState(false)

    useEffect(() => {
        loadPending()
        if (isOwner) loadConfig()
        else setLoading(false)
    }, [])

    const loadConfig = async () => {
        try {
            const data = await adminFetch('forge-config', { method: 'GET' })
            setConfig(data)
            setDraft({})
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        } finally {
            setLoading(false)
        }
    }

    const loadPending = async () => {
        try {
            const data = await adminFetch('forge-config', { method: 'GET', params: { action: 'pending' } })
            setPending(data)
        } catch (err) {
            setPendingMessage({ type: 'error', text: err.message })
        } finally {
            setPendingLoading(false)
        }
    }

    const handleChange = (key, value) => {
        setDraft(prev => ({ ...prev, [key]: value }))
    }

    const handleToggleApproval = () => {
        setDraft(prev => ({
            ...prev,
            performance_approval: !(draft.performance_approval !== undefined ? draft.performance_approval : config?.performance_approval)
        }))
    }

    const handleToggleBool = (key) => {
        setDraft(prev => ({
            ...prev,
            [key]: !(draft[key] !== undefined ? draft[key] : config?.[key])
        }))
    }

    const BOOL_KEYS = ['performance_approval', 'fueling_locked', 'cooling_locked']

    const hasChanges = (() => {
        const numericChanged = Object.keys(draft).some(key => {
            if (BOOL_KEYS.includes(key)) return false
            const current = Number(config?.[key])
            const pending = Number(draft[key])
            return !isNaN(pending) && pending !== current
        })
        const boolChanged = BOOL_KEYS.some(key =>
            draft[key] !== undefined && draft[key] !== config?.[key]
        )
        return numericChanged || boolChanged
    })()

    const handleSave = async () => {
        if (!hasChanges) return
        setSaving(true)
        setMessage(null)
        try {
            const body = {}
            for (const [key, val] of Object.entries(draft)) {
                if (BOOL_KEYS.includes(key)) {
                    if (val !== config?.[key]) body[key] = val
                    continue
                }
                const num = Number(val)
                if (!isNaN(num) && num !== Number(config?.[key])) {
                    body[key] = num
                }
            }
            const updated = await adminFetch('forge-config', { method: 'POST', body })
            setConfig(updated)
            setDraft({})
            setMessage({ type: 'success', text: 'Config saved. Changes take effect on next match submission.' })
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        setDraft({})
        setMessage(null)
    }

    const handleApprove = async () => {
        setApproving(true)
        setPendingMessage(null)
        try {
            const result = await adminFetch('forge-config', { method: 'POST', params: { action: 'approve' } })
            setPending([])
            setPendingMessage({ type: 'success', text: `Applied ${result.applied} performance updates.` })
        } catch (err) {
            setPendingMessage({ type: 'error', text: err.message })
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async () => {
        setRejecting(true)
        setPendingMessage(null)
        try {
            await adminFetch('forge-config', { method: 'POST', params: { action: 'reject' } })
            setPending([])
            setPendingMessage({ type: 'success', text: 'Pending updates rejected and cleared.' })
        } catch (err) {
            setPendingMessage({ type: 'error', text: err.message })
        } finally {
            setRejecting(false)
        }
    }

    const handleRecalc = async () => {
        setRecalcing(true)
        setPendingMessage(null)
        try {
            const result = await adminFetch('forge-config', { method: 'POST', params: { action: 'recalc' } })
            if (result.status === 'queued') {
                setPendingMessage({ type: 'success', text: `Recalculated: ${result.updates} updates queued for approval.` })
                await loadPending()
            } else if (result.status === 'applied') {
                setPendingMessage({ type: 'success', text: `Recalculated: ${result.updates} updates applied immediately (approval gate off).` })
            } else if (result.status === 'skipped') {
                setPendingMessage({ type: 'error', text: `Recalc skipped: ${result.detail}` })
            } else {
                setPendingMessage({ type: 'error', text: `Unexpected result: ${JSON.stringify(result)}` })
            }
        } catch (err) {
            setPendingMessage({ type: 'error', text: err.message })
        } finally {
            setRecalcing(false)
        }
    }

    const handleToggleBreakdown = async (sparkId) => {
        if (expandedSparkId === sparkId) {
            setExpandedSparkId(null)
            setBreakdown(null)
            return
        }
        setExpandedSparkId(sparkId)
        setBreakdown(null)
        setBreakdownLoading(true)
        try {
            const data = await adminFetch('forge-config', { method: 'GET', params: { action: 'player-detail', spark_id: sparkId } })
            setBreakdown(data)
        } catch (err) {
            setBreakdown({ error: err.message })
        } finally {
            setBreakdownLoading(false)
        }
    }

    if (loading && pendingLoading) {
        return (
            <div className="max-w-3xl mx-auto p-4">
                <PageTitle title="Forge Config" noindex />
                <div className="text-center text-[var(--color-text-secondary)] py-12">Loading...</div>
            </div>
        )
    }

    const approvalOn = draft.performance_approval !== undefined ? draft.performance_approval : config?.performance_approval

    return (
        <div className="max-w-3xl mx-auto pb-8 px-4">
            <PageTitle title="Forge Config" noindex />

            <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Forge Performance Config</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Tune the performance scoring formula. Changes apply on next match submission.
                </p>
            </div>

            {/* ── Owner-only: Config editing ── */}
            {isOwner && config && (
                <>
                    {message && (
                        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                            message.type === 'error'
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                : 'bg-green-500/10 border border-green-500/30 text-green-400'
                        }`}>
                            {message.text}
                        </div>
                    )}

                    {/* Approval toggle */}
                    <div className="mb-4 rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                        <div>
                            <div className={`text-sm font-medium ${draft.performance_approval !== undefined && draft.performance_approval !== config.performance_approval ? 'text-amber-400' : 'text-[var(--color-text)]'}`}>
                                Performance Approval Gate
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                When enabled, performance updates queue for review instead of applying immediately
                            </div>
                        </div>
                        <button
                            onClick={handleToggleApproval}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                approvalOn ? 'bg-orange-600' : 'bg-white/20'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                approvalOn ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    {/* Market lock toggles */}
                    {[
                        { key: 'fueling_locked', label: 'Fueling Locked', desc: 'Prevents all fueling (buying Sparks) while enabled', color: 'orange' },
                        { key: 'cooling_locked', label: 'Cooling Locked', desc: 'Prevents all cooling (selling Sparks) while enabled', color: 'blue' },
                    ].map(toggle => {
                        const isOn = draft[toggle.key] !== undefined ? draft[toggle.key] : config?.[toggle.key]
                        const isModified = draft[toggle.key] !== undefined && draft[toggle.key] !== config?.[toggle.key]
                        return (
                            <div key={toggle.key} className="mb-4 rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                                <div>
                                    <div className={`text-sm font-medium ${isModified ? 'text-amber-400' : 'text-[var(--color-text)]'}`}>
                                        {toggle.label}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                        {toggle.desc}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleBool(toggle.key)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        isOn ? 'bg-red-600' : 'bg-white/20'
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        isOn ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>
                        )
                    })}

                    <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Parameter</th>
                                    <th className="text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3 w-32">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CONFIG_FIELDS.map(field => {
                                    const current = Number(config?.[field.key] ?? 0)
                                    const draftVal = draft[field.key]
                                    const displayVal = draftVal !== undefined ? draftVal : current
                                    const isModified = draftVal !== undefined && Number(draftVal) !== current

                                    return (
                                        <tr key={field.key} className="border-b border-white/5 last:border-0">
                                            <td className="px-4 py-3">
                                                <div className={`text-sm font-medium ${isModified ? 'text-amber-400' : 'text-[var(--color-text)]'}`}>
                                                    {field.label}
                                                    {isModified && <span className="ml-2 text-xs text-amber-500">({current})</span>}
                                                </div>
                                                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{field.description}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={displayVal}
                                                    onChange={e => handleChange(field.key, e.target.value)}
                                                    step={field.step}
                                                    min={field.min}
                                                    max={field.max}
                                                    className={`w-full px-3 py-1.5 rounded-lg text-sm bg-white/5 border transition-colors outline-none focus:ring-1 ${
                                                        isModified
                                                            ? 'border-amber-500/50 focus:ring-amber-500/30 text-amber-300'
                                                            : 'border-white/10 focus:ring-white/20 text-[var(--color-text)]'
                                                    }`}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        {hasChanges && (
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                            >
                                Discard
                            </button>
                        )}
                    </div>

                    <hr className="border-white/10 my-8" />
                </>
            )}

            {/* ── Pending Updates (visible to all global admins) ── */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <h2 className="font-heading text-lg font-bold text-[var(--color-text)]">
                        Pending Performance Updates
                        {pending.length > 0 && <span className="ml-2 text-sm font-normal text-amber-400">({pending.length} players)</span>}
                    </h2>
                    <button
                        onClick={handleRecalc}
                        disabled={recalcing}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {recalcing ? 'Recalculating...' : 'Recalculate'}
                    </button>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Review proposed multiplier/price changes before they go live.
                </p>

                {pendingMessage && (
                    <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                        pendingMessage.type === 'error'
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-green-500/10 border border-green-500/30 text-green-400'
                    }`}>
                        {pendingMessage.text}
                    </div>
                )}

                {pendingLoading ? (
                    <div className="text-center text-[var(--color-text-secondary)] py-8">Loading pending updates...</div>
                ) : pending.length === 0 ? (
                    <div className="text-center text-[var(--color-text-secondary)] py-8 rounded-xl border border-white/10" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                        No pending updates
                    </div>
                ) : (
                    <>
                        <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Player</th>
                                            <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Old Mult</th>
                                            <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">New Mult</th>
                                            <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Old Price</th>
                                            <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">New Price</th>
                                            <th className="text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-4 py-3">Delta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pending.map(row => {
                                            const oldMult = Number(row.old_multiplier)
                                            const newMult = Number(row.new_multiplier)
                                            const oldPrice = Number(row.old_price)
                                            const newPrice = Number(row.new_price)
                                            const delta = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice * 100) : 0
                                            const isExpanded = expandedSparkId === row.spark_id

                                            return (
                                                <React.Fragment key={row.id}>
                                                    <tr
                                                        onClick={() => handleToggleBreakdown(row.spark_id)}
                                                        className={`border-b border-white/5 cursor-pointer transition-colors ${isExpanded ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}
                                                    >
                                                        <td className="px-4 py-2 text-sm text-[var(--color-text)]">
                                                            <span className={`inline-block w-3 text-[var(--color-text-secondary)] text-xs mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9656;</span>
                                                            {row.player_name}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-right text-[var(--color-text-secondary)]">{oldMult.toFixed(4)}</td>
                                                        <td className="px-4 py-2 text-sm text-right text-[var(--color-text)]">{newMult.toFixed(4)}</td>
                                                        <td className="px-4 py-2 text-sm text-right text-[var(--color-text-secondary)]">{Math.round(oldPrice)}</td>
                                                        <td className="px-4 py-2 text-sm text-right text-[var(--color-text)]">{Math.round(newPrice)}</td>
                                                        <td className={`px-4 py-2 text-sm text-right font-medium ${
                                                            delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-[var(--color-text-secondary)]'
                                                        }`}>
                                                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={6} className="p-0">
                                                                {breakdownLoading ? (
                                                                    <div className="text-center text-[var(--color-text-secondary)] text-xs py-6">Loading breakdown...</div>
                                                                ) : breakdown?.error ? (
                                                                    <div className="text-center text-red-400 text-xs py-6">{breakdown.error}</div>
                                                                ) : breakdown ? (
                                                                    <PlayerBreakdown data={breakdown} />
                                                                ) : null}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4">
                            <button
                                onClick={handleApprove}
                                disabled={approving || rejecting}
                                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {approving ? 'Applying...' : `Approve All (${pending.length})`}
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={approving || rejecting}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {rejecting ? 'Rejecting...' : 'Reject All'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}


const STAT_KEYS = ['kills', 'deaths', 'assists', 'kp', 'damage', 'mitigated']

function fmtFactor(v) {
    if (v >= 1) return '+' + ((v - 1) * 100).toFixed(1) + '%'
    return ((v - 1) * 100).toFixed(1) + '%'
}

function factorColor(v) {
    if (v > 1.01) return 'text-green-400'
    if (v < 0.99) return 'text-red-400'
    return 'text-[var(--color-text-secondary)]'
}

function PlayerBreakdown({ data }) {
    const { player, games, finalInactivityDecay, finalMultiplier, roleAvgs, config: cfg } = data
    const playerRoleAvgs = roleAvgs[player.role] || roleAvgs[Object.keys(roleAvgs)[0]]

    return (
        <div className="bg-black/20 border-t border-white/10 px-4 py-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-sm font-medium text-[var(--color-text)]">{player.name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] ml-2 capitalize">{player.role}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] ml-2">{player.totalSparks} sparks outstanding</span>
                </div>
                <div className="text-right">
                    <span className="text-xs text-[var(--color-text-secondary)]">Final multiplier: </span>
                    <span className={`text-sm font-mono font-medium ${finalMultiplier > 1 ? 'text-green-400' : finalMultiplier < 1 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
                        {finalMultiplier.toFixed(4)}
                    </span>
                </div>
            </div>

            {/* Role averages reference */}
            {playerRoleAvgs && (
                <div className="text-xs text-[var(--color-text-secondary)]">
                    <span className="font-medium">Role averages ({player.role}):</span>{' '}
                    {playerRoleAvgs.avgKills.toFixed(1)} K / {playerRoleAvgs.avgDeaths.toFixed(1)} D / {playerRoleAvgs.avgAssists.toFixed(1)} A / {(playerRoleAvgs.avgKp * 100).toFixed(0)}% KP / {Math.round(playerRoleAvgs.avgDamage).toLocaleString()} dmg / {Math.round(playerRoleAvgs.avgMitigated).toLocaleString()} mit
                </div>
            )}

            {/* Per-game table */}
            {games.length === 0 ? (
                <div className="text-xs text-[var(--color-text-secondary)] py-2">No post-market games found (multiplier affected only by inactivity decay).</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">#</th>
                                <th className="text-left px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Date</th>
                                <th className="text-left px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">God</th>
                                <th className="text-center px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">W/L</th>
                                <th className="text-center px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">K/D/A</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Raw</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Heat</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Opp</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Team</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">God</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Win</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Factor</th>
                                <th className="text-right px-2 py-1.5 text-[var(--color-text-secondary)] font-medium">Mult</th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.map((g, i) => (
                                <GameRow key={i} game={g} index={i} cfg={cfg} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Final inactivity decay */}
            {finalInactivityDecay && (
                <div className="text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <span className="text-red-400 font-medium">Inactivity decay applied:</span>
                    <span className="text-[var(--color-text-secondary)] ml-1">
                        {finalInactivityDecay.weeks} week{finalInactivityDecay.weeks > 1 ? 's' : ''} since last game
                        — {finalInactivityDecay.before.toFixed(4)} &rarr; {finalInactivityDecay.after.toFixed(4)}
                    </span>
                </div>
            )}
        </div>
    )
}

function GameRow({ game: g, index: i, cfg }) {
    const [expanded, setExpanded] = useState(false)
    const isMultiGame = g.setGameCount > 1

    return (
        <>
            <tr
                onClick={() => setExpanded(!expanded)}
                className={`border-b border-white/5 cursor-pointer transition-colors ${expanded ? 'bg-white/5' : 'hover:bg-white/[0.03]'} ${isMultiGame && g.setPosition === 1 ? 'border-t border-t-white/20' : ''}`}
            >
                <td className="px-2 py-1.5 text-[var(--color-text-secondary)] font-mono">
                    {isMultiGame ? `${i + 1}` : i + 1}
                    {isMultiGame && <span className="text-[10px] text-amber-400/70 ml-0.5">G{g.setPosition}</span>}
                </td>
                <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                <td className="px-2 py-1.5 text-[var(--color-text)]">{g.god || '—'}</td>
                <td className={`px-2 py-1.5 text-center font-medium ${g.won ? 'text-green-400' : 'text-red-400'}`}>{g.won ? 'W' : 'L'}</td>
                <td className="px-2 py-1.5 text-center text-[var(--color-text)] font-mono">{g.stats.kills}/{g.stats.deaths}/{g.stats.assists}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${g.rawScore > 1.1 ? 'text-green-400' : g.rawScore < 0.9 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
                    {g.rawScore.toFixed(3)}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono ${factorColor(g.heat)}`}>{fmtFactor(g.heat)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${factorColor(g.opponent.factor)}`}>{fmtFactor(g.opponent.factor)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${factorColor(g.teammate.factor)}`}>{fmtFactor(g.teammate.factor)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${factorColor(g.godMeta.factor)}`}>{fmtFactor(g.godMeta.factor)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${factorColor(g.winFactor)}`}>
                    {fmtFactor(g.winFactor)}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono ${factorColor(g.gameFactor)}`}>
                    {g.gameFactor ? fmtFactor(g.gameFactor) : '—'}
                </td>
                {g.isLastInSet ? (
                    <td className={`px-2 py-1.5 text-right font-mono font-medium ${g.multiplierAfter > 1 ? 'text-green-400' : g.multiplierAfter < 1 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
                        {g.multiplierAfter.toFixed(4)}
                    </td>
                ) : (
                    <td className="px-2 py-1.5 text-right font-mono text-white/20">—</td>
                )}
            </tr>
            {expanded && (
                <tr>
                    <td colSpan={13} className="bg-black/30 px-4 py-3">
                        <GameDetail game={g} cfg={cfg} />
                    </td>
                </tr>
            )}
        </>
    )
}

function GameDetail({ game: g, cfg }) {
    const sb = g.statBreakdown

    return (
        <div className="space-y-3 text-xs">
            {/* Inactivity decay if applied */}
            {g.inactivityDecay && (
                <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 text-red-400">
                    Inactivity decay: {g.inactivityDecay.weeks}w gap — mult {g.multiplierBefore.toFixed(4)} &rarr; {g.inactivityDecay.multAfter.toFixed(4)}
                </div>
            )}

            {/* Set/game decay */}
            <div className="text-[var(--color-text-secondary)]">
                {g.setGameCount > 1 ? 'Set' : 'Game'} decay: {g.gameDecay.before.toFixed(4)} &rarr; {g.gameDecay.after.toFixed(4)}
                <span className="ml-1 text-[var(--color-text-secondary)]">(regressed {((1 - cfg.GAME_DECAY) * 100).toFixed(0)}% toward 1.0)</span>
            </div>

            {/* Stat breakdown table */}
            <div>
                <div className="text-[var(--color-text-secondary)] font-medium mb-1">Composite score breakdown (raw = {g.rawScore.toFixed(3)}):</div>
                <div className="grid grid-cols-6 gap-1">
                    {STAT_KEYS.map(stat => {
                        const s = sb[stat]
                        if (!s || s.weight === 0) return (
                            <div key={stat} className="bg-white/5 rounded px-2 py-1 text-center text-white/20">
                                <div className="uppercase font-medium">{stat}</div>
                                <div>—</div>
                            </div>
                        )
                        return (
                            <div key={stat} className="bg-white/5 rounded px-2 py-1.5 text-center">
                                <div className="uppercase font-medium text-[var(--color-text-secondary)]">{stat}</div>
                                <div className={`font-mono ${s.norm > 1.1 ? 'text-green-400' : s.norm < 0.9 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
                                    {stat === 'kp' ? (g.stats.kp * 100).toFixed(0) + '%' :
                                     stat === 'damage' || stat === 'mitigated' ? Math.round(g.stats[stat]).toLocaleString() :
                                     g.stats[stat]}
                                </div>
                                <div className="text-[var(--color-text-secondary)]">
                                    {s.norm.toFixed(2)}x avg
                                </div>
                                <div className="text-amber-400 font-mono text-[10px]">
                                    {(s.weight * 100).toFixed(0)}% &rarr; {s.contribution.toFixed(3)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Factors detail */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[var(--color-text-secondary)]">
                <div>
                    <span className="font-medium">Opponents</span> (avg {g.opponent.avgStrength.toFixed(3)}):
                    {g.opponent.players.map((p, i) => (
                        <span key={i} className="ml-1">
                            <span className="text-[var(--color-text)]">{p.name}</span>
                            <span className="font-mono text-[10px] ml-0.5">({p.strength.toFixed(2)})</span>
                            {i < g.opponent.players.length - 1 && ','}
                        </span>
                    ))}
                </div>
                <div>
                    <span className="font-medium">Teammates</span> (avg {g.teammate.avgStrength.toFixed(3)}):
                    {g.teammate.players.map((p, i) => (
                        <span key={i} className="ml-1">
                            <span className="text-[var(--color-text)]">{p.name}</span>
                            <span className="font-mono text-[10px] ml-0.5">({p.strength.toFixed(2)})</span>
                            {i < g.teammate.players.length - 1 && ','}
                        </span>
                    ))}
                </div>
                <div>
                    <span className="font-medium">God meta:</span> {g.god} avg score = {g.godMeta.godAvg.toFixed(3)}, your raw = {g.rawScore.toFixed(3)} &rarr; factor {g.godMeta.factor.toFixed(4)}
                </div>
                <div>
                    <span className="font-medium">Supply dampening:</span> heat = {g.heat.toFixed(4)} (raw {g.rawScore.toFixed(3)}{g.expected > 1.001 ? ` vs ${g.expected.toFixed(3)} expected` : ''}, muted by {Math.round(g.stats?.totalSparks || 0)} sparks)
                </div>
            </div>

            {/* Pipeline */}
            <div className="text-[var(--color-text-secondary)] bg-white/5 rounded px-2 py-1.5 space-y-1">
                <div>
                    <span className="font-medium">Game factor:</span>{' '}
                    heat({g.heat.toFixed(4)}) &times; opp({g.opponent.factor.toFixed(4)}) &times; team({g.teammate.factor.toFixed(4)}) &times; god({g.godMeta.factor.toFixed(4)}) &times; win({g.winFactor.toFixed(2)})
                    = <span className="text-[var(--color-text)] font-mono">{g.gameFactor?.toFixed(4) || '—'}</span>
                </div>
                {g.isLastInSet && (
                    <div>
                        <span className="font-medium">{g.setGameCount > 1 ? `Set avg (${g.setGameCount} games):` : 'Pipeline:'}</span>{' '}
                        {g.setGameCount > 1 && <span className="font-mono">{g.setAvgFactor.toFixed(4)} avg factor &rarr; </span>}
                        decayed({g.gameDecay.after.toFixed(4)}) &times; {g.setGameCount > 1 ? 'avg' : 'factor'}({g.setAvgFactor.toFixed(4)})
                        = <span className="text-[var(--color-text)] font-mono">{g.preCompression.toFixed(4)}</span>
                        &rarr; compress = <span className={`font-mono font-medium ${g.multiplierAfter > 1 ? 'text-green-400' : g.multiplierAfter < 1 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>{g.multiplierAfter.toFixed(4)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
