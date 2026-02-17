-- Migration 025: Featured Streamer 7-day rolling window
-- Tracks per-heartbeat credits so the selection algorithm can use a
-- rolling 7-day window instead of all-time ratio (prevents dormant
-- accounts from monopolizing the featured slot).

CREATE TABLE IF NOT EXISTS featured_session_log (
    id              serial PRIMARY KEY,
    streamer_id     integer NOT NULL REFERENCES featured_streamers(id) ON DELETE CASCADE,
    seconds_credited integer NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_log_streamer_recent
    ON featured_session_log (streamer_id, created_at DESC);
