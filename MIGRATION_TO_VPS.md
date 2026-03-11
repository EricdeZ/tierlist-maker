# Migration Plan: Cloudflare Pages Functions → VPS Backend

## Overview

Move the API layer (75 endpoints in `functions/api/`) from Cloudflare Pages Functions to a Node.js server on a VPS. Frontend stays on Cloudflare Pages. Database stays on Neon. R2 stays for image storage.

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| API server | CF Pages Functions (stateless, per-request) | Express/Fastify on VPS (persistent process) |
| Request adapter | `adapt()` in `functions/lib/adapter.js` | Express middleware + route handlers |
| DB connections | `neon()` HTTP per-request | `pg` Pool (persistent connections) |
| R2 access | CF binding (`env.TEAM_ICONS`) | S3-compatible API via `@aws-sdk/client-s3` |
| WebSockets | Not possible | Native support via `ws` library |
| Background work | `event.waitUntil()` | Just run it — process stays alive |
| Env vars | `.dev.vars` + CF env bindings | `.env` + `process.env` (normal Node) |
| Dev server | Wrangler (port 8788) | Node server (port 8788, keep same port) |
| OG tags/SEO | `_middleware.js` rewriting HTML | Reverse proxy rule or small middleware on VPS |

## What Stays The Same

- **Frontend**: React SPA on Cloudflare Pages (free CDN, DDoS protection)
- **Database**: Neon PostgreSQL — all SQL queries unchanged
- **Auth**: JWT via `jose`, RBAC permission checks — same code
- **Business logic**: All handler internals (auth checks, SQL, response formatting)
- **API contract**: Same endpoints, same request/response shapes
- **Vite proxy**: Points to VPS instead of Wrangler (same port works)

## Architecture After Migration

```
Browser → Cloudflare Pages (static assets, CDN)
       → CF DNS proxied to VPS for /api/*
       ↓
VPS (Express/Fastify)
  ├── Routes (migrated from functions/api/)
  ├── Middleware (auth, CORS, error handling)
  ├── pg Pool → Neon PostgreSQL
  ├── S3 Client → Cloudflare R2
  ├── WebSocket server (ws) — for future game features
  └── Background jobs (cron, timers — no waitUntil needed)
```

## Migration Steps

### Phase 1: Scaffold the Node Server

1. Create `server/` directory at project root
2. Set up Express/Fastify with:
   - CORS middleware (replaces `headers` / `adminHeaders` pattern)
   - JSON body parsing (replaces `adapt()` body parsing)
   - Auth middleware (port `functions/lib/auth.js`)
   - Error handling middleware (replaces `adapt()` try/catch)
3. Create `server/lib/db.js` using `pg` Pool instead of `neon()` HTTP:
   ```js
   import pg from 'pg'
   const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
   export const sql = pool  // pool.query() with tagged templates or parameterized
   ```
4. Create `server/lib/r2.js` using S3-compatible client:
   ```js
   import { S3Client } from '@aws-sdk/client-s3'
   const r2 = new S3Client({
     region: 'auto',
     endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY }
   })
   ```

### Phase 2: Port the Adapter Layer

The key insight: each endpoint currently exports a function wrapped in `adapt()` that receives an `event` object with `{ httpMethod, headers, body, queryStringParameters, env }` and returns `{ statusCode, headers, body }`.

Create a thin compatibility layer so endpoints port with minimal changes:

```js
// server/lib/adapter.js — Express compatibility wrapper
export function adapt(handler) {
  return async (req, res) => {
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: req.body,
      queryStringParameters: req.query,
      env: process.env,
      waitUntil: (promise) => promise.catch(console.error) // just let it run
    }
    try {
      const result = await handler(event)
      res.status(result.statusCode)
      Object.entries(result.headers || {}).forEach(([k, v]) => res.set(k, v))
      res.send(result.body)
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
```

This means **every endpoint file can be ported with zero changes to the handler function itself** — only the import path for `adapt` changes.

### Phase 3: Port Endpoints (Incremental)

Port in batches by priority:

**Batch 1 — Auth + Core reads** (get the site working):
- `auth-callback.js`, `auth-me.js`
- `matches.js`, `standings.js`, `stats.js`, `teams.js`, `players.js`
- `r2-image.js` (needs R2 S3 client)

**Batch 2 — Admin writes**:
- `admin-write.js`, `admin-match-manage.js`, `roster-manage.js`
- `league-manage.js`, `stage-manage.js`, `team-manage.js`

**Batch 3 — Features**:
- `forge.js`, `forge-admin.js`, `forge-config.js`
- `passion.js`, `predictions.js`, `challenges.js`
- `vault.js`, `vault-admin.js`
- All remaining endpoints

**Batch 4 — Middleware**:
- Port OG tag injection from `_middleware.js` (serve `index.html` with dynamic meta tags for SSR-like SEO)

### Phase 4: Database Connection Upgrade

Replace `neon()` HTTP with `pg` Pool:

| Before (neon HTTP) | After (pg Pool) |
|---------------------|-----------------|
| New HTTP connection per query | Persistent connection pool |
| `neon(connString)` tagged template | `pool.query(text, params)` or use `slonik`/`postgres` for tagged templates |
| `transaction()` uses WebSocket Client | `pool.connect()` → `BEGIN/COMMIT/ROLLBACK` natively |
| Cold start on every request | Connections stay warm |

To keep tagged template syntax (minimal code changes), use the `postgres` library:
```js
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL)
// Usage stays identical: sql`SELECT * FROM users WHERE id = ${id}`
```

This is the closest drop-in replacement for `neon()` tagged templates.

### Phase 5: Deploy & Cutover

1. **VPS setup**: Ubuntu/Debian, Node 22, PM2 or systemd for process management
2. **SSL**: Let's Encrypt via Certbot, or keep Cloudflare proxy (CF handles SSL → origin HTTP)
3. **DNS**: CF DNS proxy mode — `api.yourdomain.com` → VPS IP (keeps DDoS protection)
4. **Deploy pipeline**: Git pull + `npm install` + PM2 restart (or use a deploy script)
5. **Monitoring**: PM2 logs, or add simple health check endpoint
6. **Cutover**: Update Vite proxy + CF DNS to point to VPS. Keep CF Functions as fallback until verified.

## New Capabilities Unlocked

### WebSockets (for board game)
```js
import { WebSocketServer } from 'ws'
const wss = new WebSocketServer({ server })
wss.on('connection', (ws, req) => {
  // Authenticate from token in query string or first message
  // Subscribe to game room
  // Broadcast moves to opponent
})
```

### Background Jobs
```js
// No more waitUntil — just run async work
import cron from 'node-cron'
cron.schedule('0 * * * *', () => resolvePredictions())
cron.schedule('*/5 * * * *', () => updateForgeMarket())
```

### In-Memory Caching
```js
// God list, config, etc. — cache in process memory
const cache = new Map()
function getCached(key, ttlMs, fetchFn) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.time < ttlMs) return entry.data
  const data = fetchFn()
  cache.set(key, { data, time: Date.now() })
  return data
}
```

## VPS Recommendations

| Provider | Spec | Price | Notes |
|----------|------|-------|-------|
| Hetzner CAX11 | 2 vCPU ARM, 4GB RAM | ~€4/mo | Best value, EU datacenters |
| Hetzner CPX11 | 2 vCPU x86, 2GB RAM | ~€5/mo | x86 if ARM is a concern |
| Oracle Cloud | 4 vCPU ARM, 24GB RAM | Free | Always-free tier, but less reliable |
| Contabo VPS S | 4 vCPU, 8GB RAM | ~€6/mo | Generous specs, mixed reviews |

For this project's scale, the cheapest Hetzner option is more than enough.

## Estimated Effort

| Phase | Work |
|-------|------|
| Phase 1: Scaffold | Set up Express, middleware, db pool, R2 client |
| Phase 2: Adapter | Write compatibility wrapper (~50 lines) |
| Phase 3: Port endpoints | Mostly copy-paste with import path changes (75 files) |
| Phase 4: DB upgrade | Swap `neon()` for `postgres` tagged templates |
| Phase 5: Deploy | VPS setup, DNS, PM2, verify |

The compatibility adapter (Phase 2) is the key insight — it means endpoint handlers port with near-zero changes. The bulk of the work is Phase 5 (ops setup) and Phase 4 (testing DB migration).

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Downtime during cutover | Run both in parallel, DNS switch is instant via CF |
| VPS goes down | PM2 auto-restart, CF can failover to Pages Functions |
| Connection pooling issues | `postgres` lib handles this; set pool max to ~10 |
| R2 access from outside CF | Generate R2 API tokens with S3 compatibility |
| OG tags / SEO regression | Test meta tags thoroughly before cutover |
| Increased ops burden | PM2 + simple deploy script keeps it minimal |

## Rollback Plan

Keep `functions/api/` intact in the repo. If VPS fails, re-deploy to CF Pages Functions by reverting DNS. The frontend doesn't change, so rollback is just a DNS flip.
