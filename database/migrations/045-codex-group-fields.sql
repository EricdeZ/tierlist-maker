-- Migration 045: Add group field type support to codex fields
-- Adds options JSONB column for storing sub-field definitions when field_type = 'group'

ALTER TABLE codex_fields ADD COLUMN options JSONB;
ALTER TABLE codex_god_fields ADD COLUMN options JSONB;
