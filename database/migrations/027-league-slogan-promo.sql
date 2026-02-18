-- Migration 027: Add slogan and promotional_text to leagues
-- Slogan: short tagline for the league
-- Promotional text: longer marketing/description text

ALTER TABLE leagues ADD COLUMN slogan TEXT;
ALTER TABLE leagues ADD COLUMN promotional_text TEXT;
