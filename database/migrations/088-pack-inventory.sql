-- Pack inventory: users can hold packs and open them later.
-- Starter packs (2 OSL + 2 BSL) are granted to all users.

CREATE TABLE IF NOT EXISTS cc_pack_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_type_id TEXT NOT NULL REFERENCES cc_pack_types(id),
    source TEXT NOT NULL DEFAULT 'starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_pack_inventory_user ON cc_pack_inventory(user_id);

-- Grant 2 OSL + 2 BSL starter packs to all existing users with cc_stats
INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
SELECT user_id, pack_type, 'starter'
FROM cc_stats
CROSS JOIN (
    VALUES ('osl-mixed'), ('osl-mixed'), ('bsl-mixed'), ('bsl-mixed')
) AS packs(pack_type);
