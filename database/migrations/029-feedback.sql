-- Migration 029: Feedback system
-- Users can submit feedback (bug reports, feature requests, general).
-- Admins with feedback_manage permission can view and delete entries.

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- Add feedback_manage to Owner + Admin system roles
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'feedback_manage'
FROM roles r
WHERE r.name IN ('Owner', 'Admin')
  AND r.is_system = true
ON CONFLICT DO NOTHING;
