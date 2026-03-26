-- Staff card passive types
CREATE TABLE cc_staff_passives (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO cc_staff_passives (name, display_name, description) VALUES
  ('odds_boost', 'Odds Boost', 'Increases overall card pull odds'),
  ('holo_boost', 'Holo Boost', 'Increases odds to pull a specific holo type'),
  ('card_reroll', 'Card Reroll', 'Reroll 1 card per pack'),
  ('pack_reroll', 'Pack Reroll', 'Reroll the whole pack after flipping (same rarities, lose 1 random card each reroll)'),
  ('unique_hunter', 'Unique Hunter', 'Blocks legendary and mythic pulls but increases unique pull chance'),
  ('collector_boost', 'Collector Boost', 'Boosts odds for cards you don''t already own'),
  ('card_generator', 'Card Generator', 'Passively generates random cards over time');

-- Add passive FK to cards (only populated for staff cards)
ALTER TABLE cc_cards ADD COLUMN passive_id INTEGER REFERENCES cc_staff_passives(id);
