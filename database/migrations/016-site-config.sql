-- Migration 016: Site Configuration
-- Generic key-value store for site-wide settings.

CREATE TABLE IF NOT EXISTS site_config (
    key         varchar(100) PRIMARY KEY,
    value       text NOT NULL DEFAULT '',
    updated_at  timestamptz NOT NULL DEFAULT NOW(),
    updated_by  integer REFERENCES users(id) ON DELETE SET NULL
);

-- Seed featured stream config (empty = feature disabled)
INSERT INTO site_config (key, value)
VALUES ('featured_stream_channel', ''),
       ('featured_stream_title', '')
ON CONFLICT (key) DO NOTHING;
