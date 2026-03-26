-- 149-blueprint-unification.sql
-- Merge cc_card_templates + cc_card_drafts into cc_card_blueprints

-- 1. Create unified blueprints table
CREATE TABLE cc_card_blueprints (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    card_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    target_player_id INTEGER,
    rejection_reason TEXT,
    depicted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    source TEXT NOT NULL,
    legacy_template_id INTEGER,
    legacy_draft_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_card_blueprints_status ON cc_card_blueprints(status);
CREATE INDEX idx_cc_card_blueprints_created_by ON cc_card_blueprints(created_by);
CREATE INDEX idx_cc_card_blueprints_status_creator ON cc_card_blueprints(status, created_by);

-- 2. Copy templates
INSERT INTO cc_card_blueprints (name, description, card_type, rarity, status, template_data, thumbnail_url, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, source, legacy_template_id, created_at, updated_at)
SELECT name, description, card_type, rarity, status, template_data, thumbnail_url, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, 'template', id, created_at, updated_at
FROM cc_card_templates;

-- 3. Copy drafts
INSERT INTO cc_card_blueprints (name, description, card_type, rarity, status, template_data, thumbnail_url, target_player_id, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, source, legacy_draft_id, created_at, updated_at)
SELECT COALESCE(notes, 'Untitled'), NULL, card_type, rarity, status, template_data, thumbnail_url, target_player_id, rejection_reason, depicted_user_id, created_by, approved_by, approved_at, 'draft', id, created_at, updated_at
FROM cc_card_drafts;

-- 4. Add blueprint_id to cc_collection_entries
ALTER TABLE cc_collection_entries ADD COLUMN blueprint_id INTEGER REFERENCES cc_card_blueprints(id) ON DELETE RESTRICT;

UPDATE cc_collection_entries ce
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE ce.template_id IS NOT NULL AND bp.legacy_template_id = ce.template_id AND bp.source = 'template';

UPDATE cc_collection_entries ce
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE ce.draft_id IS NOT NULL AND bp.legacy_draft_id = ce.draft_id AND bp.source = 'draft';

CREATE UNIQUE INDEX idx_cc_collection_entries_blueprint ON cc_collection_entries(collection_id, blueprint_id) WHERE blueprint_id IS NOT NULL;

-- 5. Add blueprint_id to cc_cards
ALTER TABLE cc_cards ADD COLUMN blueprint_id INTEGER REFERENCES cc_card_blueprints(id) ON DELETE SET NULL;

-- Backfill cards that have template_id (template-sourced collection cards)
UPDATE cc_cards c
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE c.template_id IS NOT NULL AND bp.legacy_template_id = c.template_id AND bp.source = 'template';

-- Backfill draft-sourced collection cards via god_id pattern 'collection-{draft_id}'
-- These cards have template_id=NULL but god_id='collection-{id}' where id is the draft id
UPDATE cc_cards c
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE c.card_type = 'collection'
  AND c.template_id IS NULL
  AND c.blueprint_id IS NULL
  AND c.god_id LIKE 'collection-%'
  AND bp.legacy_draft_id = CAST(SUBSTRING(c.god_id FROM 'collection-(.+)') AS INTEGER)
  AND bp.source = 'draft';

-- Backfill card_type from blueprint for all collection cards
UPDATE cc_cards c
SET card_type = bp.card_type
FROM cc_card_blueprints bp
WHERE c.card_type = 'collection' AND c.blueprint_id = bp.id;

CREATE INDEX idx_cc_cards_blueprint ON cc_cards(blueprint_id);

-- 6. Add blueprint_id to cc_promo_gifts
ALTER TABLE cc_promo_gifts ADD COLUMN blueprint_id INTEGER REFERENCES cc_card_blueprints(id);

UPDATE cc_promo_gifts pg
SET blueprint_id = bp.id
FROM cc_card_blueprints bp
WHERE pg.template_id IS NOT NULL AND bp.legacy_template_id = pg.template_id AND bp.source = 'template';
