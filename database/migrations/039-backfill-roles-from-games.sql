-- Migration 039: Backfill league_player roles from game history
-- Sets role = most recent role_played, secondary_role = most recent different role_played

WITH primary_roles AS (
    SELECT DISTINCT ON (pgs.league_player_id)
        pgs.league_player_id,
        pgs.role_played
    FROM player_game_stats pgs
    JOIN games g ON g.id = pgs.game_id
    WHERE pgs.role_played IS NOT NULL
    ORDER BY pgs.league_player_id, g.id DESC
),
secondary_roles AS (
    SELECT DISTINCT ON (pgs.league_player_id)
        pgs.league_player_id,
        pgs.role_played
    FROM player_game_stats pgs
    JOIN games g ON g.id = pgs.game_id
    JOIN primary_roles pr ON pr.league_player_id = pgs.league_player_id
    WHERE pgs.role_played IS NOT NULL
      AND pgs.role_played != pr.role_played
    ORDER BY pgs.league_player_id, g.id DESC
)
UPDATE league_players lp
SET role = pr.role_played,
    secondary_role = sr.role_played,
    updated_at = NOW()
FROM primary_roles pr
LEFT JOIN secondary_roles sr ON sr.league_player_id = pr.league_player_id
WHERE lp.id = pr.league_player_id;
