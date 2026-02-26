-- Sell pressure: accumulates on sells, decays over time, depresses price below base
ALTER TABLE player_sparks
    ADD COLUMN IF NOT EXISTS sell_pressure NUMERIC(10,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sell_pressure_updated_at TIMESTAMPTZ;
