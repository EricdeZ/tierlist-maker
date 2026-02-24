import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { invalidatePerformanceChallenges } from '../lib/challenges.js'
import { liquidateMarketBySeason } from '../lib/forge.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // ─── GET: Full hierarchy with counts ───
        if (event.httpMethod === 'GET') {
            const leagues = await sql`
                SELECT id, name, slug, description, discord_url, color, slogan, promotional_text, created_at
                FROM leagues ORDER BY name
            `

            const divisions = await sql`
                SELECT id, league_id, name, tier, slug, description, created_at
                FROM divisions ORDER BY tier, name
            `

            const seasons = await sql`
                SELECT id, league_id, division_id, name, slug, start_date, end_date,
                       is_active, description, created_at
                FROM seasons ORDER BY start_date DESC NULLS LAST, name
            `

            const teams = await sql`
                SELECT t.id, t.season_id, t.name, t.color, t.slug, t.logo_url
                FROM teams t ORDER BY t.name
            `

            // Counts for context
            const teamPlayerCounts = await sql`
                SELECT t.id as team_id, COUNT(lp.id) as player_count
                FROM teams t
                LEFT JOIN league_players lp ON lp.team_id = t.id AND lp.is_active = true
                GROUP BY t.id
            `

            const seasonMatchCounts = await sql`
                SELECT season_id, COUNT(*) as match_count
                FROM matches
                GROUP BY season_id
            `

            const divisionTags = await sql`
                SELECT id, division_id, label, show_on_league
                FROM division_tags ORDER BY id
            `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ leagues, divisions, seasons, teams, teamPlayerCounts, seasonMatchCounts, divisionTags }),
            }
        }

        // ─── POST: CRUD actions ───
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
            // League CRUD
            case 'create-league':   return await createLeague(sql, body, admin)
            case 'update-league':   return await updateLeague(sql, body, admin)
            case 'delete-league':   return await deleteLeague(sql, body, admin)
            // Division CRUD
            case 'create-division': return await createDivision(sql, body, admin)
            case 'update-division': return await updateDivision(sql, body, admin)
            case 'delete-division': return await deleteDivision(sql, body, admin)
            // Season CRUD
            case 'create-season':   return await createSeason(sql, body, admin)
            case 'update-season':   return await updateSeason(sql, body, admin)
            case 'toggle-season':   return await toggleSeason(sql, body, admin)
            case 'end-season':      return await endSeason(sql, body, admin, event)
            case 'delete-season':   return await deleteSeason(sql, body, admin)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('League manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

// ═══════════════════════════════════════════════════
// LEAGUE CRUD
// ═══════════════════════════════════════════════════

async function createLeague(sql, { name, description, discord_url, color, slogan, promotional_text }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO leagues (name, slug, description, discord_url, color, slogan, promotional_text)
        VALUES (${name.trim()}, ${slug}, ${description || null}, ${discord_url || null}, ${color || null}, ${slogan || null}, ${promotional_text || null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-league', endpoint: 'league-manage', targetType: 'league', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, league: row }) }
}

async function updateLeague(sql, { id, name, slug, description, discord_url, color, slogan, promotional_text }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE leagues SET
            name = COALESCE(${name || null}, name),
            slug = COALESCE(${slug || null}, slug),
            description = ${description ?? null},
            discord_url = ${discord_url ?? null},
            color = COALESCE(${color || null}, color),
            slogan = ${slogan ?? null},
            promotional_text = ${promotional_text ?? null},
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found' }) }
    await logAudit(sql, admin, { action: 'update-league', endpoint: 'league-manage', leagueId: id, targetType: 'league', targetId: id, details: { name, slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, league: row }) }
}

async function deleteLeague(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    // Check for children
    const [hasDivs] = await sql`SELECT 1 FROM divisions WHERE league_id = ${id} LIMIT 1`
    if (hasDivs) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete league that has divisions. Remove divisions first.' }) }
    }
    const [row] = await sql`DELETE FROM leagues WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found' }) }
    await logAudit(sql, admin, { action: 'delete-league', endpoint: 'league-manage', targetType: 'league', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ═══════════════════════════════════════════════════
// DIVISION CRUD
// ═══════════════════════════════════════════════════

async function createDivision(sql, { league_id, name, tier, description, tags }, admin) {
    if (!league_id || !name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_id and name required' }) }
    }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO divisions (league_id, name, tier, slug, description)
        VALUES (${league_id}, ${name.trim()}, ${tier || null}, ${slug}, ${description || null})
        RETURNING *
    `
    if (tags?.length) {
        for (const t of tags) {
            await sql`INSERT INTO division_tags (division_id, label, show_on_league) VALUES (${row.id}, ${t.label.trim()}, ${!!t.show_on_league})`
        }
    }
    await logAudit(sql, admin, { action: 'create-division', endpoint: 'league-manage', leagueId: league_id, targetType: 'division', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, division: row }) }
}

async function updateDivision(sql, { id, name, tier, slug, description, tags }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE divisions SET
            name = COALESCE(${name || null}, name),
            tier = ${tier ?? null},
            slug = COALESCE(${slug || null}, slug),
            description = ${description ?? null},
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Division not found' }) }
    if (tags !== undefined) {
        await sql`DELETE FROM division_tags WHERE division_id = ${id}`
        if (tags?.length) {
            for (const t of tags) {
                await sql`INSERT INTO division_tags (division_id, label, show_on_league) VALUES (${id}, ${t.label.trim()}, ${!!t.show_on_league})`
            }
        }
    }
    await logAudit(sql, admin, { action: 'update-division', endpoint: 'league-manage', leagueId: row.league_id, targetType: 'division', targetId: id, details: { name, slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, division: row }) }
}

async function deleteDivision(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [hasSeasons] = await sql`SELECT 1 FROM seasons WHERE division_id = ${id} LIMIT 1`
    if (hasSeasons) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete division that has seasons. Remove seasons first.' }) }
    }
    const [row] = await sql`DELETE FROM divisions WHERE id = ${id} RETURNING id, name, league_id`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Division not found' }) }
    await logAudit(sql, admin, { action: 'delete-division', endpoint: 'league-manage', leagueId: row.league_id, targetType: 'division', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ═══════════════════════════════════════════════════
// SEASON CRUD
// ═══════════════════════════════════════════════════

async function createSeason(sql, { league_id, division_id, name, start_date, end_date, description }, admin) {
    if (!league_id || !division_id || !name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_id, division_id, and name required' }) }
    }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO seasons (league_id, division_id, name, slug, start_date, end_date, is_active, description)
        VALUES (${league_id}, ${division_id}, ${name.trim()}, ${slug}, ${start_date || null}, ${end_date || null}, false, ${description || null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-season', endpoint: 'league-manage', leagueId: league_id, targetType: 'season', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

async function updateSeason(sql, { id, name, slug, start_date, end_date, description }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE seasons SET
            name = COALESCE(${name || null}, name),
            slug = COALESCE(${slug || null}, slug),
            start_date = ${start_date ?? null},
            end_date = ${end_date ?? null},
            description = ${description ?? null},
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Season not found' }) }
    await logAudit(sql, admin, { action: 'update-season', endpoint: 'league-manage', leagueId: row.league_id, targetType: 'season', targetId: id, details: { name, slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

async function toggleSeason(sql, { id, is_active }, admin) {
    if (!id || typeof is_active !== 'boolean') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and is_active (boolean) required' }) }
    }
    const [row] = await sql`
        UPDATE seasons SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id} RETURNING id, name, is_active, league_id
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Season not found' }) }
    await logAudit(sql, admin, { action: 'toggle-season', endpoint: 'league-manage', leagueId: row.league_id, targetType: 'season', targetId: id, details: { is_active, name: row.name } })

    // When a season is closed, re-evaluate challenges for all players in that season
    if (!is_active) {
        reevaluateSeasonChallenges(sql, id)
            .catch(err => console.error('Season challenge re-evaluation failed:', err))
        // Liquidate Fantasy Forge market for this season (fire-and-forget)
        liquidateMarketBySeason(sql, id)
            .catch(err => console.error('Forge liquidation failed:', err))
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

async function endSeason(sql, { id }, admin, event) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }

    // Owner-only: requires permission_manage
    const owner = await requirePermission(event, 'permission_manage')
    if (!owner) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only the Owner can end a season' }) }
    }

    const [row] = await sql`
        UPDATE seasons
        SET is_active = false,
            end_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = ${id} AND is_active = true
        RETURNING id, name, is_active, league_id, end_date
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Season not found or already ended' }) }

    await logAudit(sql, admin, { action: 'end-season', endpoint: 'league-manage', leagueId: row.league_id, targetType: 'season', targetId: id, details: { name: row.name, end_date: row.end_date } })

    // Re-evaluate season-based challenges for all players in this season
    reevaluateSeasonChallenges(sql, id)
        .catch(err => console.error('Season end challenge re-evaluation failed:', err))

    // Liquidate Fantasy Forge market for this season (fire-and-forget)
    liquidateMarketBySeason(sql, id)
        .catch(err => console.error('Forge liquidation failed:', err))

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

/**
 * Re-evaluate season-based challenges for all players in a just-closed season.
 * Fire-and-forget — errors are logged but won't break the toggle response.
 */
async function reevaluateSeasonChallenges(sql, seasonId) {
    const users = await sql`
        SELECT DISTINCT u.id as user_id, u.linked_player_id
        FROM users u
        JOIN league_players lp ON lp.player_id = u.linked_player_id
        WHERE lp.season_id = ${seasonId} AND u.linked_player_id IS NOT NULL
    `
    if (users.length === 0) return
    const userIds = users.map(u => u.user_id)
    await invalidatePerformanceChallenges(sql, userIds, false)
}

async function deleteSeason(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    // Block if any team in this season has players or matches
    const [hasPlayers] = await sql`
        SELECT 1 FROM league_players lp JOIN teams t ON t.id = lp.team_id
        WHERE t.season_id = ${id} LIMIT 1
    `
    if (hasPlayers) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete season that has teams with players. Remove players first.' }) }
    }
    const [hasMatches] = await sql`
        SELECT 1 FROM matches WHERE season_id = ${id} LIMIT 1
    `
    if (hasMatches) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete season that has matches.' }) }
    }
    // Delete empty teams first, then the season
    await sql`DELETE FROM teams WHERE season_id = ${id}`
    const [row] = await sql`DELETE FROM seasons WHERE id = ${id} RETURNING id, name, league_id`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Season not found' }) }
    await logAudit(sql, admin, { action: 'delete-season', endpoint: 'league-manage', leagueId: row.league_id, targetType: 'season', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

export const onRequest = adapt(handler)
