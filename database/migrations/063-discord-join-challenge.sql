-- Migration 063: Discord join challenge
-- One-time challenge rewarding 100 Passion for joining the smitecomp.com Discord server.
-- This is manually claimable (no automatic stat tracking).

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Join the Community', 'Join the smitecomp.com Discord server', 'engagement', 'one_time', 100, 1, 'discord_joined', 5, 'gold')
ON CONFLICT (title) DO NOTHING;
