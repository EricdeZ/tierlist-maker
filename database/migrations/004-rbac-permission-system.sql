-- Migration 004: RBAC Permission System
-- Adds roles, role_permissions, and user_roles tables for granular, league-scoped access control.

-- ─── 1. Roles table ───
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Role permissions table ───
CREATE TABLE IF NOT EXISTS role_permissions (
    id              SERIAL PRIMARY KEY,
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key  VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_key)
);

-- ─── 3. User-role assignments table ───
CREATE TABLE IF NOT EXISTS user_roles (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    league_id   INTEGER REFERENCES leagues(id) ON DELETE CASCADE,  -- NULL = global (all leagues)
    granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: prevent duplicate (user, role, league) combos
-- For non-null league_id, the regular unique index handles it
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_scoped
    ON user_roles (user_id, role_id, league_id)
    WHERE league_id IS NOT NULL;

-- For global assignments (league_id IS NULL), prevent duplicate (user, role) combos
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_global
    ON user_roles (user_id, role_id)
    WHERE league_id IS NULL;

-- ─── 4. Seed system roles ───
INSERT INTO roles (name, description, is_system) VALUES
    ('Owner', 'Full system access including permission management.', true),
    ('Admin', 'Full access to all admin tools except permission management.', true)
ON CONFLICT (name) DO NOTHING;

-- ─── 5. Seed Owner permissions (all 8) ───
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM roles r,
    (VALUES ('match_report'), ('roster_manage'), ('match_manage'), ('player_manage'),
            ('league_manage'), ('user_manage'), ('claim_manage'), ('permission_manage')) AS p(key)
WHERE r.name = 'Owner'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ─── 6. Seed Admin permissions (all except permission_manage) ───
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM roles r,
    (VALUES ('match_report'), ('roster_manage'), ('match_manage'), ('player_manage'),
            ('league_manage'), ('user_manage'), ('claim_manage')) AS p(key)
WHERE r.name = 'Admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ─── 7. Bootstrap: migrate existing admin users to the Admin role (global) ───
INSERT INTO user_roles (user_id, role_id, league_id)
SELECT u.id, r.id, NULL
FROM users u, roles r
WHERE u.role = 'admin' AND r.name = 'Admin'
ON CONFLICT DO NOTHING;
