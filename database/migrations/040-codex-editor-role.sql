-- Migration 040: Codex Editor role and codex_edit permission
-- Adds a system role "Codex Editor" with codex_edit permission.
-- Also grants codex_edit to Owner and Admin system roles.

-- Create the Codex Editor system role
INSERT INTO roles (name, description, is_system)
VALUES ('Codex Editor', 'Can access and edit the Codex', true)
ON CONFLICT (name) DO NOTHING;

-- Grant codex_edit permission to Owner, Admin, and Codex Editor
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'codex_edit'
FROM roles r
WHERE r.name IN ('Owner', 'Admin', 'Codex Editor')
  AND r.is_system = true
ON CONFLICT DO NOTHING;
