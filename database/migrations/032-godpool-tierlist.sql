-- Migration 032: Godpool Tier List
-- Players can save a god tier list to their profile to showcase their godpool.
-- Visibility controls: private (only self), team (active season teammates, non-sub), public (everyone).

CREATE TABLE godpool_tierlists (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tiers         JSONB NOT NULL,
    visibility    VARCHAR(10) NOT NULL DEFAULT 'private',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_godpool_tierlists_user ON godpool_tierlists(user_id);
