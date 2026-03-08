-- League-specific mixed packs: OSL and BSL
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, guarantees, category, sort_order)
VALUES
  ('osl-mixed', 'OSL Pack', 'Olympus Smite League — gods, items, consumables & a guaranteed OSL player card', 150, 6, '[]', 'mixed', 6),
  ('bsl-mixed', 'BSL Pack', 'Babylon Smite League — gods, items, consumables & a guaranteed BSL player card', 150, 6, '[]', 'mixed', 7)
ON CONFLICT (id) DO NOTHING;
