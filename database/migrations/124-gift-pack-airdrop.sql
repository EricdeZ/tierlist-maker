-- Gift 20 gift packs to every active vault user (packs_opened > 0).
-- One-time airdrop; packs appear in inventory and can be opened normally.

INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
SELECT s.user_id, 'gift', 'admin_gift'
FROM cc_stats s
CROSS JOIN generate_series(1, 20)
WHERE s.packs_opened > 0;
