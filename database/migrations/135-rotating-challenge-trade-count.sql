-- Fix rotating trade/marketplace challenges using COUNT(DISTINCT partner)
-- with baseline subtraction. This only credits NEW unique partners never
-- traded with before, so trading with existing partners shows 0 progress.
--
-- Switch rotating challenges to trades_count / marketplace_sold_count
-- (total COUNT(*)) so the baseline approach correctly tracks activity
-- within each period. One-time challenges keep trades_completed /
-- marketplace_sold (distinct partners, no baseline needed).

-- ═══ Rotating: trades_completed → trades_count ═══
UPDATE cc_challenge_templates SET stat_key = 'trades_count', description = 'Complete 2 trades today' WHERE title = 'Trade for Packs';
UPDATE cc_challenge_templates SET stat_key = 'trades_count', description = 'Complete 5 trades this week' WHERE title = 'Trade Master';
UPDATE cc_challenge_templates SET stat_key = 'trades_count', description = 'Complete 15 trades this month' WHERE title = 'Trading Empire';

-- ═══ Rotating: marketplace_sold → marketplace_sold_count ═══
UPDATE cc_challenge_templates SET stat_key = 'marketplace_sold_count', description = 'Sell 3 cards on the marketplace today' WHERE title = 'Market Seller' AND stat_key = 'marketplace_sold';
UPDATE cc_challenge_templates SET stat_key = 'marketplace_sold_count', description = 'Sell 12 cards on the marketplace this week' WHERE title = 'Marketplace Regular';
UPDATE cc_challenge_templates SET stat_key = 'marketplace_sold_count', description = 'Sell 40 cards on the marketplace this month' WHERE title = 'Market Mogul' AND stat_key = 'marketplace_sold';

-- Delete in-progress assignments for affected templates. Old baselines
-- were computed from the distinct-partner stat and can't be reused with
-- the total-count stat (would cause instant completions). These
-- challenges were broken anyway, so users lose nothing. They'll get
-- correctly baselined assignments on the next period roll.
DELETE FROM cc_challenge_assignments
WHERE completed = false
  AND claimed = false
  AND template_id IN (
    SELECT id FROM cc_challenge_templates
    WHERE stat_key IN ('trades_count', 'marketplace_sold_count')
  );
