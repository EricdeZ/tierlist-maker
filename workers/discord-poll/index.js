// Cloudflare Worker — Hourly Discord channel poller (Cron Trigger)
import { getDB } from '../../functions/lib/db.js'
import { pollChannel, syncBanList, fetchGuildRoles, fetchGuildMembers } from '../../functions/lib/discord.js'
import { autoMatchQueueItems, syncGuildMembers } from '../../functions/lib/discord-match.js'

export default {
    async scheduled(event, env, ctx) {
        // Populate process.env from Cloudflare env bindings
        for (const [key, value] of Object.entries(env)) {
            if (typeof value === 'string') {
                process.env[key] = value
            }
        }

        if (!process.env.DISCORD_BOT_TOKEN) {
            console.error('discord-poll: DISCORD_BOT_TOKEN not set, skipping')
            return
        }

        const sql = getDB()
        const channels = await sql`SELECT * FROM discord_channels WHERE is_active = true`

        if (!channels.length) {
            console.log('discord-poll: no active channels configured')
            return
        }

        // Fetch guild roles + members once per unique guild (cached for this poll cycle)
        const guildRolesMap = {}  // { guildId: Map<roleId, roleName> }
        const guildMembers = {}  // { guildId: [{ user, roles }] }
        const uniqueGuildIds = [...new Set(channels.map(c => c.guild_id))]

        for (const guildId of uniqueGuildIds) {
            try {
                const roles = await fetchGuildRoles(guildId)
                guildRolesMap[guildId] = new Map(roles.map(r => [r.id, r.name]))
                console.log(`discord-poll: fetched ${roles.length} roles for guild ${guildId}`)
            } catch (err) {
                console.error(`discord-poll: failed to fetch roles for guild ${guildId}:`, err.message)
                guildRolesMap[guildId] = new Map()
            }

            try {
                guildMembers[guildId] = await fetchGuildMembers(guildId)
                console.log(`discord-poll: fetched ${guildMembers[guildId].length} members for guild ${guildId}`)
            } catch (err) {
                console.error(`discord-poll: failed to fetch members for guild ${guildId}:`, err.message)
                guildMembers[guildId] = []
            }
        }

        // Sync guild members → player records
        for (const guildId of uniqueGuildIds) {
            if (guildMembers[guildId]?.length) {
                ctx.waitUntil(
                    syncGuildMembers(sql, guildId, guildMembers[guildId])
                        .catch(err => console.error(`discord-poll: member sync failed for guild ${guildId}:`, err.message))
                )
            }
        }

        // Poll each channel
        const results = []
        for (const channel of channels) {
            try {
                const roles = guildRolesMap[channel.guild_id] || new Map()
                const result = await pollChannel(sql, channel, roles)
                results.push({ channelId: channel.channel_id, ...result })
                console.log(`discord-poll: ${channel.channel_name || channel.channel_id} — ${result.newImages} new images from ${result.totalMessages} messages`)

                // Auto-match new queue items to scheduled matches
                if (result.newItemIds?.length) {
                    ctx.waitUntil(
                        autoMatchQueueItems(
                            sql,
                            result.newItemIds,
                            channel,
                            guildMembers[channel.guild_id] || [],
                        ).catch(err => {
                            console.error(`discord-poll: auto-match failed for ${channel.channel_name || channel.channel_id}:`, err.message)
                        })
                    )
                }
            } catch (err) {
                console.error(`discord-poll: error polling ${channel.channel_name || channel.channel_id}:`, err.message)
                results.push({ channelId: channel.channel_id, error: err.message })
            }
        }

        // Sync banned content lists
        const banConfigs = await sql`
            SELECT * FROM banned_content
            WHERE channel_id IS NOT NULL
        `
        for (const config of banConfigs) {
            try {
                await syncBanList(sql, config)
                console.log(`discord-poll: synced ban list for league ${config.league_id}`)
            } catch (err) {
                console.error(`discord-poll: error syncing ban list for league ${config.league_id}:`, err.message)
            }
        }

        console.log(`discord-poll: completed, ${results.length} channels processed`)
    },
}
