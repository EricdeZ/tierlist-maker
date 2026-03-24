-- Allow drafts in collections alongside templates
ALTER TABLE cc_collection_entries ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE cc_collection_entries ADD COLUMN draft_id INTEGER REFERENCES cc_card_drafts(id) ON DELETE RESTRICT;

-- Ensure each draft appears at most once per collection
CREATE UNIQUE INDEX idx_cc_collection_entries_draft ON cc_collection_entries(collection_id, draft_id) WHERE draft_id IS NOT NULL;

-- Each entry must have exactly one of template_id or draft_id
ALTER TABLE cc_collection_entries ADD CONSTRAINT chk_entry_type CHECK (
    (template_id IS NOT NULL AND draft_id IS NULL) OR
    (template_id IS NULL AND draft_id IS NOT NULL)
);
