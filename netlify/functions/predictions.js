import { getDB, headers, getHeaders } from './lib/db.js'
import { requireAuth, requirePermission } from './lib/auth.js'
import { grantPassion } from './lib/passion.js'
import { refundPredictions } from './lib/predictions.js'
import { logAudit } from './lib/audit.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'upcoming':
                    return await getUpcoming(sql, event, params)
                case 'my-predictions':
                    return await getMyPredictions(sql, event, params)
                case 'leaderboard':
                    return await getLeaderboard(sql, params)
                case 'matchup-detail':
                    return await getMatchupDetail(sql, event, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        // POST requires auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (action) {
                case 'predict':
                    return await submitPrediction(sql, user, body)
                case 'lock-toggle':
                    return await lockToggle(sql, event, user, body)
                case 'refund-all':
                    return await refundAllPending(sql, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('predictions error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: Upcoming matches with prediction info
// ═══════════════════════════════════════════════════
async function getUpcoming(sql, event, params) {
    const user = await requireAuth(event)
    const { leagueId, divisionId, seasonId } = params

    // Build filter conditions
    const filters = []
    if (leagueId) filters.push(sql`l.id = ${leagueId}`)
    if (divisionId) filters.push(sql`d.id = ${divisionId}`)
    if (seasonId) filters.push(sql`sm.season_id = ${seasonId}`)

    const where = filters.length > 0
        ? sql`AND ${filters.reduce((a, b) => sql`${a} AND ${b}`)}`
        : sql``

    const matches = await sql`
        SELECT
            sm.id, sm.season_id, sm.team1_id, sm.team2_id,
            sm.best_of, sm.scheduled_date, sm.week, sm.status,
            sm.predictions_locked, sm.match_id,
            (sm.predictions_locked OR sm.scheduled_date <= CURRENT_DATE) as is_locked,
            t1.name as team1_name, t1.slug as team1_slug, t1.color as team1_color,
            t2.name as team2_name, t2.slug as team2_slug, t2.color as team2_color,
            s.name as season_name,
            d.id as division_id, d.name as division_name, d.slug as division_slug, d.tier as division_tier,
            l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM scheduled_matches sm
        JOIN teams t1 ON sm.team1_id = t1.id
        JOIN teams t2 ON sm.team2_id = t2.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE sm.status IN ('scheduled', 'completed')
          AND s.is_active = true
          ${where}
        ORDER BY sm.scheduled_date ASC, sm.week ASC NULLS LAST, sm.id ASC
    `

    // Get prediction counts per match (for odds display on locked matches)
    const matchIds = matches.map(m => m.id)
    let predictionCounts = []
    if (matchIds.length > 0) {
        predictionCounts = await sql`
            SELECT
                scheduled_match_id,
                predicted_team_id,
                COUNT(*) as pick_count,
                SUM(wager_amount) as total_wagered
            FROM predictions
            WHERE scheduled_match_id = ANY(${matchIds})
            GROUP BY scheduled_match_id, predicted_team_id
        `
    }

    // Get user's predictions if authenticated
    let userPredictions = []
    if (user && matchIds.length > 0) {
        userPredictions = await sql`
            SELECT scheduled_match_id, predicted_team_id, wager_amount, status,
                   payout_multiplier, payout_amount
            FROM predictions
            WHERE user_id = ${user.id} AND scheduled_match_id = ANY(${matchIds})
        `
    }

    // Get match results for completed scheduled matches
    const completedMatchIds = matches.filter(m => m.match_id).map(m => m.match_id)
    let matchResults = []
    if (completedMatchIds.length > 0) {
        matchResults = await sql`
            SELECT id, winner_team_id FROM matches WHERE id = ANY(${completedMatchIds})
        `
    }

    // Build counts map
    const countsMap = {}
    for (const pc of predictionCounts) {
        if (!countsMap[pc.scheduled_match_id]) countsMap[pc.scheduled_match_id] = {}
        countsMap[pc.scheduled_match_id][pc.predicted_team_id] = {
            pickCount: Number(pc.pick_count),
            totalWagered: Number(pc.total_wagered),
        }
    }

    // Build user prediction map
    const userMap = {}
    for (const up of userPredictions) {
        userMap[up.scheduled_match_id] = {
            predictedTeamId: up.predicted_team_id,
            wagerAmount: up.wager_amount,
            status: up.status,
            payoutMultiplier: up.payout_multiplier ? Number(up.payout_multiplier) : null,
            payoutAmount: up.payout_amount,
        }
    }

    // Build results map
    const resultsMap = {}
    for (const mr of matchResults) {
        resultsMap[mr.id] = mr.winner_team_id
    }

    // Get team standings for all involved seasons
    const seasonIds = [...new Set(matches.map(m => m.season_id))]
    let standingsMap = {}
    if (seasonIds.length > 0) {
        const standings = await sql`
            SELECT
                t.id as team_id, t.season_id,
                COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed)::integer as matches_played,
                COUNT(DISTINCT m.id) FILTER (WHERE m.winner_team_id = t.id)::integer as wins,
                COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed AND m.winner_team_id IS NOT NULL AND m.winner_team_id != t.id)::integer as losses,
                COUNT(DISTINCT g.id) FILTER (WHERE g.is_completed AND g.winner_team_id = t.id)::integer as game_wins,
                COUNT(DISTINCT g.id) FILTER (WHERE g.is_completed AND g.winner_team_id IS NOT NULL AND g.winner_team_id != t.id)::integer as game_losses
            FROM teams t
            LEFT JOIN matches m ON (m.team1_id = t.id OR m.team2_id = t.id) AND m.season_id = t.season_id
            LEFT JOIN games g ON g.match_id = m.id
            WHERE t.season_id = ANY(${seasonIds})
            GROUP BY t.id, t.season_id
        `
        for (const s of standings) {
            standingsMap[s.team_id] = {
                matchesPlayed: s.matches_played,
                wins: s.wins,
                losses: s.losses,
                winRate: s.matches_played > 0 ? Math.round((s.wins / s.matches_played) * 100) : 0,
                gameWins: s.game_wins,
                gameLosses: s.game_losses,
            }
        }
    }

    // Assemble response
    const result = matches.map(m => {
        const counts = countsMap[m.id] || {}
        const team1Picks = counts[m.team1_id]?.pickCount || 0
        const team2Picks = counts[m.team2_id]?.pickCount || 0
        const totalPicks = team1Picks + team2Picks
        const team1Wagered = counts[m.team1_id]?.totalWagered || 0
        const team2Wagered = counts[m.team2_id]?.totalWagered || 0
        const totalWagered = team1Wagered + team2Wagered

        const t1Stats = standingsMap[m.team1_id] || { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, gameWins: 0, gameLosses: 0 }
        const t2Stats = standingsMap[m.team2_id] || { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, gameWins: 0, gameLosses: 0 }

        // Hype score: higher when both teams are strong and close in record
        const combinedWinRate = (t1Stats.winRate + t2Stats.winRate) / 2
        const closeness = 100 - Math.abs(t1Stats.winRate - t2Stats.winRate)
        const hasEnoughGames = t1Stats.matchesPlayed >= 2 && t2Stats.matchesPlayed >= 2
        const hypeScore = hasEnoughGames ? Math.round((combinedWinRate * 0.6 + closeness * 0.4)) : 0

        const entry = {
            id: m.id,
            seasonId: m.season_id,
            team1: { id: m.team1_id, name: m.team1_name, slug: m.team1_slug, color: m.team1_color, stats: t1Stats },
            team2: { id: m.team2_id, name: m.team2_name, slug: m.team2_slug, color: m.team2_color, stats: t2Stats },
            hypeScore,
            bestOf: m.best_of,
            scheduledDate: m.scheduled_date,
            week: m.week,
            status: m.status,
            isLocked: m.is_locked,
            leagueId: m.league_id,
            leagueName: m.league_name,
            leagueSlug: m.league_slug,
            divisionId: m.division_id,
            divisionName: m.division_name,
            divisionSlug: m.division_slug,
            divisionTier: m.division_tier,
            seasonName: m.season_name,
            totalPicks,
            userPrediction: userMap[m.id] || null,
        }

        // Only reveal odds after lock
        if (m.is_locked || m.status === 'completed') {
            entry.community = {
                team1Picks,
                team2Picks,
                team1Pct: totalPicks > 0 ? Math.round((team1Picks / totalPicks) * 100) : 0,
                team2Pct: totalPicks > 0 ? Math.round((team2Picks / totalPicks) * 100) : 0,
            }

            // Calculate odds (parimutuel)
            if (totalWagered > 0 && team1Wagered > 0 && team2Wagered > 0) {
                entry.odds = {
                    team1Multiplier: Math.min(Math.max(totalWagered / team1Wagered, 1.2), 5.0),
                    team2Multiplier: Math.min(Math.max(totalWagered / team2Wagered, 1.2), 5.0),
                }
            } else {
                entry.odds = { team1Multiplier: 2.0, team2Multiplier: 2.0 }
            }
        }

        // Add result info for completed matches
        if (m.match_id && resultsMap[m.match_id]) {
            entry.winnerTeamId = resultsMap[m.match_id]
        }

        return entry
    })

    return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify({ matches: result }) }
}


// ═══════════════════════════════════════════════════
// GET: User's prediction history with stats
// ═══════════════════════════════════════════════════
async function getMyPredictions(sql, event, params) {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { status: statusFilter, limit: limitStr, offset: offsetStr } = params
    const limit = Math.min(parseInt(limitStr) || 50, 100)
    const offset = parseInt(offsetStr) || 0

    const statusWhere = statusFilter && statusFilter !== 'all'
        ? sql`AND p.status = ${statusFilter}`
        : sql``

    const predictions = await sql`
        SELECT
            p.id, p.predicted_team_id, p.wager_amount, p.payout_multiplier,
            p.payout_amount, p.status, p.created_at, p.resolved_at,
            sm.scheduled_date, sm.week, sm.team1_id, sm.team2_id, sm.status as match_status,
            t1.name as team1_name, t1.slug as team1_slug, t1.color as team1_color,
            t2.name as team2_name, t2.slug as team2_slug, t2.color as team2_color,
            pt.name as predicted_team_name,
            l.name as league_name, d.name as division_name
        FROM predictions p
        JOIN scheduled_matches sm ON p.scheduled_match_id = sm.id
        JOIN teams t1 ON sm.team1_id = t1.id
        JOIN teams t2 ON sm.team2_id = t2.id
        JOIN teams pt ON p.predicted_team_id = pt.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE p.user_id = ${user.id}
          ${statusWhere}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `

    // Summary stats
    const [stats] = await sql`
        SELECT
            COUNT(*)::integer as total,
            COUNT(*) FILTER (WHERE status = 'won')::integer as correct,
            COUNT(*) FILTER (WHERE status = 'lost')::integer as incorrect,
            COUNT(*) FILTER (WHERE status = 'pending')::integer as pending,
            COALESCE(SUM(wager_amount), 0)::integer as total_wagered,
            COALESCE(SUM(payout_amount) FILTER (WHERE status = 'won'), 0)::integer as total_earned,
            COALESCE(SUM(wager_amount) FILTER (WHERE status = 'lost'), 0)::integer as total_lost
        FROM predictions
        WHERE user_id = ${user.id}
    `

    const resolved = stats.correct + stats.incorrect
    const accuracy = resolved > 0 ? Math.round((stats.correct / resolved) * 100) : 0
    const netPL = stats.total_earned - stats.total_wagered

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            predictions: predictions.map(p => ({
                id: p.id,
                predictedTeamId: p.predicted_team_id,
                predictedTeamName: p.predicted_team_name,
                wagerAmount: p.wager_amount,
                payoutMultiplier: p.payout_multiplier ? Number(p.payout_multiplier) : null,
                payoutAmount: p.payout_amount,
                status: p.status,
                createdAt: p.created_at,
                resolvedAt: p.resolved_at,
                scheduledDate: p.scheduled_date,
                week: p.week,
                matchStatus: p.match_status,
                team1: { id: p.team1_id, name: p.team1_name, slug: p.team1_slug, color: p.team1_color },
                team2: { id: p.team2_id, name: p.team2_name, slug: p.team2_slug, color: p.team2_color },
                leagueName: p.league_name,
                divisionName: p.division_name,
            })),
            stats: {
                total: stats.total,
                correct: stats.correct,
                incorrect: stats.incorrect,
                pending: stats.pending,
                accuracy,
                totalWagered: stats.total_wagered,
                totalEarned: stats.total_earned,
                netPL,
            },
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Prediction leaderboard
// ═══════════════════════════════════════════════════
async function getLeaderboard(sql, params) {
    const { seasonId } = params

    const seasonFilter = seasonId
        ? sql`AND sm.season_id = ${seasonId}`
        : sql``

    const leaders = await sql`
        SELECT
            u.id as user_id,
            u.discord_username,
            u.discord_avatar,
            u.discord_id,
            pl.slug as player_slug,
            COUNT(*)::integer as total_predictions,
            COUNT(*) FILTER (WHERE p.status = 'won')::integer as correct,
            COUNT(*) FILTER (WHERE p.status = 'lost')::integer as incorrect,
            COALESCE(SUM(p.payout_amount) FILTER (WHERE p.status = 'won'), 0)::integer as total_earned,
            COALESCE(SUM(p.wager_amount), 0)::integer as total_wagered
        FROM predictions p
        JOIN users u ON p.user_id = u.id
        JOIN scheduled_matches sm ON p.scheduled_match_id = sm.id
        LEFT JOIN players pl ON u.linked_player_id = pl.id
        WHERE p.status IN ('won', 'lost')
          ${seasonFilter}
        GROUP BY u.id, u.discord_username, u.discord_avatar, u.discord_id, pl.slug
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) FILTER (WHERE p.status = 'won')::float / COUNT(*) DESC, COUNT(*) DESC
        LIMIT 50
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            leaderboard: leaders.map((l, i) => {
                const resolved = l.correct + l.incorrect
                return {
                    position: i + 1,
                    userId: l.user_id,
                    username: l.discord_username,
                    discordId: l.discord_id,
                    avatar: l.discord_avatar,
                    playerSlug: l.player_slug,
                    totalPredictions: l.total_predictions,
                    correct: l.correct,
                    incorrect: l.incorrect,
                    accuracy: resolved > 0 ? Math.round((l.correct / resolved) * 100) : 0,
                    totalEarned: l.total_earned,
                    totalWagered: l.total_wagered,
                }
            }),
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Submit or update a prediction
// ═══════════════════════════════════════════════════
async function submitPrediction(sql, user, body) {
    const { scheduledMatchId, predictedTeamId, wagerAmount: rawWager } = body
    const wagerAmount = parseInt(rawWager) || 0

    if (!scheduledMatchId || !predictedTeamId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'scheduledMatchId and predictedTeamId are required' }) }
    }

    // Validate match exists and is open
    const [match] = await sql`
        SELECT id, team1_id, team2_id, status, predictions_locked, scheduled_date
        FROM scheduled_matches
        WHERE id = ${scheduledMatchId}
    `
    if (!match) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }
    }
    if (match.status !== 'scheduled') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Match is no longer open for predictions' }) }
    }

    const isLocked = match.predictions_locked || new Date(match.scheduled_date) <= new Date(new Date().toISOString().slice(0, 10))
    if (isLocked) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Predictions are locked for this match' }) }
    }

    // Validate team is in the match
    if (String(predictedTeamId) !== String(match.team1_id) && String(predictedTeamId) !== String(match.team2_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid team selection' }) }
    }

    // Validate wager
    if (wagerAmount < 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Wager must be non-negative' }) }
    }
    if (wagerAmount > 0 && wagerAmount < 5) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Minimum wager is 5' }) }
    }

    // Check existing prediction
    const [existing] = await sql`
        SELECT id, predicted_team_id, wager_amount, status
        FROM predictions
        WHERE user_id = ${user.id} AND scheduled_match_id = ${scheduledMatchId}
    `

    if (existing) {
        // Wagered predictions are final
        if (existing.wager_amount > 0) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Wagered predictions cannot be changed' }) }
        }

        // Free pick → update team and optionally add wager
        if (wagerAmount > 0) {
            // Check balance
            const [balance] = await sql`
                SELECT balance FROM passion_balances WHERE user_id = ${user.id}
            `
            if (!balance || balance.balance < wagerAmount) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Insufficient balance' }) }
            }

            // Deduct wager
            await grantPassion(sql, user.id, 'prediction_wager', -wagerAmount,
                `Prediction wager on match #${scheduledMatchId}`, String(scheduledMatchId))
        }

        await sql`
            UPDATE predictions SET
                predicted_team_id = ${predictedTeamId},
                wager_amount = ${wagerAmount > 0 ? wagerAmount : existing.wager_amount}
            WHERE id = ${existing.id}
        `

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, updated: true, wagerAmount: wagerAmount > 0 ? wagerAmount : existing.wager_amount }),
        }
    }

    // New prediction
    if (wagerAmount > 0) {
        const [balance] = await sql`
            SELECT balance FROM passion_balances WHERE user_id = ${user.id}
        `
        if (!balance || balance.balance < wagerAmount) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Insufficient balance' }) }
        }

        await grantPassion(sql, user.id, 'prediction_wager', -wagerAmount,
            `Prediction wager on match #${scheduledMatchId}`, String(scheduledMatchId))
    }

    await sql`
        INSERT INTO predictions (user_id, scheduled_match_id, predicted_team_id, wager_amount)
        VALUES (${user.id}, ${scheduledMatchId}, ${predictedTeamId}, ${wagerAmount})
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, created: true, wagerAmount }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Admin lock/unlock predictions for a match
// ═══════════════════════════════════════════════════
async function lockToggle(sql, event, user, body) {
    const admin = await requirePermission(event, 'match_schedule')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const { scheduledMatchId, locked } = body
    if (!scheduledMatchId || locked === undefined) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'scheduledMatchId and locked are required' }) }
    }

    await sql`
        UPDATE scheduled_matches SET predictions_locked = ${!!locked}, updated_at = NOW()
        WHERE id = ${scheduledMatchId}
    `

    await logAudit(sql, admin, {
        action: locked ? 'lock-predictions' : 'unlock-predictions',
        endpoint: 'predictions',
        targetType: 'scheduled_match',
        targetId: scheduledMatchId,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, locked: !!locked }) }
}


// ═══════════════════════════════════════════════════
// GET: Matchup detail for a single scheduled match
// ═══════════════════════════════════════════════════
async function getMatchupDetail(sql, event, params) {
    const user = await requireAuth(event)
    const { scheduledMatchId } = params

    if (!scheduledMatchId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'scheduledMatchId is required' }) }
    }

    // 1. Base match data
    const [match] = await sql`
        SELECT
            sm.id, sm.season_id, sm.team1_id, sm.team2_id,
            sm.best_of, sm.scheduled_date, sm.week, sm.status,
            sm.predictions_locked, sm.match_id,
            (sm.predictions_locked OR sm.scheduled_date <= CURRENT_DATE) as is_locked,
            t1.name as team1_name, t1.slug as team1_slug, t1.color as team1_color,
            t2.name as team2_name, t2.slug as team2_slug, t2.color as team2_color,
            s.name as season_name,
            d.id as division_id, d.name as division_name, d.slug as division_slug, d.tier as division_tier,
            l.id as league_id, l.name as league_name, l.slug as league_slug
        FROM scheduled_matches sm
        JOIN teams t1 ON sm.team1_id = t1.id
        JOIN teams t2 ON sm.team2_id = t2.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE sm.id = ${scheduledMatchId}
    `

    if (!match) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }
    }

    const t1Id = match.team1_id, t2Id = match.team2_id, seasonId = match.season_id

    // Run remaining queries in parallel
    const [standings, predCounts, userPred, rosters, teamAgg, h2hMatches, recentT1, recentT2, matchResult] = await Promise.all([
        // 2. Standings for both teams
        sql`
            SELECT
                t.id as team_id,
                COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed)::integer as matches_played,
                COUNT(DISTINCT m.id) FILTER (WHERE m.winner_team_id = t.id)::integer as wins,
                COUNT(DISTINCT m.id) FILTER (WHERE m.is_completed AND m.winner_team_id IS NOT NULL AND m.winner_team_id != t.id)::integer as losses,
                COUNT(DISTINCT g.id) FILTER (WHERE g.is_completed AND g.winner_team_id = t.id)::integer as game_wins,
                COUNT(DISTINCT g.id) FILTER (WHERE g.is_completed AND g.winner_team_id IS NOT NULL AND g.winner_team_id != t.id)::integer as game_losses
            FROM teams t
            LEFT JOIN matches m ON (m.team1_id = t.id OR m.team2_id = t.id) AND m.season_id = t.season_id
            LEFT JOIN games g ON g.match_id = m.id
            WHERE t.id IN (${t1Id}, ${t2Id})
            GROUP BY t.id
        `,
        // 3. Prediction counts
        sql`
            SELECT predicted_team_id, COUNT(*)::integer as pick_count, COALESCE(SUM(wager_amount), 0)::integer as total_wagered
            FROM predictions
            WHERE scheduled_match_id = ${scheduledMatchId}
            GROUP BY predicted_team_id
        `,
        // 4. User prediction
        user ? sql`
            SELECT predicted_team_id, wager_amount, status, payout_multiplier, payout_amount
            FROM predictions
            WHERE user_id = ${user.id} AND scheduled_match_id = ${scheduledMatchId}
        ` : Promise.resolve([]),
        // 5. Rosters + player stats
        sql`
            SELECT
                p.id as player_id, p.name as player_name, p.slug as player_slug,
                lp.role, lp.team_id,
                COUNT(DISTINCT pgs.game_id)::integer as games_played,
                COALESCE(AVG(pgs.kills), 0)::numeric(6,1) as avg_kills,
                COALESCE(AVG(pgs.deaths), 0)::numeric(6,1) as avg_deaths,
                COALESCE(AVG(pgs.assists), 0)::numeric(6,1) as avg_assists,
                COALESCE(AVG(NULLIF(pgs.damage, 0)), 0)::numeric(8,0) as avg_damage,
                COALESCE(AVG(NULLIF(pgs.mitigated, 0)), 0)::numeric(8,0) as avg_mitigated,
                (SELECT pgs2.god_played FROM player_game_stats pgs2
                 JOIN games g2 ON pgs2.game_id = g2.id AND g2.is_completed = true
                 WHERE pgs2.league_player_id = lp.id
                 GROUP BY pgs2.god_played ORDER BY COUNT(*) DESC LIMIT 1) as top_god
            FROM league_players lp
            JOIN players p ON lp.player_id = p.id
            LEFT JOIN player_game_stats pgs ON pgs.league_player_id = lp.id
            LEFT JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
            WHERE lp.team_id IN (${t1Id}, ${t2Id})
              AND lp.season_id = ${seasonId}
              AND lp.is_active = true
              AND LOWER(COALESCE(lp.role, '')) != 'sub'
            GROUP BY p.id, p.name, p.slug, lp.role, lp.team_id, lp.id
            ORDER BY lp.team_id, lp.role
        `,
        // 6. Team aggregate stats per game
        sql`
            SELECT
                lp.team_id,
                COUNT(DISTINCT g.id)::integer as total_games,
                COALESCE(SUM(pgs.kills), 0)::integer as total_kills,
                COALESCE(SUM(NULLIF(pgs.damage, 0)), 0)::bigint as total_damage,
                COALESCE(SUM(NULLIF(pgs.mitigated, 0)), 0)::bigint as total_mitigated
            FROM player_game_stats pgs
            JOIN league_players lp ON pgs.league_player_id = lp.id
            JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
            WHERE lp.team_id IN (${t1Id}, ${t2Id})
              AND lp.season_id = ${seasonId}
            GROUP BY lp.team_id
        `,
        // 7. Head-to-head
        sql`
            SELECT
                m.id, m.date, m.week, m.winner_team_id, m.best_of,
                COUNT(g.id) FILTER (WHERE g.winner_team_id = ${t1Id})::integer as t1_game_wins,
                COUNT(g.id) FILTER (WHERE g.winner_team_id = ${t2Id})::integer as t2_game_wins
            FROM matches m
            LEFT JOIN games g ON g.match_id = m.id AND g.is_completed = true
            WHERE m.season_id = ${seasonId}
              AND m.is_completed = true
              AND ((m.team1_id = ${t1Id} AND m.team2_id = ${t2Id})
                OR (m.team1_id = ${t2Id} AND m.team2_id = ${t1Id}))
            GROUP BY m.id, m.date, m.week, m.winner_team_id, m.best_of
            ORDER BY m.date DESC
        `,
        // 8a. Recent form team1 (last 5)
        sql`
            SELECT m.id, m.date, m.week, m.winner_team_id,
                t_opp.name as opponent_name, t_opp.slug as opponent_slug, t_opp.color as opponent_color
            FROM matches m
            JOIN teams t_opp ON t_opp.id = CASE WHEN m.team1_id = ${t1Id} THEN m.team2_id ELSE m.team1_id END
            WHERE m.season_id = ${seasonId} AND m.is_completed = true
              AND (m.team1_id = ${t1Id} OR m.team2_id = ${t1Id})
            ORDER BY m.date DESC LIMIT 5
        `,
        // 8b. Recent form team2 (last 5)
        sql`
            SELECT m.id, m.date, m.week, m.winner_team_id,
                t_opp.name as opponent_name, t_opp.slug as opponent_slug, t_opp.color as opponent_color
            FROM matches m
            JOIN teams t_opp ON t_opp.id = CASE WHEN m.team1_id = ${t2Id} THEN m.team2_id ELSE m.team1_id END
            WHERE m.season_id = ${seasonId} AND m.is_completed = true
              AND (m.team1_id = ${t2Id} OR m.team2_id = ${t2Id})
            ORDER BY m.date DESC LIMIT 5
        `,
        // 9. Match result if completed
        match.match_id ? sql`SELECT winner_team_id FROM matches WHERE id = ${match.match_id}` : Promise.resolve([]),
    ])

    // Build standings map
    const statsMap = {}
    for (const s of standings) {
        statsMap[s.team_id] = {
            matchesPlayed: s.matches_played, wins: s.wins, losses: s.losses,
            winRate: s.matches_played > 0 ? Math.round((s.wins / s.matches_played) * 100) : 0,
            gameWins: s.game_wins, gameLosses: s.game_losses,
        }
    }
    const t1Stats = statsMap[t1Id] || { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, gameWins: 0, gameLosses: 0 }
    const t2Stats = statsMap[t2Id] || { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, gameWins: 0, gameLosses: 0 }

    // Build prediction info
    const t1PickRow = predCounts.find(r => r.predicted_team_id === t1Id)
    const t2PickRow = predCounts.find(r => r.predicted_team_id === t2Id)
    const team1Picks = t1PickRow?.pick_count || 0
    const team2Picks = t2PickRow?.pick_count || 0
    const totalPicks = team1Picks + team2Picks
    const team1Wagered = t1PickRow?.total_wagered || 0
    const team2Wagered = t2PickRow?.total_wagered || 0
    const totalWagered = team1Wagered + team2Wagered

    const up = userPred[0]
    const userPrediction = up ? {
        predictedTeamId: up.predicted_team_id,
        wagerAmount: up.wager_amount,
        status: up.status,
        payoutMultiplier: up.payout_multiplier ? Number(up.payout_multiplier) : null,
        payoutAmount: up.payout_amount,
    } : null

    // Community + odds (only when locked)
    let community = null, odds = null
    if (match.is_locked || match.status === 'completed') {
        community = {
            team1Picks, team2Picks,
            team1Pct: totalPicks > 0 ? Math.round((team1Picks / totalPicks) * 100) : 0,
            team2Pct: totalPicks > 0 ? Math.round((team2Picks / totalPicks) * 100) : 0,
        }
        if (totalWagered > 0 && team1Wagered > 0 && team2Wagered > 0) {
            odds = {
                team1Multiplier: Math.min(Math.max(totalWagered / team1Wagered, 1.2), 5.0),
                team2Multiplier: Math.min(Math.max(totalWagered / team2Wagered, 1.2), 5.0),
            }
        } else {
            odds = { team1Multiplier: 2.0, team2Multiplier: 2.0 }
        }
    }

    // Build rosters
    const rosterT1 = rosters.filter(r => r.team_id === t1Id).map(r => ({
        playerId: r.player_id, playerName: r.player_name, playerSlug: r.player_slug,
        role: r.role, gamesPlayed: r.games_played,
        avgKills: Number(r.avg_kills), avgDeaths: Number(r.avg_deaths), avgAssists: Number(r.avg_assists),
        avgDamage: Number(r.avg_damage), avgMitigated: Number(r.avg_mitigated),
        topGod: r.top_god,
    }))
    const rosterT2 = rosters.filter(r => r.team_id === t2Id).map(r => ({
        playerId: r.player_id, playerName: r.player_name, playerSlug: r.player_slug,
        role: r.role, gamesPlayed: r.games_played,
        avgKills: Number(r.avg_kills), avgDeaths: Number(r.avg_deaths), avgAssists: Number(r.avg_assists),
        avgDamage: Number(r.avg_damage), avgMitigated: Number(r.avg_mitigated),
        topGod: r.top_god,
    }))

    // Build team aggregates
    const aggMap = {}
    for (const a of teamAgg) {
        const g = a.total_games || 1
        aggMap[a.team_id] = {
            totalGames: a.total_games,
            avgKillsPerGame: Math.round((Number(a.total_kills) / g) * 10) / 10,
            avgDamagePerGame: Math.round(Number(a.total_damage) / g),
            avgMitigatedPerGame: Math.round(Number(a.total_mitigated) / g),
        }
    }
    const noAgg = { totalGames: 0, avgKillsPerGame: 0, avgDamagePerGame: 0, avgMitigatedPerGame: 0 }

    // Build H2H
    const h2hT1Wins = h2hMatches.filter(m => m.winner_team_id === t1Id).length
    const h2hT2Wins = h2hMatches.filter(m => m.winner_team_id === t2Id).length

    // Build recent form
    const mapRecent = (rows, teamId) => rows.map(r => ({
        matchId: r.id, date: r.date, week: r.week,
        opponentName: r.opponent_name, opponentSlug: r.opponent_slug, opponentColor: r.opponent_color,
        won: r.winner_team_id === teamId,
    }))

    const winnerTeamId = matchResult[0]?.winner_team_id || null

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({
            match: {
                id: match.id, seasonId: match.season_id, bestOf: match.best_of,
                scheduledDate: match.scheduled_date, week: match.week, status: match.status, isLocked: match.is_locked,
                leagueId: match.league_id, leagueName: match.league_name, leagueSlug: match.league_slug,
                divisionId: match.division_id, divisionName: match.division_name,
                divisionSlug: match.division_slug, divisionTier: match.division_tier,
                seasonName: match.season_name,
                team1: { id: t1Id, name: match.team1_name, slug: match.team1_slug, color: match.team1_color, stats: t1Stats },
                team2: { id: t2Id, name: match.team2_name, slug: match.team2_slug, color: match.team2_color, stats: t2Stats },
                totalPicks, community, odds, userPrediction, winnerTeamId,
            },
            rosters: { team1: rosterT1, team2: rosterT2 },
            teamAggregates: { team1: aggMap[t1Id] || noAgg, team2: aggMap[t2Id] || noAgg },
            headToHead: {
                matches: h2hMatches.map(m => ({
                    id: m.id, date: m.date, week: m.week, winnerTeamId: m.winner_team_id,
                    t1GameWins: m.t1_game_wins, t2GameWins: m.t2_game_wins,
                })),
                team1Wins: h2hT1Wins, team2Wins: h2hT2Wins,
            },
            recentForm: { team1: mapRecent(recentT1, t1Id), team2: mapRecent(recentT2, t2Id) },
        }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Admin refund ALL pending predictions (debug)
// ═══════════════════════════════════════════════════
async function refundAllPending(sql, event) {
    const admin = await requirePermission(event, 'permission_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized — Owner only' }) }
    }

    // Get all distinct scheduled_match_ids that have pending predictions
    const matchIds = await sql`
        SELECT DISTINCT scheduled_match_id FROM predictions WHERE status = 'pending'
    `

    let totalRefunded = 0
    for (const { scheduled_match_id } of matchIds) {
        await refundPredictions(sql, scheduled_match_id)
        totalRefunded++
    }

    // Count how many individual predictions were refunded
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count FROM predictions WHERE status = 'refunded'
    `

    await logAudit(sql, admin, {
        action: 'refund-all-predictions',
        endpoint: 'predictions',
        targetType: 'system',
        details: { matchesAffected: totalRefunded },
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, matchesRefunded: totalRefunded, totalRefunded: count }),
    }
}
