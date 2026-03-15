import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePassion } from '../../context/PassionContext'
import { useAuth } from '../../context/AuthContext'
import { challengeService, predictionsService, passionService, emberService, vaultAdminService } from '../../services/database'
import { RANK_THRESHOLDS, formatRank } from '../../config/ranks'
import RankBadge from '../../components/RankBadge'
import PageTitle from '../../components/PageTitle'

export default function DebugTools() {
    const { user, permissions } = useAuth()
    const {
        balance, totalEarned, currentStreak, longestStreak,
        canClaimDaily, claimableCount, rank, nextRank,
        triggerRankUp, refreshBalance,
    } = usePassion()

    const [selectedRankIdx, setSelectedRankIdx] = useState(RANK_THRESHOLDS.length - 1)
    const [resetting, setResetting] = useState(false)
    const [resetResult, setResetResult] = useState(null)
    const [refunding, setRefunding] = useState(false)
    const [refundResult, setRefundResult] = useState(null)
    const [grantQuery, setGrantQuery] = useState('')
    const [grantUsers, setGrantUsers] = useState([])
    const [grantTarget, setGrantTarget] = useState(null)
    const [grantAmount, setGrantAmount] = useState('')
    const [grantReason, setGrantReason] = useState('')
    const [granting, setGranting] = useState(false)
    const [grantResult, setGrantResult] = useState(null)

    const [coresQuery, setCoresQuery] = useState('')
    const [coresUsers, setCoresUsers] = useState([])
    const [coresTarget, setCoresTarget] = useState(null)
    const [coresAmount, setCoresAmount] = useState('')
    const [coresReason, setCoresReason] = useState('')
    const [coresGranting, setCoresGranting] = useState(false)
    const [coresResult, setCoresResult] = useState(null)

    const [grantingCard, setGrantingCard] = useState(false)
    const [grantCardResult, setGrantCardResult] = useState(null)
    const [grantCardRarity, setGrantCardRarity] = useState('unique')

    const selectedRank = RANK_THRESHOLDS[selectedRankIdx]

    const handleGrantTestCard = async (rarity) => {
        setGrantingCard(true)
        setGrantCardResult(null)
        try {
            const res = await vaultAdminService.grantCard({
                userId: user.id,
                godId: `player-test-${rarity}`,
                godName: 'TestPlayer',
                godClass: 'JUNGLE',
                role: 'jungle',
                rarity,
                holoEffect: rarity === 'unique' ? 'unique' : rarity === 'mythic' ? 'rainbow' : rarity === 'legendary' ? 'gold' : 'cosmos',
                holoType: 'reverse',
                imageUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.webp?size=256` : '',
                cardType: 'player',
                cardData: {
                    playerName: user.discord_username || 'TestPlayer',
                    teamName: 'Debug Squad',
                    teamColor: '#e8e8ff',
                    role: 'JUNGLE',
                    isConnected: true,
                    stats: { gamesPlayed: 14, wins: 12, winRate: 85.7, kda: 4.3, avgDamage: 21886, avgMitigated: 13313, totalKills: 102, totalDeaths: 40, totalAssists: 141 },
                    bestGod: { name: 'Medusa', games: 3, winRate: 100 },
                },
            })
            setGrantCardResult({ card: res.card })
        } catch (err) {
            setGrantCardResult({ error: err.message })
        } finally {
            setGrantingCard(false)
        }
    }

    const handleDeleteTestCard = async (cardId) => {
        try {
            await vaultAdminService.deleteCard(cardId)
            setGrantCardResult(null)
        } catch (err) {
            setGrantCardResult({ error: err.message })
        }
    }

    const handleResetPassion = async () => {
        if (!confirm('Full passion reset: challenges, balance, transactions, streak, daily claim. Continue?')) return
        setResetting(true)
        setResetResult(null)
        try {
            const res = await challengeService.resetMyChallenges()
            setResetResult(res)
            refreshBalance()
        } catch (err) {
            setResetResult({ error: err.message })
        } finally {
            setResetting(false)
        }
    }

    const debounceRef = useRef(null)
    useEffect(() => {
        if (!grantQuery.trim() || grantTarget) {
            setGrantUsers([])
            return
        }
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await challengeService.searchUsers(grantQuery.trim())
                setGrantUsers(res.users || [])
            } catch { /* ignore */ }
        }, 300)
        return () => clearTimeout(debounceRef.current)
    }, [grantQuery, grantTarget])

    const coresDebounceRef = useRef(null)
    useEffect(() => {
        if (!coresQuery.trim() || coresTarget) {
            setCoresUsers([])
            return
        }
        clearTimeout(coresDebounceRef.current)
        coresDebounceRef.current = setTimeout(async () => {
            try {
                const res = await challengeService.searchUsers(coresQuery.trim())
                setCoresUsers(res.users || [])
            } catch { /* ignore */ }
        }, 300)
        return () => clearTimeout(coresDebounceRef.current)
    }, [coresQuery, coresTarget])

    const handleGrantCores = async () => {
        if (!coresTarget || !coresAmount) return
        setCoresGranting(true)
        setCoresResult(null)
        try {
            const res = await emberService.adminGrant(coresTarget.id, Number(coresAmount), coresReason || undefined)
            setCoresResult(res)
            setCoresAmount('')
            setCoresReason('')
        } catch (err) {
            setCoresResult({ error: err.message })
        } finally {
            setCoresGranting(false)
        }
    }

    const handleGrantPassion = async () => {
        if (!grantTarget || !grantAmount) return
        setGranting(true)
        setGrantResult(null)
        try {
            const res = await passionService.adminGrant(grantTarget.id, Number(grantAmount), grantReason || undefined)
            setGrantResult(res)
            setGrantAmount('')
            setGrantReason('')
            refreshBalance()
        } catch (err) {
            setGrantResult({ error: err.message })
        } finally {
            setGranting(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto pb-8 px-4">
            <PageTitle title="Debug Tools" noindex />

            <div className="mb-8">
                <h1 className="font-heading text-2xl font-bold text-(--color-text)">Debug Tools</h1>
            </div>

            {/* Rank-Up Animation Trigger */}
            <section className="bg-(--color-secondary) rounded-xl border border-(--color-accent)/20 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-(--color-accent) mb-4">
                    Rank-Up Animation
                </h2>

                <div className="flex items-end gap-4 mb-4">
                    <div className="flex-1">
                        <label className="block text-xs text-(--color-text-secondary) mb-1.5">
                            Select rank to preview
                        </label>
                        <select
                            value={selectedRankIdx}
                            onChange={e => setSelectedRankIdx(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)/50"
                        >
                            {RANK_THRESHOLDS.map((r, i) => (
                                <option key={i} value={i}>
                                    {formatRank(r)} ({r.minPassion} passion)
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => triggerRankUp(selectedRank)}
                        className="px-5 py-2 rounded-lg font-bold text-sm transition-colors shrink-0"
                        style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}
                    >
                        Trigger
                    </button>
                </div>

                {/* Preview of selected rank */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <RankBadge rank={selectedRank} size="lg" />
                    <div>
                        <div className="text-sm font-bold text-(--color-text)">{formatRank(selectedRank)}</div>
                        <div className="text-xs text-(--color-text-secondary)">
                            Threshold: {selectedRank.minPassion} passion
                        </div>
                    </div>
                </div>
            </section>

            {/* Challenge Nudge */}
            <section className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-amber-400 mb-4">
                    Challenge Nudge
                </h2>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-(--color-text)">Show Challenge Nudge Modal</div>
                        <div className="text-xs text-(--color-text-secondary) mt-0.5">
                            The popup shown to users with 0 Passion and claimable challenges.
                        </div>
                    </div>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-challenge-nudge'))}
                        className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-(--color-primary) font-bold text-sm transition-colors shrink-0"
                    >
                        Trigger
                    </button>
                </div>
            </section>

            {/* SAL Invite */}
            <section className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-green-400 mb-4">
                    SAL Invite
                </h2>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-(--color-text)">Show SAL Invite Modal</div>
                        <div className="text-xs text-(--color-text-secondary) mt-0.5">
                            The promotional popup shown to Tier 5 players inviting them to join the Serpent Ascension League.
                        </div>
                    </div>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-sal-invite'))}
                        className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-colors shrink-0"
                    >
                        Trigger
                    </button>
                </div>
            </section>

            {/* Current Passion State */}
            <section className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-(--color-text) mb-4">
                    Passion State
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        ['Balance', balance],
                        ['Total Earned', totalEarned],
                        ['Current Rank', formatRank(rank)],
                        ['Next Rank', nextRank ? formatRank(nextRank) : 'MAX'],
                        ['Streak', currentStreak],
                        ['Longest Streak', longestStreak],
                        ['Can Claim Daily', canClaimDaily ? 'Yes' : 'No'],
                        ['Claimable Challenges', claimableCount],
                    ].map(([label, value]) => (
                        <div key={label} className="p-3 rounded-lg bg-white/5">
                            <div className="text-[10px] uppercase tracking-wider text-(--color-text-secondary) mb-1">{label}</div>
                            <div className="text-sm font-bold text-(--color-text)">{value}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Grant Passion */}
            <section className="bg-(--color-secondary) rounded-xl border border-(--color-accent)/20 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-(--color-accent) mb-4">
                    Grant Passion
                </h2>

                {/* User search */}
                <div className="mb-3">
                    <input
                        type="text"
                        value={grantQuery}
                        onChange={e => { setGrantQuery(e.target.value); setGrantTarget(null) }}
                        placeholder="Search username..."
                        className="w-full px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)/50"
                    />
                </div>

                {/* User results */}
                {grantUsers.length > 0 && !grantTarget && (
                    <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-white/10">
                        {grantUsers.map(u => (
                            <button
                                key={u.id}
                                onClick={() => { setGrantTarget(u); setGrantUsers([]) }}
                                className="w-full text-left px-3 py-2 text-sm text-(--color-text) hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                            >
                                {u.discord_username} <span className="text-(--color-text-secondary)">#{u.id}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Selected user */}
                {grantTarget && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/5">
                        <span className="text-sm font-medium text-(--color-text)">{grantTarget.discord_username}</span>
                        <span className="text-xs text-(--color-text-secondary)">#{grantTarget.id}</span>
                        <button
                            onClick={() => { setGrantTarget(null); setGrantResult(null) }}
                            className="ml-auto text-xs text-(--color-text-secondary) hover:text-red-400 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Amount + reason */}
                <div className="flex gap-2 mb-3">
                    <input
                        type="number"
                        value={grantAmount}
                        onChange={e => setGrantAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-28 px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)/50"
                    />
                    <input
                        type="text"
                        value={grantReason}
                        onChange={e => setGrantReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)/50"
                    />
                    <button
                        onClick={handleGrantPassion}
                        disabled={!grantTarget || !grantAmount || granting}
                        className="px-5 py-2 rounded-lg font-bold text-sm transition-colors shrink-0 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}
                    >
                        {granting ? 'Granting...' : 'Grant'}
                    </button>
                </div>

                {grantResult && (
                    <div className={`text-xs p-2 rounded-lg ${grantResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {grantResult.error
                            ? `Error: ${grantResult.error}`
                            : `Granted ${grantResult.amount} Passion to ${grantResult.targetUsername}. New balance: ${grantResult.newBalance}`}
                    </div>
                )}
            </section>

            {/* Grant Cores */}
            <section className="bg-(--color-secondary) rounded-xl border border-cyan-500/20 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-cyan-400 mb-4">
                    Grant Cores
                </h2>

                <div className="mb-3">
                    <input
                        type="text"
                        value={coresQuery}
                        onChange={e => { setCoresQuery(e.target.value); setCoresTarget(null) }}
                        placeholder="Search username..."
                        className="w-full px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                </div>

                {coresUsers.length > 0 && !coresTarget && (
                    <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-white/10">
                        {coresUsers.map(u => (
                            <button
                                key={u.id}
                                onClick={() => { setCoresTarget(u); setCoresUsers([]) }}
                                className="w-full text-left px-3 py-2 text-sm text-(--color-text) hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                            >
                                {u.discord_username} <span className="text-(--color-text-secondary)">#{u.id}</span>
                            </button>
                        ))}
                    </div>
                )}

                {coresTarget && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/5">
                        <span className="text-sm font-medium text-(--color-text)">{coresTarget.discord_username}</span>
                        <span className="text-xs text-(--color-text-secondary)">#{coresTarget.id}</span>
                        <button
                            onClick={() => { setCoresTarget(null); setCoresResult(null) }}
                            className="ml-auto text-xs text-(--color-text-secondary) hover:text-red-400 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                )}

                <div className="flex gap-2 mb-3">
                    <input
                        type="number"
                        value={coresAmount}
                        onChange={e => setCoresAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-28 px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                    <input
                        type="text"
                        value={coresReason}
                        onChange={e => setCoresReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                        onClick={handleGrantCores}
                        disabled={!coresTarget || !coresAmount || coresGranting}
                        className="px-5 py-2 rounded-lg font-bold text-sm transition-colors shrink-0 disabled:opacity-50 bg-cyan-600 hover:bg-cyan-500 text-white"
                    >
                        {coresGranting ? 'Granting...' : 'Grant'}
                    </button>
                </div>

                {coresResult && (
                    <div className={`text-xs p-2 rounded-lg ${coresResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {coresResult.error
                            ? `Error: ${coresResult.error}`
                            : `Granted ${coresResult.amount} Cores to ${coresResult.targetUsername}. New balance: ${coresResult.newBalance}`}
                    </div>
                )}
            </section>

            {/* Grant Test Card */}
            <section className="bg-(--color-secondary) rounded-xl border border-purple-500/20 p-6 mb-6">
                <h2 className="font-heading text-lg font-bold text-purple-400 mb-4">
                    Grant Test Card
                </h2>
                <div className="text-xs text-(--color-text-secondary) mb-3">
                    Creates a test player card in your collection. Refresh Vault after granting.
                </div>
                <div className="flex items-center gap-2 mb-3">
                    <select
                        value={grantCardRarity}
                        onChange={e => setGrantCardRarity(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-(--color-primary) border border-white/10 text-(--color-text) text-sm focus:outline-none"
                    >
                        {['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'].map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => handleGrantTestCard(grantCardRarity)}
                        disabled={grantingCard}
                        className="px-5 py-2 rounded-lg font-bold text-sm transition-colors shrink-0 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                    >
                        {grantingCard ? 'Granting...' : 'Grant to Me'}
                    </button>
                </div>
                {grantCardResult && (
                    <div className={`text-xs p-2 rounded-lg ${grantCardResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {grantCardResult.error
                            ? `Error: ${grantCardResult.error}`
                            : <>
                                Card #{grantCardResult.card.id} granted ({grantCardResult.card.rarity}).{' '}
                                <button
                                    onClick={() => handleDeleteTestCard(grantCardResult.card.id)}
                                    className="underline text-red-400 hover:text-red-300 ml-1"
                                >
                                    Delete it
                                </button>
                            </>
                        }
                    </div>
                )}
            </section>

            {/* Full Passion Reset */}
            <section className="bg-(--color-secondary) rounded-xl border border-red-500/20 p-6">
                <h2 className="font-heading text-lg font-bold text-red-400 mb-4">
                    Destructive Actions
                </h2>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-(--color-text)">Full Passion Reset</div>
                        <div className="text-xs text-(--color-text-secondary) mt-0.5">
                            Resets everything: challenges, balance, transactions, streak, and daily claim.
                        </div>
                    </div>
                    <button
                        onClick={handleResetPassion}
                        disabled={resetting}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                        {resetting ? 'Resetting...' : 'Reset All Passion'}
                    </button>
                </div>
                {resetResult && (
                    <div className={`mt-3 text-xs p-2 rounded-lg ${resetResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {resetResult.error ? `Error: ${resetResult.error}` : 'Done. All passion data reset to zero.'}
                    </div>
                )}

                {/* Refund All Predictions */}
                <div className="flex items-center justify-between mt-5 pt-5 border-t border-white/10">
                    <div>
                        <div className="text-sm font-medium text-(--color-text)">Refund All Predictions</div>
                        <div className="text-xs text-(--color-text-secondary) mt-0.5">
                            Refunds all pending prediction wagers and marks them as refunded.
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            if (!confirm('Refund ALL pending predictions across all matches? Wagers will be returned to users.')) return
                            setRefunding(true)
                            setRefundResult(null)
                            try {
                                const res = await predictionsService.refundAll()
                                setRefundResult(res)
                            } catch (err) {
                                setRefundResult({ error: err.message })
                            } finally {
                                setRefunding(false)
                            }
                        }}
                        disabled={refunding}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                        {refunding ? 'Refunding...' : 'Refund All Predictions'}
                    </button>
                </div>
                {refundResult && (
                    <div className={`mt-3 text-xs p-2 rounded-lg ${refundResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {refundResult.error
                            ? `Error: ${refundResult.error}`
                            : `Done. Refunded ${refundResult.matchesRefunded} match(es).`}
                    </div>
                )}
            </section>
        </div>
    )
}
