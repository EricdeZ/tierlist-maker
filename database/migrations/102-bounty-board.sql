-- Bounty Board — wanted card requests with Core escrow
CREATE TABLE cc_bounties (
    id              SERIAL PRIMARY KEY,
    poster_id       INTEGER NOT NULL REFERENCES users(id),
    card_type       VARCHAR(20) NOT NULL,
    card_name       VARCHAR(200) NOT NULL,
    rarity          VARCHAR(20) NOT NULL,
    holo_type       VARCHAR(20),
    core_reward     INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    fulfilled_by    INTEGER REFERENCES users(id),
    fulfilled_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ
);

CREATE INDEX idx_bounties_status ON cc_bounties(status);
CREATE INDEX idx_bounties_poster ON cc_bounties(poster_id);
CREATE INDEX idx_bounties_expires ON cc_bounties(expires_at) WHERE status = 'active';
CREATE INDEX idx_bounties_card_spec ON cc_bounties(card_type, card_name, rarity) WHERE status = 'active';

-- Performance index for fulfillable endpoint (joining bounties against user's cards)
CREATE INDEX idx_cards_bounty_match ON cc_cards(owner_id, card_type, god_name, rarity);
