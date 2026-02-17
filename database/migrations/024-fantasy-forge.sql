-- Migration 024: Fantasy Forge System
-- Per-season player investment market with bonding curve pricing
-- and price-relative performance multipliers.

-- ═══════════════════════════════════════════════════
-- 1. Forge Markets — one per active season
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS forge_markets (
    id          serial PRIMARY KEY,
    season_id   integer NOT NULL UNIQUE REFERENCES seasons(id) ON DELETE CASCADE,
    status      varchar(20) NOT NULL DEFAULT 'open',
    base_price  integer NOT NULL DEFAULT 100,
    created_at  timestamptz NOT NULL DEFAULT NOW(),
    closed_at   timestamptz
);

DO $$ BEGIN
    ALTER TABLE forge_markets ADD CONSTRAINT forge_markets_status_check
        CHECK (status IN ('open', 'closed', 'liquidated'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
-- 2. Player Sparks — per-player price tracking within a market
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS player_sparks (
    id               serial PRIMARY KEY,
    market_id        integer NOT NULL REFERENCES forge_markets(id) ON DELETE CASCADE,
    league_player_id integer NOT NULL REFERENCES league_players(id) ON DELETE CASCADE,
    current_price    numeric(10,2) NOT NULL DEFAULT 100.00,
    total_sparks     integer NOT NULL DEFAULT 0,
    perf_multiplier  numeric(6,4) NOT NULL DEFAULT 1.0000,
    last_perf_update timestamptz,
    created_at       timestamptz NOT NULL DEFAULT NOW(),
    updated_at       timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(market_id, league_player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_sparks_market ON player_sparks(market_id);
CREATE INDEX IF NOT EXISTS idx_player_sparks_lp ON player_sparks(league_player_id);

-- ═══════════════════════════════════════════════════
-- 3. Spark Price History — snapshot after each price change
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS spark_price_history (
    id          serial PRIMARY KEY,
    spark_id    integer NOT NULL REFERENCES player_sparks(id) ON DELETE CASCADE,
    price       numeric(10,2) NOT NULL,
    trigger     varchar(20) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE spark_price_history ADD CONSTRAINT spark_price_history_trigger_check
        CHECK (trigger IN ('fuel', 'cool', 'performance', 'init'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_spark_price_history_spark
    ON spark_price_history(spark_id, created_at DESC);

-- ═══════════════════════════════════════════════════
-- 4. Spark Holdings — user positions
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS spark_holdings (
    id              serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spark_id        integer NOT NULL REFERENCES player_sparks(id) ON DELETE CASCADE,
    sparks          integer NOT NULL DEFAULT 0 CHECK (sparks >= 0),
    total_invested  numeric(10,2) NOT NULL DEFAULT 0.00,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, spark_id)
);

CREATE INDEX IF NOT EXISTS idx_spark_holdings_user ON spark_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_spark_holdings_spark ON spark_holdings(spark_id);

-- ═══════════════════════════════════════════════════
-- 5. Spark Transactions — immutable trade ledger
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS spark_transactions (
    id              serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spark_id        integer NOT NULL REFERENCES player_sparks(id) ON DELETE CASCADE,
    type            varchar(20) NOT NULL,
    sparks          integer NOT NULL CHECK (sparks > 0),
    price_per_spark numeric(10,2) NOT NULL,
    total_cost      integer NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE spark_transactions ADD CONSTRAINT spark_transactions_type_check
        CHECK (type IN ('fuel', 'cool', 'liquidate'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_spark_transactions_user
    ON spark_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spark_transactions_spark
    ON spark_transactions(spark_id);

-- ═══════════════════════════════════════════════════
-- 6. Seed Fantasy Forge challenges
-- ═══════════════════════════════════════════════════
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('First Spark', 'Fuel your first player in the Fantasy Forge', 'engagement', 'one_time', 10, 1, 'sparks_fueled', 300, 'clay')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Cool Operator', 'Cool 5 positions in the Fantasy Forge', 'engagement', 'one_time', 20, 5, 'sparks_cooled', 301, 'bronze')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Forge Builder', 'Fuel 10 different players in the Fantasy Forge', 'engagement', 'one_time', 25, 10, 'sparks_fueled', 302, 'silver')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Forge Master', 'Earn 500 total profit from the Fantasy Forge', 'engagement', 'one_time', 50, 500, 'forge_profit', 303, 'gold')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Market Titan', 'Earn 2000 total profit from the Fantasy Forge', 'engagement', 'one_time', 100, 2000, 'forge_profit', 304, 'platinum')
ON CONFLICT (title) DO NOTHING;
