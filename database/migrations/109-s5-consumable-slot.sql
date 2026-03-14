ALTER TABLE cc_starting_five_state
ADD COLUMN consumable_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX cc_s5_consumable_uniq
ON cc_starting_five_state(consumable_card_id)
WHERE consumable_card_id IS NOT NULL;
