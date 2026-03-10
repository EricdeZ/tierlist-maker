-- Card Clash: Player-to-player trading

CREATE TABLE cc_trades (
    id SERIAL PRIMARY KEY,
    player_a_id INTEGER NOT NULL REFERENCES users(id),
    player_b_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'waiting',
    player_a_core INTEGER NOT NULL DEFAULT 0,
    player_b_core INTEGER NOT NULL DEFAULT 0,
    player_a_ready BOOLEAN NOT NULL DEFAULT false,
    player_b_ready BOOLEAN NOT NULL DEFAULT false,
    player_a_confirmed BOOLEAN NOT NULL DEFAULT false,
    player_b_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_polled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT cc_trades_not_self CHECK (player_a_id != player_b_id)
);

CREATE TABLE cc_trade_cards (
    id SERIAL PRIMARY KEY,
    trade_id INTEGER NOT NULL REFERENCES cc_trades(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cc_cards(id),
    offered_by INTEGER NOT NULL REFERENCES users(id),
    UNIQUE(trade_id, card_id)
);

-- Max 1 active/waiting trade per user (as initiator or recipient)
CREATE UNIQUE INDEX idx_cc_trades_player_a_active
    ON cc_trades(player_a_id) WHERE status IN ('waiting', 'active');
CREATE UNIQUE INDEX idx_cc_trades_player_b_active
    ON cc_trades(player_b_id) WHERE status IN ('waiting', 'active');

-- Lookup indexes
CREATE INDEX idx_cc_trades_status ON cc_trades(status);
CREATE INDEX idx_cc_trade_cards_trade ON cc_trade_cards(trade_id);
CREATE INDEX idx_cc_trade_cards_card ON cc_trade_cards(card_id);
