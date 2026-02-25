-- Migration 050: Scrim challenges
-- Adds Passion challenges for scrim activity across all difficulty tiers.

-- ─── DAILY TIER ────────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Warm-Up Match', 'Post your first scrim request', 'scrim', 'one_time', 10, 1, 'scrims_posted', 20, 'daily')
ON CONFLICT (title) DO NOTHING;

-- ─── CLAY TIER ─────────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('First Contact', 'Complete your first scrim', 'scrim', 'one_time', 10, 1, 'scrims_completed', 20, 'clay')
ON CONFLICT (title) DO NOTHING;

-- ─── AMBER TIER ────────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Getting Reps', 'Complete 3 scrims', 'scrim', 'one_time', 15, 3, 'scrims_completed', 20, 'amber')
ON CONFLICT (title) DO NOTHING;

-- ─── BRONZE TIER ───────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Scrim Regular', 'Complete 5 scrims', 'scrim', 'one_time', 20, 5, 'scrims_completed', 20, 'bronze')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Matchmaker', 'Post 5 scrim requests', 'scrim', 'one_time', 20, 5, 'scrims_posted', 21, 'bronze')
ON CONFLICT (title) DO NOTHING;

-- ─── SILVER TIER ───────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Arena Veteran', 'Complete 10 scrims', 'scrim', 'one_time', 30, 10, 'scrims_completed', 20, 'silver')
ON CONFLICT (title) DO NOTHING;

-- ─── GOLD TIER ─────────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Call-Out King', 'Post 25 scrim requests', 'scrim', 'one_time', 40, 25, 'scrims_posted', 20, 'gold')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Proving Ground', 'Complete 20 scrims', 'scrim', 'one_time', 40, 20, 'scrims_completed', 21, 'gold')
ON CONFLICT (title) DO NOTHING;

-- ─── PLATINUM TIER ─────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Battle Tested', 'Complete 40 scrims', 'scrim', 'one_time', 55, 40, 'scrims_completed', 20, 'platinum')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Scrim Organizer', 'Post 50 scrim requests', 'scrim', 'one_time', 50, 50, 'scrims_posted', 21, 'platinum')
ON CONFLICT (title) DO NOTHING;

-- ─── DIAMOND TIER ──────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Scrim Addict', 'Complete 75 scrims', 'scrim', 'one_time', 80, 75, 'scrims_completed', 20, 'diamond')
ON CONFLICT (title) DO NOTHING;

-- ─── OBSIDIAN TIER ─────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('War Machine', 'Complete 125 scrims', 'scrim', 'one_time', 100, 125, 'scrims_completed', 20, 'obsidian')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Town Crier', 'Post 100 scrim requests', 'scrim', 'one_time', 95, 100, 'scrims_posted', 21, 'obsidian')
ON CONFLICT (title) DO NOTHING;

-- ─── MASTER TIER ───────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Warlord', 'Complete 200 scrims', 'scrim', 'one_time', 130, 200, 'scrims_completed', 20, 'master')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Scrim Lord', 'Post 200 scrim requests', 'scrim', 'one_time', 125, 200, 'scrims_posted', 21, 'master')
ON CONFLICT (title) DO NOTHING;

-- ─── DEMIGOD TIER (badge) ──────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Scrim Demigod', 'Complete 350 scrims', 'scrim', 'one_time', 165, 350, 'scrims_completed', 20, 'demigod', true, 'Scrim Demigod')
ON CONFLICT (title) DO NOTHING;

-- ─── DEITY TIER (badge) ────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Eternal Gladiator', 'Complete 500 scrims', 'scrim', 'one_time', 200, 500, 'scrims_completed', 20, 'deity', true, 'Eternal Gladiator')
ON CONFLICT (title) DO NOTHING;
