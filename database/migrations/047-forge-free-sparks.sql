-- 047: Forge Free Sparks — non-coolable tutorial Sparks + engagement challenges
-- Adds tutorial_sparks tracking column and seeds 11-tier challenge progression

-- ═══════════════════════════════════════════════════
-- 1. Add tutorial_sparks column to spark_holdings
-- ═══════════════════════════════════════════════════
ALTER TABLE spark_holdings
    ADD COLUMN IF NOT EXISTS tutorial_sparks INTEGER NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════
-- 2. Update Forge Apprentice reward from 100 → 125
-- ═══════════════════════════════════════════════════
UPDATE challenges SET reward = 125
WHERE title = 'Forge Apprentice' AND stat_key = 'forge_tutorial_completed';

-- ═══════════════════════════════════════════════════
-- 3. Seed Forge engagement challenges (no Passion spending required)
--    Total across all 11 tiers: 450 Passion
--    First 5 tiers (Clay→Gold): 255 Passion (reachable in ~1 month)
-- ═══════════════════════════════════════════════════

-- Amber (40) — Visit the Forge on 3 different days
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Ember Watch',
    'Visit the Fantasy Forge on 3 different days',
    'engagement', 'one_time', 40, 3, 'forge_days_visited',
    306, 'amber'
) ON CONFLICT (title) DO NOTHING;

-- Bronze (35) — Hold through 2 performance updates
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Holding Steady',
    'Hold Sparks through 2 performance updates',
    'engagement', 'one_time', 35, 2, 'forge_perf_updates_held',
    307, 'bronze'
) ON CONFLICT (title) DO NOTHING;

-- Silver (30) — Visit the Forge on 10 different days
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Forge Regular',
    'Visit the Fantasy Forge on 10 different days',
    'engagement', 'one_time', 30, 10, 'forge_days_visited',
    308, 'silver'
) ON CONFLICT (title) DO NOTHING;

-- Gold (25) — Hold Sparks for 14 days
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Diamond Hands',
    'Hold Sparks for 14 days',
    'engagement', 'one_time', 25, 14, 'forge_days_holding',
    309, 'gold'
) ON CONFLICT (title) DO NOTHING;

-- Platinum (40) — Hold through 5 performance updates
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Tempered Investor',
    'Hold Sparks through 5 performance updates',
    'engagement', 'one_time', 40, 5, 'forge_perf_updates_held',
    310, 'platinum'
) ON CONFLICT (title) DO NOTHING;

-- Diamond (35) — Visit the Forge on 30 different days
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Forge Veteran',
    'Visit the Fantasy Forge on 30 different days',
    'engagement', 'one_time', 35, 30, 'forge_days_visited',
    311, 'diamond'
) ON CONFLICT (title) DO NOTHING;

-- Obsidian (35) — Hold Sparks for 45 days
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Ironclad',
    'Hold Sparks for 45 days',
    'engagement', 'one_time', 35, 45, 'forge_days_holding',
    312, 'obsidian'
) ON CONFLICT (title) DO NOTHING;

-- Master (30) — Hold through 8 performance updates
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Forgeborn',
    'Hold Sparks through 8 performance updates',
    'engagement', 'one_time', 30, 8, 'forge_perf_updates_held',
    313, 'master'
) ON CONFLICT (title) DO NOTHING;

-- Demigod (30) — Visit the Forge on 60 different days
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Eternal Flame',
    'Visit the Fantasy Forge on 60 different days',
    'engagement', 'one_time', 30, 60, 'forge_days_visited',
    314, 'demigod'
) ON CONFLICT (title) DO NOTHING;

-- Deity (25) — Hold through 10 performance updates
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES (
    'Undying Ember',
    'Hold Sparks through 10 performance updates',
    'engagement', 'one_time', 25, 10, 'forge_perf_updates_held',
    315, 'deity'
) ON CONFLICT (title) DO NOTHING;
