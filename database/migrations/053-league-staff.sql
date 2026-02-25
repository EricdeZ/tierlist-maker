-- Migration 053: League Staff system role and league_staff_manage permission
-- Adds a "League Staff" role with all scopeable permissions (except league_staff_manage).
-- Adds league_staff_manage to Owner and Admin so they can delegate staff.

-- Create the League Staff system role
INSERT INTO roles (name, description, is_system)
VALUES ('League Staff', 'League-scoped staff with management permissions', true)
ON CONFLICT (name) DO NOTHING;

-- Grant scopeable permissions to League Staff role (everything except league_staff_manage)
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, perm.key
FROM roles r
CROSS JOIN (VALUES
    ('match_report'),
    ('roster_manage'),
    ('match_manage'),
    ('match_manage_own'),
    ('match_schedule'),
    ('league_manage'),
    ('team_manage'),
    ('league_preview')
) AS perm(key)
WHERE r.name = 'League Staff' AND r.is_system = true
ON CONFLICT DO NOTHING;

-- Grant league_staff_manage to Owner and Admin
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'league_staff_manage'
FROM roles r
WHERE r.name IN ('Owner', 'Admin')
  AND r.is_system = true
ON CONFLICT DO NOTHING;
