# Pack Opening Leaderboard

## Summary

Leaderboard showing top pack openers across three time periods: daily, weekly, and monthly. Resets at midnight UTC (daily), Monday 00:00 UTC (weekly), and 1st of month 00:00 UTC (monthly). Displayed at the bottom of the My Packs page with tab-based period switching.

## Database

New table `cc_pack_opens` — one row per pack opened:

```sql
CREATE TABLE cc_pack_opens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  pack_type_id INT REFERENCES cc_pack_types(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pack_opens_created ON cc_pack_opens (created_at, user_id);
```

Inserted inside existing pack-opening transactions (both direct open and inventory open paths).

## API

**Action**: `pack-leaderboard` (GET, public, auth optional for user position)

**Query param**: `period` = `daily` | `weekly` | `monthly`

**Date cutoff logic**:
- daily: `date_trunc('day', now() AT TIME ZONE 'UTC')`
- weekly: `date_trunc('week', now() AT TIME ZONE 'UTC')` (PostgreSQL weeks start Monday)
- monthly: `date_trunc('month', now() AT TIME ZONE 'UTC')`

**Query**:
```sql
SELECT user_id, COUNT(*)::int AS packs_opened
FROM cc_pack_opens
WHERE created_at >= $cutoff
GROUP BY user_id
ORDER BY packs_opened DESC
LIMIT 20
```

**Response shape** (matches gift/S5 leaderboard pattern):
```json
{
  "leaderboard": [{ "rank": 1, "userId": "...", "username": "...", "avatar": "...", "packsOpened": 42 }],
  "myPosition": 5,
  "myEntry": { "rank": 5, "userId": "...", "username": "...", "avatar": "...", "packsOpened": 20 }
}
```

## Frontend

- Located at bottom of My Packs page
- Three tabs: Daily / Weekly / Monthly
- Each row: rank, avatar, username, pack count
- Current user highlighted if in top 20
- "Your Position: #X" shown below if outside top 20
- Fetches on tab switch, cached per session

## Backend Changes

Two insertion points in `vault.js`:
1. `action=open-pack` — insert into `cc_pack_opens` within existing transaction
2. `action=open-inventory-pack` — insert into `cc_pack_opens` within existing transaction
