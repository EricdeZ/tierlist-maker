-- Migration 013: Challenge tier system overhaul
-- Adds tier/badge columns, wipes old challenges, re-seeds with tiered challenges.

-- ═══════════════════════════════════════════════════
-- 1. Schema changes
-- ═══════════════════════════════════════════════════

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'daily';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS gives_badge BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS badge_label VARCHAR(100);

-- Enforce valid tier values
DO $$ BEGIN
    ALTER TABLE challenges ADD CONSTRAINT challenges_tier_check
        CHECK (tier IN ('daily','clay','amber','bronze','silver','gold','platinum','diamond','obsidian','master','demigod','deity'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
-- 2. Fix duplicate titles from prior run, then add unique constraint
-- ═══════════════════════════════════════════════════

-- Rename the Gold-tier 'On Fire' that was a duplicate
UPDATE challenges SET title = 'Ablaze' WHERE title = 'On Fire' AND stat_key = 'total_earned';

DO $$ BEGIN
    ALTER TABLE challenges ADD CONSTRAINT challenges_title_unique UNIQUE (title);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
-- 3. Seed new tiered challenges (skip if already exists)
-- ═══════════════════════════════════════════════════

-- ─── DAILY TIER (engagement) ─────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('First Steps', 'Claim your first daily login', 'engagement', 'one_time', 10, 1, 'daily_logins', 1, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Creature of Habit', 'Claim daily login 7 times', 'engagement', 'one_time', 15, 7, 'daily_logins', 2, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Dedicated', 'Claim daily login 30 times', 'engagement', 'one_time', 25, 30, 'daily_logins', 3, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Loyal Fan', 'Claim daily login 100 times', 'engagement', 'one_time', 50, 100, 'daily_logins', 4, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Getting Warmed Up', 'Reach a 3-day login streak', 'engagement', 'one_time', 10, 3, 'login_streak', 5, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('On a Roll', 'Reach a 7-day login streak', 'engagement', 'one_time', 20, 7, 'login_streak', 6, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Unstoppable Streak', 'Reach a 14-day login streak', 'engagement', 'one_time', 40, 14, 'login_streak', 7, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Iron Will', 'Reach a 30-day login streak', 'engagement', 'one_time', 75, 30, 'login_streak', 8, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Opinionated', 'Save a tier list', 'engagement', 'one_time', 5, 1, 'tier_lists_created', 9, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Draft Day', 'Complete a draft simulation', 'engagement', 'one_time', 5, 1, 'drafts_completed', 10, 'daily') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Getting Started', 'Earn 100 total Passion', 'engagement', 'one_time', 15, 100, 'total_earned', 11, 'daily') ON CONFLICT (title) DO NOTHING;


-- ─── CLAY TIER (first steps in league) ───────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Baptism by Fire', 'Play your first league game', 'league', 'one_time', 10, 1, 'games_played', 1, 'clay') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('First Blood', 'Get your first career kill', 'performance', 'one_time', 10, 1, 'total_kills', 2, 'clay') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Teamwork', 'Get your first career assist', 'performance', 'one_time', 10, 1, 'total_assists', 3, 'clay') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('League Recruit', 'Join a league', 'league', 'one_time', 10, 1, 'leagues_joined', 4, 'clay') ON CONFLICT (title) DO NOTHING;


-- ─── AMBER TIER ──────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Warming Up', 'Play 5 league games', 'league', 'one_time', 15, 5, 'games_played', 1, 'amber') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Bloodthirsty', 'Get 10 career kills', 'performance', 'one_time', 15, 10, 'total_kills', 2, 'amber') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Helping Hand', 'Get 25 career assists', 'performance', 'one_time', 15, 25, 'total_assists', 3, 'amber') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Damage Dealer', 'Deal 25,000 total career damage', 'performance', 'one_time', 15, 25000, 'total_damage', 4, 'amber') ON CONFLICT (title) DO NOTHING;


-- ─── BRONZE TIER ─────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Seasoned', 'Play 15 league games', 'league', 'one_time', 20, 15, 'games_played', 1, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Slayer', 'Get 50 career kills', 'performance', 'one_time', 25, 50, 'total_kills', 2, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('On Fire', 'Get 6 kills in a single game', 'performance', 'one_time', 20, 6, 'best_kills_game', 3, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Playmaker', 'Get 6 assists in a single game', 'performance', 'one_time', 20, 6, 'best_assists_game', 4, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Heavy Hitter', 'Deal 12,000 damage in a single game', 'performance', 'one_time', 20, 12000, 'best_damage_game', 5, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('First Wins', 'Win 5 games', 'league', 'one_time', 20, 5, 'total_wins', 6, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Regular', 'Claim daily login 200 times', 'engagement', 'one_time', 25, 200, 'daily_logins', 7, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Tier Enthusiast', 'Save 10 tier lists', 'engagement', 'one_time', 20, 10, 'tier_lists_created', 8, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Draft Veteran', 'Complete 10 drafts', 'engagement', 'one_time', 20, 10, 'drafts_completed', 9, 'bronze') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Passionate', 'Earn 500 total Passion', 'engagement', 'one_time', 20, 500, 'total_earned', 10, 'bronze') ON CONFLICT (title) DO NOTHING;


-- ─── SILVER TIER ─────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Veteran', 'Play 30 league games', 'league', 'one_time', 30, 30, 'games_played', 1, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Centurion', 'Get 100 career kills', 'performance', 'one_time', 35, 100, 'total_kills', 2, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Rampage', 'Get 8 kills in a single game', 'performance', 'one_time', 30, 8, 'best_kills_game', 3, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Setup Artist', 'Get 12 assists in a single game', 'performance', 'one_time', 30, 12, 'best_assists_game', 4, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Powerhouse', 'Deal 18,000 damage in a single game', 'performance', 'one_time', 30, 18000, 'best_damage_game', 5, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Tank Mode', 'Mitigate 15,000 damage in a single game', 'performance', 'one_time', 25, 15000, 'best_mitigated_game', 6, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Contender', 'Finish a season with 50%+ win rate (min 5 games)', 'league', 'one_time', 25, 50, 'best_season_win_rate', 7, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Winning Habit', 'Win 15 games', 'league', 'one_time', 30, 15, 'total_wins', 8, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Supporter', 'Get 100 career assists', 'performance', 'one_time', 30, 100, 'total_assists', 9, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Damage Racker', 'Deal 75,000 total career damage', 'performance', 'one_time', 30, 75000, 'total_damage', 10, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Year Strong', 'Claim daily login 365 times', 'engagement', 'one_time', 35, 365, 'daily_logins', 11, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Two Month Streak', 'Reach a 60-day login streak', 'engagement', 'one_time', 35, 60, 'login_streak', 12, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Ranking Addict', 'Save 25 tier lists', 'engagement', 'one_time', 25, 25, 'tier_lists_created', 13, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Draft Commander', 'Complete 25 drafts', 'engagement', 'one_time', 25, 25, 'drafts_completed', 14, 'silver') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Burning Bright', 'Earn 1,000 total Passion', 'engagement', 'one_time', 30, 1000, 'total_earned', 15, 'silver') ON CONFLICT (title) DO NOTHING;


-- ─── GOLD TIER ───────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Experienced', 'Play 50 league games', 'league', 'one_time', 40, 50, 'games_played', 1, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('League Hopper', 'Join 2 different leagues', 'league', 'one_time', 35, 2, 'leagues_joined', 2, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Double Digits', 'Get 12 kills in a single game', 'performance', 'one_time', 45, 12, 'best_kills_game', 3, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Guardian Angel', 'Get 16 assists in a single game', 'performance', 'one_time', 40, 16, 'best_assists_game', 4, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Damage Machine', 'Deal 25,000 damage in a single game', 'performance', 'one_time', 40, 25000, 'best_damage_game', 5, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Immovable', 'Mitigate 25,000 damage in a single game', 'performance', 'one_time', 35, 25000, 'best_mitigated_game', 6, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Consistent Threat', 'Average 12,000+ damage per game in a season (min 5 games)', 'league', 'one_time', 35, 12000, 'best_season_avg_damage', 7, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Winner', 'Finish a season with 55%+ win rate (min 5 games)', 'league', 'one_time', 35, 55, 'best_season_win_rate', 8, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Victory Collector', 'Win 30 games', 'league', 'one_time', 40, 30, 'total_wins', 9, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('200 Club', 'Get 200 career kills', 'performance', 'one_time', 40, 200, 'total_kills', 10, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Supportive Soul', 'Get 300 career assists', 'performance', 'one_time', 35, 300, 'total_assists', 11, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Damage Stockpile', 'Deal 150,000 total career damage', 'performance', 'one_time', 35, 150000, 'total_damage', 12, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Shield Wall', 'Mitigate 150,000 total career damage', 'performance', 'one_time', 35, 150000, 'total_mitigated', 13, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Daily Devotee', 'Claim daily login 500 times', 'engagement', 'one_time', 40, 500, 'daily_logins', 14, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Three Month Streak', 'Reach a 90-day login streak', 'engagement', 'one_time', 45, 90, 'login_streak', 15, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Tier List Machine', 'Save 50 tier lists', 'engagement', 'one_time', 35, 50, 'tier_lists_created', 16, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Draft Obsessed', 'Complete 50 drafts', 'engagement', 'one_time', 35, 50, 'drafts_completed', 17, 'gold') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Ablaze', 'Earn 2,500 total Passion', 'engagement', 'one_time', 40, 2500, 'total_earned', 18, 'gold') ON CONFLICT (title) DO NOTHING;


-- ─── PLATINUM TIER ───────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('War Hero', 'Play 75 league games', 'league', 'one_time', 50, 75, 'games_played', 1, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Executioner', 'Get 250 career kills', 'performance', 'one_time', 50, 250, 'total_kills', 2, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Arsenal', 'Deal 300,000 total career damage', 'performance', 'one_time', 50, 300000, 'total_damage', 3, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Unstoppable Force', 'Get 15 kills in a single game', 'performance', 'one_time', 55, 15, 'best_kills_game', 4, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('The Enabler', 'Get 22 assists in a single game', 'performance', 'one_time', 55, 22, 'best_assists_game', 5, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Wrecking Ball', 'Deal 35,000 damage in a single game', 'performance', 'one_time', 55, 35000, 'best_damage_game', 6, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Fortress', 'Mitigate 35,000 damage in a single game', 'performance', 'one_time', 50, 35000, 'best_mitigated_game', 7, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Dominant', 'Finish a season with 60%+ win rate (min 5 games)', 'league', 'one_time', 60, 60, 'best_season_win_rate', 8, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('50 Dubs', 'Win 50 games', 'league', 'one_time', 55, 50, 'total_wins', 9, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Well Rounded', 'Join 3 different leagues', 'league', 'one_time', 45, 3, 'leagues_joined', 10, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('500 Assists', 'Get 500 career assists', 'performance', 'one_time', 50, 500, 'total_assists', 11, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Mitigation Machine', 'Mitigate 300,000 total career damage', 'performance', 'one_time', 50, 300000, 'total_mitigated', 12, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Always Here', 'Claim daily login 750 times', 'engagement', 'one_time', 55, 750, 'daily_logins', 13, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Four Month Streak', 'Reach a 120-day login streak', 'engagement', 'one_time', 55, 120, 'login_streak', 14, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Tier List Legend', 'Save 100 tier lists', 'engagement', 'one_time', 50, 100, 'tier_lists_created', 15, 'platinum') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Inferno', 'Earn 5,000 total Passion', 'engagement', 'one_time', 55, 5000, 'total_earned', 16, 'platinum') ON CONFLICT (title) DO NOTHING;


-- ─── DIAMOND TIER ────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Legend', 'Play 100 league games', 'league', 'one_time', 75, 100, 'games_played', 1, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Annihilator', 'Get 500 career kills', 'performance', 'one_time', 80, 500, 'total_kills', 2, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Selfless', 'Get 1,000 career assists', 'performance', 'one_time', 75, 1000, 'total_assists', 3, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('One-Man Army', 'Get 18 kills in a single game', 'performance', 'one_time', 80, 18, 'best_kills_game', 4, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Nuke Launch Detected', 'Deal 45,000 damage in a single game', 'performance', 'one_time', 85, 45000, 'best_damage_game', 5, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Diamond Wall', 'Mitigate 50,000 damage in a single game', 'performance', 'one_time', 80, 50000, 'best_mitigated_game', 6, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Franchise Player', 'Finish a season with 65%+ win rate (min 5 games)', 'league', 'one_time', 80, 65, 'best_season_win_rate', 7, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Premier League', 'Play a game in a Tier 1 division', 'league', 'one_time', 85, 1, 'games_in_tier_1', 8, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Century of Wins', 'Win 100 games', 'league', 'one_time', 80, 100, 'total_wins', 9, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('League Veteran', 'Join 5 different leagues', 'league', 'one_time', 75, 5, 'leagues_joined', 10, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Damage Hoard', 'Deal 750,000 total career damage', 'performance', 'one_time', 75, 750000, 'total_damage', 11, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Iron Guardian', 'Mitigate 750,000 total career damage', 'performance', 'one_time', 75, 750000, 'total_mitigated', 12, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Thousand Days', 'Claim daily login 1,000 times', 'engagement', 'one_time', 80, 1000, 'daily_logins', 13, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Half Year Streak', 'Reach a 180-day login streak', 'engagement', 'one_time', 85, 180, 'login_streak', 14, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Tier List Maniac', 'Save 250 tier lists', 'engagement', 'one_time', 75, 250, 'tier_lists_created', 15, 'diamond') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Passion Hoarder', 'Earn 10,000 total Passion', 'engagement', 'one_time', 80, 10000, 'total_earned', 16, 'diamond') ON CONFLICT (title) DO NOTHING;


-- ─── OBSIDIAN TIER ───────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Massacre', 'Get 22 kills in a single game', 'performance', 'one_time', 95, 22, 'best_kills_game', 1, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Omnipresent', 'Get 28 assists in a single game', 'performance', 'one_time', 90, 28, 'best_assists_game', 2, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Orbital Strike', 'Deal 55,000 damage in a single game', 'performance', 'one_time', 100, 55000, 'best_damage_game', 3, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Obsidian Shield', 'Mitigate 70,000 damage in a single game', 'performance', 'one_time', 95, 70000, 'best_mitigated_game', 4, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Unstoppable Season', 'Finish a season with 70%+ win rate (min 5 games)', 'league', 'one_time', 100, 70, 'best_season_win_rate', 5, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('200 Wins', 'Win 200 games', 'league', 'one_time', 95, 200, 'total_wins', 6, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Thousand Kills', 'Get 1,000 career kills', 'performance', 'one_time', 100, 1000, 'total_kills', 7, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('2500 Assists', 'Get 2,500 career assists', 'performance', 'one_time', 95, 2500, 'total_assists', 8, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('200 Games', 'Play 200 league games', 'league', 'one_time', 90, 200, 'games_played', 9, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Million Damage Dealt', 'Deal 1,500,000 total career damage', 'performance', 'one_time', 100, 1500000, 'total_damage', 10, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Million Mitigated', 'Mitigate 1,500,000 total career damage', 'performance', 'one_time', 100, 1500000, 'total_mitigated', 11, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('League Nomad', 'Join 8 different leagues', 'league', 'one_time', 90, 8, 'leagues_joined', 12, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('1500 Logins', 'Claim daily login 1,500 times', 'engagement', 'one_time', 95, 1500, 'daily_logins', 13, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Nine Month Streak', 'Reach a 270-day login streak', 'engagement', 'one_time', 100, 270, 'login_streak', 14, 'obsidian') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Passion Furnace', 'Earn 20,000 total Passion', 'engagement', 'one_time', 95, 20000, 'total_earned', 15, 'obsidian') ON CONFLICT (title) DO NOTHING;


-- ─── MASTER TIER ─────────────────────────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Master Assassin', 'Get 26 kills in a single game', 'performance', 'one_time', 125, 26, 'best_kills_game', 1, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Cataclysm', 'Deal 70,000 damage in a single game', 'performance', 'one_time', 130, 70000, 'best_damage_game', 2, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Absolute Unit', 'Mitigate 90,000 damage in a single game', 'performance', 'one_time', 125, 90000, 'best_mitigated_game', 3, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Grandmaster', 'Finish a season with 75%+ win rate (min 5 games)', 'league', 'one_time', 135, 75, 'best_season_win_rate', 4, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('400 Wins', 'Win 400 games', 'league', 'one_time', 130, 400, 'total_wins', 5, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('2500 Kills', 'Get 2,500 career kills', 'performance', 'one_time', 130, 2500, 'total_kills', 6, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('5000 Assists', 'Get 5,000 career assists', 'performance', 'one_time', 125, 5000, 'total_assists', 7, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('400 Games', 'Play 400 league games', 'league', 'one_time', 120, 400, 'games_played', 8, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('3 Million Damage', 'Deal 3,000,000 total career damage', 'performance', 'one_time', 135, 3000000, 'total_damage', 9, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('3 Million Mitigated', 'Mitigate 3,000,000 total career damage', 'performance', 'one_time', 135, 3000000, 'total_mitigated', 10, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('2000 Logins', 'Claim daily login 2,000 times', 'engagement', 'one_time', 125, 2000, 'daily_logins', 11, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Full Year Streak', 'Reach a 365-day login streak', 'engagement', 'one_time', 135, 365, 'login_streak', 12, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Tier List Savant', 'Save 500 tier lists', 'engagement', 'one_time', 120, 500, 'tier_lists_created', 13, 'master') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier)
VALUES ('Passion Supernova', 'Earn 50,000 total Passion', 'engagement', 'one_time', 130, 50000, 'total_earned', 14, 'master') ON CONFLICT (title) DO NOTHING;


-- ─── DEMIGOD TIER (all give badges) ──────────────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Godlike', 'Get 30 kills in a single game', 'performance', 'one_time', 150, 30, 'best_kills_game', 1, 'demigod', true, 'Godlike') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Walking Apocalypse', 'Deal 85,000 damage in a single game', 'performance', 'one_time', 165, 85000, 'best_damage_game', 2, 'demigod', true, 'Walking Apocalypse') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('God of War', 'Mitigate 120,000 damage in a single game', 'performance', 'one_time', 155, 120000, 'best_mitigated_game', 3, 'demigod', true, 'God of War') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Unbeatable', 'Finish a season with 80%+ win rate (min 5 games)', 'league', 'one_time', 175, 80, 'best_season_win_rate', 4, 'demigod', true, 'Unbeatable') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('750 Victories', 'Win 750 games', 'league', 'one_time', 160, 750, 'total_wins', 5, 'demigod', true, '750 Victories') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('5000 Kills', 'Get 5,000 career kills', 'performance', 'one_time', 165, 5000, 'total_kills', 6, 'demigod', true, '5000 Kills') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('10000 Assists', 'Get 10,000 career assists', 'performance', 'one_time', 155, 10000, 'total_assists', 7, 'demigod', true, '10000 Assists') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('750 Games', 'Play 750 league games', 'league', 'one_time', 150, 750, 'games_played', 8, 'demigod', true, '750 Games') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('6 Million Damage', 'Deal 6,000,000 total career damage', 'performance', 'one_time', 170, 6000000, 'total_damage', 9, 'demigod', true, '6M Damage') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('6 Million Mitigated', 'Mitigate 6,000,000 total career damage', 'performance', 'one_time', 170, 6000000, 'total_mitigated', 10, 'demigod', true, '6M Mitigated') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('3000 Logins', 'Claim daily login 3,000 times', 'engagement', 'one_time', 160, 3000, 'daily_logins', 11, 'demigod', true, '3000 Logins') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('500 Day Streak', 'Reach a 500-day login streak', 'engagement', 'one_time', 175, 500, 'login_streak', 12, 'demigod', true, '500 Day Streak') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('1000 Tier Lists', 'Save 1,000 tier lists', 'engagement', 'one_time', 150, 1000, 'tier_lists_created', 13, 'demigod', true, '1000 Tier Lists') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Passion Star', 'Earn 100,000 total Passion', 'engagement', 'one_time', 165, 100000, 'total_earned', 14, 'demigod', true, 'Passion Star') ON CONFLICT (title) DO NOTHING;


-- ─── DEITY TIER (hardest — all give badges) ──────
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Death Incarnate', 'Get 40 kills in a single game', 'performance', 'one_time', 200, 40, 'best_kills_game', 1, 'deity', true, 'Death Incarnate') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('World Ender', 'Deal 100,000 damage in a single game', 'performance', 'one_time', 200, 100000, 'best_damage_game', 2, 'deity', true, 'World Ender') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Martyr', 'Die 20 times in a single game', 'performance', 'one_time', 175, 20, 'best_deaths_game', 3, 'deity', true, 'Martyr') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Titanium Fortress', 'Mitigate 150,000 damage in a single game', 'performance', 'one_time', 200, 150000, 'best_mitigated_game', 4, 'deity', true, 'Titanium Fortress') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Flawless', 'Finish a season with 90%+ win rate (min 5 games)', 'league', 'one_time', 200, 90, 'best_season_win_rate', 5, 'deity', true, 'Flawless') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('1500 Victories', 'Win 1,500 games', 'league', 'one_time', 200, 1500, 'total_wins', 6, 'deity', true, '1500 Victories') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('10000 Kills', 'Get 10,000 career kills', 'performance', 'one_time', 200, 10000, 'total_kills', 7, 'deity', true, '10000 Kills') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('25000 Assists', 'Get 25,000 career assists', 'performance', 'one_time', 200, 25000, 'total_assists', 8, 'deity', true, '25000 Assists') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('1500 Games', 'Play 1,500 league games', 'league', 'one_time', 200, 1500, 'games_played', 9, 'deity', true, '1500 Games') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('10 Million Damage', 'Deal 10,000,000 total career damage', 'performance', 'one_time', 200, 10000000, 'total_damage', 10, 'deity', true, '10M Damage') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('10 Million Mitigated', 'Mitigate 10,000,000 total career damage', 'performance', 'one_time', 200, 10000000, 'total_mitigated', 11, 'deity', true, '10M Mitigated') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('5000 Logins', 'Claim daily login 5,000 times', 'engagement', 'one_time', 200, 5000, 'daily_logins', 12, 'deity', true, '5000 Logins') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Two Year Streak', 'Reach a 730-day login streak', 'engagement', 'one_time', 200, 730, 'login_streak', 13, 'deity', true, 'Two Year Streak') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('2500 Tier Lists', 'Save 2,500 tier lists', 'engagement', 'one_time', 200, 2500, 'tier_lists_created', 14, 'deity', true, '2500 Tier Lists') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('Passion Deity', 'Earn 200,000 total Passion', 'engagement', 'one_time', 200, 200000, 'total_earned', 15, 'deity', true, 'Passion Deity') ON CONFLICT (title) DO NOTHING;

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order, tier, gives_badge, badge_label)
VALUES ('League Conqueror', 'Join 15 different leagues', 'league', 'one_time', 200, 15, 'leagues_joined', 16, 'deity', true, 'League Conqueror') ON CONFLICT (title) DO NOTHING;
