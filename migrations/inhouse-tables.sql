-- Inhouse ("The Arcade") tables
-- Run against Neon PostgreSQL

-- ═══════════════════════════════════════════════════
-- Lobbies (cabinets)
-- ═══════════════════════════════════════════════════
CREATE TABLE inhouse_lobbies (
    id                  serial PRIMARY KEY,
    creator_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               varchar(255) NOT NULL,
    mode                varchar(10) NOT NULL,
    access_scope        varchar(20) NOT NULL,
    division_id         integer REFERENCES divisions(id) ON DELETE SET NULL,
    league_id           integer REFERENCES leagues(id) ON DELETE SET NULL,
    scheduled_at        timestamptz,
    pick_timer          integer NOT NULL DEFAULT 30,
    max_players         integer NOT NULL DEFAULT 10,
    max_subs            integer NOT NULL DEFAULT 2,
    status              varchar(20) NOT NULL DEFAULT 'open',
    captain_left_id     integer REFERENCES users(id) ON DELETE SET NULL,
    captain_right_id    integer REFERENCES users(id) ON DELETE SET NULL,
    draft_started_at    timestamptz,
    draft_data          jsonb,
    draft_turn_deadline timestamptz,
    winning_side        varchar(10),
    result_resolved_at  timestamptz,
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_lobby_mode CHECK (mode IN ('scheduled', 'live')),
    CONSTRAINT chk_lobby_access CHECK (access_scope IN ('division', 'league', 'open')),
    CONSTRAINT chk_lobby_status CHECK (status IN ('open', 'ready', 'drafting', 'active', 'voting', 'completed', 'cancelled', 'expired')),
    CONSTRAINT chk_winning_side CHECK (winning_side IS NULL OR winning_side IN ('left', 'right'))
);

CREATE INDEX idx_inhouse_lobbies_status ON inhouse_lobbies(status);
CREATE INDEX idx_inhouse_lobbies_creator ON inhouse_lobbies(creator_id);
CREATE INDEX idx_inhouse_lobbies_scheduled ON inhouse_lobbies(scheduled_at) WHERE status = 'open';

-- ═══════════════════════════════════════════════════
-- Participants (signed-up players)
-- ═══════════════════════════════════════════════════
CREATE TABLE inhouse_participants (
    id              serial PRIMARY KEY,
    lobby_id        integer NOT NULL REFERENCES inhouse_lobbies(id) ON DELETE CASCADE,
    user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_roles varchar(100),
    is_sub          boolean NOT NULL DEFAULT false,
    team_side       varchar(10),
    pick_number     integer,
    joined_at       timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_inhouse_lobby_user UNIQUE(lobby_id, user_id),
    CONSTRAINT chk_participant_side CHECK (team_side IS NULL OR team_side IN ('left', 'right'))
);

CREATE INDEX idx_inhouse_participants_lobby ON inhouse_participants(lobby_id);
CREATE INDEX idx_inhouse_participants_user ON inhouse_participants(user_id);

-- ═══════════════════════════════════════════════════
-- Votes (weighted result reporting)
-- ═══════════════════════════════════════════════════
CREATE TABLE inhouse_votes (
    id          serial PRIMARY KEY,
    lobby_id    integer NOT NULL REFERENCES inhouse_lobbies(id) ON DELETE CASCADE,
    user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_side   varchar(10) NOT NULL,
    weight      integer NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_inhouse_vote UNIQUE(lobby_id, user_id),
    CONSTRAINT chk_vote_side CHECK (vote_side IN ('left', 'right'))
);

CREATE INDEX idx_inhouse_votes_lobby ON inhouse_votes(lobby_id);

-- ═══════════════════════════════════════════════════
-- Stats (denormalized W/L records per player)
-- ═══════════════════════════════════════════════════
CREATE TABLE inhouse_stats (
    id          serial PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wins        integer NOT NULL DEFAULT 0,
    losses      integer NOT NULL DEFAULT 0,
    games       integer NOT NULL DEFAULT 0,
    streak      integer NOT NULL DEFAULT 0,
    best_streak integer NOT NULL DEFAULT 0,
    updated_at  timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_inhouse_stats_user UNIQUE(user_id)
);

CREATE INDEX idx_inhouse_stats_wins ON inhouse_stats(wins DESC);
CREATE INDEX idx_inhouse_stats_games ON inhouse_stats(games DESC);
