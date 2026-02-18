-- Migration 030: Tier List Social Feed
-- Users can publish tier list rankings as posts in a division-scoped feed.
-- Other users can like posts, awarding 1 Passion to the creator.

CREATE TABLE tierlist_posts (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id     INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    title         VARCHAR(100),
    rankings      JSONB NOT NULL,
    like_count    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tierlist_posts_season ON tierlist_posts(season_id, created_at DESC);
CREATE INDEX idx_tierlist_posts_user ON tierlist_posts(user_id);

CREATE TABLE tierlist_likes (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER NOT NULL REFERENCES tierlist_posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_tierlist_likes_post ON tierlist_likes(post_id);
