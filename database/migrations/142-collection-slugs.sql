-- Add slug column to cc_collections for public showcase URLs
ALTER TABLE cc_collections ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX idx_cc_collections_slug ON cc_collections(slug) WHERE slug IS NOT NULL;

-- Backfill slugs from existing names
UPDATE cc_collections SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9 -]', '', 'g'), '\s+', '-', 'g'));
