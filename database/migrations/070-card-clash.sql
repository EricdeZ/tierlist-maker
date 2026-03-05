-- Card Clash: trading card game state
-- Collections, lineups, stats, and decks

CREATE TABLE IF NOT EXISTS cc_cards (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    god_id TEXT NOT NULL,
    god_name TEXT NOT NULL,
    god_class TEXT NOT NULL,
    role TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    power INTEGER NOT NULL DEFAULT 50,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    serial_number INTEGER,
    holo_effect TEXT DEFAULT 'common',
    ability JSONB,
    image_url TEXT,
    acquired_via TEXT DEFAULT 'pack',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cc_lineups (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('solo', 'jungle', 'mid', 'support', 'adc')),
    card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS cc_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    elo INTEGER NOT NULL DEFAULT 1000,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    packs_opened INTEGER NOT NULL DEFAULT 0,
    embers INTEGER NOT NULL DEFAULT 0,
    last_income_collected TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cc_decks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cards JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_cards_owner ON cc_cards(owner_id);
CREATE INDEX IF NOT EXISTS idx_cc_decks_user ON cc_decks(user_id);
