-- Migration 006: Add audit_log_view permission
-- Grants the new permission to the Owner role only.

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'audit_log_view'
FROM roles r
WHERE r.name = 'Owner'
ON CONFLICT (role_id, permission_key) DO NOTHING;
