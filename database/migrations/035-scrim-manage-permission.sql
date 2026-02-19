-- Migration 035: scrim_manage permission
-- Allows users with this permission to create/accept/cancel/decline scrims
-- on behalf of any active team, without needing to be a team captain.

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'scrim_manage'
FROM roles r
WHERE r.name IN ('Owner', 'Admin')
  AND r.is_system = true
ON CONFLICT DO NOTHING;
