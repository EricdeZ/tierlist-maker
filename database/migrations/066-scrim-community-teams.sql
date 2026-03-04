-- Migration 066: Allow community teams in scrims
-- Adds a flag to scrim_requests so posters can opt-in to community team acceptors.

ALTER TABLE scrim_requests
    ADD COLUMN allow_community_teams BOOLEAN NOT NULL DEFAULT false;
