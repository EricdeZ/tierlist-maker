import { getDB, headers, getHeaders, handleCors } from './lib/db.js'

export const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const { slug } = event.queryStringParameters || {}
    if (!slug) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug parameter required' }) }
    }

    const sql = getDB()

    try {
        // 1. Player info + claim status
        const [player] = await sql`
            SELECT
                p.id, p.name, p.slug, p.discord_name, p.tracker_url,
                u.discord_id AS claimed_discord_id,
                u.discord_username AS claimed_discord_username,
                u.discord_avatar AS claimed_discord_avatar,
                CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
            FROM players p
            LEFT JOIN users u ON u.linked_player_id = p.id
            WHERE p.slug = ${slug}
        `

        if (!player) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player not found' }) }
        }

        // Fetch passion rank data (if claimed user exists)
        const [passionRow] = player.is_claimed ? await sql`
            SELECT pb.balance, pb.total_earned
            FROM passion_balances pb
            JOIN users u ON u.id = pb.user_id
            WHERE u.linked_player_id = ${player.id}
        ` : [null]

        // 2, 3, 4, 5 in parallel
        const [leagueBreakdowns, seasonHistory, gameHistory, badges] = await Promise.all([
            // Per-league aggregate stats
            sql`
                SELECT
                    l.id AS league_id,
                    l.name AS league_name,
                    l.slug AS league_slug,
                    l.color AS league_color,
                    COUNT(DISTINCT pgs.game_id) AS games_played,
                    COUNT(DISTINCT pgs.game_id) FILTER (
                        WHERE g.winner_team_id = CASE pgs.team_side
                            WHEN 1 THEN m.team1_id
                            WHEN 2 THEN m.team2_id
                        END
                    ) AS wins,
                    COALESCE(SUM(pgs.kills), 0) AS total_kills,
                    COALESCE(SUM(pgs.deaths), 0) AS total_deaths,
                    COALESCE(SUM(pgs.assists), 0) AS total_assists,
                    COALESCE(SUM(NULLIF(pgs.damage, 0)), 0) AS total_damage,
                    COALESCE(SUM(NULLIF(pgs.mitigated, 0)), 0) AS total_mitigated
                FROM player_game_stats pgs
                JOIN league_players lp ON pgs.league_player_id = lp.id
                JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                JOIN matches m ON g.match_id = m.id
                JOIN seasons s ON lp.season_id = s.id
                JOIN leagues l ON s.league_id = l.id
                WHERE lp.player_id = ${player.id}
                GROUP BY l.id, l.name, l.slug, l.color
                ORDER BY games_played DESC
            `,
            // Season participation history
            sql`
                SELECT
                    s.id AS season_id,
                    s.name AS season_name,
                    s.slug AS season_slug,
                    s.is_active,
                    s.start_date,
                    d.name AS division_name,
                    d.slug AS division_slug,
                    d.tier AS division_tier,
                    l.id AS league_id,
                    l.name AS league_name,
                    l.slug AS league_slug,
                    l.color AS league_color,
                    t.name AS team_name,
                    t.color AS team_color,
                    t.slug AS team_slug,
                    lp.role,
                    lp.secondary_role,
                    COUNT(DISTINCT pgs.game_id) AS games_played,
                    COUNT(DISTINCT pgs.game_id) FILTER (
                        WHERE g.winner_team_id = CASE pgs.team_side
                            WHEN 1 THEN m.team1_id
                            WHEN 2 THEN m.team2_id
                        END
                    ) AS wins,
                    COALESCE(SUM(pgs.kills), 0) AS total_kills,
                    COALESCE(SUM(pgs.deaths), 0) AS total_deaths,
                    COALESCE(SUM(pgs.assists), 0) AS total_assists
                FROM league_players lp
                JOIN seasons s ON lp.season_id = s.id
                JOIN divisions d ON s.division_id = d.id
                JOIN leagues l ON s.league_id = l.id
                LEFT JOIN teams t ON lp.team_id = t.id
                LEFT JOIN player_game_stats pgs ON pgs.league_player_id = lp.id
                LEFT JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                LEFT JOIN matches m ON g.match_id = m.id
                WHERE lp.player_id = ${player.id}
                GROUP BY s.id, s.name, s.slug, s.is_active, s.start_date,
                         d.name, d.slug, d.tier,
                         l.id, l.name, l.slug, l.color,
                         t.name, t.color, t.slug,
                         lp.role, lp.secondary_role
                ORDER BY s.is_active DESC, s.start_date DESC
            `,
            // All game history across all seasons
            sql`
                SELECT
                    g.id AS game_id,
                    g.game_number,
                    m.id AS match_id,
                    m.date,
                    m.team1_id,
                    m.team2_id,
                    t1.name AS team1_name,
                    t1.color AS team1_color,
                    t1.slug AS team1_slug,
                    t2.name AS team2_name,
                    t2.color AS team2_color,
                    t2.slug AS team2_slug,
                    g.winner_team_id,
                    pgs.kills,
                    pgs.deaths,
                    pgs.assists,
                    pgs.damage,
                    pgs.mitigated,
                    pgs.god_played,
                    pgs.team_side,
                    CASE pgs.team_side
                        WHEN 1 THEN m.team1_id
                        WHEN 2 THEN m.team2_id
                    END AS player_team_id,
                    l.id AS league_id,
                    l.name AS league_name,
                    l.slug AS league_slug,
                    l.color AS league_color,
                    d.name AS division_name,
                    d.slug AS division_slug,
                    d.tier AS division_tier,
                    s.name AS season_name
                FROM player_game_stats pgs
                JOIN league_players lp ON pgs.league_player_id = lp.id
                JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
                JOIN matches m ON g.match_id = m.id
                JOIN teams t1 ON m.team1_id = t1.id
                JOIN teams t2 ON m.team2_id = t2.id
                JOIN seasons s ON lp.season_id = s.id
                JOIN divisions d ON s.division_id = d.id
                JOIN leagues l ON s.league_id = l.id
                WHERE lp.player_id = ${player.id}
                ORDER BY m.date DESC, g.game_number DESC
            `,
            // Completed badge challenges for this player's linked user
            player.is_claimed ? sql`
                SELECT c.badge_label, c.tier, c.title, uc.completed_at
                FROM user_challenges uc
                JOIN challenges c ON c.id = uc.challenge_id
                JOIN users u ON u.id = uc.user_id
                WHERE u.linked_player_id = ${player.id}
                  AND uc.completed = true
                  AND c.gives_badge = true
                  AND c.is_active = true
                ORDER BY uc.completed_at DESC
            ` : [],
        ])

        // Compute allTimeStats from leagueBreakdowns
        const allTimeStats = leagueBreakdowns.reduce((acc, lb) => ({
            games_played: acc.games_played + parseInt(lb.games_played),
            wins: acc.wins + parseInt(lb.wins),
            total_kills: acc.total_kills + parseInt(lb.total_kills),
            total_deaths: acc.total_deaths + parseInt(lb.total_deaths),
            total_assists: acc.total_assists + parseInt(lb.total_assists),
            total_damage: acc.total_damage + parseInt(lb.total_damage),
            total_mitigated: acc.total_mitigated + parseInt(lb.total_mitigated),
        }), { games_played: 0, wins: 0, total_kills: 0, total_deaths: 0, total_assists: 0, total_damage: 0, total_mitigated: 0 })

        return {
            statusCode: 200,
            headers: getHeaders(event),
            body: JSON.stringify({
                player: {
                    id: player.id,
                    name: player.name,
                    slug: player.slug,
                    discord_name: player.discord_name,
                    tracker_url: player.tracker_url,
                    is_claimed: player.is_claimed,
                    discord_id: player.claimed_discord_id,
                    discord_username: player.claimed_discord_username,
                    discord_avatar: player.claimed_discord_avatar,
                    passion_balance: passionRow?.balance ?? null,
                    total_earned: passionRow?.total_earned ?? null,
                },
                allTimeStats,
                leagueBreakdowns,
                seasonHistory,
                gameHistory,
                badges,
            }),
        }
    } catch (error) {
        console.error('Player profile error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}
