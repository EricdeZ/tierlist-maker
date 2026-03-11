-- Track first-edition player cards (first global pull of a def_id + rarity combo)
ALTER TABLE cc_cards ADD COLUMN is_first_edition BOOLEAN NOT NULL DEFAULT FALSE;
