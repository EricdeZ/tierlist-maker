-- Add target_god_id to bounties for variant-specific targeting
ALTER TABLE cc_bounties ADD COLUMN IF NOT EXISTS target_god_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_bounties_target_god ON cc_bounties(target_god_id) WHERE target_god_id IS NOT NULL;
