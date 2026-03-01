CREATE TABLE wordle_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tag_id INTEGER REFERENCES codex_god_tags(id) ON DELETE SET NULL,
    difficulty INTEGER NOT NULL DEFAULT 5 CHECK (difficulty >= 1 AND difficulty <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
