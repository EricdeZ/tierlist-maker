-- Migration 038: SmiteRunner Leaderboard
-- Session tracking for anti-cheat + best scores per user.

-- Game sessions (append-only, one per game start)
CREATE TABLE smiterunner_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token   TEXT UNIQUE NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at    TIMESTAMPTZ,
    score           INTEGER,
    ticks           INTEGER,
    is_valid        BOOLEAN NOT NULL DEFAULT true,
    heartbeats      JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_smiterunner_sessions_user ON smiterunner_sessions(user_id);
CREATE INDEX idx_smiterunner_sessions_token ON smiterunner_sessions(session_token);

-- Best scores per user (leaderboard source)
CREATE TABLE smiterunner_scores (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    best_score      INTEGER NOT NULL DEFAULT 0,
    best_ticks      INTEGER NOT NULL DEFAULT 0,
    total_runs      INTEGER NOT NULL DEFAULT 0,
    best_score_at   TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_smiterunner_scores_best ON smiterunner_scores(best_score DESC);
