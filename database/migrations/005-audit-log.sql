-- Migration 005: Audit Log
-- Tracks all admin actions for accountability and debugging.

CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username    VARCHAR(100),
    action      VARCHAR(100) NOT NULL,
    endpoint    VARCHAR(50) NOT NULL,
    league_id   INTEGER,
    target_type VARCHAR(50),
    target_id   INTEGER,
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_endpoint ON audit_log (endpoint);
