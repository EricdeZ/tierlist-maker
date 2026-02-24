-- Migration 041: Codex items system
-- Admin-defined fields, tags, and items with dynamic field values.

-- Field definitions (admin-configurable schema)
CREATE TABLE codex_fields (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    icon_url    TEXT,
    description TEXT,
    field_type  VARCHAR(20) NOT NULL DEFAULT 'text',
    required    BOOLEAN NOT NULL DEFAULT false,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tag definitions
CREATE TABLE codex_tags (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    color      VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items
CREATE TABLE codex_items (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    icon_url     TEXT,
    field_values JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item-tag junction
CREATE TABLE codex_item_tags (
    item_id INTEGER NOT NULL REFERENCES codex_items(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES codex_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX idx_codex_item_tags_tag ON codex_item_tags(tag_id);
CREATE INDEX idx_codex_items_name ON codex_items(name);
