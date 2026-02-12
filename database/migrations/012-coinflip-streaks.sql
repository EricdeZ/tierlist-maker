-- Migration 012: Coinflip Streak Tracking
CREATE TABLE IF NOT EXISTS coinflip_streaks (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak    INTEGER NOT NULL DEFAULT 0,
    total_flips    INTEGER NOT NULL DEFAULT 0,
    total_heads    INTEGER NOT NULL DEFAULT 0,
    last_flip_at   TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coinflip_best ON coinflip_streaks(best_streak DESC);
