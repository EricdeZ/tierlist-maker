-- Rotating challenge template pool
CREATE TABLE cc_challenge_templates (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
    reward_type TEXT NOT NULL CHECK (reward_type IN ('cores', 'pack', 'mixed')),
    reward_cores INTEGER,
    reward_packs INTEGER DEFAULT 1,
    stat_key TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user challenge assignments
CREATE TABLE cc_challenge_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    template_id INTEGER NOT NULL REFERENCES cc_challenge_templates(id),
    cadence TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    baseline_value INTEGER NOT NULL DEFAULT 0,
    current_value INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, template_id, period_start)
);

CREATE INDEX idx_cc_challenge_assignments_active
    ON cc_challenge_assignments (user_id, period_end)
    WHERE claimed = false;

CREATE INDEX idx_cc_challenge_assignments_period
    ON cc_challenge_assignments (user_id, cadence, period_start);

-- Ensure challenge-pack exists (user may have already created it)
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, guarantees, category, enabled, sort_order)
VALUES ('challenge-pack', 'Challenge Pack', 'Awarded from rotating challenges', 0, 3, '{"rare": 1}', 'reward', true, 999)
ON CONFLICT (id) DO NOTHING;

-- Seed daily templates (4 cores, 3 pack, 3 mixed — pool to pick from)
INSERT INTO cc_challenge_templates (title, description, cadence, reward_type, reward_cores, reward_packs, stat_key, target_value) VALUES
-- Daily cores
('Quick Opener', 'Open 3 packs today', 'daily', 'cores', 20, NULL, 'packs_opened', 3),
('Daily Dismantler', 'Dismantle 8 cards today', 'daily', 'cores', 15, NULL, 'cards_dismantled', 8),
('Core Collector', 'Claim your daily Cores', 'daily', 'cores', 15, NULL, 'daily_cores_claimed', 1),
('Converter', 'Convert Passion to Cores 3 times', 'daily', 'cores', 25, NULL, 'cores_converted', 3),
-- Daily pack
('Pack Prize', 'Open 5 packs today', 'daily', 'pack', NULL, 1, 'packs_opened', 5),
('Trade for Packs', 'Complete 2 trades today', 'daily', 'pack', NULL, 1, 'trades_completed', 2),
('Market Seller', 'Sell 3 cards on the marketplace', 'daily', 'pack', NULL, 1, 'marketplace_sold', 3),
-- Daily mixed
('Lucky Opener', 'Open 6 packs today', 'daily', 'mixed', 15, 1, 'packs_opened', 6),
('Generous Trader', 'Send 2 gift packs', 'daily', 'mixed', 15, 1, 'gifts_sent', 2),
('Salvage & Earn', 'Dismantle 12 cards today', 'daily', 'mixed', 20, 1, 'cards_dismantled', 12),
-- Weekly cores
('Weekly Opener', 'Open 15 packs this week', 'weekly', 'cores', 55, NULL, 'packs_opened', 15),
('Marketplace Regular', 'Sell 12 cards this week', 'weekly', 'cores', 50, NULL, 'marketplace_sold', 12),
('Dismantle Spree', 'Dismantle 35 cards this week', 'weekly', 'cores', 40, NULL, 'cards_dismantled', 35),
('Core Hoarder', 'Claim daily Cores 6 times', 'weekly', 'cores', 65, NULL, 'daily_cores_claimed', 6),
-- Weekly pack
('Trade Master', 'Complete 5 trades this week', 'weekly', 'pack', NULL, 3, 'trades_completed', 5),
('Gift Giver', 'Send 5 gift packs this week', 'weekly', 'pack', NULL, 3, 'gifts_sent', 5),
-- Weekly mixed
('Big Spender', 'Open 20 packs this week', 'weekly', 'mixed', 40, 2, 'packs_opened', 20),
('Social Butterfly', 'Send 3 gift packs this week', 'weekly', 'mixed', 35, 1, 'gifts_sent', 3),
-- Monthly cores
('Monthly Marathon', 'Open 55 packs this month', 'monthly', 'cores', 135, NULL, 'packs_opened', 55),
('Market Mogul', 'Sell 40 cards this month', 'monthly', 'cores', 110, NULL, 'marketplace_sold', 40),
-- Monthly pack
('Salvage King', 'Dismantle 110 cards this month', 'monthly', 'pack', NULL, 4, 'cards_dismantled', 110),
('Bounty Hunter', 'Earn 300 Cores from bounties', 'monthly', 'pack', NULL, 4, 'bounty_cores_earned', 300),
-- Monthly mixed
('Pack Legend', 'Open 80 packs this month', 'monthly', 'mixed', 100, 4, 'packs_opened', 80),
('Trading Empire', 'Complete 15 trades this month', 'monthly', 'mixed', 80, 3, 'trades_completed', 15),
('Core Machine', 'Convert Passion 30 times this month', 'monthly', 'mixed', 70, 3, 'cores_converted', 30);
