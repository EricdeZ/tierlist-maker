-- 110-vault-dashboard.sql
-- Vault Dashboard: card templates, drafts, asset library, permissions

-- New permissions
INSERT INTO permissions (key, description) VALUES
  ('vault_member', 'Access Vault Dashboard and card creator'),
  ('vault_approve', 'Approve/reject card designs and delete assets')
ON CONFLICT (key) DO NOTHING;

-- Grant vault_member and vault_approve to Owner role
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r, (VALUES ('vault_member'), ('vault_approve')) AS p(key)
WHERE r.name = 'Owner'
ON CONFLICT DO NOTHING;

-- Card templates (reusable designs)
CREATE TABLE cc_card_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    card_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    rejection_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_card_templates_status ON cc_card_templates(status);
CREATE INDEX idx_cc_card_templates_created_by ON cc_card_templates(created_by);
CREATE INDEX idx_cc_card_templates_status_creator ON cc_card_templates(status, created_by);

-- Card drafts (one-off designs)
CREATE TABLE cc_card_drafts (
    id SERIAL PRIMARY KEY,
    card_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    target_player_id INTEGER,
    notes TEXT,
    rejection_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_card_drafts_status ON cc_card_drafts(status);
CREATE INDEX idx_cc_card_drafts_created_by ON cc_card_drafts(created_by);
CREATE INDEX idx_cc_card_drafts_status_creator ON cc_card_drafts(status, created_by);

-- Asset library
CREATE TABLE cc_asset_library (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_asset_library_category ON cc_asset_library(category);
CREATE INDEX idx_cc_asset_library_tags ON cc_asset_library USING GIN(tags);

-- Link approved templates to minted cards
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES cc_card_templates(id) ON DELETE SET NULL;
