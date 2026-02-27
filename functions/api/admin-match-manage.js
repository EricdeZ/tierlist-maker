import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requireAnyPermission, getLeagueIdFromSeason, getLeagueIdFromMatch } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { getMatchAffectedUsers, recalcMatchChallenges } from '../lib/challenges.js'
import { recalcForgePerformance } from '../lib/forge.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const authResult = await requireAnyPermission(event, ['match_manage', 'match_manage_own'])
    if (!authResult) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const admin = authResult.user
    const isOwnOnly = authResult.permissionKey === 'match_manage_own'

    const sql = getDB()

    try {
        // ─── GET: list matches or fetch match detail ───
        if (event.httpMethod === 'GET') {
            const { seasonId, matchId } = event.queryStringParameters || {}

            if (matchId) {
                return await getMatchDetail(sql, matchId, admin, isOwnOnly, event)
            }
            if (seasonId) {
                return await listMatches(sql, seasonId, admin, isOwnOnly, event)
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
                    return await deleteMatch(sql, body, admin, isOwnOnly, event)
                case 'delete-game':
                    return await deleteGame(sql, body, admin, isOwnOnly, event)
                case 'update-match':
                    return await updateMatch(sql, body, admin, isOwnOnly, event)
                case 'save-game':
                    return await saveGame(sql, body, admin, isOwnOnly, event)
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
async function listMatches(sql, seasonId, admin, isOwnOnly, event) {
    const leagueId = await getLeagueIdFromSeason(seasonId)
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_manage_own'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const matches = await sql`
        SELECT
            m.id, m.season_id, m.date, m.week, m.best_of, m.is_completed,
            m.team1_id, m.team2_id, m.winner_team_id, m.reported_by,
            u.discord_username as reported_by_username,
            t1.name as team1_name, t1.color as team1_color,
            t2.name as team2_name, t2.color as team2_color,
            (SELECT count(*) FROM games g WHERE g.match_id = m.id) as game_count
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN users u ON m.reported_by = u.id
        WHERE m.season_id = ${seasonId}
            ${isOwnOnly ? sql`AND m.reported_by = ${admin.id}` : sql``}
        ORDER BY m.date DESC, m.id DESC
    `

    return { statusCode: 200, headers, body: JSON.stringify({ matches }) }
}


// ═══════════════════════════════════════════════════
// GET: Full match detail with all stats
// ═══════════════════════════════════════════════════
async function getMatchDetail(sql, matchId, admin, isOwnOnly, event) {
    const leagueId = await getLeagueIdFromMatch(matchId)
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_manage_own'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const [match] = await sql`
        SELECT
            m.id, m.season_id, m.date, m.week, m.best_of, m.is_completed,
            m.team1_id, m.team2_id, m.winner_team_id, m.reported_by,
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

    if (isOwnOnly && match.reported_by !== admin.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'You can only manage matches you reported' }) }
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
            pgs.role_played,
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
// Helper: check match ownership for match_manage_own
// ═══════════════════════════════════════════════════
async function checkOwnership(sql, matchId, userId) {
    const [match] = await sql`SELECT reported_by FROM matches WHERE id = ${matchId}`
    if (!match) return 'Match not found'
    if (match.reported_by !== userId) return 'You can only manage matches you reported'
    return null
}


// ═══════════════════════════════════════════════════
// POST: Delete entire match (cascade)
// ═══════════════════════════════════════════════════
async function deleteMatch(sql, body, admin, isOwnOnly, event) {
    const { match_id } = body
    if (!match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_id required' }) }
    }

    const leagueId = await getLeagueIdFromMatch(match_id)
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_manage_own'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    if (isOwnOnly) {
        const err = await checkOwnership(sql, match_id, admin.id)
        if (err) return { statusCode: 403, headers, body: JSON.stringify({ error: err }) }
    }

    // Capture affected users and season BEFORE deletion (join chain breaks after)
    const affectedUsers = await getMatchAffectedUsers(sql, match_id)
    const [matchRow] = await sql`SELECT season_id FROM matches WHERE id = ${match_id}`

    await transaction(async (tx) => {
        // Reset any linked scheduled_match back to 'scheduled' before deleting
        await tx`
            UPDATE scheduled_matches
            SET status = 'scheduled', match_id = NULL, updated_at = NOW()
            WHERE match_id = ${match_id}
        `
        await tx`DELETE FROM player_game_stats WHERE game_id IN (SELECT id FROM games WHERE match_id = ${match_id})`
        await tx`DELETE FROM games WHERE match_id = ${match_id}`
        await tx`DELETE FROM matches WHERE id = ${match_id}`
    })

    await logAudit(sql, admin, { action: 'delete-match', endpoint: 'admin-match-manage', targetType: 'match', targetId: match_id })

    // Recalculate challenge progress and revoke if needed (fire-and-forget)
    event.waitUntil(
        recalcMatchChallenges(sql, affectedUsers)
            .catch(err => console.error('Challenge recalc after match delete failed:', err))
    )

    // Recalculate forge performance scores (fire-and-forget)
    if (matchRow) {
        event.waitUntil(
            recalcForgePerformance(sql, matchRow.season_id)
                .catch(err => console.error('Forge recalc after match delete failed:', err))
        )
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match deleted' }) }
}


// ═══════════════════════════════════════════════════
// POST: Delete a single game (cascade stats, recalc winner)
// ═══════════════════════════════════════════════════
async function deleteGame(sql, body, admin, isOwnOnly, event) {
    const { game_id, match_id } = body
    if (!game_id || !match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'game_id and match_id required' }) }
    }

    const leagueId = await getLeagueIdFromMatch(match_id)
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_manage_own'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    if (isOwnOnly) {
        const err = await checkOwnership(sql, match_id, admin.id)
        if (err) return { statusCode: 403, headers, body: JSON.stringify({ error: err }) }
    }

    // Capture affected users BEFORE deletion (players in deleted game may not be in remaining games)
    const affectedUsers = await getMatchAffectedUsers(sql, match_id)

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

    // Recalculate challenge progress and revoke if needed (fire-and-forget)
    event.waitUntil(
        recalcMatchChallenges(sql, affectedUsers)
            .catch(err => console.error('Challenge recalc after game delete failed:', err))
    )

    // Recalculate forge performance scores (fire-and-forget)
    const [matchForForge] = await sql`SELECT season_id FROM matches WHERE id = ${match_id}`
    if (matchForForge) {
        event.waitUntil(
            recalcForgePerformance(sql, matchForForge.season_id)
                .catch(err => console.error('Forge recalc after game delete failed:', err))
        )
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Game deleted' }) }
}


// ═══════════════════════════════════════════════════
// POST: Update match-level fields
// ═══════════════════════════════════════════════════
async function updateMatch(sql, body, admin, isOwnOnly, event) {
    const { match_id, date, week, team1_id, team2_id } = body
    if (!match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_id required' }) }
    }

    const leagueId = await getLeagueIdFromMatch(match_id)
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_manage_own'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    if (isOwnOnly) {
        const err = await checkOwnership(sql, match_id, admin.id)
        if (err) return { statusCode: 403, headers, body: JSON.stringify({ error: err }) }
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

    // Recalculate forge performance scores (date changes affect recency weights)
    const [matchForForge] = await sql`SELECT season_id FROM matches WHERE id = ${match_id}`
    if (matchForForge) {
        event.waitUntil(
            recalcForgePerformance(sql, matchForForge.season_id)
                .catch(err => console.error('Forge recalc after match update failed:', err))
        )
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match updated' }) }
}


// ═══════════════════════════════════════════════════
// POST: Save game (winner + all player stats)
// ═══════════════════════════════════════════════════
async function saveGame(sql, body, admin, isOwnOnly, event) {
    const { game_id, match_id, winner_team_id, players } = body
    if (!game_id || !match_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'game_id and match_id required' }) }
    }

    const leagueId = await getLeagueIdFromMatch(match_id)
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_manage_own'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    if (isOwnOnly) {
        const err = await checkOwnership(sql, match_id, admin.id)
        if (err) return { statusCode: 403, headers, body: JSON.stringify({ error: err }) }
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
                        gpm, structure_damage, self_healing, ally_healing, role_played
                    ) VALUES (
                        ${game_id}, ${p.league_player_id}, ${p.team_side},
                        ${p.kills || 0}, ${p.deaths || 0}, ${p.assists || 0},
                        ${p.damage || null}, ${p.mitigated || null}, ${p.god_played || 'Unknown'},
                        ${p.gpm || null}, ${p.structure_damage || null},
                        ${p.self_healing || null}, ${p.ally_healing || null},
                        ${p.role_played || null}
                    )
                `
            }
        }

        // Recalculate match winner
        await recalcMatchWinner(tx, match_id)
    })

    await logAudit(sql, admin, { action: 'save-game', endpoint: 'admin-match-manage', targetType: 'game', targetId: game_id, details: { match_id, winner_team_id } })

    // Recalculate challenge progress and revoke if needed (fire-and-forget)
    event.waitUntil(
        getMatchAffectedUsers(sql, match_id)
            .then(users => recalcMatchChallenges(sql, users))
            .catch(err => console.error('Challenge recalc after game save failed:', err))
    )

    // Recalculate forge performance scores (fire-and-forget)
    const [matchForForge] = await sql`SELECT season_id FROM matches WHERE id = ${match_id}`
    if (matchForForge) {
        event.waitUntil(
            recalcForgePerformance(sql, matchForForge.season_id)
                .catch(err => console.error('Forge recalc after game save failed:', err))
        )
    }

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
