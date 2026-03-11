-- Binder: showcase collection with locked cards
-- 10 pages × 9 slots = 90 card slots

CREATE TABLE IF NOT EXISTS cc_binders (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id),
  name        TEXT NOT NULL DEFAULT 'My Collection',
  color       TEXT NOT NULL DEFAULT '#8b5e3c',
  share_token TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cc_binder_cards (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  card_id   INTEGER NOT NULL REFERENCES cc_cards(id) ON DELETE CASCADE,
  page      SMALLINT NOT NULL CHECK (page BETWEEN 1 AND 10),
  slot      SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 9),
  slotted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, page, slot),
  UNIQUE (card_id)
);

CREATE INDEX idx_binder_cards_user ON cc_binder_cards(user_id);
CREATE INDEX idx_binder_cards_card ON cc_binder_cards(card_id);
