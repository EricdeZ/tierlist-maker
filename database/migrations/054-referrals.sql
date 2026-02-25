-- ─── REFERRAL SYSTEM ────────────────────────────────────────────────
-- Two referral types: 'website' (signup) and 'forge' (first-time Forge)

-- 1. Add referral_code to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8);

-- Backfill existing users with unique codes
UPDATE users SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::text || id::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 2. Track pending forge referral sparks on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS forge_referral_sparks INTEGER NOT NULL DEFAULT 0;

-- 3. Track non-coolable referral sparks on holdings (like tutorial_sparks)
ALTER TABLE spark_holdings ADD COLUMN IF NOT EXISTS referral_sparks INTEGER NOT NULL DEFAULT 0;

-- 4. Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id              SERIAL PRIMARY KEY,
    referrer_id     INTEGER NOT NULL REFERENCES users(id),
    referee_id      INTEGER NOT NULL REFERENCES users(id),
    type            VARCHAR(20) NOT NULL,
    rewarded        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CHECK (type IN ('website', 'forge')),
    CHECK (referrer_id != referee_id)
);

-- Each user can only have ONE referrer per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referee_type ON referrals(referee_id, type);
-- Fast lookups for referrer stats
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_type ON referrals(referrer_id, type);


-- ─── REFERRAL CHALLENGES ────────────────────────────────────────────
-- stat_key: friends_referred (combined website + forge count)

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Word of Mouth', 'Refer your first friend', 'social', 'one_time', 15, 1, 'friends_referred', 30, 'daily')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Bringing Backup', 'Refer 3 friends', 'social', 'one_time', 25, 3, 'friends_referred', 30, 'clay')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Recruiter', 'Refer 5 friends', 'social', 'one_time', 40, 5, 'friends_referred', 30, 'amber')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Rally the Troops', 'Refer 10 friends', 'social', 'one_time', 60, 10, 'friends_referred', 30, 'bronze')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Community Builder', 'Refer 25 friends', 'social', 'one_time', 100, 25, 'friends_referred', 30, 'silver')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Ambassador', 'Refer 50 friends', 'social', 'one_time', 150, 50, 'friends_referred', 30, 'gold')
ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Evangelist', 'Refer 100 friends', 'social', 'one_time', 200, 100, 'friends_referred', 30, 'platinum', true, 'Evangelist')
ON CONFLICT (title) DO NOTHING;
