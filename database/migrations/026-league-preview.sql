-- Migration 026: league_preview permission
-- Adds league_preview to Owner and Admin system roles so they can view
-- inactive seasons. Can be granted per-league to let others preview too.

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'league_preview'
FROM roles r
WHERE r.name IN ('Owner', 'Admin')
  AND r.is_system = true
ON CONFLICT DO NOTHING;
