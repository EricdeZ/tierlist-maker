CREATE TABLE IF NOT EXISTS cc_player_def_exclusions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  excluded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, team_id, season_id)
);
