-- Migration 067: Roster transaction tracking
-- Logs all roster changes from Discord sync and manual admin actions.

CREATE TABLE roster_transactions (
    id              SERIAL PRIMARY KEY,
    season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_name     VARCHAR(255) NOT NULL,
    type            VARCHAR(30) NOT NULL,
    from_team_id    INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    from_team_name  VARCHAR(255),
    to_team_id      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    to_team_name    VARCHAR(255),
    from_status     VARCHAR(20),
    to_status       VARCHAR(20),
    source          VARCHAR(20) NOT NULL DEFAULT 'manual',
    admin_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_username  VARCHAR(100),
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roster_tx_season ON roster_transactions(season_id, created_at DESC);
CREATE INDEX idx_roster_tx_player ON roster_transactions(player_id);
