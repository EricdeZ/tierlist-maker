-- Migration 036: Add acceptable_tiers to scrim_requests
-- Allows scrim posters to specify which division tiers they want to accept.
-- Stored as a JSONB array of integers (e.g., [1, 2, 3]).
-- NULL means "accept all tiers" for backward compatibility.

ALTER TABLE scrim_requests ADD COLUMN acceptable_tiers JSONB;
