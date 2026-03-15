-- Migration 117: Backfill reported_by from audit_log
-- Matches created before migration 021 (Feb 17, 2026) have reported_by = NULL,
-- making them invisible to match_manage_own users in Match Manager.
-- The audit_log has submit-match entries with user_id (reporter) and target_id (match_id).

UPDATE matches m
SET reported_by = al.user_id
FROM audit_log al
WHERE m.reported_by IS NULL
  AND al.action = 'submit-match'
  AND al.target_type = 'match'
  AND al.target_id = m.id
  AND al.user_id IS NOT NULL;
