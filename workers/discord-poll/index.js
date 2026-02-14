// Cloudflare Worker — Hourly Discord channel poller (Cron Trigger)
import { getDB } from '../../functions/lib/db.js'
import { pollChannel, syncBanList } from '../../functions/lib/discord.js'

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

        const results = []
        for (const channel of channels) {
            try {
                const result = await pollChannel(sql, channel)
                results.push({ channelId: channel.channel_id, ...result })
                console.log(`discord-poll: ${channel.channel_name || channel.channel_id} — ${result.newImages} new images from ${result.totalMessages} messages`)
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
