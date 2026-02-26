import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { fetchGuildMembers } from '../lib/discord.js'


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
            const { action, seasonId } = body

            if (!seasonId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId required' }) }
            }

            switch (action) {
                case 'preview': return await syncRosters(sql, parseInt(seasonId))
                case 'apply':   return await applyChanges(sql, body, admin, event)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (err) {
        console.error('roster-sync error:', err)
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Internal error' }) }
    }
}


// Strip non-alphanumeric, lowercase
function normalize(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Check if a is a reasonable fuzzy match for b (one starts with the other, min 4 chars)
function fuzzyMatch(a, b) {
    const na = normalize(a)
    const nb = normalize(b)
    if (na.length < 4 || nb.length < 4) return false
    return na.startsWith(nb) || nb.startsWith(na)
}


async function syncRosters(sql, seasonId) {
    // 1. Get all teams for this season with discord_role_id
    const teams = await sql`
        SELECT t.id, t.name, t.slug, t.discord_role_id, t.season_id,
               s.division_id, d.name as division_name
        FROM teams t
        JOIN seasons s ON t.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        WHERE t.season_id = ${seasonId}
        ORDER BY t.name
    `

    if (!teams.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No teams found for this season' }) }
    }

    // 2. Get all active league_players for this season with their player discord info
    const rosterPlayers = await sql`
        SELECT lp.id as league_player_id, lp.team_id, lp.roster_status,
               p.id as player_id, p.name as player_name, p.discord_id, p.discord_name
        FROM league_players lp
        JOIN players p ON lp.player_id = p.id
        WHERE lp.season_id = ${seasonId} AND lp.is_active = true
    `

    // 3. Resolve guild(s) for the league (not just this division) via discord_channels
    const guildRows = await sql`
        SELECT DISTINCT dc.guild_id
        FROM discord_channels dc
        JOIN divisions d ON dc.division_id = d.id
        WHERE d.league_id = (
            SELECT d2.league_id FROM seasons s2 JOIN divisions d2 ON s2.division_id = d2.id WHERE s2.id = ${seasonId}
        ) AND dc.is_active = true AND dc.guild_id IS NOT NULL
    `

    if (!guildRows.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No Discord guilds found for this season' }) }
    }

    // 4. Fetch all guild members from all guilds
    const allGuildMembers = []
    for (const { guild_id } of guildRows) {
        const members = await fetchGuildMembers(guild_id)
        allGuildMembers.push(...members)
    }

    // 5. Build a lookup: discord role ID → set of discord user IDs that have that role
    const roleMembers = new Map()
    for (const member of allGuildMembers) {
        for (const roleId of (member.roles || [])) {
            if (!roleMembers.has(roleId)) roleMembers.set(roleId, new Set())
            roleMembers.get(roleId).add(member.user.id)
        }
    }

    // 6. Build discord member lookup for matching
    const discordMemberById = new Map()
    const discordMemberByName = new Map()  // exact lowercase → member
    const allMemberNames = new Map()       // member user id → [names] for fuzzy
    for (const member of allGuildMembers) {
        discordMemberById.set(member.user.id, member)
        const names = [
            member.nick,
            member.user.global_name,
            member.user.username,
        ].filter(Boolean)
        allMemberNames.set(member.user.id, names)
        for (const name of names) {
            const lower = name.toLowerCase()
            if (!discordMemberByName.has(lower)) {
                discordMemberByName.set(lower, member)
            }
        }
    }

    // 7. Process each team
    const teamResults = []
    const allUnmatched = []
    const summary = { promotes: 0, demotes: 0, unchanged: 0 }

    for (const team of teams) {
        if (!team.discord_role_id) {
            const teamPlayers = rosterPlayers.filter(p => p.team_id === team.id)
            teamResults.push({
                teamId: team.id,
                teamName: team.name,
                changes: [],
                unchanged: teamPlayers.length,
                skipped: true,
                reason: 'No Discord role mapped',
            })
            summary.unchanged += teamPlayers.length
            continue
        }

        const membersWithRole = roleMembers.get(team.discord_role_id) || new Set()
        const teamPlayers = rosterPlayers.filter(p => p.team_id === team.id)
        const changes = []
        let unchanged = 0
        const matchedDiscordIds = new Set()

        for (const lp of teamPlayers) {
            let hasRole = false
            let matched = false // whether we found them in the guild at all
            let matchMethod = null

            // 1. Exact match by discord_id
            if (lp.discord_id) {
                if (membersWithRole.has(lp.discord_id)) {
                    hasRole = true
                    matched = true
                    matchMethod = 'discord_id'
                    matchedDiscordIds.add(lp.discord_id)
                } else if (discordMemberById.has(lp.discord_id)) {
                    matched = true
                    matchMethod = 'discord_id'
                    matchedDiscordIds.add(lp.discord_id)
                }
            }

            // 2. Exact match by discord_name
            if (!matched && lp.discord_name) {
                const nameLower = lp.discord_name.toLowerCase()
                const member = discordMemberByName.get(nameLower)
                if (member) {
                    matched = true
                    matchMethod = 'discord_name'
                    matchedDiscordIds.add(member.user.id)
                    if (membersWithRole.has(member.user.id)) hasRole = true
                }
            }

            // 3. Exact match by player name (smite name)
            if (!matched && lp.player_name) {
                const nameLower = lp.player_name.toLowerCase()
                const member = discordMemberByName.get(nameLower)
                if (member) {
                    matched = true
                    matchMethod = 'player_name'
                    matchedDiscordIds.add(member.user.id)
                    if (membersWithRole.has(member.user.id)) hasRole = true
                }
            }

            // 4. Fuzzy match by discord_name or player_name
            if (!matched) {
                const namesToTry = [lp.discord_name, lp.player_name].filter(Boolean)
                for (const tryName of namesToTry) {
                    for (const [userId, memberNames] of allMemberNames) {
                        if (matchedDiscordIds.has(userId)) continue
                        if (memberNames.some(mn => fuzzyMatch(tryName, mn))) {
                            matched = true
                            matchMethod = 'fuzzy'
                            matchedDiscordIds.add(userId)
                            if (membersWithRole.has(userId)) hasRole = true
                            break
                        }
                    }
                    if (matched) break
                }
            }

            if (lp.roster_status === 'captain') {
                unchanged++
                continue
            }

            if (hasRole && lp.roster_status !== 'member') {
                changes.push({
                    type: 'promote',
                    playerName: lp.player_name,
                    leaguePlayerId: lp.league_player_id,
                    from: lp.roster_status,
                    to: 'member',
                    matchMethod,
                })
                summary.promotes++
            } else if (matched && !hasRole && lp.roster_status !== 'sub') {
                // Found in guild but doesn't have the team role → demote
                changes.push({
                    type: 'demote',
                    playerName: lp.player_name,
                    leaguePlayerId: lp.league_player_id,
                    from: lp.roster_status,
                    to: 'sub',
                    matchMethod,
                })
                summary.demotes++
            } else {
                // Not matched to any Discord member → leave unchanged
                unchanged++
            }
        }

        // Check for Discord members with this role who aren't on the roster
        for (const discordUserId of membersWithRole) {
            if (matchedDiscordIds.has(discordUserId)) continue
            const member = discordMemberById.get(discordUserId)
            if (!member) continue
            const displayName = member.nick || member.user.global_name || member.user.username || discordUserId
            allUnmatched.push({
                discordName: displayName,
                discordId: discordUserId,
                teamName: team.name,
            })
        }

        summary.unchanged += unchanged
        teamResults.push({
            teamId: team.id,
            teamName: team.name,
            changes,
            unchanged,
        })
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            teams: teamResults,
            unmatched: allUnmatched,
            summary,
        }),
    }
}


async function applyChanges(sql, body, admin, event) {
    const { seasonId, updates } = body
    if (!updates || !Array.isArray(updates) || !updates.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No updates provided' }) }
    }

    // Validate all leaguePlayerIds belong to this season
    const lpIds = updates.map(u => u.leaguePlayerId)
    const valid = await sql`
        SELECT id FROM league_players
        WHERE id = ANY(${lpIds}) AND season_id = ${parseInt(seasonId)} AND is_active = true
    `
    const validIds = new Set(valid.map(r => r.id))

    let promotes = 0, demotes = 0
    for (const { leaguePlayerId, newStatus } of updates) {
        if (!validIds.has(leaguePlayerId)) continue
        if (newStatus !== 'member' && newStatus !== 'sub') continue
        await sql`
            UPDATE league_players
            SET roster_status = ${newStatus}, updated_at = NOW()
            WHERE id = ${leaguePlayerId} AND roster_status != 'captain'
        `
        if (newStatus === 'member') promotes++
        else demotes++
    }

    event.waitUntil(logAudit(sql, admin, {
        action: 'roster-sync',
        endpoint: 'roster-sync',
        targetType: 'season',
        targetId: parseInt(seasonId),
        details: { promotes, demotes },
    }))

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ applied: true, promotes, demotes }),
    }
}


export const onRequest = adapt(handler)
