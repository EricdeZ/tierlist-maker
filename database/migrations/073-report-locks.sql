-- Report locking: prevent multiple reporters working on the same scheduled match
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
