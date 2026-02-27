import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePassion } from '../../context/PassionContext'
import { useAuth } from '../../context/AuthContext'
import { challengeService, predictionsService } from '../../services/database'
import { RANK_THRESHOLDS, formatRank } from '../../config/ranks'
import RankBadge from '../../components/RankBadge'
import PageTitle from '../../components/PageTitle'

export default function DebugTools() {
    const { permissions } = useAuth()
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

    const selectedRank = RANK_THRESHOLDS[selectedRankIdx]

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
