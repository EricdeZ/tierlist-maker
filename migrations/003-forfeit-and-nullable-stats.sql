-- Migration: Add forfeit support and nullable stat columns
-- Run against the Neon database

-- 1. Add is_forfeit flag to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_forfeit BOOLEAN DEFAULT false;

-- 2. Make non-KDA stat columns truly nullable (remove default 0)
-- These columns are already nullable in the schema, but we want to distinguish
-- "no data" (NULL) from "zero damage" (0). The defaults stay as-is in the schema
-- but the application will now explicitly send NULL for partial-stat games.

-- No ALTER needed since columns are already nullable with DEFAULT 0.
-- The change is purely application-level: we'll send NULL instead of 0 for missing stats.
