-- Card signature feature: depicted player signs unique cards
ALTER TABLE cc_cards ADD COLUMN signature_url TEXT DEFAULT NULL;

CREATE TABLE cc_signature_requests (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cc_cards(id),
    requester_id INTEGER NOT NULL REFERENCES users(id),
    signer_player_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, signed, declined
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signed_at TIMESTAMPTZ,
    UNIQUE(card_id)
);

CREATE INDEX idx_signature_requests_signer ON cc_signature_requests(signer_player_id, status);
