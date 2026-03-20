import { adapt } from '../lib/adapter.js'
import { getDB, getHeaders, handleCors } from '../lib/db.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: getHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const payload = await verifyAuth(event)
    if (!payload) {
        return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify({ personal: null }) }
    }

    const sql = getDB()
    const userId = payload.userId

    try {
        // Personal competitive stats (via linked_player_id)
        const [user] = await sql`SELECT linked_player_id FROM users WHERE id = ${userId}`
        let competitive = null
        if (user?.linked_player_id) {
            const [stats] = await sql`
                SELECT
                    COUNT(DISTINCT pgs.game_id) as games_played,
                    COALESCE(SUM(pgs.kills), 0) as kills,
                    COALESCE(SUM(pgs.deaths), 0) as deaths,
                    COALESCE(SUM(pgs.assists), 0) as assists,
                    COALESCE(SUM(NULLIF(pgs.damage, 0)), 0) as damage
                FROM player_game_stats pgs
                JOIN league_players lp ON pgs.league_player_id = lp.id
                JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                WHERE lp.player_id = ${user.linked_player_id}
            `
            if (stats && +stats.games_played > 0) {
                competitive = {
                    gamesPlayed: +stats.games_played,
                    kills: +stats.kills,
                    deaths: +stats.deaths,
                    assists: +stats.assists,
                    damage: +stats.damage,
                }
            }
        }

        // Personal passion stats
        const [passionBal] = await sql`
            SELECT balance, total_earned, total_spent, current_streak, longest_streak
            FROM passion_balances WHERE user_id = ${userId}
        `
        const passion = passionBal ? {
            balance: +passionBal.balance,
            totalEarned: +passionBal.total_earned,
            totalSpent: +passionBal.total_spent,
            currentStreak: +passionBal.current_streak,
            longestStreak: +passionBal.longest_streak,
        } : null

        // Personal challenges completed
        const [challenges] = await sql`
            SELECT COUNT(*) as count FROM user_challenges
            WHERE user_id = ${userId} AND completed_at IS NOT NULL
        `

        // Personal forge stats
        const [forgeStats] = await sql`
            SELECT COUNT(*) as transactions, COALESCE(SUM(sparks), 0) as total_sparks
            FROM spark_transactions WHERE user_id = ${userId}
        `
        const [forgeHoldings] = await sql`
            SELECT COUNT(DISTINCT spark_id) as holdings, COALESCE(SUM(sparks), 0) as sparks_held
            FROM spark_holdings WHERE user_id = ${userId} AND sparks > 0
        `
        const forge = +forgeStats.transactions > 0 ? {
            transactions: +forgeStats.transactions,
            totalSparks: +forgeStats.total_sparks,
            holdings: +forgeHoldings.holdings,
            sparksHeld: +forgeHoldings.sparks_held,
        } : null

        // Personal vault stats
        const [vaultStats] = await sql`
            SELECT packs_opened, wins, losses, elo, cards_dismantled
            FROM cc_stats WHERE user_id = ${userId}
        `
        const [cardCount] = await sql`
            SELECT COUNT(*) as count FROM cc_cards WHERE owner_id = ${userId}
        `
        const vault = vaultStats ? {
            packsOpened: +vaultStats.packs_opened,
            wins: +vaultStats.wins,
            losses: +vaultStats.losses,
            elo: +vaultStats.elo,
            cardsDismantled: +vaultStats.cards_dismantled,
            cardsOwned: +cardCount.count,
        } : null

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({
                personal: {
                    competitive,
                    passion,
                    challengesCompleted: +challenges.count,
                    forge,
                    vault,
                },
            }),
        }
    } catch (error) {
        console.error('Anniversary personal stats error:', error)
        return { statusCode: 500, headers: getHeaders(event), body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)
