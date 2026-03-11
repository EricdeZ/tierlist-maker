-- Redeem codes: allow admins to create codes that grant packs when redeemed
CREATE TABLE cc_redeem_codes (
    id          SERIAL PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    pack_type_id TEXT NOT NULL,
    mode        TEXT NOT NULL CHECK (mode IN ('single', 'per_person')),
    max_uses    INTEGER,
    expires_at  TIMESTAMPTZ,
    times_redeemed INTEGER NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cc_redeem_history (
    id          SERIAL PRIMARY KEY,
    code_id     INTEGER NOT NULL REFERENCES cc_redeem_codes(id),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(code_id, user_id)
);

CREATE INDEX idx_redeem_codes_code ON cc_redeem_codes(code);
CREATE INDEX idx_redeem_history_user ON cc_redeem_history(user_id);
