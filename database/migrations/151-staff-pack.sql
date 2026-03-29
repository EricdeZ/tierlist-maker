-- Staff Pack: 6 cards, 2 guaranteed staff (boosted rarity), 1 player, 2 random, 1 wildcard
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, slots, group_constraints, odds_config, enabled, rotation_only, sort_order)
VALUES (
  'staff-mixed',
  'Staff Pack',
  '2 staff cards with boosted rarity, 1 player card, and a wildcard',
  10,
  6,
  'configured',
  '[{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"uncommon"},{"types":["god","item","consumable","player","staff"],"group":"W","minRarity":"common"}]'::jsonb,
  '{"A":[{"type":"staff","min":2,"max":2},{"type":"player","min":1,"max":1}]}'::jsonb,
  '{"typeOdds":{"staff":{"rarity":{"common":0.55,"uncommon":0.30,"rare":0.08,"epic":0.05,"legendary":0.01,"mythic":0.004,"unique":0.001}}}}'::jsonb,
  true,
  false,
  10
)
ON CONFLICT (id) DO NOTHING;
