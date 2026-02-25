-- 052: Arcade NPCs — admin-configurable characters for the game hub
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS arcade_npcs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    quote TEXT NOT NULL,
    image_url TEXT,
    spawn_qx INTEGER,
    spawn_qy INTEGER,
    active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
