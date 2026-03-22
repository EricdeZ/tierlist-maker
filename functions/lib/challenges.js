// Push-based challenge progress updates.
// Called from endpoints when underlying stats change.

import { revokePassion } from './passion.js'
import { updateRotatingProgress, rollAssignments } from './rotating-challenges.js'

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

// Discord stat keys (tracked by user_id via discord_guild_members)
export const DISCORD_KEYS = ['discord_joined']

// Vault stat keys (tracked by user_id via cc_stats / ember_balances / ember_transactions / cc_trades / cc_market_listings / cc_gifts / cc_lineups)
export const VAULT_KEYS = [
    'packs_opened', 'daily_cores_claimed', 'cores_converted',
    'cards_dismantled', 'legendary_cards_dismantled',
    'trades_completed', 'marketplace_sold', 'marketplace_bought',
    'best_marketplace_sale', 'gifts_sent', 'gifts_opened',
    'starting_five_filled', 'starting_five_rare_count', 'starting_five_epic_count',
    'income_collected', 'max_conversions_day',
    'total_cards_owned', 'unique_gods_owned', 'unique_cards_owned', 'total_cores_earned',
    'legendary_cards_owned', 'epic_cards_owned', 'marketplace_volume', 'total_cores_spent',
    'bounty_cores_earned', 'best_bounty_reward',
    'self_common_owned', 'self_uncommon_owned', 'self_rare_owned',
    'self_epic_owned', 'self_legendary_owned', 'self_mythic_owned',
    'self_rarities_owned',
]

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
        SELECT c.id, c.stat_key, c.target_value, c.title, c.reward, c.category,
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
            newlyClaimable.push({ id: ch.id, title: ch.title, reward: ch.reward, category: ch.category })
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

    // Ensure rotating assignments exist (lazily rolls on first stat change of each period).
    // Time-aware baselines inside rollAssignments mean this is safe to call with post-action stats.
    try {
        await rollAssignments(sql, userId, currentStats)
    } catch (err) {
        console.error('Lazy rotating assignment roll failed:', err)
    }

    // Update rotating challenge progress
    try {
        const rotatingClaimable = await updateRotatingProgress(sql, userId, currentStats)
        newlyClaimable.push(...rotatingClaimable)
    } catch (err) {
        console.error('Rotating challenge progress update failed:', err)
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
    const allStatKeys = [...SCRIM_KEYS, ...REFERRAL_KEYS, ...FORGE_KEYS, ...DISCORD_KEYS, ...VAULT_KEYS]
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
    const hasDiscord = challenges.some(c => DISCORD_KEYS.includes(c.stat_key))
    const hasVault = challenges.some(c => VAULT_KEYS.includes(c.stat_key))

    // Bulk stats — a few aggregate queries instead of per-user loops
    const [scrimStats, referralStats, forgeStats, discordStats] = await Promise.all([
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
        hasDiscord ? sql`
            SELECT u.id as user_id, CASE WHEN dgm.discord_id IS NOT NULL THEN 1 ELSE 0 END::integer as discord_joined
            FROM users u
            JOIN discord_guild_members dgm ON dgm.discord_id = u.discord_id
        ` : [],
    ])

    // Vault stats — aggregate from cc_stats, ember_transactions, cc_trades, cc_market_listings, cc_gifts, cc_lineups
    const [
        vaultPackStats, vaultClaimStats, vaultConvertStats,
        vaultTradeStats, vaultSoldStats, vaultBoughtStats, vaultBestSaleStats,
        vaultGiftsSentStats, vaultGiftsOpenedStats,
        vaultLineupStats, vaultLineupRareStats, vaultLineupEpicStats,
        vaultMaxConvStats,
        vaultTotalCardsStats, vaultUniqueGodsStats, vaultUniqueCardsStats, vaultTotalCoresStats,
        vaultLegendaryOwnedStats, vaultEpicOwnedStats, vaultMarketVolumeStats, vaultCoresSpentStats,
    ] = hasVault ? await Promise.all([
        sql`
            SELECT user_id,
                COALESCE(packs_opened, 0)::integer as packs_opened,
                COALESCE(cards_dismantled, 0)::integer as cards_dismantled,
                COALESCE(legendary_cards_dismantled, 0)::integer as legendary_cards_dismantled,
                COALESCE(income_collections, 0)::integer as income_collections
            FROM cc_stats WHERE packs_opened > 0 OR cards_dismantled > 0 OR income_collections > 0
        `,
        sql`
            SELECT user_id, COUNT(*)::integer as daily_cores_claimed
            FROM ember_transactions WHERE type = 'daily_claim'
            GROUP BY user_id
        `,
        sql`
            SELECT user_id, COUNT(*)::integer as cores_converted
            FROM ember_transactions WHERE type = 'passion_convert'
            GROUP BY user_id
        `,
        sql`
            SELECT user_id, COUNT(*)::integer as trades_completed FROM (
                SELECT player_a_id AS user_id FROM cc_trades WHERE status = 'completed'
                UNION ALL
                SELECT player_b_id AS user_id FROM cc_trades WHERE status = 'completed'
            ) sub GROUP BY user_id
        `,
        sql`
            SELECT seller_id AS user_id, COUNT(*)::integer as marketplace_sold
            FROM cc_market_listings WHERE status = 'sold'
            GROUP BY seller_id
        `,
        sql`
            SELECT buyer_id AS user_id, COUNT(*)::integer as marketplace_bought
            FROM cc_market_listings WHERE status = 'sold' AND buyer_id IS NOT NULL
            GROUP BY buyer_id
        `,
        sql`
            SELECT seller_id AS user_id, COALESCE(MAX(core_price), 0)::integer as best_marketplace_sale
            FROM cc_market_listings WHERE status = 'sold'
            GROUP BY seller_id
        `,
        sql`
            SELECT sender_id AS user_id, COUNT(*)::integer as gifts_sent
            FROM cc_gifts GROUP BY sender_id
        `,
        sql`
            SELECT recipient_id AS user_id, COUNT(*)::integer as gifts_opened
            FROM cc_gifts WHERE opened = true
            GROUP BY recipient_id
        `,
        sql`
            SELECT user_id, COUNT(*)::integer as starting_five_filled
            FROM cc_lineups WHERE card_id IS NOT NULL
            GROUP BY user_id
        `,
        sql`
            SELECT l.user_id, COUNT(*)::integer as starting_five_rare_count
            FROM cc_lineups l JOIN cc_cards c ON l.card_id = c.id
            WHERE l.card_id IS NOT NULL AND c.rarity IN ('rare', 'epic', 'legendary', 'mythic')
            GROUP BY l.user_id
        `,
        sql`
            SELECT l.user_id, COUNT(*)::integer as starting_five_epic_count
            FROM cc_lineups l JOIN cc_cards c ON l.card_id = c.id
            WHERE l.card_id IS NOT NULL AND c.rarity IN ('epic', 'legendary', 'mythic')
            GROUP BY l.user_id
        `,
        sql`
            SELECT user_id, MAX(daily_count)::integer as max_conversions_day FROM (
                SELECT user_id, COUNT(*)::integer as daily_count
                FROM ember_transactions WHERE type = 'passion_convert'
                GROUP BY user_id, DATE(created_at)
            ) sub GROUP BY user_id
        `,
        sql`
            SELECT owner_id AS user_id, COUNT(*)::integer as total_cards_owned
            FROM cc_cards GROUP BY owner_id
        `,
        sql`
            SELECT owner_id AS user_id, COUNT(DISTINCT god_id)::integer as unique_gods_owned
            FROM cc_cards WHERE card_type = 'god' GROUP BY owner_id
        `,
        sql`
            SELECT owner_id AS user_id, COUNT(DISTINCT god_id)::integer as unique_cards_owned
            FROM cc_cards GROUP BY owner_id
        `,
        sql`
            SELECT user_id, COALESCE(SUM(amount), 0)::integer as total_cores_earned
            FROM ember_transactions WHERE amount > 0
            GROUP BY user_id
        `,
        sql`
            SELECT owner_id AS user_id, COUNT(*)::integer as legendary_cards_owned
            FROM cc_cards WHERE rarity = 'legendary'
            GROUP BY owner_id
        `,
        sql`
            SELECT owner_id AS user_id, COUNT(*)::integer as epic_cards_owned
            FROM cc_cards WHERE rarity IN ('epic', 'legendary', 'mythic')
            GROUP BY owner_id
        `,
        sql`
            SELECT seller_id AS user_id, COALESCE(SUM(core_price), 0)::integer as marketplace_volume
            FROM cc_market_listings WHERE status = 'sold'
            GROUP BY seller_id
        `,
        sql`
            SELECT user_id, COALESCE(SUM(ABS(amount)), 0)::integer as total_cores_spent
            FROM ember_transactions WHERE amount < 0
            GROUP BY user_id
        `,
    ]) : [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]

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
    for (const s of discordStats) merge(s.user_id, { discord_joined: s.discord_joined })
    for (const s of vaultPackStats) merge(s.user_id, {
        packs_opened: s.packs_opened,
        cards_dismantled: s.cards_dismantled,
        legendary_cards_dismantled: s.legendary_cards_dismantled,
        income_collected: s.income_collections,
    })
    for (const s of vaultClaimStats) merge(s.user_id, { daily_cores_claimed: s.daily_cores_claimed })
    for (const s of vaultConvertStats) merge(s.user_id, { cores_converted: s.cores_converted })
    for (const s of vaultTradeStats) merge(s.user_id, { trades_completed: s.trades_completed })
    for (const s of vaultSoldStats) merge(s.user_id, { marketplace_sold: s.marketplace_sold })
    for (const s of vaultBoughtStats) merge(s.user_id, { marketplace_bought: s.marketplace_bought })
    for (const s of vaultBestSaleStats) merge(s.user_id, { best_marketplace_sale: s.best_marketplace_sale })
    for (const s of vaultGiftsSentStats) merge(s.user_id, { gifts_sent: s.gifts_sent })
    for (const s of vaultGiftsOpenedStats) merge(s.user_id, { gifts_opened: s.gifts_opened })
    for (const s of vaultLineupStats) merge(s.user_id, { starting_five_filled: s.starting_five_filled })
    for (const s of vaultLineupRareStats) merge(s.user_id, { starting_five_rare_count: s.starting_five_rare_count })
    for (const s of vaultLineupEpicStats) merge(s.user_id, { starting_five_epic_count: s.starting_five_epic_count })
    for (const s of vaultMaxConvStats) merge(s.user_id, { max_conversions_day: s.max_conversions_day })
    for (const s of vaultTotalCardsStats) merge(s.user_id, { total_cards_owned: s.total_cards_owned })
    for (const s of vaultUniqueGodsStats) merge(s.user_id, { unique_gods_owned: s.unique_gods_owned })
    for (const s of vaultUniqueCardsStats) merge(s.user_id, { unique_cards_owned: s.unique_cards_owned })
    for (const s of vaultTotalCoresStats) merge(s.user_id, { total_cores_earned: s.total_cores_earned })
    for (const s of vaultLegendaryOwnedStats) merge(s.user_id, { legendary_cards_owned: s.legendary_cards_owned })
    for (const s of vaultEpicOwnedStats) merge(s.user_id, { epic_cards_owned: s.epic_cards_owned })
    for (const s of vaultMarketVolumeStats) merge(s.user_id, { marketplace_volume: s.marketplace_volume })
    for (const s of vaultCoresSpentStats) merge(s.user_id, { total_cores_spent: s.total_cores_spent })

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


/**
 * Get Discord membership stats for a user.
 * Checks if the user's discord_id exists in the discord_guild_members table.
 */
export async function getDiscordStats(sql, userId) {
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count
        FROM discord_guild_members dgm
        JOIN users u ON u.discord_id = dgm.discord_id
        WHERE u.id = ${userId}
    `
    return { discord_joined: count > 0 ? 1 : 0 }
}


/**
 * Lazy recalc for Discord challenges. Called on challenges page load
 * when stale data is detected for DISCORD_KEYS.
 */
export async function recalcDiscordChallenges(sql, userId) {
    const stats = await getDiscordStats(sql, userId)

    // Only upsert if user is in the guild — keeps current_value NULL so the
    // stale check re-triggers on every page load until they actually join
    if (stats.discord_joined === 0) return

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
 * Get vault stats for a user (by user_id).
 * Returns all vault-related stats for challenge tracking.
 */
export async function getVaultStats(sql, userId) {
    const [row] = await sql`
      WITH
        stats AS (
          SELECT COALESCE(packs_opened, 0)::int AS packs_opened,
                 COALESCE(cards_dismantled, 0)::int AS cards_dismantled,
                 COALESCE(legendary_cards_dismantled, 0)::int AS legendary_cards_dismantled,
                 COALESCE(income_collections, 0)::int AS income_collections
          FROM cc_stats WHERE user_id = ${userId}
        ),
        ember_agg AS (
          SELECT
            COUNT(*) FILTER (WHERE type = 'daily_claim')::int AS daily_cores_claimed,
            COUNT(*) FILTER (WHERE type = 'passion_convert')::int AS cores_converted,
            COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND type != 'cc_trade'), 0)::int AS total_cores_earned,
            COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0 AND type != 'cc_trade'), 0)::int AS total_cores_spent,
            COALESCE(SUM(amount) FILTER (WHERE type = 'bounty_reward'), 0)::int AS bounty_cores_earned
          FROM ember_transactions WHERE user_id = ${userId}
        ),
        max_conv AS (
          SELECT COALESCE(MAX(cnt), 0)::int AS max_conversions_day FROM (
            SELECT COUNT(*)::int AS cnt
            FROM ember_transactions
            WHERE user_id = ${userId} AND type = 'passion_convert'
            GROUP BY DATE(created_at)
          ) sub
        ),
        trades_agg AS (
          SELECT COUNT(DISTINCT CASE WHEN player_a_id = ${userId} THEN player_b_id ELSE player_a_id END)::int AS trades_completed FROM cc_trades
          WHERE (player_a_id = ${userId} OR player_b_id = ${userId}) AND status = 'completed'
        ),
        market_agg AS (
          SELECT
            COUNT(DISTINCT buyer_id) FILTER (WHERE seller_id = ${userId})::int AS marketplace_sold,
            COUNT(DISTINCT seller_id) FILTER (WHERE buyer_id = ${userId})::int AS marketplace_bought,
            COALESCE(MAX(core_price) FILTER (WHERE seller_id = ${userId}), 0)::int AS best_marketplace_sale,
            COALESCE(SUM(core_price) FILTER (WHERE seller_id = ${userId}), 0)::int AS marketplace_volume
          FROM cc_market_listings
          WHERE status = 'sold' AND (seller_id = ${userId} OR buyer_id = ${userId})
        ),
        gifts_agg AS (
          SELECT
            COUNT(*) FILTER (WHERE sender_id = ${userId})::int AS gifts_sent,
            COUNT(*) FILTER (WHERE recipient_id = ${userId} AND opened = true)::int AS gifts_opened
          FROM cc_gifts
          WHERE sender_id = ${userId} OR (recipient_id = ${userId} AND opened = true)
        ),
        lineup_agg AS (
          SELECT
            COUNT(*)::int AS starting_five_filled,
            COUNT(*) FILTER (WHERE c.rarity IN ('rare','epic','legendary','mythic'))::int AS starting_five_rare_count,
            COUNT(*) FILTER (WHERE c.rarity IN ('epic','legendary','mythic'))::int AS starting_five_epic_count
          FROM cc_lineups l
          JOIN cc_cards c ON l.card_id = c.id
          WHERE l.user_id = ${userId} AND l.card_id IS NOT NULL
        ),
        cards_agg AS (
          SELECT
            COUNT(*)::int AS total_cards_owned,
            COUNT(DISTINCT god_id) FILTER (WHERE card_type = 'god')::int AS unique_gods_owned,
            COUNT(DISTINCT god_id)::int AS unique_cards_owned,
            COUNT(*) FILTER (WHERE rarity = 'legendary')::int AS legendary_cards_owned,
            COUNT(*) FILTER (WHERE rarity IN ('epic','legendary','mythic'))::int AS epic_cards_owned
          FROM cc_cards WHERE owner_id = ${userId}
        ),
        rarity_depth AS (
          SELECT COALESCE(MAX(cnt), 0)::int AS max_card_rarities FROM (
            SELECT COUNT(DISTINCT rarity)::int AS cnt
            FROM cc_cards WHERE owner_id = ${userId}
            GROUP BY god_id
          ) sub
        ),
        bounty_agg AS (
          SELECT COALESCE(MAX(core_reward), 0)::int AS best_bounty_reward
          FROM cc_bounties WHERE fulfilled_by = ${userId} AND status = 'completed'
        ),
        self_cards AS (
          SELECT COALESCE(json_object_agg(sub.rarity, sub.cnt), '{}'::json) AS self_rarity_map
          FROM (
            SELECT c.rarity, COUNT(*)::int AS cnt
            FROM cc_cards c
            JOIN cc_player_defs pd ON c.def_id = pd.id
            JOIN users u ON u.linked_player_id = pd.player_id AND u.id = ${userId}
            WHERE c.owner_id = ${userId} AND c.card_type = 'player'
            GROUP BY c.rarity
          ) sub
        )
      SELECT
        s.packs_opened, s.cards_dismantled, s.legendary_cards_dismantled, s.income_collections,
        e.daily_cores_claimed, e.cores_converted, e.total_cores_earned, e.total_cores_spent, e.bounty_cores_earned,
        mc.max_conversions_day,
        t.trades_completed,
        m.marketplace_sold, m.marketplace_bought, m.best_marketplace_sale, m.marketplace_volume,
        g.gifts_sent, g.gifts_opened,
        l.starting_five_filled, l.starting_five_rare_count, l.starting_five_epic_count,
        ca.total_cards_owned, ca.unique_gods_owned, ca.unique_cards_owned, ca.legendary_cards_owned, ca.epic_cards_owned,
        r.max_card_rarities,
        b.best_bounty_reward,
        sc.self_rarity_map
      FROM ember_agg e, max_conv mc, trades_agg t, market_agg m, gifts_agg g,
           lineup_agg l, cards_agg ca, rarity_depth r, bounty_agg b, self_cards sc
      LEFT JOIN stats s ON true
    `

    const selfMap = typeof row?.self_rarity_map === 'string'
      ? JSON.parse(row.self_rarity_map)
      : (row?.self_rarity_map || {})

    return {
        packs_opened: row?.packs_opened ?? 0,
        daily_cores_claimed: row?.daily_cores_claimed ?? 0,
        cores_converted: row?.cores_converted ?? 0,
        cards_dismantled: row?.cards_dismantled ?? 0,
        legendary_cards_dismantled: row?.legendary_cards_dismantled ?? 0,
        trades_completed: row?.trades_completed ?? 0,
        marketplace_sold: row?.marketplace_sold ?? 0,
        marketplace_bought: row?.marketplace_bought ?? 0,
        best_marketplace_sale: row?.best_marketplace_sale ?? 0,
        gifts_sent: row?.gifts_sent ?? 0,
        gifts_opened: row?.gifts_opened ?? 0,
        starting_five_filled: row?.starting_five_filled ?? 0,
        starting_five_rare_count: row?.starting_five_rare_count ?? 0,
        starting_five_epic_count: row?.starting_five_epic_count ?? 0,
        income_collected: row?.income_collections ?? 0,
        max_conversions_day: row?.max_conversions_day ?? 0,
        max_card_rarities: row?.max_card_rarities ?? 0,
        total_cards_owned: row?.total_cards_owned ?? 0,
        unique_gods_owned: row?.unique_gods_owned ?? 0,
        unique_cards_owned: row?.unique_cards_owned ?? 0,
        total_cores_earned: row?.total_cores_earned ?? 0,
        legendary_cards_owned: row?.legendary_cards_owned ?? 0,
        epic_cards_owned: row?.epic_cards_owned ?? 0,
        marketplace_volume: row?.marketplace_volume ?? 0,
        total_cores_spent: row?.total_cores_spent ?? 0,
        bounty_cores_earned: row?.bounty_cores_earned ?? 0,
        best_bounty_reward: row?.best_bounty_reward ?? 0,
        self_common_owned: selfMap.common ?? 0,
        self_uncommon_owned: selfMap.uncommon ?? 0,
        self_rare_owned: selfMap.rare ?? 0,
        self_epic_owned: selfMap.epic ?? 0,
        self_legendary_owned: selfMap.legendary ?? 0,
        self_mythic_owned: selfMap.mythic ?? 0,
        self_rarities_owned: Object.keys(selfMap).length,
    }
}


/**
 * Lazy recalc for vault challenges. Called on challenges page load.
 */
export async function recalcVaultChallenges(sql, userId) {
    const stats = await getVaultStats(sql, userId)
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
