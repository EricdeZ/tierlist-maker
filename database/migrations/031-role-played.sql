-- Migration 031: Add role_played to player_game_stats
-- Tracks what role (Solo, Jungle, Mid, Support, ADC) a player played in each game

ALTER TABLE player_game_stats ADD COLUMN role_played varchar(20);
