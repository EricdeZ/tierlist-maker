/* global process */
import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission, getLeagueIdFromSeason } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { updateMatchChallenges } from '../lib/challenges.js'
import { resolvePredictions } from '../lib/predictions.js'
import { updateForgeAfterMatch } from '../lib/forge/helpers.js'
import { sendChannelMessage } from '../lib/discord.js'
import { advanceFromMatch } from '../lib/advancement.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required' }) }
            }
            let body
            try {
                body = JSON.parse(event.body)
            } catch {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body' }) }
            }

            if (body.action === 'submit-match') {
                return await submitMatch(sql, body, admin, event)
            }

            if (body.action === 'batch-submit') {
                return await batchSubmit(sql, body, admin, event)
            }

            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Unknown action' }),
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        }
    } catch (error) {
        console.error('Admin write error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}

/**
 * Update league_player role/secondary_role based on their most recent games.
 * role = what they played last game, secondary_role = the game before that.
 */
async function updatePlayerRoles(sql, matchId) {
    const players = await sql`
        SELECT DISTINCT pgs.league_player_id FROM player_game_stats pgs
        JOIN league_players lp ON lp.id = pgs.league_player_id
        WHERE pgs.game_id IN (SELECT id FROM games WHERE match_id = ${matchId})
        AND pgs.role_played IS NOT NULL
        AND lp.roster_status != 'sub'
    `

    for (const { league_player_id } of players) {
        // Find primary role (most recent game)
        const [latest] = await sql`
            SELECT pgs.role_played
            FROM player_game_stats pgs
            JOIN games g ON g.id = pgs.game_id
            WHERE pgs.league_player_id = ${league_player_id}
            AND pgs.role_played IS NOT NULL
            ORDER BY g.id DESC
            LIMIT 1
        `

        if (latest) {
            const role = latest.role_played
            // Secondary = most recent game where they played a different role
            const [secondary] = await sql`
                SELECT pgs.role_played
                FROM player_game_stats pgs
                JOIN games g ON g.id = pgs.game_id
                WHERE pgs.league_player_id = ${league_player_id}
                AND pgs.role_played IS NOT NULL
                AND pgs.role_played != ${role}
                ORDER BY g.id DESC
                LIMIT 1
            `
            const secondaryRole = secondary?.role_played || null
            await sql`
                UPDATE league_players
                SET role = ${role}, secondary_role = ${secondaryRole}, updated_at = NOW()
                WHERE id = ${league_player_id}
            `
        }
    }
}

/**
 * Submit a single match with its games and player stats.
 * Expects pre-edited data from the admin dashboard.
 */
async function submitMatch(sql, body, admin, event) {
    const { season_id, team1_id, team2_id, week, date, best_of, games, scheduled_match_id } = body

    if (!season_id || !team1_id || !team2_id || !games?.length) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields: season_id, team1_id, team2_id, games' }),
        }
    }

    // Validate user has match_report permission for this league
    const leagueId = await getLeagueIdFromSeason(season_id)
    if (!leagueId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid season_id' }) }
    }
    const hasLeaguePerm = await requirePermission(event, 'match_report', leagueId)
    if (!hasLeaguePerm) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No permission for this league' }) }
    }

    // Validate teams belong to this season
    const teamCheck = await sql`
        SELECT id FROM teams WHERE id IN (${team1_id}, ${team2_id}) AND season_id = ${season_id}
    `
    const foundIds = new Set(teamCheck.map(r => r.id))
    if (!foundIds.has(team1_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Team 1 does not belong to the selected season' }) }
    }
    if (!foundIds.has(team2_id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Team 2 does not belong to the selected season' }) }
    }

    // Validate each game has a winner
    for (let i = 0; i < games.length; i++) {
        if (!games[i].winning_team_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Game ${i + 1} has no winner set` }),
            }
        }
    }

    // Count forfeits toward game wins but not toward player stats
    const hasForfeit = games.some(g => g.is_forfeit)

    // Determine match winner based on game wins
    const team1Wins = games.filter(g => String(g.winning_team_id) === String(team1_id)).length
    const team2Wins = games.filter(g => String(g.winning_team_id) === String(team2_id)).length

    let winnerTeamId = null
    if (team1Wins > team2Wins) winnerTeamId = team1_id
    else if (team2Wins > team1Wins) winnerTeamId = team2_id

    try {
        const result = await transaction(async (tx) => {
            // Cache for resolved league_player_ids within this transaction
            const playerCache = {}

            // Look up stage info from linked scheduled match
            let stageId = null, groupId = null, roundId = null
            if (scheduled_match_id) {
                const [smInfo] = await tx`SELECT stage_id, group_id, round_id FROM scheduled_matches WHERE id = ${scheduled_match_id}`
                if (smInfo) {
                    stageId = smInfo.stage_id
                    groupId = smInfo.group_id
                    roundId = smInfo.round_id
                }
            }

            // 1. Create the match
            const [match] = await tx`
                INSERT INTO matches (season_id, team1_id, team2_id, date, week, best_of, match_type, winner_team_id, is_completed, reported_by, stage_id, group_id, round_id)
                VALUES (${season_id}, ${team1_id}, ${team2_id}, ${date || new Date().toISOString().split('T')[0]}, ${week || null}, ${best_of || games.length}, 'regular', ${winnerTeamId}, true, ${admin.id}, ${stageId}, ${groupId}, ${roundId})
                RETURNING id
            `

            const matchId = match.id
            const gameResults = []

            // 2. Create each game and its player stats
            for (let i = 0; i < games.length; i++) {
                const game = games[i]

                const isForfeit = !!game.is_forfeit

                const [gameRow] = await tx`
                    INSERT INTO games (match_id, game_number, winner_team_id, is_completed, is_forfeit)
                    VALUES (${matchId}, ${i + 1}, ${game.winning_team_id}, true, ${isForfeit})
                    RETURNING id
                `

                const gameId = gameRow.id

                // Skip player stats entirely for forfeit games
                if (!isForfeit) {
                    const seenInGame = new Set()

                    // Insert team 1 players (team_side = 1)
                    for (const player of (game.team1_players || [])) {
                        const lpId = await resolveLeaguePlayerId(tx, player, team1_id, season_id, playerCache)
                        if (!lpId) {
                            throw new Error(`Game ${i + 1}: Could not resolve player "${player.player_name}" for team 1`)
                        }
                        if (seenInGame.has(lpId)) {
                            throw new Error(`Game ${i + 1}: "${player.player_name}" resolved to a player already in this game (duplicate name or alias conflict)`)
                        }
                        seenInGame.add(lpId)
                        await tx`
                            INSERT INTO player_game_stats (
                                game_id, league_player_id, team_side,
                                kills, deaths, assists, damage, mitigated, god_played,
                                gpm, structure_damage, self_healing, ally_healing, role_played
                            )
                            VALUES (
                                ${gameId}, ${lpId}, 1,
                                ${player.kills || 0}, ${player.deaths || 0}, ${player.assists || 0},
                                ${player.damage ?? null}, ${player.mitigated ?? null}, ${player.god_played || 'Unknown'},
                                ${player.gpm ?? null}, ${player.structure_damage ?? null},
                                ${player.self_healing ?? null}, ${player.ally_healing ?? null},
                                ${player.role_played || null}
                            )
                        `
                    }

                    // Insert team 2 players (team_side = 2)
                    for (const player of (game.team2_players || [])) {
                        const lpId = await resolveLeaguePlayerId(tx, player, team2_id, season_id, playerCache)
                        if (!lpId) {
                            throw new Error(`Game ${i + 1}: Could not resolve player "${player.player_name}" for team 2`)
                        }
                        if (seenInGame.has(lpId)) {
                            throw new Error(`Game ${i + 1}: "${player.player_name}" resolved to a player already in this game (duplicate name or alias conflict)`)
                        }
                        seenInGame.add(lpId)
                        await tx`
                            INSERT INTO player_game_stats (
                                game_id, league_player_id, team_side,
                                kills, deaths, assists, damage, mitigated, god_played,
                                gpm, structure_damage, self_healing, ally_healing, role_played
                            )
                            VALUES (
                                ${gameId}, ${lpId}, 2,
                                ${player.kills || 0}, ${player.deaths || 0}, ${player.assists || 0},
                                ${player.damage ?? null}, ${player.mitigated ?? null}, ${player.god_played || 'Unknown'},
                                ${player.gpm ?? null}, ${player.structure_damage ?? null},
                                ${player.self_healing ?? null}, ${player.ally_healing ?? null},
                                ${player.role_played || null}
                            )
                        `
                    }
                }

                gameResults.push({ game_id: gameId, game_number: i + 1 })
            }

            // Link scheduled match inside the transaction to prevent double-linking
            if (scheduled_match_id) {
                const [locked] = await tx`
                    SELECT id FROM scheduled_matches
                    WHERE id = ${scheduled_match_id} AND status = 'scheduled'
                    FOR UPDATE
                `
                if (locked) {
                    await tx`
                        UPDATE scheduled_matches
                        SET status = 'completed', match_id = ${matchId}, updated_at = NOW()
                        WHERE id = ${scheduled_match_id} AND status = 'scheduled'
                    `
                }
            }

            return { match_id: matchId, games: gameResults, scheduled_linked: !!scheduled_match_id }
        })

        if (admin) {
            await logAudit(sql, admin, { action: 'submit-match', endpoint: 'admin-write', leagueId, targetType: 'match', targetId: result.match_id, details: { season_id, team1_id, team2_id, week, games_count: games.length, scheduled_match_id: scheduled_match_id || null } })
        }

        // Push challenge progress for players in this match (fire-and-forget)
        event.waitUntil(
            updateMatchChallenges(sql, result.match_id)
                .catch(err => console.error('Match challenge update failed:', err))
        )

        // Resolve predictions for this scheduled match (fire-and-forget)
        if (scheduled_match_id && winnerTeamId) {
            event.waitUntil(
                resolvePredictions(sql, scheduled_match_id, winnerTeamId)
                    .catch(err => console.error('Prediction resolution failed:', err))
            )
            // Trigger bracket advancement
            event.waitUntil(
                advanceFromMatch(sql, scheduled_match_id)
                    .catch(err => console.error('Bracket advancement failed:', err))
            )
        }

        // Recalculate Fantasy Forge performance scores for the season (fire-and-forget)
        event.waitUntil(
            updateForgeAfterMatch(sql, result.match_id)
                .catch(err => console.error('Forge price update failed:', err))
        )

        // Update league_player roles based on recent games played (fire-and-forget)
        event.waitUntil(
            updatePlayerRoles(sql, result.match_id)
                .catch(err => console.error('Player role update failed:', err))
        )

        // Release report lock and notify Discord (fire-and-forget)
        if (scheduled_match_id) {
            event.waitUntil((async () => {
                try {
                    const [sm] = await sql`
                        SELECT t1.name as team1_name, t2.name as team2_name, sm.week
                        FROM scheduled_matches sm
                        JOIN teams t1 ON sm.team1_id = t1.id
                        JOIN teams t2 ON sm.team2_id = t2.id
                        WHERE sm.id = ${scheduled_match_id}
                    `
                    await sql`
                        UPDATE scheduled_matches
                        SET locked_by = NULL, locked_at = NULL
                        WHERE id = ${scheduled_match_id}
                    `
                    const channelId = process.env.DISCORD_REPORT_CHANNEL_ID
                    if (channelId && sm) {
                        const week = sm.week ? ` (Week ${sm.week})` : ''
                        await sendChannelMessage(channelId, {
                            content: `**${admin.discord_username}** reported **${sm.team1_name}** vs **${sm.team2_name}**${week}`,
                            flags: 4096,
                        })
                    }
                } catch (err) {
                    console.error('Lock release/notify failed:', err)
                }
            })())
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, ...result }),
        }
    } catch (error) {
        console.error('Submit match transaction error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        }
    }
}

/**
 * Batch submit: submits multiple matches sequentially.
 */
async function batchSubmit(sql, body, admin, event) {
    const { matches } = body
    if (!matches?.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No matches provided' }) }
    }

    const results = []
    for (const matchData of matches) {
        const res = await submitMatch(sql, { ...matchData, action: 'submit-match' }, admin, event)
        const data = JSON.parse(res.body)
        results.push({
            success: res.statusCode === 200,
            ...data,
        })
    }

    const successCount = results.filter(r => r.success).length
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            total: results.length,
            succeeded: successCount,
            failed: results.length - successCount,
            results,
        }),
    }
}

/**
 * Resolve a player's league_player_id.
 * Priority:
 * 1. If league_player_id is already provided (from the frontend search), use it
 * 2. Look up by exact name match in the season
 * 3. Look up globally by name or slug
 * 4. Create a new player + league_player entry as a sub (with unique slug)
 */
async function resolveLeaguePlayerId(tx, player, teamId, seasonId, cache) {
    // 1. Already resolved by frontend — validate it belongs to this season
    if (player.league_player_id) {
        const [valid] = await tx`
            SELECT id FROM league_players WHERE id = ${player.league_player_id} AND season_id = ${seasonId}
        `
        if (valid) return player.league_player_id
        // Wrong season — fall through to normal resolution
    }

    const name = (player.player_name || '').trim()
    if (!name) return null

    const cacheKey = `${name.toLowerCase()}_${seasonId}_${teamId}`
    if (cache[cacheKey]) return cache[cacheKey]

    // 2. Exact name match in this season
    const [exact] = await tx`
        SELECT lp.id
        FROM league_players lp
        JOIN players p ON lp.player_id = p.id
        WHERE LOWER(p.name) = ${name.toLowerCase()}
          AND lp.season_id = ${seasonId}
          AND lp.is_active = true
        LIMIT 1
    `
    if (exact) {
        cache[cacheKey] = exact.id
        return exact.id
    }

    // 2b. Alias match in this season
    const [aliasSeason] = await tx`
        SELECT lp.id
        FROM player_aliases pa
        JOIN players p ON pa.player_id = p.id
        JOIN league_players lp ON lp.player_id = p.id
        WHERE LOWER(pa.alias) = ${name.toLowerCase()}
          AND lp.season_id = ${seasonId}
          AND lp.is_active = true
        LIMIT 1
    `
    if (aliasSeason) {
        cache[cacheKey] = aliasSeason.id
        return aliasSeason.id
    }

    // 3. Check if player exists globally — by name first, then by slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'

    let playerId

    const [byName] = await tx`
        SELECT id FROM players WHERE LOWER(name) = ${name.toLowerCase()} LIMIT 1
    `
    if (byName) {
        playerId = byName.id
    }

    // 3b. Check aliases globally
    if (!playerId) {
        const [byAlias] = await tx`
            SELECT player_id FROM player_aliases
            WHERE LOWER(alias) = ${name.toLowerCase()}
            LIMIT 1
        `
        if (byAlias) playerId = byAlias.player_id
    }

    if (!playerId) {
        // Check by slug — e.g. "Bi€€Cosby" slugifies to "bi-cosby" which may match existing "BiggCosby"
        const [bySlug] = await tx`
            SELECT id FROM players WHERE slug = ${slug} LIMIT 1
        `
        if (bySlug) {
            playerId = bySlug.id
        } else {
            // Create new player — ensure unique slug
            let finalSlug = slug
            const [slugExists] = await tx`
                SELECT 1 FROM players WHERE slug = ${finalSlug} LIMIT 1
            `
            if (slugExists) {
                // Append random suffix to make unique
                finalSlug = `${slug}-${Date.now().toString(36).slice(-4)}`
            }
            const [newPlayer] = await tx`
                INSERT INTO players (name, slug) VALUES (${name}, ${finalSlug}) RETURNING id
            `
            playerId = newPlayer.id
        }
    }

    // Check if they already have a league_player entry for this season (maybe inactive)
    const [existingLp] = await tx`
        SELECT id FROM league_players
        WHERE player_id = ${playerId} AND season_id = ${seasonId}
        LIMIT 1
    `

    if (existingLp) {
        cache[cacheKey] = existingLp.id
        return existingLp.id
    }

    // Create league_player as sub
    const [newLp] = await tx`
        INSERT INTO league_players (player_id, team_id, season_id, roster_status, is_active)
        VALUES (${playerId}, ${teamId}, ${seasonId}, 'sub', true)
        RETURNING id
    `

    cache[cacheKey] = newLp.id
    return newLp.id
}
export const onRequest = adapt(handler)
