-- Tradematch: Tinder-style card trading matchmaker

-- Trade pile: cards marked for trade
CREATE TABLE cc_trade_pile (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    card_id INTEGER NOT NULL REFERENCES cc_cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);
CREATE INDEX idx_cc_trade_pile_user ON cc_trade_pile(user_id);
CREATE INDEX idx_cc_trade_pile_card ON cc_trade_pile(card_id);

-- Swipes: right-swipe records only
CREATE TABLE cc_swipes (
    id SERIAL PRIMARY KEY,
    swiper_id INTEGER NOT NULL REFERENCES users(id),
    card_id INTEGER NOT NULL REFERENCES cc_cards(id) ON DELETE CASCADE,
    card_owner_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(swiper_id, card_id)
);
CREATE INDEX idx_cc_swipes_owner ON cc_swipes(card_owner_id);
CREATE INDEX idx_cc_swipes_swiper ON cc_swipes(swiper_id);

-- Add mode column to cc_trades
ALTER TABLE cc_trades ADD COLUMN mode TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE cc_trades ADD COLUMN match_swipe_a_id INTEGER REFERENCES cc_swipes(id);
ALTER TABLE cc_trades ADD COLUMN match_swipe_b_id INTEGER REFERENCES cc_swipes(id);

-- Recreate unique indexes with mode filter (direct trades only)
DROP INDEX idx_cc_trades_player_a_active;
DROP INDEX idx_cc_trades_player_b_active;
CREATE UNIQUE INDEX idx_cc_trades_player_a_active
    ON cc_trades(player_a_id) WHERE status IN ('waiting', 'active') AND mode = 'direct';
CREATE UNIQUE INDEX idx_cc_trades_player_b_active
    ON cc_trades(player_b_id) WHERE status IN ('waiting', 'active') AND mode = 'direct';

-- Prevent duplicate active matches between the same pair
CREATE UNIQUE INDEX idx_cc_trades_match_pair_active
    ON cc_trades (LEAST(player_a_id, player_b_id), GREATEST(player_a_id, player_b_id))
    WHERE mode = 'match' AND status = 'active';

-- Index for outgoing match count
CREATE INDEX idx_cc_trades_match_outgoing
    ON cc_trades(player_a_id) WHERE mode = 'match' AND status = 'active';
