-- Fix: forge cool/liquidate was counting full proceeds toward total_earned (lifetime).
-- Only profit (sell proceeds - cost basis) should count.
-- This recalculates the over-count per user and subtracts it from total_earned.

-- Preview what will change (run this SELECT first to verify):
/*
WITH forge_sells AS (
    SELECT user_id, COALESCE(SUM(amount), 0) AS total_sell_passion
    FROM passion_transactions
    WHERE type IN ('forge_cool', 'forge_liquidate') AND amount > 0
    GROUP BY user_id
),
fuel_spent AS (
    SELECT user_id, COALESCE(SUM(total_cost), 0) AS total_bought
    FROM spark_transactions
    WHERE type = 'fuel'
    GROUP BY user_id
),
remaining AS (
    SELECT user_id, COALESCE(SUM(total_invested), 0) AS still_invested
    FROM spark_holdings
    GROUP BY user_id
),
adjustments AS (
    SELECT
        fs.user_id,
        fs.total_sell_passion,
        COALESCE(fb.total_bought, 0) AS total_bought,
        COALESCE(r.still_invested, 0) AS still_invested,
        fs.total_sell_passion - COALESCE(fb.total_bought, 0) + COALESCE(r.still_invested, 0) AS actual_profit,
        fs.total_sell_passion - GREATEST(0, fs.total_sell_passion - COALESCE(fb.total_bought, 0) + COALESCE(r.still_invested, 0)) AS over_count
    FROM forge_sells fs
    LEFT JOIN fuel_spent fb ON fs.user_id = fb.user_id
    LEFT JOIN remaining r ON fs.user_id = r.user_id
)
SELECT a.user_id, pb.total_earned AS old_total_earned,
       pb.total_earned - a.over_count AS new_total_earned,
       a.over_count, a.total_sell_passion, a.total_bought, a.still_invested, a.actual_profit
FROM adjustments a
JOIN passion_balances pb ON a.user_id = pb.user_id
WHERE a.over_count > 0
ORDER BY a.over_count DESC;
*/

-- Apply the fix:
WITH forge_sells AS (
    SELECT user_id, COALESCE(SUM(amount), 0) AS total_sell_passion
    FROM passion_transactions
    WHERE type IN ('forge_cool', 'forge_liquidate') AND amount > 0
    GROUP BY user_id
),
fuel_spent AS (
    SELECT user_id, COALESCE(SUM(total_cost), 0) AS total_bought
    FROM spark_transactions
    WHERE type = 'fuel'
    GROUP BY user_id
),
remaining AS (
    SELECT user_id, COALESCE(SUM(total_invested), 0) AS still_invested
    FROM spark_holdings
    GROUP BY user_id
),
adjustments AS (
    SELECT
        fs.user_id,
        -- over_count = total forge passion received - max(0, actual profit)
        -- actual profit = sell proceeds - cost basis of sold sparks
        -- cost basis of sold = total bought - still invested
        fs.total_sell_passion - GREATEST(0, fs.total_sell_passion - COALESCE(fb.total_bought, 0) + COALESCE(r.still_invested, 0)) AS over_count
    FROM forge_sells fs
    LEFT JOIN fuel_spent fb ON fs.user_id = fb.user_id
    LEFT JOIN remaining r ON fs.user_id = r.user_id
)
UPDATE passion_balances pb
SET total_earned = GREATEST(0, pb.total_earned - a.over_count),
    updated_at = NOW()
FROM adjustments a
WHERE pb.user_id = a.user_id
  AND a.over_count > 0;
