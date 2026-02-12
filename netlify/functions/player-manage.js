/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'
import { requirePermission } from './lib/auth.js'
import { logAudit } from './lib/audit.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'player_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: Rich player list ───
        if (event.httpMethod === 'GET') {
            // All global players with contact info
            const players = await sql`
                SELECT
                    p.id, p.name, p.slug, p.discord_name, p.tracker_url,
                    p.main_role, p.secondary_role,
                    p.created_at
                FROM players p
                ORDER BY LOWER(p.name)
            `

            // All league_player entries (roster assignments across all seasons)
            const rosters = await sql`
                SELECT
                    lp.id as league_player_id,
                    lp.player_id,
                    lp.team_id,
                    lp.season_id,
                    lp.role,
                    lp.secondary_role,
                    lp.is_active,
                    t.name as team_name,
                    t.color as team_color,
                    t.slug as team_slug,
                    s.name as season_name,
                    s.is_active as season_is_active,
                    d.name as division_name,
                    d.slug as division_slug,
                    l.name as league_name,
                    l.slug as league_slug
                FROM league_players lp
                JOIN teams t ON lp.team_id = t.id
                JOIN seasons s ON lp.season_id = s.id
                JOIN divisions d ON s.division_id = d.id
                JOIN leagues l ON d.league_id = l.id
                ORDER BY s.is_active DESC, l.name, s.name, t.name
            `

            // Games played count per league_player
            const gameCounts = await sql`
                SELECT
                    pgs.league_player_id,
                    COUNT(*) as games_played
                FROM player_game_stats pgs
                GROUP BY pgs.league_player_id
            `

            // All aliases
            const aliases = await sql`
                SELECT id as alias_id, player_id, alias
                FROM player_aliases
                ORDER BY player_id, alias
            `

            // All seasons (for enrollment target picker)
            const seasons = await sql`
                SELECT
                    s.id as season_id, s.name as season_name, s.is_active,
                    d.name as division_name,
                    l.name as league_name
                FROM seasons s
                JOIN divisions d ON s.division_id = d.id
                JOIN leagues l ON d.league_id = l.id
                ORDER BY s.is_active DESC, l.name, d.name, s.name
            `

            // All teams (for enrollment target picker)
            const teams = await sql`
                SELECT t.id as team_id, t.name as team_name, t.color, t.season_id
                FROM teams t
                JOIN seasons s ON t.season_id = s.id
                ORDER BY t.name
            `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ players, rosters, gameCounts, aliases, seasons, teams }),
            }
        }

        // ─── POST: Actions ───
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try { body = JSON.parse(event.body) } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        switch (body.action) {
            case 'update-player-info':
                return await updatePlayerInfo(sql, body, admin)
            case 'bulk-enroll-season':
                return await bulkEnrollSeason(sql, body, admin)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('Player manage error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        }
    }
}

/**
 * Update a player's contact info (discord_name, tracker_url)
 */
async function updatePlayerInfo(sql, { player_id, discord_name, tracker_url, main_role, secondary_role }, admin) {
    if (!player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'player_id required' }) }
    }

    const [updated] = await sql`
        UPDATE players
        SET
            discord_name = ${discord_name ?? null},
            tracker_url = ${tracker_url ?? null},
            main_role = ${main_role ?? null},
            secondary_role = ${secondary_role ?? null},
            updated_at = NOW()
        WHERE id = ${player_id}
        RETURNING id, name, discord_name, tracker_url, main_role, secondary_role
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player not found' }) }
    }

    await logAudit(sql, admin, { action: 'update-player-info', endpoint: 'player-manage', targetType: 'player', targetId: player_id, details: { discord_name, tracker_url, main_role, secondary_role } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, player: updated }),
    }
}

/**
 * Bulk-enroll players into a new season.
 * Creates league_players entries for each player_id in the target season/team.
 * Skips players who already have an active entry in that season.
 */
async function bulkEnrollSeason(sql, { player_ids, season_id, team_id, role }, admin) {
    if (!player_ids?.length || !season_id || !team_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'player_ids (array), season_id, and team_id required' }),
        }
    }

    const results = { enrolled: 0, skipped: 0, reactivated: 0, details: [] }

    // Look up default roles for all players being enrolled
    const playerDefaults = role ? {} : Object.fromEntries(
        (await sql`SELECT id, main_role FROM players WHERE id = ANY(${player_ids})`).map(p => [p.id, p.main_role])
    )

    for (const pid of player_ids) {
        const effectiveRole = role || playerDefaults[pid] || 'fill'

        // Check if player already has a league_player in this season
        const [existing] = await sql`
            SELECT id, team_id, is_active FROM league_players
            WHERE player_id = ${pid} AND season_id = ${season_id}
            LIMIT 1
        `

        if (existing) {
            if (existing.is_active) {
                results.skipped++
                results.details.push({ player_id: pid, status: 'skipped', reason: 'already active in season' })
                continue
            }
            // Reactivate inactive entry
            await sql`
                UPDATE league_players
                SET team_id = ${team_id}, role = ${effectiveRole}, is_active = true, updated_at = NOW()
                WHERE id = ${existing.id}
            `
            results.reactivated++
            results.details.push({ player_id: pid, status: 'reactivated' })
        } else {
            await sql`
                INSERT INTO league_players (player_id, team_id, season_id, role, is_active)
                VALUES (${pid}, ${team_id}, ${season_id}, ${effectiveRole}, true)
            `
            results.enrolled++
            results.details.push({ player_id: pid, status: 'enrolled' })
        }
    }

    await logAudit(sql, admin, { action: 'bulk-enroll-season', endpoint: 'player-manage', targetType: 'season', targetId: season_id, details: { team_id, player_count: player_ids.length, enrolled: results.enrolled, skipped: results.skipped, reactivated: results.reactivated } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, ...results }),
    }
}
