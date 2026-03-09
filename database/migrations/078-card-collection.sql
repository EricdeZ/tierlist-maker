-- Card collection system: player card definitions + collection index
-- Player card definitions store one row per player-team-season combination

CREATE TABLE cc_player_defs (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    league_id       INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    division_id     INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,

    -- Denormalized display fields (avoid joins at read time)
    player_name     TEXT NOT NULL,
    player_slug     TEXT NOT NULL,
    team_name       TEXT NOT NULL,
    team_color      VARCHAR(20),
    role            VARCHAR(50),
    league_slug     TEXT NOT NULL,
    division_slug   TEXT NOT NULL,
    season_slug     TEXT NOT NULL,
    division_tier   INTEGER NOT NULL DEFAULT 1,

    -- Card index number within its set (e.g. 14 in "bsl-d1-s2-014")
    card_index      INTEGER NOT NULL,

    -- Frozen stats (NULL while season is active; filled when frozen)
    frozen_stats    JSONB,

    -- Avatar URL (discord or god fallback)
    avatar_url      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(player_id, team_id, season_id)
);

CREATE INDEX idx_cc_player_defs_season ON cc_player_defs(season_id);
CREATE INDEX idx_cc_player_defs_league ON cc_player_defs(league_id);
CREATE INDEX idx_cc_player_defs_player ON cc_player_defs(player_id);

-- Link card instances to definitions for collection tracking
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS def_id INTEGER REFERENCES cc_player_defs(id) ON DELETE SET NULL;
CREATE INDEX idx_cc_cards_def_id ON cc_cards(def_id);
