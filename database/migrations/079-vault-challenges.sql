-- Vault challenges: reward Cores (ember) for vault activity
-- Category: vault, stat_keys: packs_opened, daily_cores_claimed, cores_converted

INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('First Pull',         'Open your first pack from The Vault',         'vault', 'one_time', 5,  10, 1,  'packs_opened',       200, 'clay',   true),
  ('Pack Collector',     'Open 10 packs from The Vault',               'vault', 'one_time', 10, 25, 10, 'packs_opened',       201, 'bronze', true),
  ('Consistent Collector', 'Claim daily Cores 7 times',                'vault', 'one_time', 10, 15, 7,  'daily_cores_claimed', 202, 'amber',  true),
  ('Passion Alchemist',  'Convert Passion to Cores 5 times',           'vault', 'one_time', 10, 15, 5,  'cores_converted',    203, 'amber',  true)
ON CONFLICT DO NOTHING;
