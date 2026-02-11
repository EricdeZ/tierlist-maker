-- Migration 009: Discord Queue
-- Adds discord_channels and discord_queue tables for polling Discord match screenshots.

-- 1. Channel configuration: maps Discord channels to divisions
CREATE TABLE IF NOT EXISTS discord_channels (
    id              SERIAL PRIMARY KEY,
    channel_id      VARCHAR(32) NOT NULL UNIQUE,
    channel_name    VARCHAR(255),
    guild_id        VARCHAR(32) NOT NULL,
    guild_name      VARCHAR(255),
    division_id     INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_message_id VARCHAR(32),
    last_polled_at  TIMESTAMPTZ,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Queue: individual image attachments from Discord messages
CREATE TABLE IF NOT EXISTS discord_queue (
    id                   SERIAL PRIMARY KEY,
    channel_id           INTEGER NOT NULL REFERENCES discord_channels(id) ON DELETE CASCADE,
    message_id           VARCHAR(32) NOT NULL,
    attachment_id        VARCHAR(32) NOT NULL,
    attachment_filename  VARCHAR(500),
    attachment_url       TEXT NOT NULL,
    attachment_size      INTEGER,
    attachment_width     INTEGER,
    attachment_height    INTEGER,
    message_content      TEXT,
    author_id            VARCHAR(32),
    author_name          VARCHAR(100),
    message_timestamp    TIMESTAMPTZ NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending',
    used_in_match_id     INTEGER REFERENCES matches(id) ON DELETE SET NULL,
    processed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    processed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discord_attachment UNIQUE (message_id, attachment_id),
    CONSTRAINT chk_queue_status CHECK (status IN ('pending', 'processing', 'used', 'skipped'))
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_discord_queue_channel_status
    ON discord_queue (channel_id, status);

CREATE INDEX IF NOT EXISTS idx_discord_queue_message_timestamp
    ON discord_queue (message_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_discord_channels_division
    ON discord_channels (division_id);
