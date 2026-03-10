-- Sale listings: limited-quantity packs sold through the vending machine
CREATE TABLE IF NOT EXISTS cc_pack_sales (
  id SERIAL PRIMARY KEY,
  pack_type_id TEXT NOT NULL REFERENCES cc_pack_types(id),
  name TEXT,                          -- override display name (NULL = use pack_type's name)
  description TEXT,                   -- override description
  price INTEGER NOT NULL,             -- sale price (can differ from pack_type.cost)
  stock INTEGER NOT NULL DEFAULT 0,   -- remaining quantity (0 = sold out)
  initial_stock INTEGER NOT NULL,     -- original quantity for display
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,              -- NULL = immediately available
  ends_at TIMESTAMPTZ,                -- NULL = no expiry
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_pack_sales_active ON cc_pack_sales(active, sort_order);
