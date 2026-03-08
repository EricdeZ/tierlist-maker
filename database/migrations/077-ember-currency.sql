-- Ember currency: Card Clash-specific currency for pack purchases
-- Separate from Passion, can be earned daily or converted from Passion

CREATE TABLE IF NOT EXISTS ember_balances (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id),
    balance       INTEGER NOT NULL DEFAULT 0,
    last_daily_claim TIMESTAMPTZ,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    conversions_today INTEGER NOT NULL DEFAULT 0,
    last_conversion_date DATE,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ember_transactions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    amount        INTEGER NOT NULL,
    type          VARCHAR(50) NOT NULL,
    description   TEXT,
    reference_id  TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ember_transactions_user ON ember_transactions(user_id, created_at DESC);

-- Add ember_reward column to challenges (optional, NULL = no ember)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS ember_reward INTEGER;
