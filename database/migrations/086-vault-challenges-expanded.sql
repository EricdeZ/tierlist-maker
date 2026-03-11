-- Expanded vault challenges: cover all core Card Clash mechanics
-- New stat keys tracked from: cc_stats, cc_trades, cc_market_listings, cc_gifts,
--   cc_lineups, ember_transactions

-- Add tracking columns to cc_stats
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS cards_dismantled INTEGER DEFAULT 0;
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS legendary_cards_dismantled INTEGER DEFAULT 0;
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS income_collections INTEGER DEFAULT 0;

-- ═══ Clay tier — first-time actions (5 Passion + 10 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('First Scrap',     'Dismantle your first card',                  'vault', 'one_time', 5, 10, 1,  'cards_dismantled',        204, 'clay', true),
  ('First Deal',      'Complete your first trade',                  'vault', 'one_time', 5, 10, 1,  'trades_completed',        205, 'clay', true),
  ('First Listing',   'Sell a card on the marketplace',             'vault', 'one_time', 5, 10, 1,  'marketplace_sold',        206, 'clay', true),
  ('Starter Slot',    'Slot a card in your Starting Five',          'vault', 'one_time', 5, 10, 1,  'starting_five_filled',    207, 'clay', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Amber tier — early engagement (10 Passion + 10 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Window Shopper',   'Buy a card from the marketplace',           'vault', 'one_time', 10, 10, 1,  'marketplace_bought',      208, 'amber', true),
  ('Generous Friend',  'Send a gift pack to a friend',              'vault', 'one_time', 10, 10, 1,  'gifts_sent',              209, 'amber', true),
  ('Surprise Inside',  'Open a gift pack from a friend',            'vault', 'one_time', 10, 10, 1,  'gifts_opened',            210, 'amber', true),
  ('Passive Income',   'Collect Starting Five income',              'vault', 'one_time', 10, 10, 1,  'income_collected',        211, 'amber', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Bronze tier — building habits (10 Passion + 15 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Salvage Crew',     'Dismantle 25 cards',                        'vault', 'one_time', 10, 15, 25, 'cards_dismantled',        212, 'bronze', true),
  ('Trade Regular',    'Complete 5 trades',                         'vault', 'one_time', 10, 15, 5,  'trades_completed',        213, 'bronze', true),
  ('Market Seller',    'Sell 5 cards on the marketplace',           'vault', 'one_time', 10, 15, 5,  'marketplace_sold',        214, 'bronze', true),
  ('Full Roster',      'Fill all 5 Starting Five slots',            'vault', 'one_time', 10, 15, 5,  'starting_five_filled',    215, 'bronze', true),
  ('Gift Basket',      'Send 3 gift packs',                         'vault', 'one_time', 10, 15, 3,  'gifts_sent',              216, 'bronze', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Silver tier — intermediate (15 Passion + 20-25 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Pack Enthusiast',  'Open 25 packs from The Vault',              'vault', 'one_time', 15, 20, 25,  'packs_opened',           217, 'silver', true),
  ('Recycler',         'Dismantle 50 cards',                        'vault', 'one_time', 15, 20, 50,  'cards_dismantled',        218, 'silver', true),
  ('Trading Floor',    'Complete 10 trades',                        'vault', 'one_time', 15, 20, 10,  'trades_completed',        219, 'silver', true),
  ('Shopkeeper',       'Sell 15 cards on the marketplace',          'vault', 'one_time', 15, 20, 15,  'marketplace_sold',        220, 'silver', true),
  ('Big Sale',         'Sell a card for 50+ Cores on the marketplace', 'vault', 'one_time', 15, 25, 50, 'best_marketplace_sale', 221, 'silver', true),
  ('Starting Strong',  'Fill Starting Five with all rare or better cards', 'vault', 'one_time', 15, 25, 5, 'starting_five_rare_count', 222, 'silver', true),
  ('Daily Devotion',   'Claim daily Cores 30 times',                'vault', 'one_time', 15, 20, 30,  'daily_cores_claimed',     223, 'silver', true),
  ('Double Down',      'Convert Passion to Cores 3 times in a single day', 'vault', 'one_time', 15, 20, 3, 'max_conversions_day', 224, 'silver', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Gold tier — advanced (20 Passion + 40-50 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Pack Addict',          'Open 50 packs from The Vault',                  'vault', 'one_time', 20, 40, 50,  'packs_opened',               225, 'gold', true),
  ('Scrap Master',         'Dismantle 100 cards',                           'vault', 'one_time', 20, 40, 100, 'cards_dismantled',            226, 'gold', true),
  ('Deal Maker',           'Complete 25 trades',                            'vault', 'one_time', 20, 40, 25,  'trades_completed',            227, 'gold', true),
  ('Market Mogul',         'Sell 30 cards on the marketplace',              'vault', 'one_time', 20, 40, 30,  'marketplace_sold',            228, 'gold', true),
  ('Premium Sale',         'Sell a card for 100+ Cores on the marketplace', 'vault', 'one_time', 20, 50, 100, 'best_marketplace_sale',       229, 'gold', true),
  ('Legendary Scrapper',   'Dismantle 5 legendary cards',                   'vault', 'one_time', 20, 50, 5,   'legendary_cards_dismantled',  230, 'gold', true),
  ('Starting Elite',       'Fill Starting Five with all epic or better cards', 'vault', 'one_time', 20, 50, 5, 'starting_five_epic_count',  231, 'gold', true),
  ('Alchemy Rush',         'Convert Passion to Cores 5 times in a single day', 'vault', 'one_time', 20, 50, 5, 'max_conversions_day',      232, 'gold', true),
  ('Gift Master',          'Send 5 gift packs',                             'vault', 'one_time', 20, 40, 5,   'gifts_sent',                  233, 'gold', true),
  ('Income Farmer',        'Collect Starting Five income 25 times',         'vault', 'one_time', 20, 40, 25,  'income_collected',            234, 'gold', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Platinum tier — expert (25 Passion + 75 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Pack Hoarder',       'Open 100 packs from The Vault',               'vault', 'one_time', 25, 75, 100, 'packs_opened',               235, 'platinum', true),
  ('Demolition Expert',  'Dismantle 250 cards',                         'vault', 'one_time', 25, 75, 250, 'cards_dismantled',            236, 'platinum', true),
  ('Luxury Sale',        'Sell a card for 200+ Cores on the marketplace', 'vault', 'one_time', 25, 75, 200, 'best_marketplace_sale',     237, 'platinum', true),
  ('Income Machine',     'Collect Starting Five income 50 times',       'vault', 'one_time', 25, 75, 50,  'income_collected',            238, 'platinum', true),
  ('Devoted Collector',  'Claim daily Cores 100 times',                 'vault', 'one_time', 25, 75, 100, 'daily_cores_claimed',         239, 'platinum', true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Diamond tier — master (30 Passion + 100 Cores) ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Pack Legend',            'Open 250 packs from The Vault',                  'vault', 'one_time', 30, 100, 250, 'packs_opened',               240, 'diamond', true),
  ('Total Destruction',     'Dismantle 500 cards',                            'vault', 'one_time', 30, 100, 500, 'cards_dismantled',            241, 'diamond', true),
  ('Legendary Demolisher',  'Dismantle 15 legendary cards',                   'vault', 'one_time', 30, 100, 15,  'legendary_cards_dismantled',  242, 'diamond', true),
  ('Trade Empire',          'Complete 50 trades',                             'vault', 'one_time', 30, 100, 50,  'trades_completed',            243, 'diamond', true),
  ('Whale Sale',            'Sell a card for 500+ Cores on the marketplace',  'vault', 'one_time', 30, 100, 500, 'best_marketplace_sale',       244, 'diamond', true)
ON CONFLICT (title) DO NOTHING;
