-- Tunable Forge performance config (single-row table, owner-editable from admin UI)
CREATE TABLE IF NOT EXISTS forge_config (
    id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    game_decay      NUMERIC(6,4) NOT NULL DEFAULT 0.7500,
    supply_weight   NUMERIC(6,4) NOT NULL DEFAULT 0.0100,
    inactivity_decay NUMERIC(6,4) NOT NULL DEFAULT 0.8500,
    perf_floor      NUMERIC(6,4) NOT NULL DEFAULT 0.1000,
    perf_ceiling    NUMERIC(6,4) NOT NULL DEFAULT 2.5000,
    compress_k      NUMERIC(6,4) NOT NULL DEFAULT 0.6500,
    opponent_weight NUMERIC(6,4) NOT NULL DEFAULT 0.3000,
    teammate_weight NUMERIC(6,4) NOT NULL DEFAULT 0.1500,
    god_weight      NUMERIC(6,4) NOT NULL DEFAULT 0.1000,
    win_bonus       NUMERIC(6,4) NOT NULL DEFAULT 0.0500,
    decay_half_life INTEGER NOT NULL DEFAULT 7,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO forge_config DEFAULT VALUES ON CONFLICT DO NOTHING;

-- Performance update approval gate (temporary safety net)
ALTER TABLE forge_config ADD COLUMN IF NOT EXISTS performance_approval BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS forge_pending_updates (
    id              SERIAL PRIMARY KEY,
    market_id       INTEGER NOT NULL,
    spark_id        INTEGER NOT NULL,
    player_name     TEXT,
    old_multiplier  NUMERIC(6,4),
    new_multiplier  NUMERIC(6,4) NOT NULL,
    old_price       NUMERIC(10,2),
    new_price       NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
