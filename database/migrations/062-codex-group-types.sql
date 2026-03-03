-- Reusable group type templates for codex fields
CREATE TABLE codex_group_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sub_fields JSONB NOT NULL DEFAULT '[]',
    sentence_template TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add group_type_id FK to codex_fields
ALTER TABLE codex_fields
    ADD COLUMN group_type_id INTEGER REFERENCES codex_group_types(id) ON DELETE SET NULL;

-- Add group_type_id FK to codex_god_fields
ALTER TABLE codex_god_fields
    ADD COLUMN group_type_id INTEGER REFERENCES codex_group_types(id) ON DELETE SET NULL;
