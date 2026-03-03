// Push-based challenge progress updates.
// Called from endpoints when underlying stats change.

import { revokePassion } from './passion.js'

// Performance stat keys that map to challenges
export const PERF_KEYS = [
    'total_damage', 'total_kills', 'total_assists', 'total_mitigated',
    'games_played', 'leagues_joined',
    'best_kills_game', 'best_deaths_game', 'best_assists_game',
    'best_damage_game', 'best_mitigated_game',
    'best_season_win_rate', 'best_season_avg_damage',
    'games_in_tier_1', 'total_wins',
]

// Scrim stat keys that map to challenges (tracked by user_id, not player_id)
export const SCRIM_KEYS = ['scrims_posted', 'scrims_completed']

// Referral stat keys (tracked by user_id)
export const REFERRAL_KEYS = ['friends_referred']

// Forge stat keys (tracked by user_id)
export const FORGE_KEYS = ['sparks_fueled', 'sparks_cooled', 'forge_profit', 'forge_perf_updates_held', 'starter_sparks_used']

/**
 * Update challenge progress for a user based on known current stat values.
 * Finds all active, uncompleted challenges matching the provided stat keys,
 * upserts user_challenges rows, and returns newly claimable challenges.
 *
 * @param {object} sql - postgres connection
 * @param {number} userId
 * @param {object} currentStats - { stat_key: currentValue, ... }
 * @returns {Promise<Array<{id: number, title: string, reward: number}>>} newly claimable challenges
 */
export async function pushChallengeProgress(sql, userId, currentStats) {
    const statKeys = Object.keys(currentStats)
    if (statKeys.length === 0) return []

    const challenges = await sql`
        SELECT c.id, c.stat_key, c.target_value, c.title, c.reward,
               COALESCE(uc.current_value, 0)::integer as old_value,
               COALESCE(uc.completed, false) as completed,
               COALESCE(uc.admin_altered, false) as admin_altered
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${userId}
        WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
    `

    if (challenges.length === 0) return []

    const upsertRows = []
    const newlyClaimable = []

    for (const ch of challenges) {
        if (ch.completed || ch.admin_altered) continue
        const newValue = Number(currentStats[ch.stat_key] || 0)

        upsertRows.push([ch.id, newValue])

        if (newValue >= Number(ch.target_value) && Number(ch.old_value) < Number(ch.target_value)) {
            newlyClaimable.push({ id: ch.id, title: ch.title, reward: ch.reward })
        }
    }

    if (upsertRows.length > 0) {
        const challengeIds = upsertRows.map(r => r[0])
        const currentValues = upsertRows.map(r => r[1])
        await sql`
            INSERT INTO user_challenges (user_id, challenge_id, current_value)
            SELECT ${userId}, unnest(${challengeIds}::int[]), unnest(${currentValues}::int[])
            ON CONFLICT (user_id, challenge_id)
            DO UPDATE SET current_value = EXCLUDED.current_value
        `
    }

    return newlyClaimable
}


/**
 * Get performance stats for a player (by player_id, not user_id).
 * Returns career aggregates, per-game bests, season bests, and division data.
 */
export async function getPerformanceStats(sql, playerId) {
    const [
        [gameStats],
        [leagueCount],
        [perGameBests],
        seasonStats,
        [tier1Games],
        [winStats],
    ] = await Promise.all([
        // Career aggregates
        sql`
            SELECT
                COALESCE(SUM(pgs.kills), 0)::integer as total_kills,
                COALESCE(SUM(pgs.deaths), 0)::integer as total_deaths,
                COALESCE(SUM(pgs.assists), 0)::integer as total_assists,
                COALESCE(SUM(pgs.damage), 0)::integer as total_damage,
                COALESCE(SUM(pgs.mitigated), 0)::integer as total_mitigated,
                COUNT(pgs.id)::integer as games_played
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            WHERE lp.player_id = ${playerId}
        `,
        // League count
        sql`
            SELECT COUNT(DISTINCT s.league_id)::integer as count
            FROM league_players lp
            JOIN seasons s ON lp.season_id = s.id
            WHERE lp.player_id = ${playerId}
        `,
        // Per-game bests (MAX of each stat across all games)
        sql`
            SELECT
                COALESCE(MAX(pgs.kills), 0)::integer as best_kills_game,
                COALESCE(MAX(pgs.deaths), 0)::integer as best_deaths_game,
                COALESCE(MAX(pgs.assists), 0)::integer as best_assists_game,
                COALESCE(MAX(pgs.damage), 0)::integer as best_damage_game,
                COALESCE(MAX(pgs.mitigated), 0)::integer as best_mitigated_game
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            WHERE lp.player_id = ${playerId}
        `,
        // Per-season stats (min 5 games, completed seasons only) for best win rate and avg damage
        sql`
            SELECT
                lp.season_id,
                COUNT(DISTINCT pgs.game_id)::integer as games,
                COUNT(DISTINCT pgs.game_id) FILTER (
                    WHERE g.winner_team_id = CASE pgs.team_side
                        WHEN 1 THEN m.team1_id
                        WHEN 2 THEN m.team2_id
                    END
                )::integer as wins,
                COALESCE(AVG(pgs.damage), 0)::integer as avg_damage
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            JOIN games g ON pgs.game_id = g.id
            JOIN matches m ON g.match_id = m.id
            JOIN seasons s ON lp.season_id = s.id
            WHERE lp.player_id = ${playerId} AND s.is_active = false
            GROUP BY lp.season_id
            HAVING COUNT(DISTINCT pgs.game_id) >= 5
        `,
        // Games in Tier 1 divisions
        sql`
            SELECT COUNT(DISTINCT pgs.game_id)::integer as count
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            JOIN seasons s ON lp.season_id = s.id
            JOIN divisions d ON s.division_id = d.id
            WHERE lp.player_id = ${playerId} AND d.tier = 1
        `,
        // Total career wins
        sql`
            SELECT COUNT(DISTINCT pgs.game_id)::integer as count
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            JOIN games g ON pgs.game_id = g.id
            JOIN matches m ON g.match_id = m.id
            WHERE lp.player_id = ${playerId}
              AND g.winner_team_id = CASE pgs.team_side
                  WHEN 1 THEN m.team1_id
                  WHEN 2 THEN m.team2_id
              END
        `,
    ])

    // Compute best season win rate and avg damage across qualifying seasons
    let bestSeasonWinRate = 0
    let bestSeasonAvgDamage = 0
    for (const s of seasonStats) {
        if (s.games >= 5) {
            const winRate = Math.round((s.wins / s.games) * 100)
            if (winRate > bestSeasonWinRate) bestSeasonWinRate = winRate
            if (s.avg_damage > bestSeasonAvgDamage) bestSeasonAvgDamage = s.avg_damage
        }
    }

    return {
        // Career aggregates
        total_kills: Number(gameStats.total_kills),
        total_deaths: Number(gameStats.total_deaths),
        total_assists: Number(gameStats.total_assists),
        total_damage: Number(gameStats.total_damage),
        total_mitigated: Number(gameStats.total_mitigated),
        games_played: Number(gameStats.games_played),
        leagues_joined: Number(leagueCount.count),
        // Per-game bests
        best_kills_game: Number(perGameBests.best_kills_game),
        best_deaths_game: Number(perGameBests.best_deaths_game),
        best_assists_game: Number(perGameBests.best_assists_game),
        best_damage_game: Number(perGameBests.best_damage_game),
        best_mitigated_game: Number(perGameBests.best_mitigated_game),
        // Season bests
        best_season_win_rate: bestSeasonWinRate,
        best_season_avg_damage: bestSeasonAvgDamage,
        // Division & win stats
        games_in_tier_1: Number(tier1Games.count),
        total_wins: Number(winStats.count),
    }
}


/**
 * Catch-up recalc for all users. Pushes current performance/scrim/referral stats
 * into challenge progress without ever revoking completed challenges.
 * Uses pushChallengeProgress which skips completed challenges entirely.
 *
 * @param {object} sql
 * @param {Array<{user_id: number, linked_player_id: number}>} linkedUsers - users with linked players
 * @returns {Promise<{updated: number, claimable: number}>}
 */
export async function catchupAllUsers(sql, linkedUsers) {
    let updated = 0
    let claimable = 0

    // Performance challenges for users with linked players — parallel batches of 5
    for (let i = 0; i < linkedUsers.length; i += 5) {
        const batch = linkedUsers.slice(i, i + 5)
        const results = await Promise.all(batch.map(async user => {
            const stats = await getPerformanceStats(sql, user.linked_player_id)
            return pushChallengeProgress(sql, user.user_id, stats)
        }))
        for (const newly of results) {
            claimable += newly.length
            updated++
        }
    }

    // Scrim + referral + forge — bulk approach (few queries instead of per-user)
    await bulkRecalcNonPerfChallenges(sql)

    return { updated, claimable }
}


/**
 * Bulk recalc scrim/referral/forge challenge progress for all users at once.
 * Uses aggregate queries + single bulk upsert instead of per-user loops.
 */
async function bulkRecalcNonPerfChallenges(sql) {
    const allStatKeys = [...SCRIM_KEYS, ...REFERRAL_KEYS, ...FORGE_KEYS]
    const challenges = await sql`
        SELECT id, stat_key FROM challenges
        WHERE is_active = true AND stat_key = ANY(${allStatKeys})
    `
    if (challenges.length === 0) return

    // Find completed/admin-altered entries to skip
    const challengeIds = challenges.map(c => c.id)
    const completed = await sql`
        SELECT user_id, challenge_id FROM user_challenges
        WHERE challenge_id = ANY(${challengeIds})
          AND (completed = true OR admin_altered = true)
    `
    const skipSet = new Set(completed.map(r => `${r.user_id}:${r.challenge_id}`))

    const hasScrim = challenges.some(c => SCRIM_KEYS.includes(c.stat_key))
    const hasReferral = challenges.some(c => REFERRAL_KEYS.includes(c.stat_key))
    const hasForge = challenges.some(c => FORGE_KEYS.includes(c.stat_key))

    // Bulk stats — a few aggregate queries instead of per-user loops
    const [scrimStats, referralStats, forgeStats] = await Promise.all([
        hasScrim ? sql`
            WITH posted AS (
                SELECT user_id, COUNT(*)::integer as scrims_posted
                FROM scrim_requests WHERE status != 'cancelled'
                GROUP BY user_id
            ), completed AS (
                SELECT user_id, COUNT(*)::integer as scrims_completed FROM (
                    SELECT user_id FROM scrim_requests WHERE status = 'completed'
                    UNION ALL
                    SELECT accepted_user_id FROM scrim_requests
                    WHERE status = 'completed' AND accepted_user_id IS NOT NULL
                ) sub GROUP BY user_id
            )
            SELECT COALESCE(p.user_id, c.user_id) as user_id,
                   COALESCE(p.scrims_posted, 0)::integer as scrims_posted,
                   COALESCE(c.scrims_completed, 0)::integer as scrims_completed
            FROM posted p FULL OUTER JOIN completed c ON p.user_id = c.user_id
        ` : [],
        hasReferral ? sql`
            SELECT referrer_id as user_id, COUNT(*)::integer as friends_referred
            FROM referrals GROUP BY referrer_id
        ` : [],
        hasForge ? sql`
            SELECT user_id,
                COALESCE(SUM(sparks) FILTER (WHERE type = 'fuel'), 0)::integer as sparks_fueled,
                COALESCE(SUM(sparks) FILTER (WHERE type = 'cool'), 0)::integer as sparks_cooled,
                COALESCE(SUM(sparks) FILTER (WHERE type = 'tutorial_fuel'), 0)::integer as starter_sparks_used
            FROM spark_transactions GROUP BY user_id
        ` : [],
    ])

    // Forge profit + perf held need separate queries (different tables)
    const [forgeProfitStats, forgePerfStats] = hasForge ? await Promise.all([
        sql`
            WITH user_txns AS (
                SELECT user_id,
                    COALESCE(SUM(CASE WHEN type IN ('cool', 'liquidate') THEN total_cost ELSE 0 END), 0) as proceeds,
                    COALESCE(SUM(CASE WHEN type IN ('fuel', 'tutorial_fuel', 'referral_fuel') THEN total_cost ELSE 0 END), 0) as costs
                FROM spark_transactions GROUP BY user_id
            ), user_holds AS (
                SELECT user_id, COALESCE(SUM(total_invested), 0) as remaining
                FROM spark_holdings WHERE sparks > 0 GROUP BY user_id
            )
            SELECT COALESCE(t.user_id, h.user_id) as user_id,
                (COALESCE(t.proceeds, 0) - COALESCE(t.costs, 0) + COALESCE(h.remaining, 0))::integer as forge_profit
            FROM user_txns t
            FULL OUTER JOIN user_holds h ON t.user_id = h.user_id
        `,
        sql`
            SELECT sh.user_id, COUNT(*)::integer as forge_perf_updates_held
            FROM spark_holdings sh
            JOIN player_sparks ps ON ps.id = sh.spark_id
            WHERE sh.sparks > 0 AND ps.perf_multiplier IS NOT NULL AND ps.perf_multiplier != 1
            GROUP BY sh.user_id
        `,
    ]) : [[], []]

    // Build user -> stats map
    const userStats = new Map()
    const merge = (uid, stats) => userStats.set(uid, { ...(userStats.get(uid) || {}), ...stats })

    for (const s of scrimStats) merge(s.user_id, { scrims_posted: s.scrims_posted, scrims_completed: s.scrims_completed })
    for (const s of referralStats) merge(s.user_id, { friends_referred: s.friends_referred })
    for (const s of forgeStats) merge(s.user_id, { sparks_fueled: s.sparks_fueled, sparks_cooled: s.sparks_cooled, starter_sparks_used: s.starter_sparks_used })
    for (const s of forgeProfitStats) merge(s.user_id, { forge_profit: s.forge_profit })
    for (const s of forgePerfStats) merge(s.user_id, { forge_perf_updates_held: s.forge_perf_updates_held })

    // Build bulk upsert arrays
    const upsertUserIds = []
    const upsertChallengeIds = []
    const upsertValues = []

    for (const [userId, stats] of userStats) {
        for (const ch of challenges) {
            if (skipSet.has(`${userId}:${ch.id}`)) continue
            const val = Number(stats[ch.stat_key] || 0)
            if (val === 0) continue
            upsertUserIds.push(userId)
            upsertChallengeIds.push(ch.id)
            upsertValues.push(val)
        }
    }

    if (upsertUserIds.length > 0) {
        await sql`
            INSERT INTO user_challenges (user_id, challenge_id, current_value)
            SELECT unnest(${upsertUserIds}::int[]), unnest(${upsertChallengeIds}::int[]), unnest(${upsertValues}::int[])
            ON CONFLICT (user_id, challenge_id)
            DO UPDATE SET current_value = EXCLUDED.current_value
        `
    }
}


/**
 * Find all users with linked players who participated in a given match.
 * Must be called BEFORE match/game deletion since the join chain breaks after.
 *
 * @param {object} sql - postgres connection
 * @param {number} matchId
 * @returns {Promise<Array<{user_id: number, linked_player_id: number}>>}
 */
export async function getMatchAffectedUsers(sql, matchId) {
    return await sql`
        SELECT DISTINCT u.id as user_id, u.linked_player_id
        FROM users u
        JOIN league_players lp ON lp.player_id = u.linked_player_id
        JOIN player_game_stats pgs ON pgs.league_player_id = lp.id
        JOIN games g ON g.id = pgs.game_id
        WHERE g.match_id = ${matchId} AND u.linked_player_id IS NOT NULL
    `
}


/**
 * Invalidate performance challenge progress for a list of user IDs.
 * Sets current_value = -1 as a sentinel so the next challenges page load
 * triggers a full recalc for that user (just 1 user at a time, safe budget).
 *
 * @param {object} sql
 * @param {number[]} userIds
 * @param {boolean} includeCompleted - true for delete/edit (may need revocations)
 */
export async function invalidatePerformanceChallenges(sql, userIds, includeCompleted) {
    if (userIds.length === 0) return

    if (includeCompleted) {
        await sql`
            UPDATE user_challenges uc SET current_value = -1
            FROM challenges c
            WHERE uc.challenge_id = c.id
              AND uc.user_id = ANY(${userIds})
              AND c.is_active = true
              AND c.stat_key = ANY(${PERF_KEYS})
              AND uc.admin_altered = false
        `
    } else {
        await sql`
            UPDATE user_challenges uc SET current_value = -1
            FROM challenges c
            WHERE uc.challenge_id = c.id
              AND uc.user_id = ANY(${userIds})
              AND c.is_active = true
              AND c.stat_key = ANY(${PERF_KEYS})
              AND uc.completed = false
              AND uc.admin_altered = false
        `
    }
}


/**
 * Full recalc for a single user. Called lazily on challenges page load
 * when invalidated data is detected (current_value = -1 or NULL).
 * Handles both progress updates and revocations with batched queries.
 *
 * Query budget: 6 (stats) + 1 (challenges) + 1 (upsert) + 3 (revocations) = 11 max
 */
export async function recalcSingleUserChallenges(sql, userId, playerId) {
    const stats = await getPerformanceStats(sql, playerId)
    const statKeys = Object.keys(stats)
    if (statKeys.length === 0) return

    const challenges = await sql`
        SELECT c.id, c.stat_key, c.target_value, c.title, c.reward,
               COALESCE(uc.current_value, 0)::integer as old_value,
               COALESCE(uc.completed, false) as completed,
               COALESCE(uc.admin_altered, false) as admin_altered
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${userId}
        WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
    `

    if (challenges.length === 0) return

    const upsertRows = []
    const revocations = []

    for (const ch of challenges) {
        if (ch.admin_altered) continue
        const newValue = Number(stats[ch.stat_key] || 0)
        upsertRows.push([ch.id, newValue])

        if (ch.completed && newValue < Number(ch.target_value)) {
            revocations.push(ch)
        }
    }

    // Batch upsert all current_values
    if (upsertRows.length > 0) {
        const challengeIds = upsertRows.map(r => r[0])
        const currentValues = upsertRows.map(r => r[1])
        await sql`
            INSERT INTO user_challenges (user_id, challenge_id, current_value)
            SELECT ${userId}, unnest(${challengeIds}::int[]), unnest(${currentValues}::int[])
            ON CONFLICT (user_id, challenge_id)
            DO UPDATE SET current_value = EXCLUDED.current_value
        `
    }

    // Batch revocations (3 queries for any number of revocations)
    if (revocations.length > 0) {
        const revokeIds = revocations.map(r => r.id)
        await sql`
            UPDATE user_challenges SET
                completed = false,
                completed_at = NULL,
                last_completed_at = NULL
            WHERE user_id = ${userId} AND challenge_id = ANY(${revokeIds})
        `

        const amounts = revocations.map(r => -r.reward)
        const descriptions = revocations.map(r => `Challenge revoked: ${r.title}`)
        const refIds = revocations.map(r => String(r.id))
        await sql`
            INSERT INTO passion_transactions (user_id, amount, type, description, reference_id)
            SELECT ${userId}, unnest(${amounts}::int[]), 'challenge_revoked',
                   unnest(${descriptions}::text[]), unnest(${refIds}::text[])
        `

        const totalRevoked = revocations.reduce((sum, r) => sum + r.reward, 0)
        await sql`
            UPDATE passion_balances SET
                balance = GREATEST(balance - ${totalRevoked}, 0),
                total_earned = GREATEST(total_earned - ${totalRevoked}, 0),
                updated_at = NOW()
            WHERE user_id = ${userId}
        `
    }
}


/**
 * After a match is submitted, invalidate performance challenge progress
 * for affected users. Actual recalc happens lazily on their next page load.
 * Only 2 queries — safe for any number of players.
 */
export async function updateMatchChallenges(sql, matchId) {
    const affectedUsers = await getMatchAffectedUsers(sql, matchId)
    if (affectedUsers.length === 0) return

    // Push actual stats instead of just invalidating — keeps progress current
    // without requiring users to visit the challenges page
    for (const user of affectedUsers) {
        const stats = await getPerformanceStats(sql, user.linked_player_id)
        await pushChallengeProgress(sql, user.user_id, stats)
    }
}


/**
 * After match deletion/editing, invalidate ALL performance challenge progress
 * (including completed) for affected users. Revocations handled lazily on page load.
 * Only 1 query (caller already has affectedUsers) — safe for any number of players.
 */
export async function recalcMatchChallenges(sql, affectedUsers) {
    if (affectedUsers.length === 0) return

    const userIds = affectedUsers.map(u => u.user_id)
    await invalidatePerformanceChallenges(sql, userIds, true)
}


/**
 * Get scrim stats for a user (by user_id, not player_id).
 * Returns counts of scrims posted and completed.
 */
export async function getScrimStats(sql, userId) {
    const [[posted], [completed]] = await Promise.all([
        sql`
            SELECT COUNT(*)::integer as count
            FROM scrim_requests
            WHERE user_id = ${userId} AND status != 'cancelled'
        `,
        sql`
            SELECT COUNT(*)::integer as count
            FROM scrim_requests
            WHERE (user_id = ${userId} OR accepted_user_id = ${userId})
              AND status = 'completed'
        `,
    ])

    return {
        scrims_posted: Number(posted.count),
        scrims_completed: Number(completed.count),
    }
}


/**
 * Lazy recalc for scrim challenges. Called on challenges page load
 * when stale data is detected for SCRIM_KEYS.
 * No revocations needed — scrim counts only go up.
 */
export async function recalcScrimChallenges(sql, userId) {
    const stats = await getScrimStats(sql, userId)
    const statKeys = Object.keys(stats)

    const challenges = await sql`
        SELECT c.id, c.stat_key, c.target_value
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${userId}
        WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
          AND (uc.completed IS NULL OR uc.completed = false)
    `

    if (challenges.length === 0) return

    const challengeIds = challenges.map(c => c.id)
    const currentValues = challenges.map(c => Number(stats[c.stat_key] || 0))

    await sql`
        INSERT INTO user_challenges (user_id, challenge_id, current_value)
        SELECT ${userId}, unnest(${challengeIds}::int[]), unnest(${currentValues}::int[])
        ON CONFLICT (user_id, challenge_id)
        DO UPDATE SET current_value = EXCLUDED.current_value
    `
}


/**
 * Get referral stats for a user (total referrals made, both types).
 */
export async function getReferralStats(sql, userId) {
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count FROM referrals
        WHERE referrer_id = ${userId}
    `
    return { friends_referred: count }
}


/**
 * Lazy recalc for referral challenges. Called on challenges page load
 * when stale data is detected for REFERRAL_KEYS.
 * No revocations needed — referral counts only go up.
 */
export async function recalcReferralChallenges(sql, userId) {
    const stats = await getReferralStats(sql, userId)
    const statKeys = Object.keys(stats)

    const challenges = await sql`
        SELECT c.id, c.stat_key, c.target_value
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${userId}
        WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
          AND (uc.completed IS NULL OR uc.completed = false)
    `

    if (challenges.length === 0) return

    const challengeIds = challenges.map(c => c.id)
    const currentValues = challenges.map(c => Number(stats[c.stat_key] || 0))

    await sql`
        INSERT INTO user_challenges (user_id, challenge_id, current_value)
        SELECT ${userId}, unnest(${challengeIds}::int[]), unnest(${currentValues}::int[])
        ON CONFLICT (user_id, challenge_id)
        DO UPDATE SET current_value = EXCLUDED.current_value
    `
}


/**
 * Get forge stats for a user (by user_id).
 * Returns total sparks fueled, cooled, realized profit, perf updates held, starter sparks used.
 */
export async function getForgeStats(sql, userId) {
    const [fuelCoolRows, realizedRows, perfHeldRows, starterRows] = await Promise.all([
        sql`
            SELECT
                COALESCE(SUM(sparks) FILTER (WHERE type = 'fuel'), 0)::integer as fueled,
                COALESCE(SUM(sparks) FILTER (WHERE type = 'cool'), 0)::integer as cooled
            FROM spark_transactions
            WHERE user_id = ${userId}
        `,
        sql`
            WITH txns AS (
                SELECT
                    COALESCE(SUM(CASE WHEN type IN ('cool', 'liquidate') THEN total_cost ELSE 0 END), 0) as proceeds,
                    COALESCE(SUM(CASE WHEN type IN ('fuel', 'tutorial_fuel', 'referral_fuel') THEN total_cost ELSE 0 END), 0) as costs
                FROM spark_transactions WHERE user_id = ${userId}
            ), holds AS (
                SELECT COALESCE(SUM(total_invested), 0) as remaining
                FROM spark_holdings WHERE user_id = ${userId} AND sparks > 0
            )
            SELECT (txns.proceeds - txns.costs + holds.remaining)::integer as realized
            FROM txns, holds
        `,
        sql`
            SELECT COUNT(*)::integer as "perfHeld"
            FROM spark_holdings sh
            JOIN player_sparks ps ON ps.id = sh.spark_id
            WHERE sh.user_id = ${userId} AND sh.sparks > 0
              AND ps.perf_multiplier IS NOT NULL AND ps.perf_multiplier != 1
        `,
        sql`
            SELECT COALESCE(SUM(sparks), 0)::integer as "starterUsed"
            FROM spark_transactions
            WHERE user_id = ${userId} AND type = 'tutorial_fuel'
        `,
    ])
    const fuelCool = fuelCoolRows[0] || { fueled: 0, cooled: 0 }
    const realized = realizedRows[0]?.realized ?? 0
    const perfHeld = perfHeldRows[0]?.perfHeld ?? 0
    const starterUsed = starterRows[0]?.starterUsed ?? 0

    return {
        sparks_fueled: fuelCool.fueled,
        sparks_cooled: fuelCool.cooled,
        forge_profit: realized,
        forge_perf_updates_held: perfHeld,
        starter_sparks_used: starterUsed,
    }
}


/**
 * Lazy recalc for forge challenges. Called on challenges page load
 * when stale data is detected for FORGE_KEYS.
 * No revocations needed — forge stats only go up (profit is realized total).
 */
export async function recalcForgeChallenges(sql, userId) {
    const stats = await getForgeStats(sql, userId)
    const statKeys = Object.keys(stats)

    const challenges = await sql`
        SELECT c.id, c.stat_key, c.target_value
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${userId}
        WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
          AND (uc.completed IS NULL OR uc.completed = false)
    `

    if (challenges.length === 0) return

    const challengeIds = challenges.map(c => c.id)
    const currentValues = challenges.map(c => Number(stats[c.stat_key] || 0))

    await sql`
        INSERT INTO user_challenges (user_id, challenge_id, current_value)
        SELECT ${userId}, unnest(${challengeIds}::int[]), unnest(${currentValues}::int[])
        ON CONFLICT (user_id, challenge_id)
        DO UPDATE SET current_value = EXCLUDED.current_value
    `
}
