-- Card Generator passive: pool selection (god, consumable, player)
ALTER TABLE cc_passive_state ADD COLUMN IF NOT EXISTS generator_pool TEXT NOT NULL DEFAULT 'god';
