-- Bounty Board challenges — high roller tier only
-- stat keys: bounty_cores_earned, best_bounty_reward

-- ═══ bounty_cores_earned — Total Cores earned from fulfilling bounties ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Bounty Collector',   'Earn 500 Cores from bounty rewards',     'vault', 'one_time', 25, 75,  500,   'bounty_cores_earned', 330, 'platinum', true),
  ('Outlaw Payday',      'Earn 2,500 Cores from bounty rewards',   'vault', 'one_time', 30, 100, 2500,  'bounty_cores_earned', 331, 'diamond',  true),
  ('Bounty Legend',       'Earn 10,000 Cores from bounty rewards',  'vault', 'one_time', 35, 150, 10000, 'bounty_cores_earned', 332, 'obsidian', true),
  ('Dead or Alive',       'Earn 25,000 Cores from bounty rewards',  'vault', 'one_time', 40, 200, 25000, 'bounty_cores_earned', 333, 'master',   true)
ON CONFLICT (title) DO NOTHING;

-- ═══ best_bounty_reward — Biggest single bounty payout ═══
INSERT INTO challenges (title, description, category, type, reward, ember_reward, target_value, stat_key, sort_order, tier, is_active)
VALUES
  ('Nice Score',      'Fulfill a bounty worth 100+ Cores',   'vault', 'one_time', 25, 75,  100,  'best_bounty_reward', 334, 'platinum', true),
  ('Big Game Hunter', 'Fulfill a bounty worth 500+ Cores',   'vault', 'one_time', 30, 100, 500,  'best_bounty_reward', 335, 'diamond',  true),
  ('Jackpot',         'Fulfill a bounty worth 2,000+ Cores', 'vault', 'one_time', 35, 150, 2000, 'best_bounty_reward', 336, 'obsidian', true),
  ('The Motherload',  'Fulfill a bounty worth 5,000+ Cores', 'vault', 'one_time', 50, 300, 5000, 'best_bounty_reward', 337, 'master',   true)
ON CONFLICT (title) DO NOTHING;
