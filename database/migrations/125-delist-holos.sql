-- One-time: cancel all active marketplace listings for holographic cards
UPDATE cc_market_listings
SET    status = 'cancelled'
WHERE  status = 'active'
  AND  card_id IN (
    SELECT id FROM cc_cards WHERE holo_type = 'holo'
  );
