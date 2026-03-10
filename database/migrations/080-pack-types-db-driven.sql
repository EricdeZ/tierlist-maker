-- Make pack types fully DB-driven: add league_id, disable non-league packs

ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS league_id INTEGER REFERENCES leagues(id);

-- Set league_ids on league packs
UPDATE cc_pack_types SET league_id = 2 WHERE id = 'osl-mixed';
UPDATE cc_pack_types SET league_id = 3 WHERE id = 'bsl-mixed';

-- Sync costs to what's been running in code
UPDATE cc_pack_types SET cost = 20 WHERE id IN ('osl-mixed', 'bsl-mixed');

-- Disable all non-league packs (only OSL and BSL are active)
UPDATE cc_pack_types SET enabled = false WHERE id NOT IN ('osl-mixed', 'bsl-mixed');
