-- Jumbo Staff Pack: 18 cards (3x staff pack), 6 guaranteed staff (boosted rarity), 3 players, 6 random, 3 wildcards
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, slots, group_constraints, odds_config, enabled, rotation_only, sort_order, color)
VALUES (
  'staff-jumbo',
  'Jumbo Staff Pack',
  '6 staff cards with boosted rarity, 3 player cards, and 3 wildcards',
  35,
  18,
  'configured',
  '[{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"uncommon"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"uncommon"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"uncommon"},{"types":["god","item","consumable","player","staff"],"group":"W","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"W","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"W","minRarity":"common"}]'::jsonb,
  '{"A":[{"type":"staff","min":6,"max":6},{"type":"player","min":3,"max":3}]}'::jsonb,
  '{"typeOdds":{"staff":{"rarity":{"common":0.55,"uncommon":0.30,"rare":0.08,"epic":0.05,"legendary":0.01,"mythic":0.004,"unique":0.001}}}}'::jsonb,
  true,
  false,
  11,
  '#ec4899'
)
ON CONFLICT (id) DO NOTHING;
