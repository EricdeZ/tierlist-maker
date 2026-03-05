-- Migration 068: Drop team FK constraints from scrim_requests
-- Community teams use negative IDs (e.g., -5 for community_teams.id = 5),
-- which violates FK constraints referencing teams(id).
-- The application already handles both ID schemes with CASE WHEN logic.

ALTER TABLE scrim_requests DROP CONSTRAINT IF EXISTS scrim_requests_team_id_fkey;
ALTER TABLE scrim_requests DROP CONSTRAINT IF EXISTS scrim_requests_challenged_team_id_fkey;
ALTER TABLE scrim_requests DROP CONSTRAINT IF EXISTS scrim_requests_accepted_team_id_fkey;
ALTER TABLE scrim_requests DROP CONSTRAINT IF EXISTS scrim_requests_pending_team_id_fkey;
