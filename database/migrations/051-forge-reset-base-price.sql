-- 051: Reset Forge base price to 50
-- Clears all existing holdings, transactions, and price history,
-- then resets all spark prices and market base_price to 50.

-- Clear all user holdings
DELETE FROM spark_holdings;

-- Clear all transaction history
DELETE FROM spark_transactions;

-- Clear all price history
DELETE FROM spark_price_history;

-- Reset all spark prices to 50 with fresh multiplier
UPDATE player_sparks SET
    current_price = 50.00,
    total_sparks = 0,
    perf_multiplier = 1.0000,
    updated_at = NOW();

-- Update market base_price
UPDATE forge_markets SET base_price = 50;

-- Reset forge-related challenge progress so users can re-earn
UPDATE user_challenges SET current_value = 0, completed = false, completed_at = NULL
WHERE challenge_id IN (
    SELECT id FROM challenges
    WHERE stat_key IN ('sparks_fueled', 'sparks_cooled', 'forge_profit',
                       'forge_days_visited', 'forge_tutorial_completed',
                       'forge_perf_updates_held', 'forge_days_holding')
);
