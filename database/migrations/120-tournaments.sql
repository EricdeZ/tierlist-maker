-- 120-tournaments.sql
-- Standalone tournament signup system

CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  draft_date DATE,
  game_dates JSONB DEFAULT '[]'::jsonb,
  signups_open BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  discord_invite_url VARCHAR(512),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tournament_signups (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  player_id INTEGER REFERENCES players(id),
  smite_name VARCHAR(255) NOT NULL,
  tracker_url VARCHAR(512),
  applying_as_captain BOOLEAN NOT NULL DEFAULT false,
  available_game_dates JSONB DEFAULT '[]'::jsonb,
  available_draft_date BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id),
  CHECK (applying_as_captain = false OR available_draft_date = true)
);

-- Add tournament_manage permission to Owner and Admin system roles
INSERT INTO role_permissions (role_id, permission_key)
SELECT id, 'tournament_manage' FROM roles WHERE name IN ('Owner', 'Admin');
