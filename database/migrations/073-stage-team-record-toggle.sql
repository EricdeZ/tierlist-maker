-- Add toggle for whether a stage's matches count toward team records
-- Player stats always count, but team W/L records can be excluded per stage
ALTER TABLE season_stages ADD COLUMN counts_for_team_record BOOLEAN NOT NULL DEFAULT TRUE;
