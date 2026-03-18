-- 121-tournament-signup-role.sql
-- Replace applying_as_captain boolean with signup_role (player/captain/both)

ALTER TABLE tournament_signups DROP CONSTRAINT IF EXISTS tournament_signups_check;
ALTER TABLE tournament_signups ADD COLUMN signup_role VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (signup_role IN ('player', 'captain', 'both'));
UPDATE tournament_signups SET signup_role = CASE WHEN applying_as_captain THEN 'both' ELSE 'player' END;
ALTER TABLE tournament_signups DROP COLUMN applying_as_captain;
ALTER TABLE tournament_signups ADD CONSTRAINT captain_draft_check CHECK (signup_role = 'player' OR available_draft_date = true);
