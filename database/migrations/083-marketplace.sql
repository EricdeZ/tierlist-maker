-- Card Clash marketplace: player-to-player card listings

CREATE TABLE IF NOT EXISTS cc_market_listings (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES cc_cards(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('passion', 'core', 'adaptive')),
  passion_price INTEGER,          -- set when price_type = 'passion' or 'adaptive'
  core_price INTEGER,             -- set when price_type = 'core' or 'adaptive'
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_id INTEGER REFERENCES users(id),
  currency_used TEXT,             -- actual currency used for purchase (passion/core)
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_passion_price CHECK (
    (price_type != 'passion' AND price_type != 'adaptive') OR passion_price IS NOT NULL
  ),
  CONSTRAINT valid_core_price CHECK (
    (price_type != 'core' AND price_type != 'adaptive') OR core_price IS NOT NULL
  )
);

-- Fast lookup for browsing active listings
CREATE INDEX IF NOT EXISTS idx_cc_market_active ON cc_market_listings(status, created_at DESC) WHERE status = 'active';

-- One active listing per card
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_market_card_active ON cc_market_listings(card_id) WHERE status = 'active';

-- Seller's listings (for count + my-listings)
CREATE INDEX IF NOT EXISTS idx_cc_market_seller ON cc_market_listings(seller_id, status);

-- Filter by rarity/type via join, but index price for range queries
CREATE INDEX IF NOT EXISTS idx_cc_market_passion_price ON cc_market_listings(passion_price) WHERE status = 'active' AND passion_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_market_core_price ON cc_market_listings(core_price) WHERE status = 'active' AND core_price IS NOT NULL;
