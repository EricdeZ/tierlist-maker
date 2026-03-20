-- Pack rotation system: schedule which packs appear in the "Special Rotation" shop section

-- Add rotation_only flag to pack types (rotation packs only visible when scheduled)
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS rotation_only BOOLEAN DEFAULT false;

-- Rotation schedule table — maps dates to pack types
CREATE TABLE IF NOT EXISTS cc_pack_rotation_schedule (
  date         DATE NOT NULL,
  pack_type_id TEXT NOT NULL REFERENCES cc_pack_types(id) ON DELETE CASCADE,
  PRIMARY KEY (date, pack_type_id)
);
CREATE INDEX IF NOT EXISTS idx_rotation_schedule_date ON cc_pack_rotation_schedule(date DESC);

-- Seed themed packs (rotation-only)
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, slots, enabled, rotation_only, sort_order) VALUES
  ('gods-only', 'Gods Pack', 'A pack full of god cards', 70, 6, 'configured',
   '[{"types":["god"],"minRarity":"common"},{"types":["god"],"minRarity":"common"},{"types":["god"],"minRarity":"common"},{"types":["god"],"minRarity":"uncommon"},{"types":["god"],"minRarity":"common"},{"types":["god"],"minRarity":"common"}]',
   true, true, 100),
  ('items-only', 'Items Pack', 'A pack full of item cards', 70, 6, 'configured',
   '[{"types":["item"],"minRarity":"common"},{"types":["item"],"minRarity":"common"},{"types":["item"],"minRarity":"common"},{"types":["item"],"minRarity":"uncommon"},{"types":["item"],"minRarity":"common"},{"types":["item"],"minRarity":"common"}]',
   true, true, 101)
ON CONFLICT (id) DO NOTHING;

-- Create division-specific packs dynamically from existing divisions
-- Each division gets a pack scoped to its player pool with 1-3 player cards guaranteed
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, slots, division_ids, league_id, color, group_constraints, enabled, rotation_only, sort_order)
SELECT
  'div-' || l.slug || '-' || d.slug AS id,
  d.name || ' Pack' AS name,
  'Division pack for ' || d.name || ' (' || l.name || ')' AS description,
  15 AS cost,
  6 AS cards_per_pack,
  'configured' AS category,
  '[{"types":["god","item","consumable","player"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player"],"group":"A","minRarity":"uncommon"},{"types":["god","item","consumable","player"],"group":"A","minRarity":"common"},{"types":["god","item","consumable","player"],"group":"A","minRarity":"common"}]'::jsonb AS slots,
  ARRAY[d.id] AS division_ids,
  l.id AS league_id,
  l.color AS color,
  '{"A":[{"type":"player","min":1,"max":3}]}'::jsonb AS group_constraints,
  true AS enabled,
  true AS rotation_only,
  200 + d.tier AS sort_order
FROM divisions d
JOIN leagues l ON l.id = d.league_id
WHERE l.slug != 'test-league'
ON CONFLICT (id) DO NOTHING;
