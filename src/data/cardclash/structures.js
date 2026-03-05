// Structure definitions for the 3-lane board
// Each lane has: T1 Tower → T2 Tower → Phoenix → (Titan shared)
// Structures must be destroyed in order. Titan exposed when any phoenix dies.

export const STRUCTURE_TYPES = {
  T1_TOWER: 't1_tower',
  T2_TOWER: 't2_tower',
  PHOENIX: 'phoenix',
  TITAN: 'titan',
};

export const STRUCTURES = {
  t1_tower: {
    type: 't1_tower',
    name: 'Tier 1 Tower',
    hp: 40,
    attack: 8,
    defense: 5,
    description: 'First line of defense. Protected while friendly minions alive (takes 50% damage).',
    minionProtection: true, // takes 50% damage while friendly minions exist
    targetPriority: 'strongest', // targets strongest enemy
  },
  t2_tower: {
    type: 't2_tower',
    name: 'Tier 2 Tower',
    hp: 50,
    attack: 10,
    defense: 6,
    description: 'Stronger tower deeper in territory. Only vulnerable after T1 falls.',
    minionProtection: true,
    targetPriority: 'strongest',
    requiresPrevious: true,
  },
  phoenix: {
    type: 'phoenix',
    name: 'Phoenix',
    hp: 60,
    attack: 12,
    defense: 8,
    description: 'Powerful structure. Respawns 4 turns after destruction. Spawns Super Minions when down.',
    minionProtection: false,
    targetPriority: 'closest',
    respawnTurns: 4,
    spawnsSuper: true,
    requiresPrevious: true,
  },
  titan: {
    type: 'titan',
    name: 'Titan',
    hp: 80,
    attack: 15,
    defense: 10,
    description: 'Final objective. Destroy to win. Only exposed when at least one Phoenix is destroyed.',
    minionProtection: false,
    targetPriority: 'closest',
    requiresPhoenixDown: true,
  },
};

// Jungle objectives
export const JUNGLE_OBJECTIVES = {
  gold_fury: {
    name: 'Gold Fury',
    hp: 35,
    attack: 5,
    defense: 3,
    reward: { mana: 2, gold: 3 }, // bonus mana regen + draw cards
    respawnTurns: 5,
    description: 'Grants team-wide mana boost and extra card draw.',
  },
  fire_giant: {
    name: 'Fire Giant',
    hp: 60,
    attack: 10,
    defense: 5,
    reward: { attack: 3, fireMinions: true, duration: 3 },
    respawnTurns: 8,
    description: 'Grants team +3 Attack and Fire Minions for 3 turns.',
  },
  pyromancer: {
    name: 'Pyromancer',
    hp: 25,
    attack: 8,
    defense: 2,
    reward: { speedBoost: true, structureDamage: 5 },
    respawnTurns: 4,
    description: 'Grants speed buff and deals 5 damage to nearest enemy structure.',
  },
};

// Lane configuration
export const LANES = {
  solo: { name: 'Solo Lane', color: 'blue', index: 0 },
  mid: { name: 'Mid Lane', color: 'purple', index: 1 },
  duo: { name: 'Duo Lane', color: 'red', index: 2 },
};

// Create initial board state for one side
export function createSideStructures() {
  return {
    solo: {
      t1: { ...STRUCTURES.t1_tower, currentHp: STRUCTURES.t1_tower.hp, destroyed: false },
      t2: { ...STRUCTURES.t2_tower, currentHp: STRUCTURES.t2_tower.hp, destroyed: false },
      phoenix: { ...STRUCTURES.phoenix, currentHp: STRUCTURES.phoenix.hp, destroyed: false, respawnTimer: 0 },
    },
    mid: {
      t1: { ...STRUCTURES.t1_tower, currentHp: STRUCTURES.t1_tower.hp, destroyed: false },
      t2: { ...STRUCTURES.t2_tower, currentHp: STRUCTURES.t2_tower.hp, destroyed: false },
      phoenix: { ...STRUCTURES.phoenix, currentHp: STRUCTURES.phoenix.hp, destroyed: false, respawnTimer: 0 },
    },
    duo: {
      t1: { ...STRUCTURES.t1_tower, currentHp: STRUCTURES.t1_tower.hp, destroyed: false },
      t2: { ...STRUCTURES.t2_tower, currentHp: STRUCTURES.t2_tower.hp, destroyed: false },
      phoenix: { ...STRUCTURES.phoenix, currentHp: STRUCTURES.phoenix.hp, destroyed: false, respawnTimer: 0 },
    },
    titan: { ...STRUCTURES.titan, currentHp: STRUCTURES.titan.hp, destroyed: false },
  };
}

export default STRUCTURES;
