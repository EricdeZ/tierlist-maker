-- Migration 011: Seed built-in challenges
-- Run this if you already ran 010 before seed challenges were added.

-- Engagement: Daily Logins
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('First Steps', 'Claim your first daily login', 'engagement', 'one_time', 10, 1, 'daily_logins', 1);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Creature of Habit', 'Claim daily login 7 times', 'engagement', 'one_time', 25, 7, 'daily_logins', 2);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Dedicated', 'Claim daily login 30 times', 'engagement', 'one_time', 75, 30, 'daily_logins', 3);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Loyal Fan', 'Claim daily login 100 times', 'engagement', 'one_time', 200, 100, 'daily_logins', 4);

-- Engagement: Login Streaks
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Getting Warmed Up', 'Reach a 3-day login streak', 'engagement', 'one_time', 15, 3, 'login_streak', 5);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('On a Roll', 'Reach a 7-day login streak', 'engagement', 'one_time', 40, 7, 'login_streak', 6);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Unstoppable', 'Reach a 14-day login streak', 'engagement', 'one_time', 100, 14, 'login_streak', 7);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Iron Will', 'Reach a 30-day login streak', 'engagement', 'one_time', 250, 30, 'login_streak', 8);

-- Engagement: Tier Lists
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Opinionated', 'Save a tier list', 'engagement', 'one_time', 10, 1, 'tier_lists_created', 9);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Tier Enthusiast', 'Save 5 tier lists', 'engagement', 'one_time', 30, 5, 'tier_lists_created', 10);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Ranking Addict', 'Save 25 tier lists', 'engagement', 'one_time', 100, 25, 'tier_lists_created', 11);

-- Engagement: Drafts
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Draft Day', 'Complete a draft', 'engagement', 'one_time', 10, 1, 'drafts_completed', 12);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Draft Veteran', 'Complete 5 drafts', 'engagement', 'one_time', 30, 5, 'drafts_completed', 13);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('GM Material', 'Complete 25 drafts', 'engagement', 'one_time', 100, 25, 'drafts_completed', 14);

-- Engagement: Passion Earning (meta)
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Getting Started', 'Earn 100 total Passion', 'engagement', 'one_time', 25, 100, 'total_earned', 15);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Passionate', 'Earn 500 total Passion', 'engagement', 'one_time', 75, 500, 'total_earned', 16);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Burning Bright', 'Earn 1,000 total Passion', 'engagement', 'one_time', 150, 1000, 'total_earned', 17);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Inferno', 'Earn 2,500 total Passion', 'engagement', 'one_time', 300, 2500, 'total_earned', 18);

-- Performance: Kills
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('First Blood', 'Get 10 total kills', 'performance', 'one_time', 15, 10, 'total_kills', 1);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Slayer', 'Get 100 total kills', 'performance', 'one_time', 50, 100, 'total_kills', 2);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Annihilator', 'Get 500 total kills', 'performance', 'one_time', 150, 500, 'total_kills', 3);

-- Performance: Assists
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Team Player', 'Get 25 total assists', 'performance', 'one_time', 15, 25, 'total_assists', 4);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Supportive', 'Get 200 total assists', 'performance', 'one_time', 50, 200, 'total_assists', 5);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Guardian Angel', 'Get 1,000 total assists', 'performance', 'one_time', 200, 1000, 'total_assists', 6);

-- Performance: Damage
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Damage Dealer', 'Deal 50,000 total damage', 'performance', 'one_time', 25, 50000, 'total_damage', 7);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Powerhouse', 'Deal 250,000 total damage', 'performance', 'one_time', 100, 250000, 'total_damage', 8);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Walking Nuke', 'Deal 1,000,000 total damage', 'performance', 'one_time', 300, 1000000, 'total_damage', 9);

-- Performance: Mitigation
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Tank Mode', 'Mitigate 50,000 total damage', 'performance', 'one_time', 25, 50000, 'total_mitigated', 10);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Immovable Object', 'Mitigate 250,000 total damage', 'performance', 'one_time', 100, 250000, 'total_mitigated', 11);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Fortress', 'Mitigate 1,000,000 total damage', 'performance', 'one_time', 300, 1000000, 'total_mitigated', 12);

-- League: Games & Leagues
INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Rookie', 'Play 5 games', 'league', 'one_time', 15, 5, 'games_played', 1);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Seasoned', 'Play 25 games', 'league', 'one_time', 50, 25, 'games_played', 2);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Veteran', 'Play 100 games', 'league', 'one_time', 200, 100, 'games_played', 3);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('League Hopper', 'Join 2 different leagues', 'league', 'one_time', 50, 2, 'leagues_joined', 4);

INSERT INTO challenges (title, description, category, type, reward, target_value, stat_key, sort_order)
VALUES ('Well Rounded', 'Join 3 different leagues', 'league', 'one_time', 100, 3, 'leagues_joined', 5);
