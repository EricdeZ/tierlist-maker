-- Fix rotating challenge baselines broken by:
-- 1) trades_count / marketplace_sold_count not included in getVaultStats SELECT
-- 2) packs_opened baseline using cc_pack_opens (no historical data) vs cc_stats
--
-- Delete all unclaimed assignments for the current period so rollAssignments
-- recreates them with correct baselines on the next stat push.

DELETE FROM cc_challenge_assignments
WHERE claimed = false
  AND period_end > NOW();
