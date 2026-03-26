import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission, getLeagueIdFromLeaguePlayer, getLeagueIdFromSeason } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { logRosterTransaction } from '../lib/roster-tx.js'
import { mergeForgeHoldings, sellOwnTeamHoldings, cleanupForgeAfterTeamChange, ensurePlayerSparks } from '../lib/forge.js'
import { syncRoleToVault, ensurePlayerDef } from '../lib/vault-defs.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'roster_manage')
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
                return await changeRole(sql, body, admin, event)
            case 'transfer-player':
                return await transferPlayer(sql, body, admin, event)
            case 'drop-player':
                return await dropPlayer(sql, body, admin, event)
            case 'add-player-to-team':
                return await addPlayerToTeam(sql, body, admin, event)
            case 'create-and-add-player':
                return await createAndAddPlayer(sql, body, admin, event)
            case 'reactivate-player':
                return await reactivatePlayer(sql, body, admin, event)
            case 'add-alias':
                return await addAlias(sql, body, admin, event)
            case 'remove-alias':
                return await removeAlias(sql, body, admin, event)
            case 'merge-player':
                return await mergePlayer(sql, body, admin, event)
            case 'rename-player':
                return await renamePlayer(sql, body, admin, event)
            case 'set-captain':
                return await setCaptain(sql, body, admin, event)
            case 'set-co-captain':
                return await setCoCaptain(sql, body, admin, event)
            case 'promote-sub':
                return await promoteSub(sql, body, admin, event)
            case 'cleanup-illegal-holdings':
                return await cleanupIllegalHoldings(sql, admin, event)
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
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        }
    }
}

/**
 * Change a league_player's role
 */
async function changeRole(sql, { league_player_id, role, secondary_role }, admin, event) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }
    if (!role) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'role required' }) }
    }

    const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'fill']
    const normalizedRole = role.toLowerCase()
    if (!validRoles.includes(normalizedRole)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Invalid role "${role}". Valid: ${validRoles.join(', ')}` }),
        }
    }

    const [updated] = await sql`
        UPDATE league_players
        SET role = ${normalizedRole}, secondary_role = ${secondary_role || null}, updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, role, secondary_role
    `

    if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    await syncRoleToVault(sql, league_player_id, normalizedRole)
    await logAudit(sql, admin, { action: 'change-role', endpoint: 'roster-manage', targetType: 'league_player', targetId: league_player_id, details: { role, secondary_role } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated }),
    }
}

/**
 * Transfer a player from one team to another within the same season
 */
async function transferPlayer(sql, { league_player_id, new_team_id }, admin, event) {
    if (!league_player_id || !new_team_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'league_player_id and new_team_id required' }),
        }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // Verify the league_player exists
    const [lp] = await sql`
        SELECT lp.id, lp.team_id, lp.season_id, lp.player_id, lp.roster_status,
               p.name as player_name, t.name as from_team_name
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.id = ${league_player_id}
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

    const result = await transaction(async (tx) => {
        const [updated] = await tx`
            UPDATE league_players
            SET team_id = ${new_team_id}, roster_status = 'member', updated_at = NOW()
            WHERE id = ${league_player_id}
            RETURNING id, team_id, roster_status
        `

        // Auto-sell any Forge holdings that are now illegal (own-team rule)
        const forgeResult = await cleanupForgeAfterTeamChange(tx, lp.player_id, new_team_id)

        return { updated, forgeResult }
    })

    await logAudit(sql, admin, { action: 'transfer-player', endpoint: 'roster-manage', targetType: 'league_player', targetId: league_player_id, details: { new_team_id, team_name: team.name, forge: result.forgeResult } })
    await logRosterTransaction(sql, {
        seasonId: lp.season_id, playerId: lp.player_id, playerName: lp.player_name,
        type: 'transfer', fromTeamId: lp.team_id, fromTeamName: lp.from_team_name,
        toTeamId: new_team_id, toTeamName: team.name,
        fromStatus: lp.roster_status, toStatus: 'member', admin,
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated: result.updated, team_name: team.name, forge: result.forgeResult }),
    }
}

/**
 * Drop (deactivate) a player from their roster
 */
async function dropPlayer(sql, { league_player_id }, admin, event) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // Look up context before dropping
    const [lp] = await sql`
        SELECT lp.id, lp.team_id, lp.season_id, lp.player_id, lp.roster_status,
               p.name as player_name, t.name as team_name
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.id = ${league_player_id}
    `
    if (!lp) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    await sql`
        UPDATE league_players
        SET is_active = false, roster_status = 'member', updated_at = NOW()
        WHERE id = ${league_player_id}
    `

    await logAudit(sql, admin, { action: 'drop-player', endpoint: 'roster-manage', targetType: 'league_player', targetId: league_player_id })
    await logRosterTransaction(sql, {
        seasonId: lp.season_id, playerId: lp.player_id, playerName: lp.player_name,
        type: 'drop', fromTeamId: lp.team_id, fromTeamName: lp.team_name,
        fromStatus: lp.roster_status, admin,
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated: { id: lp.id, is_active: false, roster_status: 'member' } }),
    }
}

/**
 * Reactivate a previously dropped player
 */
async function reactivatePlayer(sql, { league_player_id }, admin, event) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // Look up context before reactivating
    const [lp] = await sql`
        SELECT lp.id, lp.team_id, lp.season_id, lp.player_id, lp.roster_status,
               p.name as player_name, t.name as team_name
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.id = ${league_player_id}
    `
    if (!lp) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }

    await sql`
        UPDATE league_players
        SET is_active = true, updated_at = NOW()
        WHERE id = ${league_player_id}
    `

    await logAudit(sql, admin, { action: 'reactivate-player', endpoint: 'roster-manage', targetType: 'league_player', targetId: league_player_id })
    await logRosterTransaction(sql, {
        seasonId: lp.season_id, playerId: lp.player_id, playerName: lp.player_name,
        type: 'reactivate', toTeamId: lp.team_id, toTeamName: lp.team_name,
        toStatus: lp.roster_status, admin,
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated: { id: lp.id, is_active: true } }),
    }
}

/**
 * Add an existing player (from the global players table) to a team for a specific season.
 * Creates a new league_players record.
 */
async function addPlayerToTeam(sql, { player_id, team_id, season_id, role }, admin, event) {
    if (!player_id || !team_id || !season_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'player_id, team_id, and season_id required' }),
        }
    }
    const leagueId = await getLeagueIdFromSeason(season_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // Look up player and team names for transaction logging
    const [player] = await sql`SELECT id, name, main_role FROM players WHERE id = ${player_id}`
    if (!player) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player not found' }) }
    }
    const [toTeam] = await sql`SELECT id, name FROM teams WHERE id = ${team_id} AND season_id = ${season_id}`
    if (!toTeam) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found in this season' }) }
    }

    const effectiveRole = (role || player.main_role || 'fill').toLowerCase()

    // Check if player already has an active league_player entry for this season
    const [existing] = await sql`
        SELECT lp.id, lp.team_id, lp.is_active, t.name as from_team_name
        FROM league_players lp
        LEFT JOIN teams t ON t.id = lp.team_id
        WHERE lp.player_id = ${player_id} AND lp.season_id = ${season_id}
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
        const result = await transaction(async (tx) => {
            const [updated] = await tx`
                UPDATE league_players
                SET team_id = ${team_id}, role = ${effectiveRole}, is_active = true, updated_at = NOW()
                WHERE id = ${existing.id}
                RETURNING id, team_id, role, is_active
            `
            const forgeResult = await cleanupForgeAfterTeamChange(tx, player_id, team_id)
            return { updated, forgeResult }
        })

        await logAudit(sql, admin, { action: 'add-player-to-team', endpoint: 'roster-manage', targetType: 'league_player', targetId: existing.id, details: { player_id, team_id, season_id, reactivated: true, forge: result.forgeResult } })
        await logRosterTransaction(sql, {
            seasonId: season_id, playerId: player_id, playerName: player.name,
            type: 'pickup', fromTeamId: existing.team_id, fromTeamName: existing.from_team_name,
            toTeamId: team_id, toTeamName: toTeam.name, toStatus: 'member', admin,
            details: { reactivated: true },
        })

        // Auto-generate vault card def for new team (fire-and-forget)
        event.waitUntil(
            ensurePlayerDef(sql, existing.id)
                .catch(err => console.error('Auto card def generation failed:', err))
        )

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reactivated: true, league_player: result.updated, forge: result.forgeResult }),
        }
    }

    // Create new league_players entry
    const result = await transaction(async (tx) => {
        const [newLp] = await tx`
            INSERT INTO league_players (player_id, team_id, season_id, role, is_active)
            VALUES (${player_id}, ${team_id}, ${season_id}, ${effectiveRole}, true)
            RETURNING id, team_id, role, is_active
        `
        const forgeResult = await cleanupForgeAfterTeamChange(tx, player_id, team_id)
        return { newLp, forgeResult }
    })

    await logAudit(sql, admin, { action: 'add-player-to-team', endpoint: 'roster-manage', targetType: 'league_player', targetId: result.newLp.id, details: { player_id, team_id, season_id, forge: result.forgeResult } })
    await logRosterTransaction(sql, {
        seasonId: season_id, playerId: player_id, playerName: player.name,
        type: 'pickup', toTeamId: team_id, toTeamName: toTeam.name,
        toStatus: 'member', admin,
    })

    // Auto-generate vault card def (fire-and-forget)
    event.waitUntil(
        ensurePlayerDef(sql, result.newLp.id)
            .catch(err => console.error('Auto card def generation failed:', err))
    )

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, league_player: result.newLp, forge: result.forgeResult }),
    }
}

/**
 * Create a brand-new player in the global players table AND add them to a team.
 */
async function createAndAddPlayer(sql, { name, team_id, season_id, role, main_role, secondary_role }, admin, event) {
    if (!name || !team_id || !season_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'name, team_id, and season_id required' }),
        }
    }
    const leagueId = await getLeagueIdFromSeason(season_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
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

    const effectiveRole = (role || main_role || 'fill').toLowerCase()

    const result = await transaction(async (tx) => {
        const [player] = await tx`
            INSERT INTO players (name, slug, main_role, secondary_role)
            VALUES (${trimmed}, ${slug}, ${main_role ?? null}, ${secondary_role ?? null})
            RETURNING id, name, slug, main_role, secondary_role
        `

        const [lp] = await tx`
            INSERT INTO league_players (player_id, team_id, season_id, role, is_active)
            VALUES (${player.id}, ${team_id}, ${season_id}, ${effectiveRole}, true)
            RETURNING id, team_id, role, is_active
        `

        return { player, league_player: lp }
    })

    // Look up team name for transaction log
    const [toTeam] = await sql`SELECT name FROM teams WHERE id = ${team_id}`

    await logAudit(sql, admin, { action: 'create-and-add-player', endpoint: 'roster-manage', targetType: 'player', targetId: result.player.id, details: { name: result.player.name, team_id, season_id } })
    await logRosterTransaction(sql, {
        seasonId: season_id, playerId: result.player.id, playerName: result.player.name,
        type: 'create-and-add', toTeamId: team_id, toTeamName: toTeam?.name,
        toStatus: 'member', admin,
    })

    // Auto-generate vault card def (fire-and-forget)
    event.waitUntil(
        ensurePlayerDef(sql, result.league_player.id)
            .catch(err => console.error('Auto card def generation failed:', err))
    )

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, ...result }),
    }
}

/**
 * Add an alias (old name) for a player
 */
async function addAlias(sql, { player_id, alias }, admin, event) {
    if (!player_id || !alias?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'player_id and alias required' }) }
    }
    // Aliases are global — require global roster_manage permission
    if (!await requirePermission(event, 'roster_manage', null)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global roster permission required for alias management' }) }
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
        await logAudit(sql, admin, { action: 'add-alias', endpoint: 'roster-manage', targetType: 'player', targetId: player_id, details: { alias: trimmed } })
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
async function removeAlias(sql, { alias_id }, admin, event) {
    if (!alias_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'alias_id required' }) }
    }
    if (!await requirePermission(event, 'roster_manage', null)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global roster permission required for alias management' }) }
    }
    const [deleted] = await sql`
        DELETE FROM player_aliases WHERE id = ${alias_id} RETURNING id, player_id, alias
    `
    if (!deleted) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Alias not found' }) }
    }
    await logAudit(sql, admin, { action: 'remove-alias', endpoint: 'roster-manage', targetType: 'player', targetId: deleted.player_id, details: { alias: deleted.alias } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted }) }
}

/**
 * Merge a duplicate player into the real player.
 * Reassigns all stats, saves old name as alias, deletes the duplicate.
 */
async function mergePlayer(sql, { source_player_id, target_player_id }, admin, event) {
    if (!source_player_id || !target_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'source_player_id and target_player_id required' }) }
    }
    if (!await requirePermission(event, 'roster_manage', null)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global roster permission required for player merge' }) }
    }
    if (String(source_player_id) === String(target_player_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot merge a player into themselves' }) }
    }

    const result = await transaction(async (tx) => {
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
        let forgeRelinked = 0, forgeSold = 0, forgeRefunded = 0

        for (const slp of sourceLps) {
            // Check if target already has a league_player in this season
            const [targetLp] = await tx`
                SELECT id FROM league_players
                WHERE player_id = ${target_player_id} AND season_id = ${slp.season_id}
                LIMIT 1
            `

            if (targetLp) {
                // Relink/sell forge holdings before deleting the source LP
                const forgeResult = await mergeForgeHoldings(tx, slp.id, targetLp.id)
                if (forgeResult) {
                    forgeRelinked += forgeResult.relinked
                    forgeSold += forgeResult.sold
                    forgeRefunded += forgeResult.refunded
                }

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

        // Save the source name as an alias for the target (skip if same name)
        if (source.name.toLowerCase() !== target.name.toLowerCase()) {
            await tx`
                INSERT INTO player_aliases (player_id, alias)
                VALUES (${target_player_id}, ${source.name})
                ON CONFLICT DO NOTHING
            `
        }

        // Move any existing aliases from source to target
        await tx`
            UPDATE player_aliases SET player_id = ${target_player_id}
            WHERE player_id = ${source_player_id}
              AND LOWER(alias) NOT IN (
                  SELECT LOWER(alias) FROM player_aliases WHERE player_id = ${target_player_id}
              )
        `

        // Re-point any user links and claim requests from source → target
        const affectedUsers = await tx`
            UPDATE users SET linked_player_id = ${target_player_id}
            WHERE linked_player_id = ${source_player_id}
            RETURNING id
        `
        await tx`UPDATE claim_requests SET player_id = ${target_player_id} WHERE player_id = ${source_player_id}`

        // Auto-sell any holdings that are now illegal (own-team) after the merge.
        // Check both re-pointed users AND users already linked to the target,
        // since re-parented LPs may have added new teams to the target's profile.
        const usersToCheck = new Set(affectedUsers.map(u => u.id))
        const targetLinkedUsers = await tx`
            SELECT id FROM users WHERE linked_player_id = ${target_player_id}
        `
        for (const u of targetLinkedUsers) usersToCheck.add(u.id)

        for (const userId of usersToCheck) {
            const ownTeamResult = await sellOwnTeamHoldings(tx, userId)
            if (ownTeamResult) {
                forgeSold += ownTeamResult.sold
                forgeRefunded += ownTeamResult.refunded
            }
        }

        // Delete the source player (CASCADE cleans up remaining aliases)
        await tx`DELETE FROM players WHERE id = ${source_player_id}`

        return {
            source_name: source.name,
            target_name: target.name,
            stats_reassigned: statsReassigned,
            league_players_reassigned: lpsReassigned,
            league_players_deleted: lpsDeleted,
            forge_relinked: forgeRelinked,
            forge_sold: forgeSold,
            forge_refunded: forgeRefunded,
        }
    })

    await logAudit(sql, admin, { action: 'merge-player', endpoint: 'roster-manage', targetType: 'player', targetId: target_player_id, details: { source_player_id, source_name: result.source_name, target_name: result.target_name } })

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
async function renamePlayer(sql, { player_id, new_name, save_old_as_alias }, admin, event) {
    if (!player_id || !new_name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'player_id and new_name required' }) }
    }
    if (!await requirePermission(event, 'roster_manage', null)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global roster permission required for player rename' }) }
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

    const result = await transaction(async (tx) => {
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

    await logAudit(sql, admin, { action: 'rename-player', endpoint: 'roster-manage', targetType: 'player', targetId: player_id, details: { old_name: result.old_name, new_name: result.new_name, save_old_as_alias } })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `Renamed "${result.old_name}" to "${result.new_name}"`, ...result }),
    }
}

/**
 * Set a player as team captain.
 * Removes captain from any existing captain on the same team+season.
 */
async function setCaptain(sql, { league_player_id }, admin, event) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const [lp] = await sql`
        SELECT lp.id, lp.team_id, lp.season_id, lp.is_active, lp.player_id, lp.roster_status,
               p.name as player_name, t.name as team_name
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.id = ${league_player_id}
    `
    if (!lp) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }
    if (!lp.is_active) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot set an inactive player as captain' }) }
    }

    // Remove captain from all players on same team+season
    await sql`
        UPDATE league_players
        SET roster_status = 'member', updated_at = NOW()
        WHERE team_id = ${lp.team_id} AND season_id = ${lp.season_id} AND roster_status = 'captain'
    `

    const [updated] = await sql`
        UPDATE league_players
        SET roster_status = 'captain', updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, roster_status
    `

    await logAudit(sql, admin, {
        action: 'set-captain',
        endpoint: 'roster-manage',
        targetType: 'league_player',
        targetId: league_player_id,
        details: { team_id: lp.team_id, season_id: lp.season_id },
    })
    await logRosterTransaction(sql, {
        seasonId: lp.season_id, playerId: lp.player_id, playerName: lp.player_name,
        type: 'set-captain', fromTeamId: lp.team_id, fromTeamName: lp.team_name,
        toTeamId: lp.team_id, toTeamName: lp.team_name,
        fromStatus: lp.roster_status, toStatus: 'captain', admin,
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated }),
    }
}

/**
 * Set or remove a player as co-captain.
 * Only one co-captain per team+season.
 */
async function setCoCaptain(sql, { league_player_id, remove }, admin, event) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const [lp] = await sql`
        SELECT lp.id, lp.team_id, lp.season_id, lp.is_active, lp.player_id, lp.roster_status,
               p.name as player_name, t.name as team_name
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.id = ${league_player_id}
    `
    if (!lp) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }
    if (!lp.is_active) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot modify an inactive player' }) }
    }

    if (remove) {
        if (lp.roster_status !== 'co_captain') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Player is not a co-captain' }) }
        }
        await sql`
            UPDATE league_players SET roster_status = 'member', updated_at = NOW()
            WHERE id = ${league_player_id}
        `
    } else {
        if (lp.roster_status === 'captain') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot demote the captain to co-captain' }) }
        }
        // Remove any existing co-captain on this team+season
        await sql`
            UPDATE league_players SET roster_status = 'member', updated_at = NOW()
            WHERE team_id = ${lp.team_id} AND season_id = ${lp.season_id} AND roster_status = 'co_captain'
        `
        await sql`
            UPDATE league_players SET roster_status = 'co_captain', updated_at = NOW()
            WHERE id = ${league_player_id}
        `
    }

    await logAudit(sql, admin, {
        action: remove ? 'remove-co-captain' : 'set-co-captain',
        endpoint: 'roster-manage',
        targetType: 'league_player',
        targetId: league_player_id,
        details: { team_id: lp.team_id, season_id: lp.season_id },
    })
    await logRosterTransaction(sql, {
        seasonId: lp.season_id, playerId: lp.player_id, playerName: lp.player_name,
        type: remove ? 'remove-co-captain' : 'set-co-captain',
        fromTeamId: lp.team_id, fromTeamName: lp.team_name,
        toTeamId: lp.team_id, toTeamName: lp.team_name,
        fromStatus: lp.roster_status, toStatus: remove ? 'member' : 'co_captain', admin,
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated: { id: lp.id, roster_status: remove ? 'member' : 'co_captain' } }),
    }
}

/**
 * Promote a Rule 0-Sub to a regular member
 */
async function promoteSub(sql, { league_player_id }, admin, event) {
    if (!league_player_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_player_id required' }) }
    }
    const leagueId = await getLeagueIdFromLeaguePlayer(league_player_id)
    if (!await requirePermission(event, 'roster_manage', leagueId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    const [lp] = await sql`
        SELECT lp.id, lp.roster_status, lp.season_id, lp.team_id, lp.player_id,
               p.name as player_name, t.name as team_name
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        WHERE lp.id = ${league_player_id}
    `
    if (!lp) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League player not found' }) }
    }
    if (lp.roster_status !== 'sub') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Player is not a sub' }) }
    }

    const [updated] = await sql`
        UPDATE league_players
        SET roster_status = 'member', updated_at = NOW()
        WHERE id = ${league_player_id}
        RETURNING id, roster_status
    `

    await logAudit(sql, admin, { action: 'promote-sub', endpoint: 'roster-manage', targetType: 'league_player', targetId: league_player_id })
    await logRosterTransaction(sql, {
        seasonId: lp.season_id, playerId: lp.player_id, playerName: lp.player_name,
        type: 'promote', fromTeamId: lp.team_id, fromTeamName: lp.team_name,
        toTeamId: lp.team_id, toTeamName: lp.team_name,
        fromStatus: 'sub', toStatus: 'member', admin,
    })

    // Create forge spark for newly promoted member (fire-and-forget)
    const [market] = await sql`SELECT id, season_id FROM forge_markets WHERE season_id = ${lp.season_id} AND status = 'open'`
    if (market) {
        event.waitUntil(
            ensurePlayerSparks(sql, market.id, market.season_id)
                .catch(err => console.error('Spark creation after promote-sub failed:', err))
        )
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated, message: 'Promoted to member' }),
    }
}

/**
 * Scan ALL users with linked players and auto-sell any illegal Forge holdings.
 * Useful for retroactively cleaning up after trades that happened before enforcement was added.
 */
async function cleanupIllegalHoldings(sql, admin, event) {
    if (!await requirePermission(event, 'roster_manage', null)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Global roster permission required' }) }
    }

    // Pre-scan: find users who actually have illegal holdings (own-team)
    // This avoids opening a transaction for every user
    const illegal = await sql`
        SELECT DISTINCT sh.user_id, u.discord_username
        FROM spark_holdings sh
        JOIN player_sparks ps ON sh.spark_id = ps.id
        JOIN forge_markets fm ON ps.market_id = fm.id
        JOIN league_players lp ON ps.league_player_id = lp.id
        JOIN users u ON u.id = sh.user_id
        WHERE sh.sparks > 0
          AND fm.status = 'open'
          AND u.linked_player_id IS NOT NULL
          AND lp.team_id IN (
              SELECT lp2.team_id FROM league_players lp2
              WHERE lp2.player_id = u.linked_player_id AND lp2.is_active = true
          )
    `

    let totalSold = 0, totalRefunded = 0
    const affected = []

    for (const user of illegal) {
        try {
            const result = await transaction(async (tx) => {
                return await sellOwnTeamHoldings(tx, user.user_id)
            })
            if (result) {
                totalSold += result.sold
                totalRefunded += result.refunded
                affected.push({ userId: user.user_id, username: user.discord_username, ...result })
            }
        } catch (err) {
            console.error(`Forge cleanup failed for user ${user.user_id} (${user.discord_username}):`, err)
            affected.push({ userId: user.user_id, username: user.discord_username, error: err.message })
        }
    }

    await logAudit(sql, admin, {
        action: 'cleanup-illegal-holdings',
        endpoint: 'roster-manage',
        targetType: 'system',
        targetId: 0,
        details: { totalSold, totalRefunded, affectedUsers: affected.length },
    })

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, totalSold, totalRefunded, affected }),
    }
}

export const onRequest = adapt(handler)
