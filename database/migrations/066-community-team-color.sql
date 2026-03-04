-- Migration 066: Add color column to community teams
ALTER TABLE community_teams ADD COLUMN color VARCHAR(7) DEFAULT '#6366f1';
