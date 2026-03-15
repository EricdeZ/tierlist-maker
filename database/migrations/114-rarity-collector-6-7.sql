-- Challenges for collecting 6 and 7 rarities of the same card
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Rarity Grandmaster', 'Own 6 different rarities of the same card', 'vault', 'one_time', 40, 200, 6, 'max_card_rarities', 249, 'obsidian', true),
  ('Rarity Deity',       'Own 7 different rarities of the same card', 'vault', 'one_time', 50, 400, 7, 'max_card_rarities', 250, 'master',   true)
ON CONFLICT (title) DO NOTHING;
