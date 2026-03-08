ALTER TABLE forge_config_history
    ADD COLUMN IF NOT EXISTS inactivity_decay NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS game_decay       NUMERIC(6,4);

-- Backfill existing rows with defaults from forge_config
UPDATE forge_config_history
SET inactivity_decay = COALESCE((SELECT inactivity_decay FROM forge_config LIMIT 1), 0.85),
    game_decay       = COALESCE((SELECT game_decay FROM forge_config LIMIT 1), 0.75)
WHERE inactivity_decay IS NULL;

ALTER TABLE forge_config_history
    ALTER COLUMN inactivity_decay SET NOT NULL,
    ALTER COLUMN game_decay       SET NOT NULL;
