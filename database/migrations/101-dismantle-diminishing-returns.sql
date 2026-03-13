-- Track daily dismantle count for diminishing returns
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS dismantled_today INTEGER DEFAULT 0;
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS dismantle_reset_date DATE DEFAULT CURRENT_DATE;
