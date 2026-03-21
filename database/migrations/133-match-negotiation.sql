-- Match negotiation: async offer state on cc_trades

ALTER TABLE cc_trades ADD COLUMN offer_by INTEGER REFERENCES users(id);
ALTER TABLE cc_trades ADD COLUMN offer_status TEXT NOT NULL DEFAULT 'negotiating';
ALTER TABLE cc_trades ADD COLUMN offer_version INTEGER NOT NULL DEFAULT 0;
