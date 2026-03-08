-- Direct profile titles (not tied to challenges)
CREATE TABLE user_titles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    tier VARCHAR(20) NOT NULL DEFAULT 'gold',
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, label)
);

CREATE INDEX idx_user_titles_user_id ON user_titles(user_id);
