-- Pack opening log for leaderboards (daily/weekly/monthly)
CREATE TABLE cc_pack_opens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  pack_type_id TEXT REFERENCES cc_pack_types(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pack_opens_created ON cc_pack_opens (created_at, user_id);
