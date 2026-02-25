-- Migration 055: Replace is_captain + role='sub' with roster_status enum
-- Values: 'member' (default), 'captain', 'sub'

-- Add new column
ALTER TABLE league_players ADD COLUMN roster_status VARCHAR(20) NOT NULL DEFAULT 'member';

-- Backfill captains
UPDATE league_players SET roster_status = 'captain' WHERE is_captain = true;

-- Backfill subs (players whose role is 'sub')
UPDATE league_players SET roster_status = 'sub' WHERE LOWER(role) = 'sub';

-- Drop old captain column and its partial unique index
DROP INDEX IF EXISTS uq_one_captain_per_team_season;
ALTER TABLE league_players DROP COLUMN is_captain;

-- New partial unique index: one captain per team per active season
CREATE UNIQUE INDEX uq_one_captain_per_team_season
    ON league_players (team_id, season_id)
    WHERE roster_status = 'captain' AND is_active = true;

-- Clean up role for players that had role='sub' — set to null since their actual role is unknown
UPDATE league_players SET role = NULL WHERE LOWER(role) = 'sub';
