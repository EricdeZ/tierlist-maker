-- Migration 015: Game Predictions System
-- Adds match predictions with optional Passion Coin wagering and dynamic odds.

-- ═══════════════════════════════════════════════════
-- 1. Predictions table
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS predictions (
    id                  serial PRIMARY KEY,
    user_id             integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_match_id  integer NOT NULL REFERENCES scheduled_matches(id) ON DELETE CASCADE,
    predicted_team_id   integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    wager_amount        integer NOT NULL DEFAULT 0,
    payout_multiplier   numeric(5,2),
    payout_amount       integer,
    status              varchar(20) NOT NULL DEFAULT 'pending',
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    resolved_at         timestamptz,
    UNIQUE(user_id, scheduled_match_id)
);

DO $$ BEGIN
    ALTER TABLE predictions ADD CONSTRAINT predictions_status_check
        CHECK (status IN ('pending', 'won', 'lost', 'refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(scheduled_match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id, status);

-- ═══════════════════════════════════════════════════
-- 2. Admin lock toggle on scheduled_matches
-- ═══════════════════════════════════════════════════

ALTER TABLE scheduled_matches
    ADD COLUMN IF NOT EXISTS predictions_locked boolean NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════
-- 3. Seed prediction challenges
-- ═══════════════════════════════════════════════════

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Oracle''s First Vision', 'Make your first match prediction', 'engagement', 'one_time', 10, 1, 'predictions_made', 200, 'clay')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Fortune Teller', 'Get 5 correct predictions', 'engagement', 'one_time', 30, 5, 'predictions_correct', 201, 'silver')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Clairvoyant', 'Get 20 correct predictions', 'engagement', 'one_time', 45, 20, 'predictions_correct', 202, 'gold')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('High Roller', 'Wager 500 total coins on predictions', 'engagement', 'one_time', 50, 500, 'predictions_wagered', 203, 'platinum')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Against All Odds', 'Win a prediction with 3x or higher odds', 'engagement', 'one_time', 75, 1, 'predictions_upset_wins', 204, 'diamond')
ON CONFLICT (title) DO NOTHING;
