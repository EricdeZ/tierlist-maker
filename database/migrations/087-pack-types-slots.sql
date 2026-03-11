-- Add configurable slot definitions, division filtering, and cosmetic color to pack types
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS slots JSONB;
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS division_ids INTEGER[];
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN cc_pack_types.slots IS 'Array of slot configs: [{types, typeWeights, minRarity, maxRarity}]. NULL = use legacy category-based generation.';
COMMENT ON COLUMN cc_pack_types.division_ids IS 'Division IDs for player card pool. Empty/NULL = all divisions.';
COMMENT ON COLUMN cc_pack_types.color IS 'Hex color for pack art and UI theming.';
