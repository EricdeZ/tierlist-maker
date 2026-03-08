-- Pack type definitions table
CREATE TABLE IF NOT EXISTS cc_pack_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL DEFAULT 0,
  cards_per_pack INTEGER NOT NULL DEFAULT 6,
  guarantees JSONB DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'rarity',
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed existing rarity packs
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, guarantees, category, sort_order) VALUES
  ('standard',  'Standard Pack',  'Basic Collection',       75,   3, '[{"minRarity":"uncommon","count":1}]', 'rarity', 0),
  ('premium',   'Premium Pack',   'Enhanced Drops',         200,  5, '[{"minRarity":"rare","count":1}]', 'rarity', 1),
  ('elite',     'Elite Pack',     'Rare Guaranteed',        500,  5, '[{"minRarity":"epic","count":1},{"minRarity":"rare","count":2}]', 'rarity', 2),
  ('legendary', 'Legendary Pack', 'The Ultimate Pull',      1500, 7, '[{"minRarity":"legendary","count":1}]', 'rarity', 3),
  ('mixed',     'Mixed Pack',     'Gods, Items, Consumables & a Player Card', 150, 6, '[]', 'mixed', 10)
ON CONFLICT (id) DO NOTHING;

-- Add card_type column to cc_cards for mixed card types
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'god';
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS card_data JSONB;
