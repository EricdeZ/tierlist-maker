-- Challenges for owning player cards of yourself (requires linked_player_id)
-- These reward only Cores, no Passion

-- ═══ Per-rarity: own at least one card of yourself at each rarity ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Self Portrait',        'Own a Common card of yourself',    'vault', 'one_time', 0, 15,  1, 'self_common_owned',    330, 'clay',     true),
  ('Better Likeness',      'Own an Uncommon card of yourself', 'vault', 'one_time', 0, 25,  1, 'self_uncommon_owned',  331, 'bronze',   true),
  ('Rare Find',            'Own a Rare card of yourself',      'vault', 'one_time', 0, 40,  1, 'self_rare_owned',      332, 'silver',   true),
  ('Epic Self',            'Own an Epic card of yourself',     'vault', 'one_time', 0, 75,  1, 'self_epic_owned',      333, 'gold',     true),
  ('Legendary Status',     'Own a Legendary card of yourself', 'vault', 'one_time', 0, 125, 1, 'self_legendary_owned', 334, 'platinum', true),
  ('Mythic Ego',           'Own a Mythic card of yourself',    'vault', 'one_time', 0, 200, 1, 'self_mythic_owned',    335, 'diamond',  true)
ON CONFLICT (title) DO NOTHING;

-- ═══ Multi-rarity: own yourself in N different rarities ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Identity Crisis',      'Own yourself in 3 different rarities', 'vault', 'one_time', 0, 50,  3, 'self_rarities_owned', 336, 'silver',   true),
  ('Hall of Mirrors',      'Own yourself in 4 different rarities', 'vault', 'one_time', 0, 100, 4, 'self_rarities_owned', 337, 'gold',     true),
  ('Multiverse of Me',     'Own yourself in 5 different rarities', 'vault', 'one_time', 0, 175, 5, 'self_rarities_owned', 338, 'platinum', true),
  ('Full Spectrum Narcissist', 'Own yourself in 6 different rarities', 'vault', 'one_time', 0, 300, 6, 'self_rarities_owned', 339, 'diamond', true)
ON CONFLICT (title) DO NOTHING;
