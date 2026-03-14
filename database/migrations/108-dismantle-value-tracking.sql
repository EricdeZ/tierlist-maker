-- Track cumulative base value dismantled today (for value-based diminishing returns)
ALTER TABLE cc_stats ADD COLUMN IF NOT EXISTS dismantled_value_today NUMERIC(10,1) DEFAULT 0;
