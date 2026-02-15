// Shared helpers for the predictions system.

import { grantPassion } from './passion.js'
import { pushChallengeProgress } from './challenges.js'

/**
 * Resolve all predictions for a completed scheduled match.
 * Calculates dynamic odds, pays out winners, and updates prediction records.
 *
 * @param {object} sql - postgres connection
 * @param {number} scheduledMatchId
 * @param {number} winnerTeamId - the winning team
 */
export async function resolvePredictions(sql, scheduledMatchId, winnerTeamId) {
    const predictions = await sql`
        SELECT id, user_id, predicted_team_id, wager_amount, status
        FROM predictions
        WHERE scheduled_match_id = ${scheduledMatchId} AND status = 'pending'
    `

    if (predictions.length === 0) return

    // Calculate dynamic odds from wagers
    let winnerWagered = 0
    let loserWagered = 0
    for (const p of predictions) {
        if (p.wager_amount > 0) {
            if (p.predicted_team_id === winnerTeamId) {
                winnerWagered += p.wager_amount
            } else {
                loserWagered += p.wager_amount
            }
        }
    }

    const totalPool = winnerWagered + loserWagered
    const uniqueWagerers = new Set(predictions.filter(p => p.wager_amount > 0).map(p => p.user_id)).size

    // Multiplier: parimutuel if enough data, otherwise flat 2x
    let winnerMultiplier = 2.0
    if (totalPool > 0 && winnerWagered > 0 && uniqueWagerers >= 2) {
        winnerMultiplier = Math.min(Math.max(totalPool / winnerWagered, 1.2), 5.0)
    }

    const FREE_PICK_REWARD = 3

    for (const p of predictions) {
        const isCorrect = p.predicted_team_id === winnerTeamId
        let payoutAmount = 0
        let payoutMultiplier = null

        if (isCorrect) {
            if (p.wager_amount > 0) {
                // Wagered correct: pay wager * multiplier
                payoutMultiplier = Math.round(winnerMultiplier * 100) / 100
                payoutAmount = Math.round(p.wager_amount * payoutMultiplier)
                await grantPassion(sql, p.user_id, 'prediction_payout', payoutAmount,
                    `Prediction won (${payoutMultiplier}x)`, String(scheduledMatchId))
            } else {
                // Free correct: flat reward
                payoutAmount = FREE_PICK_REWARD
                await grantPassion(sql, p.user_id, 'prediction_correct', FREE_PICK_REWARD,
                    'Correct prediction', String(scheduledMatchId))
            }
        }

        await sql`
            UPDATE predictions SET
                status = ${isCorrect ? 'won' : 'lost'},
                payout_multiplier = ${payoutMultiplier},
                payout_amount = ${isCorrect ? payoutAmount : 0},
                resolved_at = NOW()
            WHERE id = ${p.id}
        `

        // Push challenge progress (fire-and-forget per user)
        try {
            const [userStats] = await sql`
                SELECT
                    COUNT(*)::integer as predictions_made,
                    COUNT(*) FILTER (WHERE status = 'won')::integer as predictions_correct,
                    COALESCE(SUM(wager_amount), 0)::integer as predictions_wagered,
                    COALESCE(SUM(payout_amount) FILTER (WHERE status = 'won'), 0)::integer as predictions_earned
                FROM predictions
                WHERE user_id = ${p.user_id}
            `

            const challengeStats = {
                predictions_made: userStats.predictions_made,
                predictions_correct: userStats.predictions_correct,
                predictions_wagered: userStats.predictions_wagered,
            }

            // Track "upset wins" (3x+ odds)
            if (isCorrect && payoutMultiplier && payoutMultiplier >= 3.0) {
                const [upsetCount] = await sql`
                    SELECT COUNT(*)::integer as count FROM predictions
                    WHERE user_id = ${p.user_id} AND status = 'won' AND payout_multiplier >= 3.0
                `
                challengeStats.predictions_upset_wins = upsetCount.count
            }

            await pushChallengeProgress(sql, p.user_id, challengeStats)
        } catch (err) {
            console.error(`Prediction challenge push failed for user ${p.user_id}:`, err)
        }
    }
}

/**
 * Refund all pending prediction wagers for a cancelled match.
 *
 * @param {object} sql - postgres connection
 * @param {number} scheduledMatchId
 */
export async function refundPredictions(sql, scheduledMatchId) {
    const predictions = await sql`
        SELECT id, user_id, wager_amount
        FROM predictions
        WHERE scheduled_match_id = ${scheduledMatchId} AND status = 'pending'
    `

    for (const p of predictions) {
        if (p.wager_amount > 0) {
            await grantPassion(sql, p.user_id, 'prediction_refund', p.wager_amount,
                'Prediction wager refunded (match cancelled)', String(scheduledMatchId))
        }

        await sql`
            UPDATE predictions SET status = 'refunded', resolved_at = NOW()
            WHERE id = ${p.id}
        `
    }
}
