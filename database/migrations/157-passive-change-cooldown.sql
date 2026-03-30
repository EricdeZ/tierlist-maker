-- Track when a unique staff card's passive was last changed (48h cooldown)
ALTER TABLE cc_cards ADD COLUMN passive_changed_at TIMESTAMPTZ;
