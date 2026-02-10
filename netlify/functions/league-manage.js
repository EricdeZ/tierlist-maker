/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()

    try {
        // ─── GET: Full hierarchy with counts ───
        if (event.httpMethod === 'GET') {
            const leagues = await sql`
                SELECT id, name, slug, description, discord_url, color, created_at
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ leagues, divisions, seasons, teams, teamPlayerCounts, seasonMatchCounts }),
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
            case 'create-league':   return await createLeague(sql, body)
            case 'update-league':   return await updateLeague(sql, body)
            case 'delete-league':   return await deleteLeague(sql, body)
            // Division CRUD
            case 'create-division': return await createDivision(sql, body)
            case 'update-division': return await updateDivision(sql, body)
            case 'delete-division': return await deleteDivision(sql, body)
            // Season CRUD
            case 'create-season':   return await createSeason(sql, body)
            case 'update-season':   return await updateSeason(sql, body)
            case 'toggle-season':   return await toggleSeason(sql, body)
            case 'delete-season':   return await deleteSeason(sql, body)
            // Team CRUD
            case 'create-team':     return await createTeam(sql, body)
            case 'update-team':     return await updateTeam(sql, body)
            case 'delete-team':     return await deleteTeam(sql, body)
            case 'copy-teams':      return await copyTeams(sql, body)
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

async function createLeague(sql, { name, description, discord_url, color }) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO leagues (name, slug, description, discord_url, color)
        VALUES (${name.trim()}, ${slug}, ${description || null}, ${discord_url || null}, ${color || null})
        RETURNING *
    `
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, league: row }) }
}

async function updateLeague(sql, { id, name, slug, description, discord_url, color }) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE leagues SET
            name = COALESCE(${name || null}, name),
            slug = COALESCE(${slug || null}, slug),
            description = ${description ?? null},
            discord_url = ${discord_url ?? null},
            color = COALESCE(${color || null}, color),
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, league: row }) }
}

async function deleteLeague(sql, { id }) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    // Check for children
    const [hasDivs] = await sql`SELECT 1 FROM divisions WHERE league_id = ${id} LIMIT 1`
    if (hasDivs) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete league that has divisions. Remove divisions first.' }) }
    }
    const [row] = await sql`DELETE FROM leagues WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ═══════════════════════════════════════════════════
// DIVISION CRUD
// ═══════════════════════════════════════════════════

async function createDivision(sql, { league_id, name, tier, description }) {
    if (!league_id || !name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_id and name required' }) }
    }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO divisions (league_id, name, tier, slug, description)
        VALUES (${league_id}, ${name.trim()}, ${tier || null}, ${slug}, ${description || null})
        RETURNING *
    `
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, division: row }) }
}

async function updateDivision(sql, { id, name, tier, slug, description }) {
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
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, division: row }) }
}

async function deleteDivision(sql, { id }) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [hasSeasons] = await sql`SELECT 1 FROM seasons WHERE division_id = ${id} LIMIT 1`
    if (hasSeasons) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete division that has seasons. Remove seasons first.' }) }
    }
    const [row] = await sql`DELETE FROM divisions WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Division not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ═══════════════════════════════════════════════════
// SEASON CRUD
// ═══════════════════════════════════════════════════

async function createSeason(sql, { league_id, division_id, name, start_date, end_date, description }) {
    if (!league_id || !division_id || !name?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'league_id, division_id, and name required' }) }
    }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO seasons (league_id, division_id, name, slug, start_date, end_date, is_active, description)
        VALUES (${league_id}, ${division_id}, ${name.trim()}, ${slug}, ${start_date || null}, ${end_date || null}, false, ${description || null})
        RETURNING *
    `
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

async function updateSeason(sql, { id, name, slug, start_date, end_date, description }) {
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
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

async function toggleSeason(sql, { id, is_active }) {
    if (!id || typeof is_active !== 'boolean') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and is_active (boolean) required' }) }
    }
    const [row] = await sql`
        UPDATE seasons SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id} RETURNING id, name, is_active
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Season not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, season: row }) }
}

async function deleteSeason(sql, { id }) {
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
    const [row] = await sql`DELETE FROM seasons WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Season not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ═══════════════════════════════════════════════════
// TEAM CRUD
// ═══════════════════════════════════════════════════

async function createTeam(sql, { season_id, name, color }) {
    if (!season_id || !name?.trim() || !color?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'season_id, name, and color required' }) }
    }
    const slug = slugify(name.trim())
    const [row] = await sql`
        INSERT INTO teams (season_id, name, color, slug)
        VALUES (${season_id}, ${name.trim()}, ${color.trim()}, ${slug})
        RETURNING *
    `
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, team: row }) }
}

async function updateTeam(sql, { id, name, color, slug }) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE teams SET
            name = COALESCE(${name || null}, name),
            color = COALESCE(${color || null}, color),
            slug = COALESCE(${slug || null}, slug),
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, team: row }) }
}

async function copyTeams(sql, { source_season_id, target_season_id, team_ids }) {
    if (!source_season_id || !target_season_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'source_season_id and target_season_id required' }) }
    }
    if (source_season_id === target_season_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Source and target season must be different' }) }
    }
    let sourceTeams
    if (team_ids?.length) {
        sourceTeams = await sql`
            SELECT name, color FROM teams WHERE season_id = ${source_season_id} AND id = ANY(${team_ids}) ORDER BY name
        `
    } else {
        sourceTeams = await sql`
            SELECT name, color FROM teams WHERE season_id = ${source_season_id} ORDER BY name
        `
    }
    if (sourceTeams.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No teams found to copy' }) }
    }
    const created = []
    for (const t of sourceTeams) {
        const slug = slugify(t.name)
        const [row] = await sql`
            INSERT INTO teams (season_id, name, color, slug)
            VALUES (${target_season_id}, ${t.name}, ${t.color}, ${slug})
            RETURNING *
        `
        created.push(row)
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, teams: created, count: created.length }) }
}

async function deleteTeam(sql, { id }) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [hasPlayers] = await sql`SELECT 1 FROM league_players WHERE team_id = ${id} LIMIT 1`
    if (hasPlayers) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete team that has players. Remove players first.' }) }
    }
    const [hasMatches] = await sql`SELECT 1 FROM matches WHERE team1_id = ${id} OR team2_id = ${id} LIMIT 1`
    if (hasMatches) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cannot delete team that has matches.' }) }
    }
    const [row] = await sql`DELETE FROM teams WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}
