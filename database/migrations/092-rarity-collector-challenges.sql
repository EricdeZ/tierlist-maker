-- Challenges for collecting multiple rarities of the same card
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Rarity Pair',     'Own 2 different rarities of the same card', 'vault', 'one_time', 10, 10,  2, 'max_card_rarities', 245, 'amber',   true),
  ('Rarity Trio',     'Own 3 different rarities of the same card', 'vault', 'one_time', 15, 25,  3, 'max_card_rarities', 246, 'silver',  true),
  ('Rarity Spectrum', 'Own 4 different rarities of the same card', 'vault', 'one_time', 20, 50,  4, 'max_card_rarities', 247, 'gold',    true),
  ('Rarity Master',   'Own 5 different rarities of the same card', 'vault', 'one_time', 30, 100, 5, 'max_card_rarities', 248, 'diamond', true)
ON CONFLICT (title) DO NOTHING;
