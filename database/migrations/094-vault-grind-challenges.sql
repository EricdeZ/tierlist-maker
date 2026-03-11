-- Extended vault challenges: higher tiers for long-term grind
-- Adds obsidian, master, demigod, deity tier challenges + new stat keys

-- ═══ Extended: packs_opened ═══
-- Current max: 250 (diamond)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Pack Fanatic',    'Open 500 packs from The Vault',   'vault', 'one_time', 35, 150, 500,  'packs_opened', 250, 'obsidian', true),
  ('Pack Obsession',  'Open 1000 packs from The Vault',  'vault', 'one_time', 40, 200, 1000, 'packs_opened', 251, 'master',   true),
  ('Pack Titan',      'Open 2500 packs from The Vault',  'vault', 'one_time', 50, 300, 2500, 'packs_opened', 252, 'demigod',  true),
  ('Pack Deity',      'Open 5000 packs from The Vault',  'vault', 'one_time', 75, 500, 5000, 'packs_opened', 253, 'deity',    true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: cards_dismantled ═══
-- Current max: 500 (diamond)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Scrap Overlord',   'Dismantle 1000 cards',  'vault', 'one_time', 35, 150, 1000, 'cards_dismantled', 254, 'obsidian', true),
  ('Eternal Scrapper', 'Dismantle 2500 cards',  'vault', 'one_time', 40, 200, 2500, 'cards_dismantled', 255, 'master',   true),
  ('The Shredder',     'Dismantle 5000 cards',  'vault', 'one_time', 50, 300, 5000, 'cards_dismantled', 256, 'demigod',  true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: legendary_cards_dismantled ═══
-- Current max: 15 (diamond)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Legendary Sacrifice', 'Dismantle 30 legendary cards',  'vault', 'one_time', 35, 150, 30,  'legendary_cards_dismantled', 257, 'obsidian', true),
  ('Golden Grinder',      'Dismantle 50 legendary cards',  'vault', 'one_time', 40, 200, 50,  'legendary_cards_dismantled', 258, 'master',   true),
  ('Legend Eater',        'Dismantle 100 legendary cards', 'vault', 'one_time', 75, 500, 100, 'legendary_cards_dismantled', 259, 'deity',    true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: trades_completed ═══
-- Current max: 50 (diamond)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Trade Mogul',  'Complete 100 trades', 'vault', 'one_time', 35, 150, 100, 'trades_completed', 260, 'obsidian', true),
  ('Trade Tycoon', 'Complete 250 trades', 'vault', 'one_time', 40, 200, 250, 'trades_completed', 261, 'master',   true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: marketplace_sold ═══
-- Current max: 30 (gold)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Market Veteran',  'Sell 75 cards on the marketplace',  'vault', 'one_time', 25, 75,  75,  'marketplace_sold', 262, 'platinum', true),
  ('Market Kingpin',  'Sell 150 cards on the marketplace', 'vault', 'one_time', 30, 100, 150, 'marketplace_sold', 263, 'diamond',  true),
  ('Market Overlord', 'Sell 300 cards on the marketplace', 'vault', 'one_time', 35, 150, 300, 'marketplace_sold', 264, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: marketplace_bought ═══
-- Current max: 1 (amber)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Bargain Hunter', 'Buy 5 cards from the marketplace',  'vault', 'one_time', 10, 15, 5,  'marketplace_bought', 265, 'bronze',   true),
  ('Shopping Spree', 'Buy 15 cards from the marketplace', 'vault', 'one_time', 15, 20, 15, 'marketplace_bought', 266, 'silver',   true),
  ('Bulk Buyer',     'Buy 30 cards from the marketplace', 'vault', 'one_time', 20, 40, 30, 'marketplace_bought', 267, 'gold',     true),
  ('Market Whale',   'Buy 75 cards from the marketplace', 'vault', 'one_time', 25, 75, 75, 'marketplace_bought', 268, 'platinum', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: daily_cores_claimed ═══
-- Current max: 100 (platinum)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Daily Ritual',    'Claim daily Cores 200 times', 'vault', 'one_time', 30, 100, 200, 'daily_cores_claimed', 269, 'diamond',  true),
  ('Year-Round',      'Claim daily Cores 365 times', 'vault', 'one_time', 35, 150, 365, 'daily_cores_claimed', 270, 'obsidian', true),
  ('Two-Year Streak', 'Claim daily Cores 730 times', 'vault', 'one_time', 40, 200, 730, 'daily_cores_claimed', 271, 'master',   true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: income_collected ═══
-- Current max: 50 (platinum)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Income Magnate', 'Collect Starting Five income 100 times', 'vault', 'one_time', 30, 100, 100, 'income_collected', 272, 'diamond',  true),
  ('Income Baron',   'Collect Starting Five income 200 times', 'vault', 'one_time', 35, 150, 200, 'income_collected', 273, 'obsidian', true),
  ('Income Empire',  'Collect Starting Five income 365 times', 'vault', 'one_time', 40, 200, 365, 'income_collected', 274, 'master',   true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: gifts_sent ═══
-- Current max: 5 (gold)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Philanthropist', 'Send 10 gift packs', 'vault', 'one_time', 25, 75,  10, 'gifts_sent', 275, 'platinum', true),
  ('Gift Legend',    'Send 25 gift packs', 'vault', 'one_time', 30, 100, 25, 'gifts_sent', 276, 'diamond',  true),
  ('Santa Claus',    'Send 50 gift packs', 'vault', 'one_time', 35, 150, 50, 'gifts_sent', 277, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Extended: best_marketplace_sale ═══
-- Current max: 500 (diamond)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Auction House King', 'Sell a card for 1000+ Cores on the marketplace', 'vault', 'one_time', 35, 150, 1000, 'best_marketplace_sale', 278, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: cores_converted ═══
-- (stat key already tracked, just no challenges using it at scale)
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Core Convert',     'Convert Passion to Cores 10 times',  'vault', 'one_time', 10, 15,  10,  'cores_converted', 279, 'bronze',   true),
  ('Core Alchemist',   'Convert Passion to Cores 50 times',  'vault', 'one_time', 15, 20,  50,  'cores_converted', 280, 'silver',   true),
  ('Core Transmuter',  'Convert Passion to Cores 100 times', 'vault', 'one_time', 20, 40,  100, 'cores_converted', 281, 'gold',     true),
  ('Core Philosopher', 'Convert Passion to Cores 250 times', 'vault', 'one_time', 25, 75,  250, 'cores_converted', 282, 'platinum', true),
  ('Core Sage',        'Convert Passion to Cores 500 times', 'vault', 'one_time', 30, 100, 500, 'cores_converted', 283, 'diamond',  true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: total_cards_owned (new stat key) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Card Collector',  'Own 100 cards',  'vault', 'one_time', 15, 20,  100,  'total_cards_owned', 284, 'silver',   true),
  ('Card Hoarder',    'Own 250 cards',  'vault', 'one_time', 20, 40,  250,  'total_cards_owned', 285, 'gold',     true),
  ('Card Stockpile',  'Own 500 cards',  'vault', 'one_time', 25, 75,  500,  'total_cards_owned', 286, 'platinum', true),
  ('Card Warehouse',  'Own 1000 cards', 'vault', 'one_time', 30, 100, 1000, 'total_cards_owned', 287, 'diamond',  true),
  ('Card Vault',      'Own 2000 cards', 'vault', 'one_time', 35, 150, 2000, 'total_cards_owned', 288, 'obsidian', true),
  ('Card Empire',     'Own 3500 cards', 'vault', 'one_time', 40, 200, 3500, 'total_cards_owned', 289, 'master',   true),
  ('Card Dynasty',    'Own 5000 cards', 'vault', 'one_time', 50, 300, 5000, 'total_cards_owned', 290, 'demigod',  true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: unique_gods_owned (new stat key) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Diverse Roster',   'Own cards of 25 different gods',  'vault', 'one_time', 15, 20,  25,  'unique_gods_owned', 291, 'silver',   true),
  ('God Collector',    'Own cards of 50 different gods',  'vault', 'one_time', 20, 40,  50,  'unique_gods_owned', 292, 'gold',     true),
  ('Pantheon Seeker',  'Own cards of 75 different gods',  'vault', 'one_time', 25, 75,  75,  'unique_gods_owned', 293, 'platinum', true),
  ('Pantheon Master',  'Own cards of 100 different gods', 'vault', 'one_time', 30, 100, 100, 'unique_gods_owned', 294, 'diamond',  true),
  ('Divine Collector', 'Own cards of 125 different gods', 'vault', 'one_time', 35, 150, 125, 'unique_gods_owned', 295, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ NEW: total_cores_earned (new stat key) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Core Earner',       'Earn 500 lifetime Cores',    'vault', 'one_time', 10, 15,   500,    'total_cores_earned', 296, 'bronze',   true),
  ('Core Accumulator',  'Earn 2500 lifetime Cores',   'vault', 'one_time', 15, 20,   2500,   'total_cores_earned', 297, 'silver',   true),
  ('Core Magnate',      'Earn 10000 lifetime Cores',  'vault', 'one_time', 20, 40,   10000,  'total_cores_earned', 298, 'gold',     true),
  ('Core Mogul',        'Earn 50000 lifetime Cores',  'vault', 'one_time', 25, 75,   50000,  'total_cores_earned', 299, 'platinum', true),
  ('Core Tycoon',       'Earn 100000 lifetime Cores', 'vault', 'one_time', 30, 100,  100000, 'total_cores_earned', 300, 'diamond',  true),
  ('Core Olympian',     'Earn 250000 lifetime Cores', 'vault', 'one_time', 35, 150,  250000, 'total_cores_earned', 301, 'obsidian', true)
ON CONFLICT (title) DO NOTHING;
