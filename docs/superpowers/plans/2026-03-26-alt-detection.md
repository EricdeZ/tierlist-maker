# Alt Account Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect alt account usage in The Vault via localStorage fingerprinting + IP/device logging, surfaced on an admin monitoring page.

**Architecture:** Frontend stores obfuscated user ID history and device UUID in localStorage. On login, mismatches are reported to a new backend endpoint that also logs IP and device ID. Admin panel gets a new "Device Flags" tab showing flags and a lookup tool for IP/device correlation.

**Tech Stack:** React (admin component), Cloudflare Pages Functions (endpoint), PostgreSQL/Neon (new tables), `cf-connecting-ip` header for IP extraction.

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/148-device-tracking.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Run the migration against the dev database**

```bash
# Use whatever method the project uses to run migrations against Neon
# e.g. psql or the Neon console
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/148-device-tracking.sql
git commit -m "feat(vault): add device tracking tables for alt detection"
```

---

### Task 2: Backend Endpoint — `vault-device-log.js`

**Files:**
- Create: `functions/api/vault-device-log.js`

- [ ] **Step 1: Create the endpoint with POST handler (log login + flag mismatches)**

```javascript
import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const { action } = event.queryStringParameters || {}

    // --- POST: log device + flag mismatches ---
    if (event.httpMethod === 'POST' && action === 'log-login') {
        const user = await requireAuth(event)
        if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }

        const { deviceId, previousIds } = JSON.parse(event.body || '{}')
        const ip = event.headers['cf-connecting-ip'] || event.headers['x-forwarded-for'] || null

        // Always log the login
        await sql`
            INSERT INTO cc_vault_device_log (user_id, device_id, ip_address)
            VALUES (${user.id}, ${deviceId || null}, ${ip})
        `

        // If frontend detected a mismatch, create flags
        if (previousIds && Array.isArray(previousIds) && previousIds.length > 0) {
            for (const prevId of previousIds) {
                const numericId = parseInt(prevId, 10)
                if (!numericId || numericId === user.id) continue

                // Check user exists
                const [exists] = await sql`SELECT 1 FROM users WHERE id = ${numericId}`
                if (!exists) continue

                // Avoid duplicate flags for the same pair
                const [existing] = await sql`
                    SELECT 1 FROM cc_vault_device_flags
                    WHERE (user_id_a = ${user.id} AND user_id_b = ${numericId})
                       OR (user_id_a = ${numericId} AND user_id_b = ${user.id})
                `
                if (!existing) {
                    await sql`
                        INSERT INTO cc_vault_device_flags (user_id_a, user_id_b, device_id)
                        VALUES (${numericId}, ${user.id}, ${deviceId || null})
                    `
                }
            }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
    }

    // --- Admin GET endpoints ---
    const admin = await requirePermission(event, 'cardclash_manage')
    if (!admin) return { statusCode: 403, headers: adminHeaders(event), body: JSON.stringify({ error: 'Forbidden' }) }

    if (event.httpMethod === 'GET' && action === 'flags') {
        const flags = await sql`
            SELECT f.*,
                   ua.discord_username AS user_a_name, ua.discord_id AS user_a_discord,
                   ub.discord_username AS user_b_name, ub.discord_id AS user_b_discord
            FROM cc_vault_device_flags f
            JOIN users ua ON ua.id = f.user_id_a
            JOIN users ub ON ub.id = f.user_id_b
            ORDER BY f.resolved ASC, f.flagged_at DESC
            LIMIT 100
        `
        return { statusCode: 200, headers: adminHeaders(event), body: JSON.stringify({ flags }) }
    }

    if (event.httpMethod === 'GET' && action === 'investigate') {
        const userId = parseInt(event.queryStringParameters?.userId, 10)
        if (!userId) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'userId required' }) }

        // Find all IPs and device IDs for target user
        const userLogs = await sql`
            SELECT DISTINCT ip_address, device_id FROM cc_vault_device_log
            WHERE user_id = ${userId}
        `
        const ips = userLogs.map(r => r.ip_address).filter(Boolean)
        const devices = userLogs.map(r => r.device_id).filter(Boolean)

        if (ips.length === 0 && devices.length === 0) {
            return { statusCode: 200, headers: adminHeaders(event), body: JSON.stringify({ matches: [] }) }
        }

        // Find other users sharing those IPs or device IDs
        const matches = await sql`
            SELECT dl.user_id, u.discord_username, u.discord_id,
                   dl.ip_address, dl.device_id, dl.logged_at
            FROM cc_vault_device_log dl
            JOIN users u ON u.id = dl.user_id
            WHERE dl.user_id != ${userId}
              AND (
                ${ips.length > 0 ? sql`dl.ip_address = ANY(${ips})` : sql`false`}
                OR ${devices.length > 0 ? sql`dl.device_id = ANY(${devices})` : sql`false`}
              )
            ORDER BY dl.logged_at DESC
            LIMIT 200
        `
        return { statusCode: 200, headers: adminHeaders(event), body: JSON.stringify({ matches, targetIps: ips, targetDevices: devices }) }
    }

    // --- Admin POST: resolve flag ---
    if (event.httpMethod === 'POST' && action === 'resolve-flag') {
        const { flagId } = JSON.parse(event.body || '{}')
        await sql`
            UPDATE cc_vault_device_flags
            SET resolved = true, resolved_by = ${admin.id}, resolved_at = NOW()
            WHERE id = ${flagId}
        `
        return { statusCode: 200, headers: adminHeaders(event), body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/vault-device-log.js
git commit -m "feat(vault): add device log endpoint for alt detection"
```

---

### Task 3: Frontend Service Methods

**Files:**
- Modify: `src/services/database.js` — add methods to `vaultService` and `vaultAdminService`

- [ ] **Step 1: Add `logDevice` to `vaultService` (around line 1009)**

After the last method in `vaultService`, add:

```javascript
async logDevice(deviceId, previousIds) {
    return apiPost('vault-device-log', { action: 'log-login' }, { deviceId, previousIds })
},
```

- [ ] **Step 2: Add admin methods to `vaultAdminService` (around line 1397)**

After the last method in `vaultAdminService`, add:

```javascript
async getDeviceFlags() {
    return apiCall('vault-device-log', { action: 'flags' })
},
async investigateUser(userId) {
    return apiCall('vault-device-log', { action: 'investigate', userId })
},
async resolveDeviceFlag(flagId) {
    return apiPost('vault-device-log', { action: 'resolve-flag' }, { flagId })
},
```

- [ ] **Step 3: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add device log service methods"
```

---

### Task 4: Frontend Detection in AuthContext

**Files:**
- Modify: `src/context/AuthContext.jsx` — add device tracking logic after successful login

- [ ] **Step 1: Add the device tracking helper (import + function)**

At the top of the file, add the import:

```javascript
import { vaultService } from '../services/database.js'
```

Inside the `AuthProvider` component, add this helper function before the `useEffect` blocks (around line 18, after state declarations):

```javascript
// Device fingerprint tracking for alt detection
const trackDevice = useCallback((userId) => {
    try {
        // Obfuscated keys: btoa('_vd') = 'X3Zk', btoa('_vp') = 'X3Zw'
        const DEVICE_KEY = 'X3Zk'
        const HISTORY_KEY = 'X3Zw'

        // Ensure device ID exists
        let deviceId = localStorage.getItem(DEVICE_KEY)
        if (!deviceId) {
            deviceId = crypto.randomUUID()
            localStorage.setItem(DEVICE_KEY, deviceId)
        }

        // Read user history
        let history = []
        try {
            history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
            if (!Array.isArray(history)) history = []
        } catch { history = [] }

        // Encode current user ID
        const encoded = btoa(String(userId))
        const isNew = !history.includes(encoded)

        // Decode previous IDs for reporting (only ones that aren't current user)
        const previousIds = isNew && history.length > 0
            ? history.map(h => { try { return atob(h) } catch { return null } }).filter(Boolean)
            : null

        // Update history
        if (isNew) {
            history.push(encoded)
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
        }

        // Fire and forget — send device log (always) + mismatch flag (if detected)
        vaultService.logDevice(deviceId, previousIds).catch(() => {})
    } catch {
        // Never let tracking break the login flow
    }
}, [])
```

- [ ] **Step 2: Call `trackDevice` after successful auth-me fetch**

In the `fetchUser` effect (the `useEffect` at line 70), after `setVaultBanned(!!data.vaultBanned)` at line 99, add:

```javascript
trackDevice(data.user.id)
```

This goes inside the `if (!cancelled)` block, right after `setVaultBanned`.

- [ ] **Step 3: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat(vault): add localStorage device tracking on login"
```

---

### Task 5: Admin UI — Device Flags Tab

**Files:**
- Create: `src/pages/admin/vault/CCAdminDeviceFlags.jsx`
- Modify: `src/pages/admin/VaultAdmin.jsx` — add tab entry + import

- [ ] **Step 1: Create the admin component**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { vaultAdminService } from '../../../services/database'

export default function CCAdminDeviceFlags() {
    const [flags, setFlags] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [investigating, setInvestigating] = useState(null)
    const [matches, setMatches] = useState(null)
    const [investigateLoading, setInvestigateLoading] = useState(false)

    const fetchFlags = useCallback(async () => {
        setLoading(true)
        try {
            const data = await vaultAdminService.getDeviceFlags()
            setFlags(data.flags || [])
        } catch (err) {
            console.error('Failed to load device flags:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchFlags() }, [fetchFlags])

    const resolveFlag = async (flagId) => {
        try {
            await vaultAdminService.resolveDeviceFlag(flagId)
            fetchFlags()
        } catch (err) {
            console.error('Failed to resolve flag:', err)
        }
    }

    const investigate = async () => {
        const userId = parseInt(search, 10)
        if (!userId) return
        setInvestigateLoading(true)
        setInvestigating(userId)
        try {
            const data = await vaultAdminService.investigateUser(userId)
            setMatches(data)
        } catch (err) {
            console.error('Investigation failed:', err)
            setMatches(null)
        } finally {
            setInvestigateLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Flags Panel */}
            <div>
                <h3 className="text-lg font-bold text-[var(--cd-cyan)] cd-head mb-3">Device Flags</h3>
                {loading ? (
                    <div className="flex justify-center py-8"><div className="cd-spinner w-6 h-6" /></div>
                ) : flags.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">No flags detected yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                                    <th className="p-3">User A</th>
                                    <th className="p-3">User B</th>
                                    <th className="p-3">Device</th>
                                    <th className="p-3">Flagged</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flags.map(f => (
                                    <tr key={f.id} className={`border-b border-white/5 ${f.resolved ? 'opacity-40' : ''}`}>
                                        <td className="p-3">{f.user_a_name} <span className="text-xs text-white/30">#{f.user_id_a}</span></td>
                                        <td className="p-3">{f.user_b_name} <span className="text-xs text-white/30">#{f.user_id_b}</span></td>
                                        <td className="p-3 font-mono text-xs text-white/50">{f.device_id ? f.device_id.slice(0, 8) + '...' : '-'}</td>
                                        <td className="p-3 text-xs text-white/50">{new Date(f.flagged_at).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            {f.resolved
                                                ? <span className="text-xs text-green-400">Resolved</span>
                                                : <span className="text-xs text-yellow-400">Unresolved</span>}
                                        </td>
                                        <td className="p-3">
                                            {!f.resolved && (
                                                <button
                                                    onClick={() => resolveFlag(f.id)}
                                                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors cursor-pointer"
                                                >
                                                    Resolve
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Lookup Tool */}
            <div>
                <h3 className="text-lg font-bold text-[var(--cd-cyan)] cd-head mb-3">Investigate User</h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="User ID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && investigate()}
                        className="w-full max-w-xs px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--cd-cyan)]/50"
                    />
                    <button
                        onClick={investigate}
                        disabled={!search || investigateLoading}
                        className="px-4 py-2 rounded-lg bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-sm font-bold hover:bg-[var(--cd-cyan)]/30 disabled:opacity-30 transition-colors cursor-pointer cd-head"
                    >
                        Investigate
                    </button>
                </div>

                {investigateLoading && (
                    <div className="flex justify-center py-8"><div className="cd-spinner w-6 h-6" /></div>
                )}

                {matches && !investigateLoading && (
                    matches.matches.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-secondary)]">No shared IPs or devices found for user #{investigating}.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                                        <th className="p-3">User</th>
                                        <th className="p-3">IP</th>
                                        <th className="p-3">Device</th>
                                        <th className="p-3">Last Login</th>
                                        <th className="p-3">Signal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matches.matches.map((m, i) => {
                                        const sharedIp = matches.targetIps.includes(m.ip_address)
                                        const sharedDevice = matches.targetDevices.includes(m.device_id)
                                        const bothMatch = sharedIp && sharedDevice
                                        return (
                                            <tr key={i} className={`border-b border-white/5 ${bothMatch ? 'bg-red-500/10' : ''}`}>
                                                <td className="p-3">{m.discord_username} <span className="text-xs text-white/30">#{m.user_id}</span></td>
                                                <td className="p-3 font-mono text-xs">{m.ip_address || '-'}</td>
                                                <td className="p-3 font-mono text-xs text-white/50">{m.device_id ? m.device_id.slice(0, 8) + '...' : '-'}</td>
                                                <td className="p-3 text-xs text-white/50">{new Date(m.logged_at).toLocaleDateString()}</td>
                                                <td className="p-3">
                                                    {bothMatch && <span className="text-xs font-bold text-red-400">IP + Device</span>}
                                                    {sharedIp && !sharedDevice && <span className="text-xs text-yellow-400">IP only</span>}
                                                    {sharedDevice && !sharedIp && <span className="text-xs text-orange-400">Device only</span>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Add tab entry and import to VaultAdmin.jsx**

Add import at the top of `VaultAdmin.jsx` (line 17, after the CCAdminPromoGift import):

```javascript
import CCAdminDeviceFlags from './vault/CCAdminDeviceFlags'
```

Add to the `TABS` array (after the `promo-gift` entry at line 33):

```javascript
{ key: 'device-flags', label: 'Device Flags', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z' },
```

Add the conditional render in the tab content section (after line 82):

```jsx
{activeTab === 'device-flags' && <CCAdminDeviceFlags />}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/vault/CCAdminDeviceFlags.jsx src/pages/admin/VaultAdmin.jsx
git commit -m "feat(vault): add device flags admin tab for alt detection"
```

---

### Task 6: Verify End-to-End Flow

- [ ] **Step 1: Start dev server**

```bash
npm start
```

- [ ] **Step 2: Verify localStorage tracking**

1. Log in with your account
2. Open DevTools → Application → Local Storage
3. Confirm `X3Zk` key exists with a UUID value
4. Confirm `X3Zw` key exists with a JSON array containing one base64-encoded entry
5. Check Network tab — confirm POST to `/api/vault-device-log?action=log-login` was sent

- [ ] **Step 3: Verify admin panel**

1. Navigate to `/admin/vault`
2. Click the "Device Flags" tab
3. Confirm the flags table loads (empty is fine)
4. Enter your user ID in the investigate field and hit "Investigate"
5. Confirm your login shows up with IP and device ID

- [ ] **Step 4: Commit any fixes if needed**
