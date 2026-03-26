-- Device login log: one row per login
CREATE TABLE cc_vault_device_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    device_id VARCHAR(64),
    ip_address VARCHAR(45),
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_log_user ON cc_vault_device_log(user_id);
CREATE INDEX idx_device_log_device ON cc_vault_device_log(device_id);
CREATE INDEX idx_device_log_ip ON cc_vault_device_log(ip_address);

-- Device flags: pairs of accounts detected on the same browser
CREATE TABLE cc_vault_device_flags (
    id SERIAL PRIMARY KEY,
    user_id_a INTEGER NOT NULL REFERENCES users(id),
    user_id_b INTEGER NOT NULL REFERENCES users(id),
    device_id VARCHAR(64),
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_device_flags_unresolved ON cc_vault_device_flags(resolved) WHERE NOT resolved;
