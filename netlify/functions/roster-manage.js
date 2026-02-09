/* global process */
import { getDB, handleCors, headers } from './lib/db.js'

export const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }

        const body = JSON.parse(event.body)
        const { action } = body

        switch (action) {
            case 'change-role':
                return await changeRole(sql, body)
            case 'transfer-player':
                return await transferPlayer(sql, body)
            case 'drop-player':
                return await dropPlayer(sql, body)
            case 'add-player-to-team':
                return await addPlayerToTeam(sql, body)
            case 'create-and-add-player':
                return await createAndAddPlayer(sql, body)
            case 'reactivate-player':
                return await reactivatePlayer(sql, body)
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Unknown action: ${action}` }),
                }
        }
    } catch (error) {
        console.error('Roster manage error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            }),
        }
    }
}

/**
 * Change a league_player's role
 */
async function changeRole(sql, { league_player_id, role, secondary_role }) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    if (!role) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'role required' }) }
    }

    const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'sub', 'fill']
    if (!validRoles.includes(role.toLowerCase())) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Invalid role "${role}". Valid: ${validRoles.join(', ')}` }),
        }
    }

    const [updated] = await sql`
        UPDATE league_players
        SET role = ${role}, secondary_role = ${secondary_role || null}, updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, role, secondary_role
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated }),
    }
}

/**
 * Transfer a player from one team to another within the same season
 */
async function transferPlayer(sql, { league_player_id, new_team_id }) {
    if (!league_player_id || !new_team_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'league_player_id and new_team_id required' }),
        }
    }

    // Verify the league_player exists
    const [lp] = await sql`
        SELECT id, team_id, season_id FROM league_players WHERE id = ${league_player_id}
    `
    if (!lp) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    // Verify the new team exists and belongs to the same season
    const [team] = await sql`
        SELECT id, name FROM teams WHERE id = ${new_team_id} AND season_id = ${lp.season_id}
    `
    if (!team) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Target team not found or not in the same season' }),
        }
    }

    const [updated] = await sql`
        UPDATE league_players
        SET team_id = ${new_team_id}, updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, team_id
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated, team_name: team.name }),
    }
}

/**
 * Drop (deactivate) a player from their roster
 */
async function dropPlayer(sql, { league_player_id }) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }

    const [updated] = await sql`
        UPDATE league_players
        SET is_active = false, updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, is_active
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated }),
    }
}

/**
 * Reactivate a previously dropped player
 */
async function reactivatePlayer(sql, { league_player_id }) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }

    const [updated] = await sql`
        UPDATE league_players
        SET is_active = true, updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, is_active
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated }),
    }
}

/**
 * Add an existing player (from the global players table) to a team for a specific season.
 * Creates a new league_players record.
 */
async function addPlayerToTeam(sql, { player_id, team_id, season_id, role }) {
    if (!player_id || !team_id || !season_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'player_id, team_id, and season_id required' }),
        }
    }

    // Check if player already has an active league_player entry for this season
    const [existing] = await sql`
        SELECT id, team_id, is_active FROM league_players
        WHERE player_id = ${player_id} AND season_id = ${season_id}
    `

    if (existing) {
        if (existing.is_active) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({
                    error: 'Player already has an active roster entry for this season. Use transfer instead.',
                    existing_league_player_id: existing.id,
                }),
            }
        }
        // Reactivate and move to new team
        const [updated] = await sql`
            UPDATE league_players
            SET team_id = ${team_id}, role = ${role || 'fill'}, is_active = true, updated_at = NOW()
            WHERE id = ${existing.id}
            RETURNING id, team_id, role, is_active
        `
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reactivated: true, league_player: updated }),
        }
    }

    // Create new league_players entry
    const [newLp] = await sql`
        INSERT INTO league_players (player_id, team_id, season_id, role, is_active)
        VALUES (${player_id}, ${team_id}, ${season_id}, ${role || 'fill'}, true)
        RETURNING id, team_id, role, is_active
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, league_player: newLp }),
    }
}

/**
 * Create a brand-new player in the global players table AND add them to a team.
 */
async function createAndAddPlayer(sql, { name, team_id, season_id, role }) {
    if (!name || !team_id || !season_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'name, team_id, and season_id required' }),
        }
    }

    const trimmed = name.trim()
    if (!trimmed) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Player name cannot be empty' }) }
    }

    // Generate slug
    let slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'

    // Ensure unique slug
    const [slugExists] = await sql`SELECT 1 FROM players WHERE slug = ${slug} LIMIT 1`
    if (slugExists) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`
    }

    // Check if player name already exists
    const [existingByName] = await sql`
        SELECT id, name FROM players WHERE LOWER(name) = ${trimmed.toLowerCase()} LIMIT 1
    `
    if (existingByName) {
        return {
            statusCode: 409,
            headers,
            body: JSON.stringify({
                error: `Player "${existingByName.name}" already exists (ID: ${existingByName.id}). Use "Add existing player" instead.`,
                existing_player_id: existingByName.id,
            }),
        }
    }

    const result = await sql.begin(async (tx) => {
        const [player] = await tx`
            INSERT INTO players (name, slug) VALUES (${trimmed}, ${slug}) RETURNING id, name, slug
        `

        const [lp] = await tx`
            INSERT INTO league_players (player_id, team_id, season_id, role, is_active)
            VALUES (${player.id}, ${team_id}, ${season_id}, ${role || 'fill'}, true)
            RETURNING id, team_id, role, is_active
        `

        return { player, league_player: lp }
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, ...result }),
    }
}
