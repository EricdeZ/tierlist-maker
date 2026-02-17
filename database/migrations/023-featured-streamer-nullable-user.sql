-- Migration 023: Allow non-user featured streamers
-- Makes user_id nullable so streams can exist without a linked site user.
-- Adds display_name column for all streamers (used as fallback when no user).

ALTER TABLE featured_streamers ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE featured_streamers ADD COLUMN IF NOT EXISTS display_name varchar(100);

-- Backfill display_name for existing rows from their linked user's discord_username
UPDATE featured_streamers fs
SET display_name = u.discord_username
FROM users u
WHERE fs.user_id = u.id
  AND fs.display_name IS NULL;
