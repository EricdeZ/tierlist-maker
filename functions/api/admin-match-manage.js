import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: list matches or fetch match detail ───
        if (event.httpMethod === 'GET') {
            const { seasonId, matchId } = event.queryStringParameters || {}

            if (matchId) {
                return await getMatchDetail(sql, matchId)
            }
            if (seasonId) {
                return await listMatches(sql, seasonId)
            }
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId or matchId required' }) }
        }

        // ─── POST: mutations ───
        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
            }
            const body = JSON.parse(event.body)

            switch (body.action) {
                case 'delete-match':
                    return await deleteMatch(sql, body, admin)
                case 'delete-game':
                    return await deleteGame(sql, body, admin)
                case 'update-match':
                    return await updateMatch(sql, body, admin)
                case 'save-game':
                    return await saveGame(sql, body, admin)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('admin-match-manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: List matches for a season
// ═══════════════════════════════════════════════════
async function listMatches(sql, seasonId) {
    const matches = await sql`
        SELECT
            m.id, m.season_id, m.date, m.week, m.best_of, m.is_completed,
            m.team1_id, m.team2_id, m.winner_team_id,
            t1.name as team1_name, t1.color as team1_color,
            t2.name as team2_name, t2.color as team2_color,
            (SELECT count(*) FROM games g WHERE g.match_id = m.id) as game_count
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        WHERE m.season_id = ${seasonId}
        ORDER BY m.date DESC, m.id DESC
    `

    return { statusCode: 200, headers, body: JSON.stringify({ matches }) }
}


// ═══════════════════════════════════════════════════
// GET: Full match detail with all stats
// ═══════════════════════════════════════════════════
async function getMatchDetail(sql, matchId) {
    const [match] = await sql`
        SELECT
            m.id, m.season_id, m.date, m.week, m.best_of, m.is_completed,
            m.team1_id, m.team2_id, m.winner_team_id,
            t1.name as team1_name, t1.color as team1_color,
            t2.name as team2_name, t2.color as team2_color
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        WHERE m.id = ${matchId}
    `

    if (!match) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }
    }

    const games = await sql`
        SELECT id, game_number, winner_team_id, is_completed
        FROM games
        WHERE match_id = ${matchId}
        ORDER BY game_number
    `

    const stats = await sql`
        SELECT
            pgs.id as stat_id,
            pgs.game_id,
            pgs.league_player_id,
            pgs.team_side,
            pgs.god_played,
            pgs.kills, pgs.deaths, pgs.assists,
            pgs.damage, pgs.mitigated,
            pgs.gpm, pgs.structure_damage,
            pgs.self_healing, pgs.ally_healing,
            p.name as player_name,
            p.id as player_id,
            lp.role,
            lp.team_id
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN players p ON lp.player_id = p.id
        JOIN games g ON pgs.game_id = g.id
        WHERE g.match_id = ${matchId}
        ORDER BY pgs.team_side, p.name
    `

    const gamesWithStats = games.map(game => ({
        ...game,
        team1_players: stats.filter(s => s.game_id === game.id && s.team_side === 1),
        team2_players: stats.filter(s => s.game_id === game.id && s.team_side === 2),
    }))

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ...match, games: gamesWithStats }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Delete entire match (cascade)
// ═══════════════════════════════════════════════════
async function deleteMatch(sql, body, admin) {
    const { match_id } = body
    if (!match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_id required' }) }
    }

    await transaction(async (tx) => {
        await tx`DELETE FROM player_game_stats WHERE game_id IN (SELECT id FROM games WHERE match_id = ${match_id})`
        await tx`DELETE FROM games WHERE match_id = ${match_id}`
        await tx`DELETE FROM matches WHERE id = ${match_id}`
    })

    await logAudit(sql, admin, { action: 'delete-match', endpoint: 'admin-match-manage', targetType: 'match', targetId: match_id })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match deleted' }) }
}


// ═══════════════════════════════════════════════════
// POST: Delete a single game (cascade stats, recalc winner)
// ═══════════════════════════════════════════════════
async function deleteGame(sql, body, admin) {
    const { game_id, match_id } = body
    if (!game_id || !match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'game_id and match_id required' }) }
    }

    await transaction(async (tx) => {
        await tx`DELETE FROM player_game_stats WHERE game_id = ${game_id}`
        await tx`DELETE FROM games WHERE id = ${game_id}`

        // Renumber remaining games
        const remaining = await tx`
            SELECT id FROM games WHERE match_id = ${match_id} ORDER BY game_number
        `
        for (let i = 0; i < remaining.length; i++) {
            await tx`UPDATE games SET game_number = ${i + 1} WHERE id = ${remaining[i].id}`
        }

        // Recalculate match winner
        await recalcMatchWinner(tx, match_id)
    })

    await logAudit(sql, admin, { action: 'delete-game', endpoint: 'admin-match-manage', targetType: 'game', targetId: game_id, details: { match_id } })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Game deleted' }) }
}


// ═══════════════════════════════════════════════════
// POST: Update match-level fields
// ═══════════════════════════════════════════════════
async function updateMatch(sql, body, admin) {
    const { match_id, date, week, team1_id, team2_id } = body
    if (!match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_id required' }) }
    }

    await sql`
        UPDATE matches SET
            date = COALESCE(${date || null}, date),
            week = ${week !== undefined ? (week || null) : sql`week`},
            team1_id = COALESCE(${team1_id || null}, team1_id),
            team2_id = COALESCE(${team2_id || null}, team2_id)
        WHERE id = ${match_id}
    `

    await logAudit(sql, admin, { action: 'update-match', endpoint: 'admin-match-manage', targetType: 'match', targetId: match_id, details: { date, week, team1_id, team2_id } })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match updated' }) }
}


// ═══════════════════════════════════════════════════
// POST: Save game (winner + all player stats)
// ═══════════════════════════════════════════════════
async function saveGame(sql, body, admin) {
    const { game_id, match_id, winner_team_id, players } = body
    if (!game_id || !match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'game_id and match_id required' }) }
    }

    await transaction(async (tx) => {
        // Update game winner
        if (winner_team_id !== undefined) {
            await tx`UPDATE games SET winner_team_id = ${winner_team_id} WHERE id = ${game_id}`
        }

        // Replace all player stats for this game
        if (players?.length) {
            await tx`DELETE FROM player_game_stats WHERE game_id = ${game_id}`

            for (const p of players) {
                await tx`
                    INSERT INTO player_game_stats (
                        game_id, league_player_id, team_side,
                        kills, deaths, assists, damage, mitigated, god_played,
                        gpm, structure_damage, self_healing, ally_healing
                    ) VALUES (
                        ${game_id}, ${p.league_player_id}, ${p.team_side},
                        ${p.kills || 0}, ${p.deaths || 0}, ${p.assists || 0},
                        ${p.damage || null}, ${p.mitigated || null}, ${p.god_played || 'Unknown'},
                        ${p.gpm || null}, ${p.structure_damage || null},
                        ${p.self_healing || null}, ${p.ally_healing || null}
                    )
                `
            }
        }

        // Recalculate match winner
        await recalcMatchWinner(tx, match_id)
    })

    await logAudit(sql, admin, { action: 'save-game', endpoint: 'admin-match-manage', targetType: 'game', targetId: game_id, details: { match_id, winner_team_id } })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Game saved' }) }
}


// ═══════════════════════════════════════════════════
// Helper: recalculate match winner from game results
// ═══════════════════════════════════════════════════
async function recalcMatchWinner(tx, matchId) {
    const [match] = await tx`SELECT team1_id, team2_id FROM matches WHERE id = ${matchId}`
    if (!match) return

    const games = await tx`SELECT winner_team_id FROM games WHERE match_id = ${matchId}`

    const team1Wins = games.filter(g => g.winner_team_id === match.team1_id).length
    const team2Wins = games.filter(g => g.winner_team_id === match.team2_id).length

    let winnerTeamId = null
    if (team1Wins > team2Wins) winnerTeamId = match.team1_id
    else if (team2Wins > team1Wins) winnerTeamId = match.team2_id

    await tx`UPDATE matches SET winner_team_id = ${winnerTeamId}, best_of = ${games.length} WHERE id = ${matchId}`
}

export const onRequest = adapt(handler)
