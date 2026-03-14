-- 112-vault-bans.sql
-- Vault banlist: one row per banned user

CREATE TABLE cc_vault_bans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  banned_by INTEGER NOT NULL REFERENCES users(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
