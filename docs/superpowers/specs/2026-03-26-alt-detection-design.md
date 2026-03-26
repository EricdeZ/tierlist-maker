# Alt Account Detection — Design Spec

## Overview

Detect and surface alt account usage in The Vault through two independent signals:
1. **localStorage device fingerprinting** — frontend detects when multiple accounts log in from the same browser
2. **IP + device ID logging** — backend records login metadata for admin-triggered correlation

All detection is **admin-reviewed only** — no automatic bans or user-facing effects.

## Frontend: localStorage Detection

### Storage Scheme

Two obfuscated localStorage keys:

1. **User history** — key: base64 of `_vp` (`X3Zw`), value: JSON array of base64-encoded user IDs seen on this browser (e.g., `["MTIzNDU2", "Nzg5MDEy"]`)
2. **Device ID** — key: base64 of `_vd` (`X3Zk`), value: random UUID generated on first visit

Both keys use base64-encoded names so they don't stand out as auth-related in DevTools.

### Detection Flow (in AuthContext, after successful auth-me)

1. Read device ID from localStorage. If missing, generate a UUID and store it.
2. Read user history array from localStorage.
3. Base64-encode the current user's numeric ID.
4. If the array exists AND the current ID is NOT in it → **mismatch detected**:
   - POST to `vault-device-log` endpoint with `{ previousIds: [base64 IDs], deviceId }`
5. Add current ID to the array (deduplicated) and save back.
6. Always POST the device ID to the login log endpoint (even without mismatch) so backend has a complete device-to-user mapping.

### What This Catches

- Naive alt usage: same browser, same profile
- Users who clear cookies but not localStorage (or vice versa)

### What This Misses

- Incognito/private browsing
- Different browser or device
- Users who clear all browser data

## Backend: Login Logging

### New Table: `cc_vault_device_log`

```sql
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
```

One row per login. No uniqueness constraints — full history.

### New Table: `cc_vault_device_flags`

```sql
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
```

Populated by the frontend mismatch POST. One row per detected pair.

### New Endpoint: `vault-device-log.js`

**POST** (authenticated, any vault user):
- Receives `{ previousIds, deviceId }` from frontend
- Logs current login to `cc_vault_device_log` (user_id, device_id, IP from `cf-connecting-ip` header)
- If `previousIds` present (mismatch), decodes each base64 ID and inserts a row into `cc_vault_device_flags` for each pair

**GET** (admin, `cardclash_manage` permission):
- `action=flags` — returns unresolved flags (joined with users for discord usernames), then resolved
- `action=investigate&userId=X` — returns all `cc_vault_device_log` entries sharing an IP or device_id with the given user, grouped by shared signal
- `action=log&userId=X` — returns raw login log for a specific user

**POST admin actions** (`cardclash_manage` permission):
- `action=resolve-flag` — marks a flag as resolved (false positive)
- Banning reuses existing `ban-user` action in `vault-admin.js`

### IP Extraction

Cloudflare provides client IP via `cf-connecting-ip` header, already available in `event.headers` from the adapter. Fallback to `x-forwarded-for` for local dev.

## Admin Monitoring Page

New section on the vault admin page, gated by `cardclash_manage` permission.

### Flags Panel

- Lists `cc_vault_device_flags` rows, unresolved first
- Each row shows: User A (username), User B (username), shared device ID, flagged timestamp
- Actions per row: "Resolve" (mark as false positive), "Ban" (bans the alt via existing ban endpoint)

### Lookup Tool

- Text input for username or user ID, "Investigate" button
- Queries backend for all device_log entries sharing an IP or device_id with the target user
- Results table: username, IP, device_id, last login timestamp
- Rows sharing BOTH IP and device_id with the target are highlighted as strongest signal

## Scope

- No automatic bans or restrictions
- No user-facing UI changes
- Device log data is never exposed to non-admin users
- localStorage values are obfuscated but not cryptographically secure — this is a tripwire, not a fortress
