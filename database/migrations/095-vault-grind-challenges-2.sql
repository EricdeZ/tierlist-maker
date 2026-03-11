-- More grindy vault challenges: rarity collection, marketplace volume, spending, gifts

-- ═══ Extended: gifts_opened ═══
-- Current max: 1 (amber)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Gift Unwrapper',    'Open 3 gift packs',  'vault', 'one_time', 10, 15, 3,  'gifts_opened', 302, 'bronze',   true),
  ('Gift Enthusiast',   'Open 10 gift packs', 'vault', 'one_time', 15, 20, 10, 'gifts_opened', 303, 'silver',   true),
  ('Gift Addict',       'Open 25 gift packs', 'vault', 'one_time', 20, 40, 25, 'gifts_opened', 304, 'gold',     true),
  ('Gift Connoisseur',  'Open 50 gift packs', 'vault', 'one_time', 25, 75, 50, 'gifts_opened', 305, 'platinum', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: marketplace_bought ═══
-- Current max: 75 (platinum) from migration 094
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Compulsive Buyer',  'Buy 150 cards from the marketplace', 'vault', 'one_time', 30, 100, 150, 'marketplace_bought', 306, 'diamond',  true),
  ('Market Addict',     'Buy 300 cards from the marketplace', 'vault', 'one_time', 35, 150, 300, 'marketplace_bought', 307, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: legendary_cards_owned (new stat key) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Legendary Stash',     'Own 5 legendary cards',   'vault', 'one_time', 15, 20,  5,   'legendary_cards_owned', 308, 'silver',   true),
  ('Legendary Arsenal',   'Own 15 legendary cards',  'vault', 'one_time', 20, 40,  15,  'legendary_cards_owned', 309, 'gold',     true),
  ('Legendary Vault',     'Own 30 legendary cards',  'vault', 'one_time', 25, 75,  30,  'legendary_cards_owned', 310, 'platinum', true),
  ('Legendary Fortress',  'Own 50 legendary cards',  'vault', 'one_time', 30, 100, 50,  'legendary_cards_owned', 311, 'diamond',  true),
  ('Legendary Hoard',     'Own 100 legendary cards', 'vault', 'one_time', 35, 150, 100, 'legendary_cards_owned', 312, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: epic_cards_owned (new stat key — epic or better) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Epic Collector',     'Own 25 epic or better cards',  'vault', 'one_time', 15, 20,  25,  'epic_cards_owned', 313, 'silver',   true),
  ('Epic Stockpile',     'Own 75 epic or better cards',  'vault', 'one_time', 20, 40,  75,  'epic_cards_owned', 314, 'gold',     true),
  ('Epic Treasury',      'Own 150 epic or better cards', 'vault', 'one_time', 25, 75,  150, 'epic_cards_owned', 315, 'platinum', true),
  ('Epic Armory',        'Own 300 epic or better cards', 'vault', 'one_time', 30, 100, 300, 'epic_cards_owned', 316, 'diamond',  true),
  ('Epic Dominion',      'Own 500 epic or better cards', 'vault', 'one_time', 35, 150, 500, 'epic_cards_owned', 317, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: marketplace_volume (new stat key — lifetime Cores earned from sales) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Sales Revenue',      'Earn 500 Cores from marketplace sales',    'vault', 'one_time', 15, 20,  500,   'marketplace_volume', 318, 'silver',   true),
  ('Profitable Seller',  'Earn 2500 Cores from marketplace sales',   'vault', 'one_time', 20, 40,  2500,  'marketplace_volume', 319, 'gold',     true),
  ('Sales Machine',      'Earn 10000 Cores from marketplace sales',  'vault', 'one_time', 25, 75,  10000, 'marketplace_volume', 320, 'platinum', true),
  ('Sales Baron',        'Earn 25000 Cores from marketplace sales',  'vault', 'one_time', 30, 100, 25000, 'marketplace_volume', 321, 'diamond',  true),
  ('Sales Emperor',      'Earn 75000 Cores from marketplace sales',  'vault', 'one_time', 35, 150, 75000, 'marketplace_volume', 322, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: total_cores_spent (new stat key — lifetime Cores spent on packs + marketplace) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Spender',            'Spend 1000 Cores total',   'vault', 'one_time', 15, 20,  1000,   'total_cores_spent', 323, 'silver',   true),
  ('Big Spender',        'Spend 5000 Cores total',   'vault', 'one_time', 20, 40,  5000,   'total_cores_spent', 324, 'gold',     true),
  ('High Roller',        'Spend 15000 Cores total',  'vault', 'one_time', 25, 75,  15000,  'total_cores_spent', 325, 'platinum', true),
  ('Whale',              'Spend 50000 Cores total',  'vault', 'one_time', 30, 100, 50000,  'total_cores_spent', 326, 'diamond',  true),
  ('Deep Pockets',       'Spend 150000 Cores total', 'vault', 'one_time', 35, 150, 150000, 'total_cores_spent', 327, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;
