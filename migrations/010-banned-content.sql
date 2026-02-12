-- Migration 010: Banned content system
-- Stores per-league ban lists synced from Discord

CREATE TABLE IF NOT EXISTS banned_content (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    channel_id VARCHAR(32),
    message_id VARCHAR(32),
    raw_content TEXT,
    parsed_data JSONB,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id)
);
