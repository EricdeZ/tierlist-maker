/**
 * Auto-match Discord queue items to scheduled matches.
 *
 * Strategy (priority order):
 * 1. Author's team (Discord role OR player DB record) → identify one team
 * 2. Message text → parse for team name mentions
 * 3. Scheduled match lookup → match team(s) + division + date proximity
 */

import { sendWebhook } from './discord.js'

/**
 * Auto-match newly inserted discord_queue items to scheduled matches.
 * Fire-and-forget — errors are logged but never propagated.
 *
 * @param {object} sql - neon() database connection
 * @param {number[]} newItemIds - IDs of newly inserted discord_queue rows
 * @param {object} channel - discord_channels row (has division_id, guild_id, notification_webhook_url)
 * @param {object[]} guildMembers - Array of Discord guild member objects ({ user, roles })
 */
export async function autoMatchQueueItems(sql, newItemIds, channel, guildMembers) {
    if (!newItemIds.length) return

    // 1. Get new queue items
    const items = await sql`
        SELECT id, message_content, author_id, author_name, message_timestamp
        FROM discord_queue
        WHERE id = ANY(${newItemIds})
    `
    if (!items.length) return

    // 2. Get active season + teams for this channel's division
    const seasons = await sql`
        SELECT s.id as season_id
        FROM seasons s
        WHERE s.division_id = ${channel.division_id} AND s.is_active = true
        ORDER BY s.id DESC LIMIT 1
    `
    if (!seasons.length) return
    const seasonId = seasons[0].season_id

    const teams = await sql`
        SELECT id, name, slug, discord_role_id
        FROM teams
        WHERE season_id = ${seasonId}
    `
    if (!teams.length) return

    // Build lookup maps
    const teamsByRoleId = new Map()  // discord_role_id → team
    const teamsByName = new Map()    // lowercase team name → team
    for (const team of teams) {
        if (team.discord_role_id) teamsByRoleId.set(team.discord_role_id, team)
        teamsByName.set(team.name.toLowerCase(), team)
    }

    // Build member → team role lookup
    const memberTeamMap = new Map() // discord user id → team
    for (const member of guildMembers) {
        for (const roleId of (member.roles || [])) {
            if (teamsByRoleId.has(roleId)) {
                memberTeamMap.set(member.user.id, teamsByRoleId.get(roleId))
                break // first team role wins
            }
        }
    }

    // Build author → team lookup from player database records
    // Matches even when the author doesn't have the Discord team role
    const authorIds = [...new Set(items.map(i => i.author_id).filter(Boolean))]
    const teamsByIdMap = new Map(teams.map(t => [t.id, t]))
    const playerTeamMap = new Map() // discord user id → team
    if (authorIds.length) {
        const playerTeams = await sql`
            SELECT p.discord_id, lp.team_id
            FROM players p
            JOIN league_players lp ON lp.player_id = p.id
            WHERE p.discord_id = ANY(${authorIds})
              AND lp.team_id = ANY(${teams.map(t => t.id)})
        `
        for (const row of playerTeams) {
            const team = teamsByIdMap.get(row.team_id)
            if (team) playerTeamMap.set(row.discord_id, team)
        }
    }

    // 3. Get scheduled matches for this season
    const scheduledMatches = await sql`
        SELECT sm.id, sm.team1_id, sm.team2_id, sm.scheduled_date, sm.week, sm.best_of,
               t1.name as team1_name, t2.name as team2_name,
               t1.color as team1_color, t2.color as team2_color
        FROM scheduled_matches sm
        JOIN teams t1 ON sm.team1_id = t1.id
        JOIN teams t2 ON sm.team2_id = t2.id
        WHERE sm.season_id = ${seasonId} AND sm.status = 'scheduled'
    `

    // 4. Group items by message_id (same message = same match)
    // Since all items from same message have same content/author, group to match once
    const itemsByMessage = new Map()
    for (const item of items) {
        const key = `${item.author_id}_${item.message_content || ''}`
        if (!itemsByMessage.has(key)) {
            itemsByMessage.set(key, { ...item, itemIds: [item.id] })
        } else {
            itemsByMessage.get(key).itemIds.push(item.id)
        }
    }

    const matchedScheduleIds = new Set()

    for (const [, group] of itemsByMessage) {
        let matchedTeamIds = new Set()

        // Strategy 1: Author's team (Discord role OR player record)
        if (group.author_id) {
            if (memberTeamMap.has(group.author_id)) {
                matchedTeamIds.add(memberTeamMap.get(group.author_id).id)
            } else if (playerTeamMap.has(group.author_id)) {
                matchedTeamIds.add(playerTeamMap.get(group.author_id).id)
            }
        }

        // Strategy 2: Message text mentions team names
        if (group.message_content) {
            const textLower = group.message_content.toLowerCase()
            for (const [name, team] of teamsByName) {
                if (textLower.includes(name)) {
                    matchedTeamIds.add(team.id)
                }
            }
        }

        if (!matchedTeamIds.size && !scheduledMatches.length) continue

        // Strategy 3: Find matching scheduled match
        const msgDate = new Date(group.message_timestamp)
        const candidates = scheduledMatches.filter(sm => {
            // At least one identified team must be in this match
            if (matchedTeamIds.size > 0) {
                const hasTeam = matchedTeamIds.has(sm.team1_id) || matchedTeamIds.has(sm.team2_id)
                if (!hasTeam) return false
            }

            // Date proximity: within 2 days
            const schedDate = new Date(sm.scheduled_date)
            const daysDiff = Math.abs(msgDate - schedDate) / (1000 * 60 * 60 * 24)
            return daysDiff <= 7
        })

        let bestMatch = null
        if (candidates.length === 1) {
            bestMatch = candidates[0]
        } else if (candidates.length > 1 && matchedTeamIds.size > 0) {
            // Prefer match where both teams are identified
            const bothTeamsMatch = candidates.find(sm =>
                matchedTeamIds.has(sm.team1_id) && matchedTeamIds.has(sm.team2_id)
            )
            if (bothTeamsMatch) {
                bestMatch = bothTeamsMatch
            } else {
                // Pick closest date
                bestMatch = candidates.reduce((best, sm) => {
                    const bestDiff = Math.abs(msgDate - new Date(best.scheduled_date))
                    const smDiff = Math.abs(msgDate - new Date(sm.scheduled_date))
                    return smDiff < bestDiff ? sm : best
                })
            }
        } else if (candidates.length === 0 && matchedTeamIds.size === 0) {
            // No team identified and no date match — try all scheduled matches for this season
            // Only match if there's exactly one scheduled match within date range
            const dateMatches = scheduledMatches.filter(sm => {
                const schedDate = new Date(sm.scheduled_date)
                const daysDiff = Math.abs(msgDate - schedDate) / (1000 * 60 * 60 * 24)
                return daysDiff <= 7
            })
            if (dateMatches.length === 1) {
                bestMatch = dateMatches[0]
            }
        }

        if (bestMatch) {
            await sql`
                UPDATE discord_queue
                SET suggested_match_id = ${bestMatch.id}
                WHERE id = ANY(${group.itemIds})
                  AND suggested_match_id IS NULL
            `
            matchedScheduleIds.add(bestMatch.id)
        }
    }

    // 5. Send webhook notifications for newly matched scheduled matches
    if (matchedScheduleIds.size > 0 && channel.notification_webhook_url) {
        for (const smId of matchedScheduleIds) {
            const sm = scheduledMatches.find(m => m.id === smId)
            if (!sm) continue

            // Count total pending screenshots for this match
            const [countRow] = await sql`
                SELECT COUNT(*) as count FROM discord_queue
                WHERE suggested_match_id = ${smId} AND status = 'pending'
            `

            sendWebhook(channel.notification_webhook_url, {
                embeds: [{
                    title: 'Match Ready to Report',
                    description: `**${sm.team1_name}** vs **${sm.team2_name}**${sm.week ? ` — Week ${sm.week}` : ''}`,
                    color: 0x5865F2, // Discord blurple
                    fields: [
                        { name: 'Screenshots', value: `${countRow?.count || '?'} collected`, inline: true },
                    ],
                    footer: { text: 'Report this match at smitecomp.com/admin' },
                    timestamp: new Date().toISOString(),
                }],
            }).catch(err => console.error('discord-match: webhook failed:', err.message))
        }
    }
}


/**
 * Sync Discord guild members to player records.
 * For each member with a mapped team role, update or flag player discord_id/discord_name.
 * Fire-and-forget — errors logged but not propagated.
 *
 * @param {object} sql - neon() database connection
 * @param {string} guildId - Discord guild ID
 * @param {object[]} members - Discord guild member objects
 */
export async function syncGuildMembers(sql, guildId, members) {
    if (!members?.length) return

    // Get all teams with discord_role_id for any active season in this guild's channels
    const teams = await sql`
        SELECT t.id as team_id, t.discord_role_id, t.season_id
        FROM teams t
        JOIN seasons s ON t.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN discord_channels dc ON dc.division_id = d.id AND dc.guild_id = ${guildId}
        WHERE t.discord_role_id IS NOT NULL AND s.is_active = true
    `
    if (!teams.length) return

    const teamRoleIds = new Set(teams.map(t => t.discord_role_id))
    let updated = 0

    for (const member of members) {
        const userId = member.user?.id
        const username = member.user?.global_name || member.user?.username
        if (!userId) continue

        // Check if this member has any team role
        const hasTeamRole = (member.roles || []).some(r => teamRoleIds.has(r))
        if (!hasTeamRole) continue

        // Update players.discord_id and discord_name where they match
        const result = await sql`
            UPDATE players
            SET discord_name = ${username || null},
                updated_at = NOW()
            WHERE discord_id = ${userId}
              AND (discord_name IS DISTINCT FROM ${username || null})
        `
        if (result.count > 0) updated++
    }

    if (updated > 0) {
        console.log(`discord-match: synced ${updated} player names for guild ${guildId}`)
    }
}
