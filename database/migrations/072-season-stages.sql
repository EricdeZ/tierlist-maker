-- 072-season-stages.sql
-- Tournament structure: stages, groups, rounds with flexible match slot sources

-- Phases of competition within a season (Regular Season, Playoffs, Finals, etc.)
CREATE TABLE season_stages (
    id SERIAL PRIMARY KEY,
    season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    stage_type TEXT,  -- round_robin, single_elimination, double_elimination, swiss, custom, NULL for freeform
    sort_order INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(season_id, slug)
);

-- Subdivisions within a stage (conferences, pools, brackets)
CREATE TABLE stage_groups (
    id SERIAL PRIMARY KEY,
    stage_id INT NOT NULL REFERENCES season_stages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    group_type TEXT NOT NULL DEFAULT 'default',
    sort_order INT NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}',
    UNIQUE(stage_id, slug)
);

-- Team membership in groups with optional seeding
CREATE TABLE stage_group_teams (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL REFERENCES stage_groups(id) ON DELETE CASCADE,
    team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    seed INT,
    UNIQUE(group_id, team_id)
);

-- Ordered rounds within a stage
CREATE TABLE stage_rounds (
    id SERIAL PRIMARY KEY,
    stage_id INT NOT NULL REFERENCES season_stages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    round_number INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    best_of_override INT,
    scheduled_date DATE,
    UNIQUE(stage_id, round_number)
);

-- Extend scheduled_matches with stage structure + slot sources
ALTER TABLE scheduled_matches
    ADD COLUMN stage_id INT REFERENCES season_stages(id) ON DELETE SET NULL,
    ADD COLUMN group_id INT REFERENCES stage_groups(id) ON DELETE SET NULL,
    ADD COLUMN round_id INT REFERENCES stage_rounds(id) ON DELETE SET NULL,
    ADD COLUMN bracket_position INT,
    ADD COLUMN team1_source JSONB,
    ADD COLUMN team2_source JSONB;

-- Make team1_id, team2_id, and scheduled_date nullable (bracket matches start without teams/date)
ALTER TABLE scheduled_matches ALTER COLUMN team1_id DROP NOT NULL;
ALTER TABLE scheduled_matches ALTER COLUMN team2_id DROP NOT NULL;
ALTER TABLE scheduled_matches ALTER COLUMN scheduled_date DROP NOT NULL;

-- Drop the old CHECK constraint that requires both teams to differ
-- (can't enforce when one or both are NULL for bracket slots)
ALTER TABLE scheduled_matches DROP CONSTRAINT IF EXISTS scheduled_matches_team1_id_team2_id_check;
ALTER TABLE scheduled_matches DROP CONSTRAINT IF EXISTS scheduled_matches_check;
-- Re-add with NULL tolerance
ALTER TABLE scheduled_matches ADD CONSTRAINT scheduled_matches_teams_differ
    CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id <> team2_id);

-- Extend completed matches with stage references
ALTER TABLE matches
    ADD COLUMN stage_id INT REFERENCES season_stages(id) ON DELETE SET NULL,
    ADD COLUMN group_id INT REFERENCES stage_groups(id) ON DELETE SET NULL,
    ADD COLUMN round_id INT REFERENCES stage_rounds(id) ON DELETE SET NULL;

-- Indexes for common queries
CREATE INDEX idx_season_stages_season ON season_stages(season_id);
CREATE INDEX idx_stage_groups_stage ON stage_groups(stage_id);
CREATE INDEX idx_stage_group_teams_group ON stage_group_teams(group_id);
CREATE INDEX idx_stage_rounds_stage ON stage_rounds(stage_id);
CREATE INDEX idx_scheduled_matches_stage ON scheduled_matches(stage_id) WHERE stage_id IS NOT NULL;
CREATE INDEX idx_scheduled_matches_round ON scheduled_matches(round_id) WHERE round_id IS NOT NULL;
CREATE INDEX idx_matches_stage ON matches(stage_id) WHERE stage_id IS NOT NULL;
