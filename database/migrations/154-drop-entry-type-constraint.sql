-- Drop the old check constraint that required exactly one of template_id/draft_id.
-- After blueprint unification (149), entries use blueprint_id instead.
ALTER TABLE cc_collection_entries DROP CONSTRAINT chk_entry_type;
