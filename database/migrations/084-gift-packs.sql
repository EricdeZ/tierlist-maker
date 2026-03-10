-- Migration 084: Gift pack system
-- Each user gets 5 gift packs to send to other players (one per recipient).
-- Gift packs contain 5 cards: gods/items/consumables from both leagues, no wildcard.

CREATE TABLE IF NOT EXISTS cc_gifts (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT,
    opened BOOLEAN NOT NULL DEFAULT false,
    seen BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    CONSTRAINT cc_gifts_no_self CHECK (sender_id != recipient_id),
    CONSTRAINT cc_gifts_unique_pair UNIQUE (sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_gifts_recipient ON cc_gifts(recipient_id, opened, seen);
CREATE INDEX IF NOT EXISTS idx_cc_gifts_sender ON cc_gifts(sender_id);

-- Insert the gift pack type (disabled from shop — only used internally)
INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, enabled, sort_order)
VALUES ('gift', 'Gift Pack', 'A gift from a friend! Contains 5 cards from both leagues.', 0, 5, 'mixed', false, 99)
ON CONFLICT (id) DO NOTHING;
