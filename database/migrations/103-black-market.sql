-- Black Market: add Brudih turn-in tracking columns to cc_stats
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS brudihs_turned_in INTEGER DEFAULT 0;
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS pending_mythic_claim INTEGER DEFAULT 0;
