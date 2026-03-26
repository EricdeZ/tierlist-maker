-- Promo gift packs: owner-to-user scripted card gifts
CREATE TABLE cc_promo_gifts (
  id SERIAL PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  card_type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  template_id INT REFERENCES cc_card_templates(id),
  card_config JSONB NOT NULL DEFAULT '{}',
  message TEXT,
  tradeable BOOLEAN NOT NULL DEFAULT true,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  card_id INT REFERENCES cc_cards(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_gifts_recipient ON cc_promo_gifts (recipient_id) WHERE claimed = false;

-- Trade lock column on cards
ALTER TABLE cc_cards ADD COLUMN trade_locked BOOLEAN NOT NULL DEFAULT false;
