-- Migration 064: Discord guild members table
-- Persistent cache of Discord guild membership, synced hourly by the poll worker.
-- Powers the discord_joined challenge and future guild-based features.

CREATE TABLE IF NOT EXISTS discord_guild_members (
    discord_id VARCHAR(32) PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    discord_username VARCHAR(64),
    joined_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dgm_guild ON discord_guild_members(guild_id);
