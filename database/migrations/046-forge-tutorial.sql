-- 046: Forge Tutorial - free Sparks + challenge
-- Adds tutorial_fuel transaction type and seeds tutorial completion challenge

-- Allow tutorial_fuel in spark_transactions type constraint
ALTER TABLE spark_transactions DROP CONSTRAINT IF EXISTS spark_transactions_type_check;
ALTER TABLE spark_transactions ADD CONSTRAINT spark_transactions_type_check
    CHECK (type IN ('fuel', 'cool', 'liquidate', 'tutorial_fuel'));

-- Forge Apprentice challenge: 100 Passion for completing the tutorial
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES (
    'Forge Apprentice',
    'Complete the Fantasy Forge tutorial',
    'engagement', 'one_time', 100, 1, 'forge_tutorial_completed',
    305, 'clay', true, 'Forge Apprentice'
)
ON CONFLICT (title) DO NOTHING;
