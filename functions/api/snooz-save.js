import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, adminHeaders } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const SNOOZ_ALLOWED = ['171059031291461633', process.env.ADMIN_DISCORD_ID]
    if (!SNOOZ_ALLOWED.includes(user.discord_id)) {
        return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Not authorized to save snooz picks' }) }
    }

    const { seasonId, week, panelists, picks } = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    if (!seasonId || !week || !Array.isArray(panelists)) {
        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const sql = getDB()

    try {
        // Upsert panelists
        const savedPanelists = []
        for (let i = 0; i < panelists.length; i++) {
            const p = panelists[i]
            if (p.id) {
                // Check if name changed — if so, treat as new panelist
                const [current] = await sql`SELECT name FROM snooz_panelists WHERE id = ${p.id}`
                if (current && current.name.toLowerCase() === p.name.toLowerCase()) {
                    await sql`UPDATE snooz_panelists SET sort_order = ${i} WHERE id = ${p.id}`
                    savedPanelists.push({ id: p.id, name: current.name, sort_order: i })
                    continue
                }
                // Name changed — fall through to create/find by new name
            }
            // Find existing panelist by name (case-insensitive) or create new
            const [existing] = await sql`
                SELECT id, name FROM snooz_panelists WHERE LOWER(name) = LOWER(${p.name}) LIMIT 1
            `
            if (existing) {
                await sql`UPDATE snooz_panelists SET sort_order = ${i} WHERE id = ${existing.id}`
                savedPanelists.push({ id: existing.id, name: existing.name, sort_order: i })
            } else {
                const [created] = await sql`
                    INSERT INTO snooz_panelists (name, sort_order) VALUES (${p.name}, ${i})
                    RETURNING id, name, sort_order
                `
                savedPanelists.push(created)
            }
        }

        // Save week roster (league-scoped, shared across divisions)
        const weekNum = parseInt(week)
        const [seasonRow] = await sql`SELECT d.league_id FROM seasons s JOIN divisions d ON s.division_id = d.id WHERE s.id = ${seasonId} LIMIT 1`
        const leagueId = seasonRow?.league_id
        if (!leagueId) throw new Error('Could not resolve league from season')

        const savedIds = savedPanelists.map(p => p.id)

        // Find panelists removed from the roster who still have picks in other divisions this week
        const keepFromOtherDivisions = await sql`
            SELECT DISTINCT sp.panelist_id, p.name
            FROM snooz_picks sp
            JOIN snooz_panelists p ON p.id = sp.panelist_id
            WHERE sp.week = ${weekNum}
              AND sp.season_id != ${seasonId}
              AND sp.panelist_id != ALL(${savedIds})
              AND EXISTS (
                SELECT 1 FROM seasons s JOIN divisions d ON s.division_id = d.id
                WHERE s.id = sp.season_id AND d.league_id = ${leagueId}
              )
        `

        await sql`DELETE FROM snooz_week_panelists WHERE league_id = ${leagueId} AND week = ${weekNum}`
        for (let i = 0; i < savedPanelists.length; i++) {
            await sql`INSERT INTO snooz_week_panelists (league_id, week, panelist_id, sort_order) VALUES (${leagueId}, ${weekNum}, ${savedPanelists[i].id}, ${i})`
        }
        // Re-add panelists that were removed but still have picks in other divisions
        for (let i = 0; i < keepFromOtherDivisions.length; i++) {
            await sql`INSERT INTO snooz_week_panelists (league_id, week, panelist_id, sort_order) VALUES (${leagueId}, ${weekNum}, ${keepFromOtherDivisions[i].panelist_id}, ${savedPanelists.length + i})`
        }

        // Delete picks for this week/season, then reinsert
        await sql`DELETE FROM snooz_picks WHERE season_id = ${seasonId} AND week = ${weekNum}`

        if (Array.isArray(picks)) {
            for (const pick of picks) {
                const panelistId = savedPanelists[pick.panelistIndex]?.id
                if (!panelistId) continue
                const teamA = Math.min(pick.team1Id, pick.team2Id)
                const teamB = Math.max(pick.team1Id, pick.team2Id)
                await sql`
                    INSERT INTO snooz_picks (panelist_id, season_id, week, team_a_id, team_b_id, picked_team_id)
                    VALUES (${panelistId}, ${seasonId}, ${weekNum}, ${teamA}, ${teamB}, ${pick.pickedTeamId})
                `
            }
        }

        return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ panelists: savedPanelists }) }
    } catch (error) {
        console.error('Snooz save error:', error.message, error.stack)
        return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
    }
}

export const onRequest = adapt(handler)
