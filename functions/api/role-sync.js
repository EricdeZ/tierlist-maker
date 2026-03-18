import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

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
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}')
            const { action } = body

            if (action === 'preview') return await preview(sql, body, event)
            if (action === 'apply') return await apply(sql, body, admin, event)

            return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Role sync error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

const VALID_ROLES = ['solo', 'jungle', 'mid', 'support', 'adc']

// Accept seasonId (single) or seasonIds (array)
function resolveSeasonIds({ seasonId, seasonIds }) {
    if (seasonIds?.length) return seasonIds.map(Number)
    if (seasonId) return [Number(seasonId)]
    return []
}

async function preview(sql, body, event) {
    const ids = resolveSeasonIds(body)
    if (!ids.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId or seasonIds required' }) }
    }

    const players = await sql`
        SELECT lp.id as league_player_id, lp.role as current_role, lp.team_id,
               p.id as player_id, p.name as player_name, p.slug as player_slug,
               t.name as team_name, t.color as team_color,
               s.id as season_id,
               d.name as division_name, d.slug as division_slug,
               l.name as league_name, l.slug as league_slug
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        JOIN teams t ON t.id = lp.team_id
        JOIN seasons s ON s.id = lp.season_id
        JOIN divisions d ON d.id = s.division_id
        JOIN leagues l ON l.id = d.league_id
        WHERE lp.season_id = ANY(${ids})
          AND lp.is_active = true
        ORDER BY l.name, d.name, t.name, p.name
    `

    if (!players.length) {
        return {
            statusCode: 200, headers,
            body: JSON.stringify({ teams: [], summary: { changes: 0, unchanged: 0, noData: 0 } }),
        }
    }

    const lpIds = players.map(p => p.league_player_id)
    const lastGames = await sql`
        SELECT DISTINCT ON (pgs.league_player_id)
            pgs.league_player_id,
            pgs.role_played,
            pgs.game_id,
            g.game_number,
            g.match_id,
            m.date as match_date,
            m.week as match_week
        FROM player_game_stats pgs
        JOIN games g ON g.id = pgs.game_id
        JOIN matches m ON m.id = g.match_id
        WHERE pgs.league_player_id = ANY(${lpIds})
          AND pgs.role_played IS NOT NULL
          AND pgs.role_played != ''
        ORDER BY pgs.league_player_id, m.date DESC, g.game_number DESC
    `

    const lastGameMap = {}
    for (const g of lastGames) {
        lastGameMap[g.league_player_id] = g
    }

    const teamMap = {}
    let totalChanges = 0
    let totalUnchanged = 0
    let totalNoData = 0

    for (const p of players) {
        const teamKey = `${p.season_id}-${p.team_id}`
        if (!teamMap[teamKey]) {
            teamMap[teamKey] = {
                teamId: p.team_id,
                teamName: p.team_name,
                teamColor: p.team_color,
                leagueName: p.league_name,
                divisionName: p.division_name,
                changes: [],
                unchanged: 0,
                noData: 0,
            }
        }
        const team = teamMap[teamKey]

        const lastGame = lastGameMap[p.league_player_id]
        if (!lastGame) {
            team.noData++
            totalNoData++
            continue
        }

        const newRole = lastGame.role_played.toLowerCase()
        const currentRole = (p.current_role || '').toLowerCase()

        if (!VALID_ROLES.includes(newRole)) {
            team.noData++
            totalNoData++
            continue
        }

        if (newRole === currentRole) {
            team.unchanged++
            totalUnchanged++
        } else {
            team.changes.push({
                leaguePlayerId: p.league_player_id,
                playerName: p.player_name,
                playerSlug: p.player_slug,
                currentRole: currentRole || null,
                newRole,
                matchId: lastGame.match_id,
                matchDate: lastGame.match_date,
                matchWeek: lastGame.match_week,
                gameNumber: lastGame.game_number,
                leagueSlug: p.league_slug,
                divisionSlug: p.division_slug,
            })
            totalChanges++
        }
    }

    const teams = Object.values(teamMap)
        .filter(t => t.changes.length > 0 || t.noData > 0)
        .sort((a, b) => b.changes.length - a.changes.length)

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            teams,
            summary: { changes: totalChanges, unchanged: totalUnchanged, noData: totalNoData },
        }),
    }
}

async function apply(sql, body, admin, event) {
    const ids = resolveSeasonIds(body)
    const { updates } = body
    if (!ids.length || !updates?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId(s) and updates required' }) }
    }

    // Validate upfront, collect valid updates
    const validUpdates = updates.filter(({ leaguePlayerId, newRole }) =>
        leaguePlayerId && newRole && VALID_ROLES.includes(newRole.toLowerCase())
    )
    const skippedValidation = updates.length - validUpdates.length

    if (!validUpdates.length) {
        return {
            statusCode: 200, headers,
            body: JSON.stringify({ success: true, applied: 0, skipped: updates.length }),
        }
    }

    const lpIds = validUpdates.map(u => u.leaguePlayerId)
    const roles = validUpdates.map(u => u.newRole.toLowerCase())

    // Batch update league_players (1 query instead of N)
    const updated = await sql`
        UPDATE league_players lp
        SET role = v.role, updated_at = NOW()
        FROM unnest(${lpIds}::int[], ${roles}::text[]) AS v(id, role)
        WHERE lp.id = v.id
          AND lp.season_id = ANY(${ids})
          AND lp.is_active = true
        RETURNING lp.id, lp.player_id, lp.season_id, v.role
    `

    const applied = updated.length

    if (applied > 0) {
        const updatedPlayerIds = updated.map(r => r.player_id)
        const updatedSeasonIds = updated.map(r => r.season_id)
        const updatedRoles = updated.map(r => r.role)

        // Batch sync to vault defs (1 query instead of N)
        await sql`
            UPDATE cc_player_defs d
            SET role = v.role, updated_at = NOW()
            FROM unnest(${updatedPlayerIds}::int[], ${updatedSeasonIds}::int[], ${updatedRoles}::text[]) AS v(player_id, season_id, role)
            WHERE d.player_id = v.player_id
              AND d.season_id = v.season_id
              AND d.frozen_stats IS NULL
        `

        // Batch sync to minted cards (1 query instead of N)
        await sql`
            UPDATE cc_cards c
            SET role = d.role,
                card_data = jsonb_set(COALESCE(c.card_data, '{}'::jsonb), '{role}', to_jsonb(UPPER(d.role)))
            FROM cc_player_defs d
            WHERE c.def_id = d.id
              AND c.card_type = 'player'
              AND d.frozen_stats IS NULL
              AND d.player_id = ANY(${updatedPlayerIds})
              AND d.season_id = ANY(${updatedSeasonIds})
        `
    }

    const skipped = skippedValidation + (validUpdates.length - applied)

    await logAudit(sql, admin, {
        action: 'role-sync-apply',
        endpoint: 'role-sync',
        targetType: 'season',
        targetId: ids[0],
        details: { applied, skipped, total: updates.length, seasonIds: ids },
    })

    return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, applied, skipped }),
    }
}

export const onRequest = adapt(handler)
