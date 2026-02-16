-- Migration 018: Data Issue Reports
-- Allows authenticated users to report data problems on matches.

CREATE TABLE IF NOT EXISTS data_reports (
    id              serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id        integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    category        varchar(30) NOT NULL,
    details         text NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'pending',
    admin_note      text,
    resolved_by     integer REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    resolved_at     timestamptz
);

DO $$ BEGIN
    ALTER TABLE data_reports ADD CONSTRAINT data_reports_category_check
        CHECK (category IN ('wrong_score', 'wrong_stats', 'wrong_god', 'missing_data', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE data_reports ADD CONSTRAINT data_reports_status_check
        CHECK (status IN ('pending', 'resolved', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_reports_user ON data_reports(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_data_reports_match ON data_reports(match_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_status ON data_reports(status);
