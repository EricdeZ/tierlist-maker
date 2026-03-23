-- Buff challenge packs: 2 guaranteed rares (up from broken 1-uncommon shorthand)
UPDATE cc_pack_types
SET guarantees = '[{"minRarity":"rare","count":2}]'::jsonb
WHERE id = 'challenge-pack';

-- Fix any other pack types that have object-format guarantees (e.g. {"rare":1})
-- instead of the expected array format ([{"minRarity":"rare","count":1}])
UPDATE cc_pack_types
SET guarantees = (
  SELECT jsonb_agg(jsonb_build_object('minRarity', kv.key, 'count', kv.value::int))
  FROM jsonb_each(guarantees) kv
)
WHERE jsonb_typeof(guarantees) = 'object'
  AND id != 'challenge-pack';
