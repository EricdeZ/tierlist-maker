-- Collections: curated groups of approved templates for pack distribution
CREATE TABLE cc_collections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cc_collections_status ON cc_collections(status);

CREATE TABLE cc_collection_entries (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL REFERENCES cc_collections(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES cc_card_templates(id) ON DELETE RESTRICT,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, template_id)
);
CREATE INDEX idx_cc_collection_entries_collection ON cc_collection_entries(collection_id);
