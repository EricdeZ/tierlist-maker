-- Migration 065: Community Teams (Bring Your Own Team)
-- Self-service team creation separate from admin-managed league teams.

CREATE TABLE community_teams (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    logo_url        TEXT,
    skill_tier      INTEGER NOT NULL CHECK (skill_tier BETWEEN 1 AND 5),
    owner_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_teams_owner ON community_teams(owner_user_id);

CREATE TABLE community_team_members (
    id          SERIAL PRIMARY KEY,
    team_id     INTEGER NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('captain', 'member')),
    status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'left')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

CREATE INDEX idx_ctm_user ON community_team_members(user_id);

-- One active captain per team
CREATE UNIQUE INDEX uq_ctm_one_captain
    ON community_team_members (team_id)
    WHERE role = 'captain' AND status = 'active';

CREATE TABLE community_team_invitations (
    id              SERIAL PRIMARY KEY,
    team_id         INTEGER NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('invite', 'request', 'link')),
    from_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invite_code     VARCHAR(32),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at    TIMESTAMPTZ
);

CREATE INDEX idx_cti_to_user_pending ON community_team_invitations(to_user_id) WHERE status = 'pending';

-- Prevent duplicate pending invitations of same type to same user
CREATE UNIQUE INDEX uq_cti_pending
    ON community_team_invitations (team_id, to_user_id, type)
    WHERE status = 'pending' AND to_user_id IS NOT NULL;

-- Unique invite codes
CREATE UNIQUE INDEX uq_cti_invite_code
    ON community_team_invitations (invite_code)
    WHERE invite_code IS NOT NULL;
