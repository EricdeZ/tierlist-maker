-- Unique cards owned challenges (all card types, COUNT(DISTINCT god_id))
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Catalog Bronze',   'Own 300 unique cards',  'vault', 'one_time', 20, 30,   300, 'unique_cards_owned', 296, 'silver',   true),
  ('Catalog Silver',   'Own 400 unique cards',  'vault', 'one_time', 25, 50,   400, 'unique_cards_owned', 297, 'gold',     true),
  ('Catalog Gold',     'Own 500 unique cards',  'vault', 'one_time', 30, 75,   500, 'unique_cards_owned', 298, 'platinum', true),
  ('Catalog Platinum', 'Own 650 unique cards',  'vault', 'one_time', 35, 100,  650, 'unique_cards_owned', 299, 'diamond',  true),
  ('Catalog Diamond',  'Own 800 unique cards',  'vault', 'one_time', 40, 150,  800, 'unique_cards_owned', 300, 'obsidian', true);
