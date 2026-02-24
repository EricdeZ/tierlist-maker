-- Migration 043: Codex gods system
-- Same structure as codex items (fields, tags, entries) for god data,
-- with an optional FK to the gods table for linking to the god database.

-- God field definitions (admin-configurable schema)
CREATE TABLE codex_god_fields (
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

-- God tag definitions
CREATE TABLE codex_god_tags (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    color      VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- God entries
CREATE TABLE codex_gods (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    icon_url     TEXT,
    god_id       INTEGER REFERENCES gods(id) ON DELETE SET NULL,
    field_values JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- God-tag junction
CREATE TABLE codex_god_tag_assignments (
    god_id INTEGER NOT NULL REFERENCES codex_gods(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES codex_god_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (god_id, tag_id)
);

CREATE INDEX idx_codex_god_tag_assignments_tag ON codex_god_tag_assignments(tag_id);
CREATE INDEX idx_codex_gods_name ON codex_gods(name);
CREATE INDEX idx_codex_gods_god_id ON codex_gods(god_id);
