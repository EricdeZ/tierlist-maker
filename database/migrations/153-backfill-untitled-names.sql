-- Backfill card/blueprint names from banner playerName.
-- The banner is the source of truth for display names.

-- 1. Fix blueprint names + cardData.name to match their banner
UPDATE cc_card_blueprints bp
SET name = sub.banner_name,
    template_data = jsonb_set(bp.template_data, '{cardData,name}', to_jsonb(sub.banner_name))
FROM (
  SELECT bp2.id,
    (SELECT el->>'playerName' FROM jsonb_array_elements(bp2.template_data->'elements') el
     WHERE el->>'type' = 'name-banner' LIMIT 1) AS banner_name
  FROM cc_card_blueprints bp2
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(bp2.template_data->'elements') el
    WHERE el->>'type' = 'name-banner' AND el->>'playerName' != '' AND el->>'playerName' != 'Player Name'
  )
  AND bp2.name != (
    SELECT el->>'playerName' FROM jsonb_array_elements(bp2.template_data->'elements') el
    WHERE el->>'type' = 'name-banner' LIMIT 1
  )
) sub
WHERE bp.id = sub.id;

-- 2. Fix cc_cards.god_name to match blueprint banner
UPDATE cc_cards c
SET god_name = sub.banner_name
FROM (
  SELECT bp.id,
    (SELECT el->>'playerName' FROM jsonb_array_elements(bp.template_data->'elements') el
     WHERE el->>'type' = 'name-banner' LIMIT 1) AS banner_name
  FROM cc_card_blueprints bp
) sub
WHERE c.blueprint_id = sub.id
  AND c.god_name != sub.banner_name
  AND sub.banner_name IS NOT NULL
  AND sub.banner_name != ''
  AND sub.banner_name != 'Player Name';
