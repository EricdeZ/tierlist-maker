// Push-based challenge progress updates.
// Called from endpoints when underlying stats change.

import { revokePassion } from './passion.js'

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
               COALESCE(uc.completed, false) as completed
        FROM challenges c
        LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${userId}
        WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
    `

    if (challenges.length === 0) return []

    const upsertRows = []
    const newlyClaimable = []

    for (const ch of challenges) {
        if (ch.completed) continue
        const newValue = Number(currentStats[ch.stat_key] || 0)

        upsertRows.push([ch.id, newValue])

        if (newValue >= Number(ch.target_value) && Number(ch.old_value) < Number(ch.target_value)) {
            newlyClaimable.push({ id: ch.id, title: ch.title, reward: ch.reward })
        }
    }

    for (const [challengeId, currentValue] of upsertRows) {
        await sql`
            INSERT INTO user_challenges (user_id, challenge_id, current_value)
            VALUES (${userId}, ${challengeId}, ${currentValue})
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
 * After a match is submitted, push performance challenge progress for affected users.
 * Fire-and-forget — errors are logged but won't break the caller.
 */
export async function updateMatchChallenges(sql, matchId) {
    const affectedUsers = await getMatchAffectedUsers(sql, matchId)

    for (const au of affectedUsers) {
        try {
            const stats = await getPerformanceStats(sql, au.linked_player_id)
            await pushChallengeProgress(sql, au.user_id, stats)
        } catch (err) {
            console.error(`Challenge update failed for user ${au.user_id}:`, err)
        }
    }
}


/**
 * Recalculate challenge progress for a list of affected users, including
 * revocation of completed challenges that no longer qualify.
 *
 * Called after match deletion/editing when stats may have decreased.
 * Unlike pushChallengeProgress, this checks completed challenges too.
 *
 * @param {object} sql - postgres connection
 * @param {Array<{user_id: number, linked_player_id: number}>} affectedUsers
 */
export async function recalcMatchChallenges(sql, affectedUsers) {
    for (const au of affectedUsers) {
        try {
            const stats = await getPerformanceStats(sql, au.linked_player_id)
            const statKeys = Object.keys(stats)
            if (statKeys.length === 0) continue

            // Get ALL challenges including completed ones
            const challenges = await sql`
                SELECT c.id, c.stat_key, c.target_value, c.title, c.reward,
                       COALESCE(uc.current_value, 0)::integer as old_value,
                       COALESCE(uc.completed, false) as completed
                FROM challenges c
                LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ${au.user_id}
                WHERE c.is_active = true AND c.stat_key = ANY(${statKeys})
            `

            if (challenges.length === 0) continue

            const upsertRows = []
            const revocations = []

            for (const ch of challenges) {
                const newValue = Number(stats[ch.stat_key] || 0)
                upsertRows.push([ch.id, newValue])

                // Completed but no longer qualifies — needs revocation
                if (ch.completed && newValue < Number(ch.target_value)) {
                    revocations.push(ch)
                }
            }

            // Update current_value for all challenges (completed or not)
            for (const [challengeId, currentValue] of upsertRows) {
                await sql`
                    INSERT INTO user_challenges (user_id, challenge_id, current_value)
                    VALUES (${au.user_id}, ${challengeId}, ${currentValue})
                    ON CONFLICT (user_id, challenge_id)
                    DO UPDATE SET current_value = EXCLUDED.current_value
                `
            }

            // Revoke challenges that no longer qualify
            for (const ch of revocations) {
                await sql`
                    UPDATE user_challenges SET
                        completed = false,
                        completed_at = NULL,
                        last_completed_at = NULL
                    WHERE user_id = ${au.user_id} AND challenge_id = ${ch.id}
                `
                await revokePassion(sql, au.user_id, ch.reward,
                    `Challenge revoked: ${ch.title}`, String(ch.id))
            }
        } catch (err) {
            console.error(`Challenge recalc failed for user ${au.user_id}:`, err)
        }
    }
}
