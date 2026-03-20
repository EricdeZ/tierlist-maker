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
('Quick Opener', 'Open 2 packs today', 'daily', 'cores', 15, NULL, 'packs_opened', 2),
('Daily Dismantler', 'Dismantle 5 cards today', 'daily', 'cores', 10, NULL, 'cards_dismantled', 5),
('Core Collector', 'Claim your daily Cores', 'daily', 'cores', 10, NULL, 'daily_cores_claimed', 1),
('Converter', 'Convert Passion to Cores twice', 'daily', 'cores', 20, NULL, 'cores_converted', 2),
-- Daily pack
('Pack Prize', 'Open 3 packs today', 'daily', 'pack', NULL, 1, 'packs_opened', 3),
('Trade for Packs', 'Complete a trade today', 'daily', 'pack', NULL, 1, 'trades_completed', 1),
('Market Seller', 'Sell 2 cards on the marketplace', 'daily', 'pack', NULL, 1, 'marketplace_sold', 2),
-- Daily mixed
('Lucky Opener', 'Open 4 packs today', 'daily', 'mixed', 10, 1, 'packs_opened', 4),
('Generous Trader', 'Send a gift pack', 'daily', 'mixed', 10, 1, 'gifts_sent', 1),
('Salvage & Earn', 'Dismantle 8 cards today', 'daily', 'mixed', 15, 1, 'cards_dismantled', 8),
-- Weekly cores
('Weekly Opener', 'Open 10 packs this week', 'weekly', 'cores', 40, NULL, 'packs_opened', 10),
('Marketplace Regular', 'Sell 8 cards this week', 'weekly', 'cores', 35, NULL, 'marketplace_sold', 8),
('Dismantle Spree', 'Dismantle 25 cards this week', 'weekly', 'cores', 30, NULL, 'cards_dismantled', 25),
('Core Hoarder', 'Claim daily Cores 5 times', 'weekly', 'cores', 50, NULL, 'daily_cores_claimed', 5),
-- Weekly pack
('Trade Master', 'Complete 3 trades this week', 'weekly', 'pack', NULL, 2, 'trades_completed', 3),
('Gift Giver', 'Send 3 gift packs this week', 'weekly', 'pack', NULL, 2, 'gifts_sent', 3),
-- Weekly mixed
('Big Spender', 'Open 15 packs this week', 'weekly', 'mixed', 30, 2, 'packs_opened', 15),
('Social Butterfly', 'Send 2 gift packs this week', 'weekly', 'mixed', 25, 1, 'gifts_sent', 2),
-- Monthly cores
('Monthly Marathon', 'Open 40 packs this month', 'monthly', 'cores', 100, NULL, 'packs_opened', 40),
('Market Mogul', 'Sell 30 cards this month', 'monthly', 'cores', 80, NULL, 'marketplace_sold', 30),
-- Monthly pack
('Salvage King', 'Dismantle 80 cards this month', 'monthly', 'pack', NULL, 3, 'cards_dismantled', 80),
('Bounty Hunter', 'Earn 200 Cores from bounties', 'monthly', 'pack', NULL, 3, 'bounty_cores_earned', 200),
-- Monthly mixed
('Pack Legend', 'Open 60 packs this month', 'monthly', 'mixed', 75, 3, 'packs_opened', 60),
('Trading Empire', 'Complete 10 trades this month', 'monthly', 'mixed', 60, 2, 'trades_completed', 10),
('Core Machine', 'Convert Passion 20 times this month', 'monthly', 'mixed', 50, 2, 'cores_converted', 20);
