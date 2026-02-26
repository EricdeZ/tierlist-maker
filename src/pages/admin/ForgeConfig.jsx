import { useState, useEffect } from 'react'
import { adminFetch } from '../../services/adminApi'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'

const CONFIG_FIELDS = [
    { key: 'game_decay', label: 'Game Decay', description: 'Per-game regression toward 1.0 — prevents runaway compounding', step: 0.01, min: 0, max: 1 },
    { key: 'supply_weight', label: 'Supply Weight', description: 'How much spark supply mutes score deviation (higher = popular players more stable)', step: 0.001, min: 0, max: 1 },
    { key: 'inactivity_decay', label: 'Inactivity Decay', description: 'Per-week multiplicative decay for players who don\'t play', step: 0.01, min: 0, max: 1 },
    { key: 'perf_floor', label: 'Perf Floor', description: 'Hard floor on the performance multiplier', step: 0.01, min: 0, max: 1 },
    { key: 'perf_ceiling', label: 'Perf Ceiling', description: 'Soft ceiling asymptote (gains compress toward this, never reached)', step: 0.1, min: 1, max: 10 },
    { key: 'compress_k', label: 'Compress K', description: 'How aggressively gains compress above 1.0 (higher = more compression)', step: 0.01, min: 0, max: 5 },
    { key: 'opponent_weight', label: 'Opponent Weight', description: 'How much opponent quality affects the score (strong opponents = boost)', step: 0.01, min: 0, max: 1 },
    { key: 'teammate_weight', label: 'Teammate Weight', description: 'How much teammate quality affects the score (strong teammates = slight penalty)', step: 0.01, min: 0, max: 1 },
    { key: 'god_weight', label: 'God Weight', description: 'How much god meta affects the score (strong god = slight penalty)', step: 0.01, min: 0, max: 1 },
    { key: 'win_bonus', label: 'Win Bonus', description: 'Flat multiplier boost for winning the game', step: 0.01, min: 0, max: 0.5 },
    { key: 'decay_half_life', label: 'Decay Half-Life', description: 'Days for 50% recency decay on role averages', step: 1, min: 1, max: 30 },
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

    const hasChanges = (() => {
        const numericChanged = Object.keys(draft).some(key => {
            if (key === 'performance_approval') return false
            const current = Number(config?.[key])
            const pending = Number(draft[key])
            return !isNaN(pending) && pending !== current
        })
        const boolChanged = draft.performance_approval !== undefined && draft.performance_approval !== config?.performance_approval
        return numericChanged || boolChanged
    })()

    const handleSave = async () => {
        if (!hasChanges) return
        setSaving(true)
        setMessage(null)
        try {
            const body = {}
            for (const [key, val] of Object.entries(draft)) {
                if (key === 'performance_approval') {
                    if (val !== config?.performance_approval) body.performance_approval = val
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
                <h2 className="font-heading text-lg font-bold text-[var(--color-text)] mb-1">
                    Pending Performance Updates
                    {pending.length > 0 && <span className="ml-2 text-sm font-normal text-amber-400">({pending.length} players)</span>}
                </h2>
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

                                            return (
                                                <tr key={row.id} className="border-b border-white/5 last:border-0">
                                                    <td className="px-4 py-2 text-sm text-[var(--color-text)]">{row.player_name}</td>
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
