-- Normalize all role values to lowercase everywhere
-- Fixes Starting Five slot mismatches caused by title-case roles (e.g. 'Solo' vs 'solo')

UPDATE league_players SET role = LOWER(role) WHERE role IS DISTINCT FROM LOWER(role);
UPDATE league_players SET secondary_role = LOWER(secondary_role) WHERE secondary_role IS DISTINCT FROM LOWER(secondary_role);
UPDATE cc_player_defs SET role = LOWER(role) WHERE role IS DISTINCT FROM LOWER(role);
UPDATE cc_cards SET role = LOWER(role) WHERE role IS DISTINCT FROM LOWER(role);
UPDATE player_game_stats SET role_played = LOWER(role_played) WHERE role_played IS DISTINCT FROM LOWER(role_played);
UPDATE players SET main_role = LOWER(main_role) WHERE main_role IS DISTINCT FROM LOWER(main_role);
UPDATE players SET secondary_role = LOWER(secondary_role) WHERE secondary_role IS DISTINCT FROM LOWER(secondary_role);
