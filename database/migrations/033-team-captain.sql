-- Migration 033: Team Captain
-- Adds is_captain flag to league_players. One captain per team per season.

ALTER TABLE league_players ADD COLUMN is_captain BOOLEAN NOT NULL DEFAULT false;

-- Partial unique index: enforce at most one active captain per team+season
CREATE UNIQUE INDEX uq_one_captain_per_team_season
    ON league_players (team_id, season_id)
    WHERE is_captain = true AND is_active = true;
