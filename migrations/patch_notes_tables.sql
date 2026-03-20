-- Patch Notes tables
-- Run this migration to create the patch_notes system

CREATE TABLE patch_notes (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    version TEXT NOT NULL,
    subtitle TEXT,
    patch_date DATE,
    source_url TEXT,
    buff_count INTEGER DEFAULT 0,
    nerf_count INTEGER DEFAULT 0,
    new_item_count INTEGER DEFAULT 0,
    rework_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patch_note_god_changes (
    id SERIAL PRIMARY KEY,
    patch_note_id INTEGER NOT NULL REFERENCES patch_notes(id) ON DELETE CASCADE,
    god_name TEXT NOT NULL,
    god_id INTEGER REFERENCES gods(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL,
    abilities JSONB DEFAULT '[]',
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE patch_note_item_changes (
    id SERIAL PRIMARY KEY,
    patch_note_id INTEGER NOT NULL REFERENCES patch_notes(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    change_type TEXT NOT NULL,
    section TEXT DEFAULT 'item_balance',
    cost TEXT,
    build_path TEXT,
    stats JSONB DEFAULT '[]',
    passive_text TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_patch_note_god_changes_patch_id ON patch_note_god_changes(patch_note_id);
CREATE INDEX idx_patch_note_item_changes_patch_id ON patch_note_item_changes(patch_note_id);
CREATE INDEX idx_patch_notes_slug ON patch_notes(slug);
