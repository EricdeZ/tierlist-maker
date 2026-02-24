-- Migration 042: team_manage permission
-- Allows creating, editing, deleting teams and uploading team icons.
-- Granted to Owner, Admin system roles and the custom League Manager role.

-- Grant to system roles
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'team_manage'
FROM roles r
WHERE r.name IN ('Owner', 'Admin')
  AND r.is_system = true
ON CONFLICT DO NOTHING;

-- Grant to custom "League Manager" role if it exists
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'team_manage'
FROM roles r
WHERE r.name = 'League Manager'
ON CONFLICT DO NOTHING;
