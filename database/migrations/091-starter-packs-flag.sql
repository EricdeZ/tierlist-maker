-- Track whether starter packs have been granted (persistent even after packs are opened)
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS starter_packs_granted BOOLEAN DEFAULT false;

-- Mark existing users who already received starter packs
UPDATE cc_stats SET starter_packs_granted = true;
