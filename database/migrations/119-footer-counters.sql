-- 119-footer-counters.sql
-- Track auto-incrementing serial counters per footer label for card templates/drafts

CREATE TABLE IF NOT EXISTS cc_footer_counters (
    label TEXT PRIMARY KEY,
    next_serial INTEGER NOT NULL DEFAULT 1
);
