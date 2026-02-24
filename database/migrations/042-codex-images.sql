-- Migration 042: Codex image uploads
-- Stores metadata for images uploaded to R2 under the codex/ prefix.

CREATE TABLE codex_images (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL,
    url         TEXT NOT NULL,
    category    VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_codex_images_category ON codex_images(category);
