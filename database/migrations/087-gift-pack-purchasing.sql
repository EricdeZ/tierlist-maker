-- Allow users to buy standard packs (OSL, BSL) and send them as gifts.
-- Free gift packs remain limited to 5 per user, one per recipient (unchanged).
-- Purchased packs have no limit and can be sent to anyone.

-- Track purchased pack inventory for gifting
CREATE TABLE IF NOT EXISTS cc_gift_inventory (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (user_id, pack_type)
);

-- Track what kind of pack each gift contains
ALTER TABLE cc_gifts ADD COLUMN IF NOT EXISTS pack_type TEXT NOT NULL DEFAULT 'gift';
