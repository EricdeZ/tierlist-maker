-- Add depicted_user_id to card templates, drafts, and card instances
ALTER TABLE cc_card_templates
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cc_card_drafts
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cc_cards
  ADD COLUMN depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
