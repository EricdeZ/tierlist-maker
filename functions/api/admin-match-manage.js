import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requireAnyPermission, getLeagueIdFromSeason, getLeagueIdFromMatch } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { getMatchAffectedUsers, recalcMatchChallenges } from '../lib/challenges.js'
import { recalcForgePerformance } from '../lib/forge.js'
import { advanceFromMatch } from '../lib/advancement.js'
import { updatePlayerRoles, recalcPlayerRolesByIds } from '../lib/vault-defs.js'

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
                case 'transfer-match':
                    return await transferMatch(sql, body, admin, isOwnOnly, event)
                case 'bulk-assign-stage':
                    return await bulkAssignStage(sql, body, admin, event)
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
            m.stage_id, m.group_id, m.round_id,
            u.discord_username as reported_by_username,
            t1.name as team1_name, t1.color as team1_color,
            t2.name as team2_name, t2.color as team2_color,
            ss.name as stage_name, sg.name as group_name, sr.name as round_name,
            (SELECT count(*) FROM games g WHERE g.match_id = m.id) as game_count
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN users u ON m.reported_by = u.id
        LEFT JOIN season_stages ss ON m.stage_id = ss.id
        LEFT JOIN stage_groups sg ON m.group_id = sg.id
        LEFT JOIN stage_rounds sr ON m.round_id = sr.id
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
            m.stage_id, m.group_id, m.round_id,
            t1.name as team1_name, t1.color as team1_color,
            t2.name as team2_name, t2.color as team2_color,
            ss.name as stage_name, sg.name as group_name, sr.name as round_name
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN season_stages ss ON m.stage_id = ss.id
        LEFT JOIN stage_groups sg ON m.group_id = sg.id
        LEFT JOIN stage_rounds sr ON m.round_id = sr.id
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

    // Capture affected users, players, and season BEFORE deletion (join chain breaks after)
    const affectedUsers = await getMatchAffectedUsers(sql, match_id)
    const affectedPlayers = await sql`
        SELECT DISTINCT pgs.league_player_id FROM player_game_stats pgs
        JOIN league_players lp ON lp.id = pgs.league_player_id
        WHERE pgs.game_id IN (SELECT id FROM games WHERE match_id = ${match_id})
        AND pgs.role_played IS NOT NULL AND lp.roster_status != 'sub'
    `
    const affectedPlayerIds = affectedPlayers.map(p => p.league_player_id)
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

    // Update player roles from remaining game history (fire-and-forget)
    if (affectedPlayerIds.length) {
        event.waitUntil(
            recalcPlayerRolesByIds(sql, affectedPlayerIds)
                .catch(err => console.error('Player role update after match delete failed:', err))
        )
    }

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
        await recalcMatchWinner(tx, match_id, event)
    })

    await logAudit(sql, admin, { action: 'delete-game', endpoint: 'admin-match-manage', targetType: 'game', targetId: game_id, details: { match_id } })

    // Recalculate challenge progress and revoke if needed (fire-and-forget)
    event.waitUntil(
        recalcMatchChallenges(sql, affectedUsers)
            .catch(err => console.error('Challenge recalc after game delete failed:', err))
    )

    // Update player roles based on remaining games (fire-and-forget)
    event.waitUntil(
        updatePlayerRoles(sql, match_id)
            .catch(err => console.error('Player role update after game delete failed:', err))
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
    const { match_id, date, week, team1_id, team2_id, stage_id, group_id, round_id } = body
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
            team2_id = COALESCE(${team2_id || null}, team2_id),
            stage_id = ${stage_id !== undefined ? (stage_id || null) : sql`stage_id`},
            group_id = ${group_id !== undefined ? (group_id || null) : sql`group_id`},
            round_id = ${round_id !== undefined ? (round_id || null) : sql`round_id`}
        WHERE id = ${match_id}
    `

    await logAudit(sql, admin, { action: 'update-match', endpoint: 'admin-match-manage', targetType: 'match', targetId: match_id, details: { date, week, team1_id, team2_id, stage_id, group_id, round_id } })

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
                        ${p.role_played?.toLowerCase() || null}
                    )
                `
            }
        }

        // Recalculate match winner
        await recalcMatchWinner(tx, match_id, event)
    })

    await logAudit(sql, admin, { action: 'save-game', endpoint: 'admin-match-manage', targetType: 'game', targetId: game_id, details: { match_id, winner_team_id } })

    // Recalculate challenge progress and revoke if needed (fire-and-forget)
    event.waitUntil(
        getMatchAffectedUsers(sql, match_id)
            .then(users => recalcMatchChallenges(sql, users))
            .catch(err => console.error('Challenge recalc after game save failed:', err))
    )

    // Update player roles based on recent games (fire-and-forget)
    event.waitUntil(
        updatePlayerRoles(sql, match_id)
            .catch(err => console.error('Player role update after game save failed:', err))
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
// POST: Transfer match to a different season
// ═══════════════════════════════════════════════════
async function transferMatch(sql, body, admin, isOwnOnly, event) {
    const { match_id, target_season_id } = body
    if (!match_id || !target_season_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_id and target_season_id required' }) }
    }

    // Check permission on source league
    const sourceLeagueId = await getLeagueIdFromMatch(match_id)
    if (!sourceLeagueId || !await requireAnyPermission(event, ['match_manage'], sourceLeagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for source league' }) }
    }

    // Check permission on target league
    const targetLeagueId = await getLeagueIdFromSeason(target_season_id)
    if (!targetLeagueId || !await requireAnyPermission(event, ['match_manage'], targetLeagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for target league' }) }
    }

    // Block cross-league transfers — player stats are tied to league-specific league_player entries
    if (String(sourceLeagueId) !== String(targetLeagueId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot transfer matches across leagues. Delete and re-report in the correct league.' }) }
    }

    // Get current season for forge recalc
    const [matchRow] = await sql`SELECT season_id FROM matches WHERE id = ${match_id}`
    if (!matchRow) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) }
    }
    const oldSeasonId = matchRow.season_id

    await sql`UPDATE matches SET season_id = ${target_season_id}, updated_at = NOW() WHERE id = ${match_id}`

    await logAudit(sql, admin, {
        action: 'transfer-match', endpoint: 'admin-match-manage',
        targetType: 'match', targetId: match_id,
        details: { from_season_id: oldSeasonId, to_season_id: target_season_id }
    })

    // Recalculate forge for both old and new seasons
    event.waitUntil(
        Promise.all([
            recalcForgePerformance(sql, oldSeasonId).catch(err => console.error('Forge recalc (old season) failed:', err)),
            recalcForgePerformance(sql, target_season_id).catch(err => console.error('Forge recalc (new season) failed:', err)),
        ])
    )

    // Recalculate challenges for affected players
    const affectedUsers = await getMatchAffectedUsers(sql, match_id)
    event.waitUntil(
        recalcMatchChallenges(sql, affectedUsers)
            .catch(err => console.error('Challenge recalc after transfer failed:', err))
    )

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Match transferred' }) }
}


// ═══════════════════════════════════════════════════
// Helper: recalculate match winner from game results
// ═══════════════════════════════════════════════════
async function recalcMatchWinner(tx, matchId, event) {
    const [match] = await tx`SELECT team1_id, team2_id FROM matches WHERE id = ${matchId}`
    if (!match) return

    const games = await tx`SELECT winner_team_id FROM games WHERE match_id = ${matchId}`

    const team1Wins = games.filter(g => g.winner_team_id === match.team1_id).length
    const team2Wins = games.filter(g => g.winner_team_id === match.team2_id).length

    let winnerTeamId = null
    if (team1Wins > team2Wins) winnerTeamId = match.team1_id
    else if (team2Wins > team1Wins) winnerTeamId = match.team2_id

    await tx`UPDATE matches SET winner_team_id = ${winnerTeamId}, best_of = ${games.length} WHERE id = ${matchId}`

    // Trigger bracket advancement if there's a linked scheduled_match with a winner
    if (winnerTeamId && event) {
        // Find the scheduled_match linked to this completed match
        const sql = getDB()
        event.waitUntil(
            sql`SELECT id FROM scheduled_matches WHERE match_id = ${matchId}`
                .then(rows => {
                    if (rows.length > 0) return advanceFromMatch(sql, rows[0].id)
                })
                .catch(err => console.error('Bracket advancement from game save failed:', err))
        )
    }
}

async function bulkAssignStage(sql, body, admin, event) {
    const { match_ids, stage_id, group_id, round_id } = body
    if (!Array.isArray(match_ids) || match_ids.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'match_ids array required' }) }
    }

    // Verify permission from the first match's league
    const leagueId = await getLeagueIdFromMatch(match_ids[0])
    if (!leagueId || !await requireAnyPermission(event, ['match_manage', 'match_schedule'], leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    await sql`
        UPDATE matches SET
            stage_id = ${stage_id || null},
            group_id = ${group_id || null},
            round_id = ${round_id || null}
        WHERE id = ANY(${match_ids})
    `

    await logAudit(sql, admin, { action: 'bulk-assign-stage', endpoint: 'admin-match-manage', details: { match_ids, stage_id, group_id, round_id } })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `${match_ids.length} match(es) updated` }) }
}

export const onRequest = adapt(handler)
