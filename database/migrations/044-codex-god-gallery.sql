-- Migration 044: God gallery — shared hierarchical categories + god-image associations

-- Shared category tree for god images (e.g. Skins, Ability Icons, Splash Art)
CREATE TABLE codex_god_categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    slug       VARCHAR(100) NOT NULL UNIQUE,
    parent_id  INTEGER REFERENCES codex_god_categories(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_codex_god_categories_parent ON codex_god_categories(parent_id);

-- Junction: links a codex_god to a codex_image under a specific category
CREATE TABLE codex_god_images (
    id             SERIAL PRIMARY KEY,
    codex_god_id   INTEGER NOT NULL REFERENCES codex_gods(id) ON DELETE CASCADE,
    codex_image_id INTEGER NOT NULL REFERENCES codex_images(id) ON DELETE CASCADE,
    category_id    INTEGER NOT NULL REFERENCES codex_god_categories(id) ON DELETE CASCADE,
    caption        TEXT,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (codex_god_id, codex_image_id, category_id)
);

CREATE INDEX idx_codex_god_images_god ON codex_god_images(codex_god_id);
CREATE INDEX idx_codex_god_images_category ON codex_god_images(category_id);
CREATE INDEX idx_codex_god_images_image ON codex_god_images(codex_image_id);
