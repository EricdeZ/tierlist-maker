-- Add sentence_template column to codex_fields for customizable display sentences
ALTER TABLE codex_fields ADD COLUMN sentence_template TEXT;

-- Seed templates for existing fields based on their current hardcoded descriptors
UPDATE codex_fields SET sentence_template = 'Grants a shield of [{flat_shield}][ + {percentage_max_health_shield}% of max health][ + {flat_physical_protection_shield} physical protection][ + {percentage_physical_protection_shield}% physical protection][ + {flat_magical_protection_shield} magical protection][ + {percentage_magical_protection_shield}% magical protection]' WHERE slug = 'does-it-shield';
UPDATE codex_fields SET sentence_template = 'Stacks[ up to {max_stacks} times][ via {how_does_the_item_stack}][, gaining {things_gained_per_stack} per stack][ ({if_max_stacks_change_by_level_how_so})]' WHERE slug = 'stacking';
UPDATE codex_fields SET sentence_template = '{passive_text}' WHERE slug = 'passive';
UPDATE codex_fields SET sentence_template = '[{what_is_the_buff}][, lasts {how_long_does_the_buff_last_for_in_seconds}s]' WHERE slug = 'buff';
UPDATE codex_fields SET sentence_template = 'Affects [{self:self}][, {one_ally_only:one ally}][, {all_allies:all allies}][, {allies_within_range:allies within range}][{allies}]' WHERE slug = 'who-gets-affected';
UPDATE codex_fields SET sentence_template = '[{can_be_upgraded:Starter item (upgradable)}][{fully_upgraded:Fully upgraded starter}]' WHERE slug = 'starter';
