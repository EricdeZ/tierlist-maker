-- Migration 059: Forge starter sparks challenge
-- Rewards users for spending all 3 of their free Starter Sparks.

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Keep it rolling, here is more passion', 'Spend all 3 of your Starter Sparks', 'engagement', 'one_time', 80, 3, 'starter_sparks_used', 15, 'daily')
ON CONFLICT (title) DO NOTHING;
