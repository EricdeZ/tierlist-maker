-- Log each consumable use so daily count is a simple COUNT query
CREATE TABLE IF NOT EXISTS cc_consumable_uses (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    card_id     INTEGER,
    consumable_id VARCHAR(50) NOT NULL,
    rarity      VARCHAR(20),
    effect      VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_consumable_uses_user_date
    ON cc_consumable_uses (user_id, created_at DESC);
