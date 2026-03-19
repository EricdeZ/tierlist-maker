CREATE TABLE tournament_egg_hunts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    eggs_collected INTEGER NOT NULL DEFAULT 0,
    cores_awarded INTEGER NOT NULL DEFAULT 0,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_egg_hunts_user_tournament ON tournament_egg_hunts(user_id, tournament_id);
