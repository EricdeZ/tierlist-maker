-- Migration 022: Featured Streamers
-- Users purchase the "Featured Streamer" badge with Passion.
-- Badge holders are rotated into the site's featured stream widget.
-- total_featured_seconds only increments via client heartbeats (= actual live time).

CREATE TABLE IF NOT EXISTS featured_streamers (
    id                      serial PRIMARY KEY,
    user_id                 integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    twitch_channel          varchar(100) NOT NULL,
    total_featured_seconds  integer NOT NULL DEFAULT 0,
    current_session_start   timestamptz,
    last_heartbeat          timestamptz,
    is_active               boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);
