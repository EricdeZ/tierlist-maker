-- Update gift pack to 7 cards (added a wildcard slot)
UPDATE cc_pack_types
SET cards_per_pack = 7,
    description = 'A gift from a friend! Contains 7 cards from both leagues.'
WHERE id = 'gift';
