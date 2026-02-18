-- Migration 028: Division tags
-- Tags per division, with a flag to also show at the league level

CREATE TABLE division_tags (
    id SERIAL PRIMARY KEY,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,
    show_on_league BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(division_id, label)
);
