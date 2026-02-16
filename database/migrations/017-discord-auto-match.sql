-- Migration 017: Discord Auto-Match
-- Adds team ↔ Discord role mapping, auto-match suggestions on queue items,
-- and webhook notification support for discord channels.

-- Team ↔ Discord role mapping (explicit, since role names/suffixes aren't consistent)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS discord_role_id VARCHAR(32);

-- Auto-match suggestion: links queue items to likely scheduled matches
ALTER TABLE discord_queue ADD COLUMN IF NOT EXISTS suggested_match_id INTEGER
    REFERENCES scheduled_matches(id) ON DELETE SET NULL;

-- Discord webhook URL for "ready to report" notifications
ALTER TABLE discord_channels ADD COLUMN IF NOT EXISTS notification_webhook_url TEXT;

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_discord_queue_suggested
    ON discord_queue(suggested_match_id) WHERE suggested_match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_discord_role
    ON teams(discord_role_id) WHERE discord_role_id IS NOT NULL;
