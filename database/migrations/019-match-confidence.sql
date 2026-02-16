-- Migration 019: Auto-match confidence tracking
-- Adds confidence level so admins can see which auto-matches need review.

ALTER TABLE discord_queue ADD COLUMN IF NOT EXISTS match_confidence VARCHAR(10)
    CHECK (match_confidence IN ('high', 'medium', 'low'));
