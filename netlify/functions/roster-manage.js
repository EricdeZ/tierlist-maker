/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'
import { requireAdmin } from './lib/auth.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requireAdmin(event)
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }

        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required' }) }
        }
        let body
        try {
            body = JSON.parse(event.body)
        } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body' }) }
        }
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
            case 'add-alias':
                return await addAlias(sql, body)
            case 'remove-alias':
                return await removeAlias(sql, body)
            case 'merge-player':
                return await mergePlayer(sql, body)
            case 'rename-player':
                return await renamePlayer(sql, body)
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
            body: JSON.stringify({ error: 'Internal server error' }),
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

/**
 * Add an alias (old name) for a player
 */
async function addAlias(sql, { player_id, alias }) {
    if (!player_id || !alias?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'player_id and alias required' }) }
    }
    const trimmed = alias.trim()

    // Check alias doesn't match an existing player's actual name
    const [nameConflict] = await sql`
        SELECT id, name FROM players WHERE LOWER(name) = ${trimmed.toLowerCase()} LIMIT 1
    `
    if (nameConflict && nameConflict.id !== player_id) {
        return {
            statusCode: 409, headers,
            body: JSON.stringify({ error: `"${trimmed}" is already the name of player "${nameConflict.name}"` }),
        }
    }

    try {
        const [created] = await sql`
            INSERT INTO player_aliases (player_id, alias)
            VALUES (${player_id}, ${trimmed})
            RETURNING id, player_id, alias
        `
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, alias: created }) }
    } catch (err) {
        if (err.code === '23505') {
            return { statusCode: 409, headers, body: JSON.stringify({ error: `Alias "${trimmed}" is already in use` }) }
        }
        throw err
    }
}

/**
 * Remove an alias by its ID
 */
async function removeAlias(sql, { alias_id }) {
    if (!alias_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'alias_id required' }) }
    }
    const [deleted] = await sql`
        DELETE FROM player_aliases WHERE id = ${alias_id} RETURNING id, alias
    `
    if (!deleted) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Alias not found' }) }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted }) }
}

/**
 * Merge a duplicate player into the real player.
 * Reassigns all stats, saves old name as alias, deletes the duplicate.
 */
async function mergePlayer(sql, { source_player_id, target_player_id }) {
    if (!source_player_id || !target_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'source_player_id and target_player_id required' }) }
    }
    if (String(source_player_id) === String(target_player_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot merge a player into themselves' }) }
    }

    const result = await sql.begin(async (tx) => {
        // Validate both players exist
        const [source] = await tx`SELECT id, name, slug FROM players WHERE id = ${source_player_id}`
        const [target] = await tx`SELECT id, name, slug FROM players WHERE id = ${target_player_id}`
        if (!source) throw new Error(`Source player ID ${source_player_id} not found`)
        if (!target) throw new Error(`Target player ID ${target_player_id} not found`)

        // Get all league_player entries for the source
        const sourceLps = await tx`
            SELECT id, season_id, team_id, role FROM league_players WHERE player_id = ${source_player_id}
        `

        let statsReassigned = 0
        let lpsReassigned = 0
        let lpsDeleted = 0

        for (const slp of sourceLps) {
            // Check if target already has a league_player in this season
            const [targetLp] = await tx`
                SELECT id FROM league_players
                WHERE player_id = ${target_player_id} AND season_id = ${slp.season_id}
                LIMIT 1
            `

            if (targetLp) {
                // Reassign all player_game_stats from source LP to target LP
                const reassigned = await tx`
                    UPDATE player_game_stats
                    SET league_player_id = ${targetLp.id}
                    WHERE league_player_id = ${slp.id}
                `
                statsReassigned += reassigned.count

                // Delete the source league_player entry
                await tx`DELETE FROM league_players WHERE id = ${slp.id}`
                lpsDeleted++
            } else {
                // No target LP in this season — just re-parent the league_player
                await tx`
                    UPDATE league_players SET player_id = ${target_player_id} WHERE id = ${slp.id}
                `
                lpsReassigned++
            }
        }

        // Save the source name as an alias for the target (ignore if already exists)
        try {
            await tx`
                INSERT INTO player_aliases (player_id, alias)
                VALUES (${target_player_id}, ${source.name})
            `
        } catch (err) {
            if (err.code !== '23505') throw err // ignore unique violation
        }

        // Move any existing aliases from source to target
        await tx`
            UPDATE player_aliases SET player_id = ${target_player_id}
            WHERE player_id = ${source_player_id}
              AND LOWER(alias) NOT IN (
                  SELECT LOWER(alias) FROM player_aliases WHERE player_id = ${target_player_id}
              )
        `

        // Delete the source player (CASCADE cleans up remaining aliases)
        await tx`DELETE FROM players WHERE id = ${source_player_id}`

        return {
            source_name: source.name,
            target_name: target.name,
            stats_reassigned: statsReassigned,
            league_players_reassigned: lpsReassigned,
            league_players_deleted: lpsDeleted,
        }
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, ...result }),
    }
}

/**
 * Rename a player. Updates the global players table name + slug.
 * Optionally saves the old name as an alias.
 */
async function renamePlayer(sql, { player_id, new_name, save_old_as_alias }) {
    if (!player_id || !new_name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'player_id and new_name required' }) }
    }
    const trimmed = new_name.trim()
    if (trimmed.length < 2) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name must be at least 2 characters' }) }
    }

    // Check if new name conflicts with another player
    const [nameConflict] = await sql`
        SELECT id, name FROM players WHERE LOWER(name) = ${trimmed.toLowerCase()} AND id != ${player_id} LIMIT 1
    `
    if (nameConflict) {
        return {
            statusCode: 409, headers,
            body: JSON.stringify({ error: `"${trimmed}" is already taken by player "${nameConflict.name}"` }),
        }
    }

    const result = await sql.begin(async (tx) => {
        const [player] = await tx`SELECT id, name, slug FROM players WHERE id = ${player_id}`
        if (!player) throw new Error('Player not found')

        const oldName = player.name

        // Save old name as alias if requested and it differs
        if (save_old_as_alias && oldName.toLowerCase() !== trimmed.toLowerCase()) {
            try {
                await tx`INSERT INTO player_aliases (player_id, alias) VALUES (${player_id}, ${oldName})`
            } catch (err) {
                if (err.code !== '23505') throw err // ignore if alias already exists
            }
        }

        // Generate new slug
        let slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'
        const [slugExists] = await tx`SELECT 1 FROM players WHERE slug = ${slug} AND id != ${player_id} LIMIT 1`
        if (slugExists) {
            slug = `${slug}-${Date.now().toString(36).slice(-4)}`
        }

        const [updated] = await tx`
            UPDATE players SET name = ${trimmed}, slug = ${slug}, updated_at = NOW()
            WHERE id = ${player_id}
            RETURNING id, name, slug
        `

        return { old_name: oldName, new_name: updated.name, new_slug: updated.slug }
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `Renamed "${result.old_name}" to "${result.new_name}"`, ...result }),
    }
}
