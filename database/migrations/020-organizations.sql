-- Migration 020: Organizations
-- Orgs group teams across seasons/divisions. Each org has a name, color, slug, and optional icon.

CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add organization_id FK to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;

-- Seed organizations from existing unique team slugs
-- Each unique team slug becomes an org, inheriting name and color from the first match
INSERT INTO organizations (name, slug, color)
SELECT DISTINCT ON (slug) name, slug, color
FROM teams
ORDER BY slug, id
ON CONFLICT (slug) DO NOTHING;

-- Link existing teams to their orgs by matching slug
UPDATE teams t
SET organization_id = o.id
FROM organizations o
WHERE t.slug = o.slug AND t.organization_id IS NULL;
