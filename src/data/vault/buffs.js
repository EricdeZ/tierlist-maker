// Buff cards — jungle camp rewards and map-wide effects
// Obtained by defeating jungle camps during Full Game mode

const WIKI = 'https://wiki.smite2.com/images';

export const BUFFS = [
  { id: 'speed', name: 'Speed Buff', color: '#f59e0b', icon: 'wind', category: 'jungle',
    imageUrl: `${WIKI}/S2_Icon_Buff_Pathfinder.png`,
    description: 'Gain +1 action this turn. Move to any adjacent zone for free.',
    manaCost: 0, duration: 2 },
  { id: 'damage', name: 'Damage Buff', color: '#ef4444', icon: 'flame', category: 'jungle',
    imageUrl: `${WIKI}/S2_Icon_Buff_Blight.png`,
    description: '+3 Attack for 3 turns.',
    manaCost: 0, duration: 3 },
  { id: 'mana', name: 'Mana Buff', color: '#3b82f6', icon: 'droplet', category: 'jungle',
    imageUrl: `${WIKI}/S2_Icon_Buff_Primal.png`,
    description: 'Restore 3 mana. +1 mana regen per turn for 3 turns.',
    manaCost: 0, duration: 3 },
  { id: 'void', name: 'Void Buff', color: '#a855f7', icon: 'shield-off', category: 'jungle',
    imageUrl: `${WIKI}/S2_Icon_Buff_Inspiration.png`,
    description: 'Your attacks reduce target Defense by 2 for 2 turns.',
    manaCost: 0, duration: 3 },
  { id: 'fire-giant', name: 'Fire Giant Buff', color: '#f97316', icon: 'flame', category: 'objective',
    imageUrl: `${WIKI}/S2_T_Icon_Buff_FireGiant.png`,
    description: 'All allies: +3 Attack, +3 Defense. Minions become Fire Minions.',
    manaCost: 0, duration: 3 },
  { id: 'gold-fury', name: 'Gold Fury Buff', color: '#eab308', icon: 'coins', category: 'objective',
    imageUrl: `${WIKI}/S2_T_Icon_Buff_GoldFury_Minions.png`,
    description: 'Team gains 2 extra mana and draws 1 extra card.',
    manaCost: 0, duration: 1 },
  { id: 'pyromancer', name: 'Pyromancer Buff', color: '#06b6d4', icon: 'zap', category: 'objective',
    imageUrl: `${WIKI}/S2_T_Icon_Buff_WarHorn.png`,
    description: 'Deal 5 damage to nearest enemy structure. +1 action this turn.',
    manaCost: 0, duration: 1 },
]

// Consumable cards — one-time use items bought from shop
export const CONSUMABLES = [
  { id: 'health-pot', name: 'Health Potion', color: '#ef4444', icon: 'heart',
    imageUrl: `${WIKI}/Consumable_Health_Potion.png`,
    description: 'Fill a percentage of your Cores cap instantly.',
    manaCost: 1, uses: 1 },
  { id: 'mana-pot', name: 'Mana Potion', color: '#3b82f6', icon: 'droplet',
    imageUrl: `${WIKI}/Consumable_Mana_Potion.png`,
    description: 'Boost your income rate until next collect.',
    manaCost: 0, uses: 1 },
  { id: 'multi-pot', name: 'Multi Potion', color: '#a855f7', icon: 'sparkles',
    imageUrl: `${WIKI}/Consumable_Multi_Potion.png`,
    description: 'Boost your rate and extend your cap until next collect.',
    manaCost: 1, uses: 1 },
  { id: 'elixir-str', name: 'Elixir of Strength', color: '#f97316', icon: 'swords',
    imageUrl: `${WIKI}/Consumable_Elixir_of_Strength.png`,
    description: 'Multiply your next collect payout.',
    manaCost: 3, uses: 1 },
  { id: 'elixir-int', name: 'Elixir of Intelligence', color: '#8b5cf6', icon: 'brain',
    imageUrl: `${WIKI}/Consumable_Elixir_of_Intelligence.png`,
    description: 'Expand dismantle thresholds until daily reset.',
    manaCost: 3, uses: 1 },
  { id: 'ward', name: 'Vision Ward', color: '#22c55e', icon: 'eye',
    imageUrl: `${WIKI}/Consumable_Vision_Ward.png`,
    description: 'Add extra days to your cap until next collect.',
    manaCost: 1, uses: 1 },
  { id: 'sentry', name: 'Sentry Ward', color: '#f59e0b', icon: 'eye-off',
    imageUrl: `${WIKI}/Consumable_Sentry_Ward.png`,
    description: 'Jackpot! Receive a random amount of Cores instantly.',
    manaCost: 1, uses: 1 },
]

export default BUFFS
