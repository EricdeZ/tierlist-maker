import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { logRosterTransaction } from '../lib/roster-tx.js'
import { fetchGuildMembers } from '../lib/discord.js'
import { cleanupForgeAfterTeamChange } from '../lib/forge.js'


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
        if (event.httpMethod === 'GET') {
            return await getTransactions(sql, event)
        }

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


// ─── GET: Transaction History ───

async function getTransactions(sql, event) {
    const qs = event.queryStringParameters || {}
    const seasonId = parseInt(qs.seasonId)
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId required' }) }
    }

    const limit = Math.min(100, parseInt(qs.limit) || 50)
    const offset = parseInt(qs.offset) || 0

    const [rows, countResult] = await Promise.all([
        sql`
            SELECT id, season_id, player_id, player_name, type,
                   from_team_id, from_team_name, to_team_id, to_team_name,
                   from_status, to_status, source,
                   admin_user_id, admin_username, details, created_at
            FROM roster_transactions
            WHERE season_id = ${seasonId}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int as total FROM roster_transactions WHERE season_id = ${seasonId}`,
    ])

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ transactions: rows, total: countResult[0]?.total || 0 }),
    }
}


// ─── POST preview: Sync Rosters ───

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
        SELECT lp.id as league_player_id, lp.team_id, lp.roster_status, lp.player_id,
               p.id as player_id, p.name as player_name, p.discord_id, p.discord_name
        FROM league_players lp
        JOIN players p ON lp.player_id = p.id
        WHERE lp.season_id = ${seasonId} AND lp.is_active = true
    `

    // 3. Resolve guild(s) for the league via discord_channels
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
    const discordMemberByName = new Map()
    const allMemberNames = new Map()
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

    // Build set of mapped team role IDs for transfer detection
    const mappedTeamsByRoleId = new Map() // roleId → team
    for (const team of teams) {
        if (team.discord_role_id) {
            mappedTeamsByRoleId.set(team.discord_role_id, team)
        }
    }

    // 7. Process each team — track matched discord IDs globally to avoid double-counting
    const teamResults = []
    const allUnmatchedDiscordIds = new Set() // discord user IDs with team roles but no player match
    const unmatchedByTeam = [] // raw unmatched entries
    const globalMatchedDiscordIds = new Set()
    const summary = { promotes: 0, demotes: 0, transfers: 0, pickups: 0, unchanged: 0 }

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

        for (const lp of teamPlayers) {
            let hasRole = false
            let matched = false
            let matchMethod = null
            let matchedDiscordId = null

            // 1. Exact match by discord_id
            if (lp.discord_id) {
                if (membersWithRole.has(lp.discord_id)) {
                    hasRole = true
                    matched = true
                    matchMethod = 'discord_id'
                    matchedDiscordId = lp.discord_id
                } else if (discordMemberById.has(lp.discord_id)) {
                    matched = true
                    matchMethod = 'discord_id'
                    matchedDiscordId = lp.discord_id
                }
            }

            // 2. Exact match by discord_name
            if (!matched && lp.discord_name) {
                const nameLower = lp.discord_name.toLowerCase()
                const member = discordMemberByName.get(nameLower)
                if (member) {
                    matched = true
                    matchMethod = 'discord_name'
                    matchedDiscordId = member.user.id
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
                    matchedDiscordId = member.user.id
                    if (membersWithRole.has(member.user.id)) hasRole = true
                }
            }

            // 4. Fuzzy match
            if (!matched) {
                const namesToTry = [lp.discord_name, lp.player_name].filter(Boolean)
                for (const tryName of namesToTry) {
                    for (const [userId, memberNames] of allMemberNames) {
                        if (globalMatchedDiscordIds.has(userId)) continue
                        if (memberNames.some(mn => fuzzyMatch(tryName, mn))) {
                            matched = true
                            matchMethod = 'fuzzy'
                            matchedDiscordId = userId
                            if (membersWithRole.has(userId)) hasRole = true
                            break
                        }
                    }
                    if (matched) break
                }
            }

            if (matchedDiscordId) globalMatchedDiscordIds.add(matchedDiscordId)

            if (lp.roster_status === 'captain') {
                unchanged++
                continue
            }

            if (hasRole && lp.roster_status !== 'member') {
                changes.push({
                    type: 'promote',
                    playerName: lp.player_name,
                    playerId: lp.player_id,
                    leaguePlayerId: lp.league_player_id,
                    from: lp.roster_status,
                    to: 'member',
                    matchMethod,
                })
                summary.promotes++
            } else if (matched && !hasRole && lp.roster_status !== 'sub') {
                // Check if player has a DIFFERENT team's role → transfer
                let transferTarget = null
                if (matchedDiscordId) {
                    for (const [roleId, t] of mappedTeamsByRoleId) {
                        if (t.id === team.id) continue
                        const members = roleMembers.get(roleId) || new Set()
                        if (members.has(matchedDiscordId)) {
                            transferTarget = t
                            break
                        }
                    }
                }

                if (transferTarget) {
                    changes.push({
                        type: 'transfer',
                        playerName: lp.player_name,
                        playerId: lp.player_id,
                        leaguePlayerId: lp.league_player_id,
                        fromTeamId: team.id,
                        fromTeamName: team.name,
                        toTeamId: transferTarget.id,
                        toTeamName: transferTarget.name,
                        from: lp.roster_status,
                        matchMethod,
                    })
                    summary.transfers++
                } else {
                    changes.push({
                        type: 'demote',
                        playerName: lp.player_name,
                        playerId: lp.player_id,
                        leaguePlayerId: lp.league_player_id,
                        from: lp.roster_status,
                        to: 'sub',
                        matchMethod,
                    })
                    summary.demotes++
                }
            } else {
                unchanged++
            }
        }

        summary.unchanged += unchanged
        teamResults.push({
            teamId: team.id,
            teamName: team.name,
            changes,
            unchanged,
        })
    }

    // 8. Collect unmatched Discord members AFTER all teams are processed
    //    so globalMatchedDiscordIds is fully populated
    for (const team of teams) {
        if (!team.discord_role_id) continue
        const membersWithRole = roleMembers.get(team.discord_role_id) || new Set()
        for (const discordUserId of membersWithRole) {
            if (globalMatchedDiscordIds.has(discordUserId)) continue
            const member = discordMemberById.get(discordUserId)
            if (!member) continue
            allUnmatchedDiscordIds.add(discordUserId)
            unmatchedByTeam.push({
                discordName: member.nick || member.user.global_name || member.user.username || discordUserId,
                discordId: discordUserId,
                teamId: team.id,
                teamName: team.name,
            })
        }
    }

    // 9. Pickup detection: resolve unmatched Discord users to players via users table
    const pickups = []
    if (allUnmatchedDiscordIds.size > 0) {
        const unmatchedIds = [...allUnmatchedDiscordIds]
        const linkedUsers = await sql`
            SELECT u.discord_id, u.linked_player_id, p.name as player_name, p.id as player_id,
                   p.main_role
            FROM users u
            JOIN players p ON p.id = u.linked_player_id
            WHERE u.discord_id = ANY(${unmatchedIds})
              AND u.linked_player_id IS NOT NULL
        `
        const linkedByDiscordId = new Map()
        for (const lu of linkedUsers) {
            linkedByDiscordId.set(lu.discord_id, lu)
        }

        // Check which of these players already have active LPs in this season
        const linkedPlayerIds = linkedUsers.map(lu => lu.player_id)
        let existingLps = []
        if (linkedPlayerIds.length > 0) {
            existingLps = await sql`
                SELECT id, player_id, team_id, is_active
                FROM league_players
                WHERE player_id = ANY(${linkedPlayerIds}) AND season_id = ${seasonId}
            `
        }
        const existingLpByPlayer = new Map()
        for (const lp of existingLps) {
            existingLpByPlayer.set(lp.player_id, lp)
        }

        // Build pickup suggestions
        const resolvedDiscordIds = new Set()
        for (const entry of unmatchedByTeam) {
            if (resolvedDiscordIds.has(entry.discordId)) continue
            const linked = linkedByDiscordId.get(entry.discordId)
            if (!linked) continue

            const existingLp = existingLpByPlayer.get(linked.player_id)
            if (existingLp && existingLp.is_active) continue // already on a team, skip

            resolvedDiscordIds.add(entry.discordId)
            pickups.push({
                type: 'pickup',
                discordName: entry.discordName,
                discordId: entry.discordId,
                playerId: linked.player_id,
                playerName: linked.player_name,
                toTeamId: entry.teamId,
                toTeamName: entry.teamName,
                role: linked.main_role || 'fill',
                existingLpId: existingLp?.id || null,
                isReactivation: !!existingLp,
            })
            summary.pickups++
        }
    }

    // Filter out resolved pickups from unmatched list
    const resolvedPickupDiscordIds = new Set(pickups.map(p => p.discordId))
    const finalUnmatched = unmatchedByTeam.filter(u => !resolvedPickupDiscordIds.has(u.discordId))

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            teams: teamResults,
            pickups,
            unmatched: finalUnmatched,
            summary,
        }),
    }
}


// ─── POST apply: Apply Changes ───

async function applyChanges(sql, body, admin, event) {
    const { seasonId, updates } = body
    if (!updates || !Array.isArray(updates) || !updates.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No updates provided' }) }
    }

    const sid = parseInt(seasonId)

    // Separate by type
    const statusUpdates = updates.filter(u => u.type === 'promote' || u.type === 'demote')
    const transferUpdates = updates.filter(u => u.type === 'transfer')
    const pickupUpdates = updates.filter(u => u.type === 'pickup')

    // Validate LP IDs for status + transfer updates
    const lpIds = [...statusUpdates, ...transferUpdates].map(u => u.leaguePlayerId).filter(Boolean)
    let validLps = []
    if (lpIds.length > 0) {
        validLps = await sql`
            SELECT lp.id, lp.player_id, lp.team_id, lp.roster_status,
                   p.name as player_name, t.name as team_name
            FROM league_players lp
            JOIN players p ON p.id = lp.player_id
            JOIN teams t ON t.id = lp.team_id
            WHERE lp.id = ANY(${lpIds}) AND lp.season_id = ${sid} AND lp.is_active = true
        `
    }
    const lpMap = new Map(validLps.map(r => [r.id, r]))

    let promotes = 0, demotes = 0, transfers = 0, pickups = 0
    const txLogs = [] // collect transaction log promises
    const forgeCleanups = [] // (playerId, newTeamId) pairs for forge cleanup

    // Apply promote/demote
    for (const { leaguePlayerId, newStatus } of statusUpdates) {
        const lp = lpMap.get(leaguePlayerId)
        if (!lp) continue
        if (newStatus !== 'member' && newStatus !== 'sub') continue
        await sql`
            UPDATE league_players
            SET roster_status = ${newStatus}, updated_at = NOW()
            WHERE id = ${leaguePlayerId} AND roster_status != 'captain'
        `
        if (newStatus === 'member') promotes++
        else demotes++
        txLogs.push(logRosterTransaction(sql, {
            seasonId: sid, playerId: lp.player_id, playerName: lp.player_name,
            type: newStatus === 'member' ? 'promote' : 'demote',
            fromTeamId: lp.team_id, fromTeamName: lp.team_name,
            toTeamId: lp.team_id, toTeamName: lp.team_name,
            fromStatus: lp.roster_status, toStatus: newStatus,
            source: 'discord_sync', admin,
        }))
    }

    // Apply transfers
    for (const { leaguePlayerId, newTeamId } of transferUpdates) {
        const lp = lpMap.get(leaguePlayerId)
        if (!lp) continue
        if (!newTeamId) continue
        // Verify target team
        const [toTeam] = await sql`
            SELECT id, name FROM teams WHERE id = ${newTeamId} AND season_id = ${sid}
        `
        if (!toTeam) continue
        await sql`
            UPDATE league_players
            SET team_id = ${newTeamId}, roster_status = 'member', updated_at = NOW()
            WHERE id = ${leaguePlayerId} AND roster_status != 'captain'
        `
        transfers++
        forgeCleanups.push({ playerId: lp.player_id, newTeamId })
        txLogs.push(logRosterTransaction(sql, {
            seasonId: sid, playerId: lp.player_id, playerName: lp.player_name,
            type: 'transfer',
            fromTeamId: lp.team_id, fromTeamName: lp.team_name,
            toTeamId: newTeamId, toTeamName: toTeam.name,
            fromStatus: lp.roster_status, toStatus: 'member',
            source: 'discord_sync', admin,
        }))
    }

    // Apply pickups
    for (const { playerId, toTeamId, existingLpId, isReactivation, role } of pickupUpdates) {
        if (!playerId || !toTeamId) continue
        // Verify target team
        const [toTeam] = await sql`
            SELECT id, name FROM teams WHERE id = ${toTeamId} AND season_id = ${sid}
        `
        if (!toTeam) continue
        // Verify player exists
        const [player] = await sql`SELECT id, name FROM players WHERE id = ${playerId}`
        if (!player) continue

        // Check player isn't already active
        const [active] = await sql`
            SELECT id FROM league_players
            WHERE player_id = ${playerId} AND season_id = ${sid} AND is_active = true
        `
        if (active) continue

        if (isReactivation && existingLpId) {
            await sql`
                UPDATE league_players
                SET team_id = ${toTeamId}, is_active = true, roster_status = 'member', updated_at = NOW()
                WHERE id = ${existingLpId}
            `
        } else {
            await sql`
                INSERT INTO league_players (player_id, team_id, season_id, role, is_active, roster_status)
                VALUES (${playerId}, ${toTeamId}, ${sid}, ${role || 'fill'}, true, 'member')
            `
        }
        pickups++
        forgeCleanups.push({ playerId, newTeamId: toTeamId })
        txLogs.push(logRosterTransaction(sql, {
            seasonId: sid, playerId: player.id, playerName: player.name,
            type: 'pickup', toTeamId, toTeamName: toTeam.name,
            toStatus: 'member', source: 'discord_sync', admin,
            details: isReactivation ? { reactivated: true } : null,
        }))
    }

    // Fire-and-forget: audit log + transaction logs + forge cleanup
    const forgeCleanupPromise = forgeCleanups.length > 0
        ? transaction(async (tx) => {
            for (const { playerId, newTeamId } of forgeCleanups) {
                await cleanupForgeAfterTeamChange(tx, playerId, newTeamId)
            }
        }).catch(err => console.error('Forge cleanup after roster-sync failed:', err))
        : Promise.resolve()

    event.waitUntil(Promise.all([
        logAudit(sql, admin, {
            action: 'roster-sync',
            endpoint: 'roster-sync',
            targetType: 'season',
            targetId: sid,
            details: { promotes, demotes, transfers, pickups },
        }),
        ...txLogs,
        forgeCleanupPromise,
    ]))

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ applied: true, promotes, demotes, transfers, pickups }),
    }
}


export const onRequest = adapt(handler)
