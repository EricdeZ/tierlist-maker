-- Passive state: charge tracking, cooldowns, toggles
CREATE TABLE cc_passive_state (
  user_id INTEGER NOT NULL,
  passive_name TEXT NOT NULL,
  charges INTEGER NOT NULL DEFAULT 0,
  last_charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  holo_choice TEXT,
  PRIMARY KEY (user_id, passive_name)
);

-- Generated cards from Card Generator passive
CREATE TABLE cc_generated_cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  card_data JSONB NOT NULL,
  rarity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);
CREATE INDEX idx_cc_generated_cards_user ON cc_generated_cards(user_id) WHERE claimed_at IS NULL;

-- Pack sessions for reroll state
CREATE TABLE cc_pack_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cards JSONB NOT NULL,
  odds_context JSONB NOT NULL,
  reroll_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);
CREATE INDEX idx_cc_pack_sessions_user ON cc_pack_sessions(user_id);

-- Custom odds per pack type
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS odds_config JSONB;

-- Holo choice on lineup slot (for Holo Boost passive)
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS holo_choice TEXT;
