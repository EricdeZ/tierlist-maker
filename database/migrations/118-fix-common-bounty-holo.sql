-- Fix common bounties that were created with a holo_type other than 'none'.
-- Common cards never have holo, so these bounties could never be fulfilled.
UPDATE cc_bounties
SET holo_type = 'none', updated_at = NOW()
WHERE rarity = 'common' AND holo_type != 'none';
