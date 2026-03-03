CREATE TABLE IF NOT EXISTS forge_config_history (
    id                 SERIAL PRIMARY KEY,
    effective_from     TIMESTAMPTZ NOT NULL,
    expectation_weight NUMERIC(6,4) NOT NULL,
    supply_weight      NUMERIC(6,4) NOT NULL,
    opponent_weight    NUMERIC(6,4) NOT NULL,
    teammate_weight    NUMERIC(6,4) NOT NULL,
    god_weight         NUMERIC(6,4) NOT NULL,
    win_bonus          NUMERIC(6,4) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS forge_config_history_effective_from_idx
    ON forge_config_history (effective_from);

-- Store recalc timestamp so breakdown replays match pending multipliers exactly
ALTER TABLE forge_pending_updates ADD COLUMN IF NOT EXISTS recalc_at TIMESTAMPTZ;

-- Seed baseline from current config so existing games keep their scoring
INSERT INTO forge_config_history (
    effective_from, expectation_weight, supply_weight,
    opponent_weight, teammate_weight, god_weight, win_bonus
)
SELECT
    '1970-01-01 00:00:00+00'::TIMESTAMPTZ,
    COALESCE(expectation_weight, 0.002),
    COALESCE(supply_weight, 0.01),
    COALESCE(opponent_weight, 0.30),
    COALESCE(teammate_weight, 0.15),
    COALESCE(god_weight, 0.10),
    COALESCE(win_bonus, 0.05)
FROM forge_config
LIMIT 1
ON CONFLICT DO NOTHING;
