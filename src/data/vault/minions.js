// Minion card data for SMITE Card Clash
// Minions auto-spawn each turn (wave) but extra minion cards can be played from hand

const WIKI = 'https://wiki.smite2.com/images';
const DATAMINE = 'https://smitedatamining.com/wp-content/uploads/2024/12';

export const MINION_TYPES = {
  MELEE: 'melee',
  RANGED: 'ranged',
  BRUTE: 'brute',
  SIEGE: 'siege',
  SUPER: 'super',
  FIRE: 'fire',
};

export const MINIONS = [
  {
    type: 'melee',
    name: 'Melee Minion',
    hp: 6,
    attack: 2,
    defense: 2,
    manaCost: 1,
    description: 'Basic frontline minion. Takes hits before backline units.',
    imageUrl: `${DATAMINE}/Knight1.png`,
    isAutoSpawn: true,
    spawnCount: 2,
  },
  {
    type: 'ranged',
    name: 'Ranged Minion',
    hp: 3,
    attack: 3,
    defense: 0,
    manaCost: 1,
    description: 'Fragile backline minion. Deals more damage but dies fast.',
    imageUrl: `${DATAMINE}/Archer1.png`,
    isAutoSpawn: true,
    spawnCount: 1,
  },
  {
    type: 'brute',
    name: 'Brute Minion',
    hp: 12,
    attack: 4,
    defense: 3,
    manaCost: 2,
    description: 'Tougher minion. Requires a card play to deploy.',
    imageUrl: `${DATAMINE}/Knight3.png`,
    isAutoSpawn: false,
  },
  {
    type: 'siege',
    name: 'Siege Minion',
    hp: 8,
    attack: 6,
    defense: 1,
    manaCost: 3,
    description: 'Deals double damage to structures. Glass cannon.',
    imageUrl: `${DATAMINE}/Ballista.png`,
    isAutoSpawn: false,
    structureDamageMultiplier: 2,
  },
  {
    type: 'super',
    name: 'Super Minion',
    hp: 15,
    attack: 5,
    defense: 4,
    manaCost: 0,
    description: 'Spawns when a Phoenix is destroyed. Very strong.',
    imageUrl: `${DATAMINE}/Knight5.png`,
    isAutoSpawn: true,
    requiresPhoenixDown: true,
    spawnCount: 1,
  },
  {
    type: 'fire',
    name: 'Fire Minion',
    hp: 10,
    attack: 5,
    defense: 3,
    manaCost: 0,
    description: 'Empowered minion spawned after Fire Giant is defeated.',
    imageUrl: `${WIKI}/S2_Conquest_Minion_Fire.png`,
    isAutoSpawn: true,
    requiresFireGiant: true,
    spawnCount: 1,
  },
];

export function getMinion(type) {
  return MINIONS.find(m => m.type === type);
}

// Generate a standard minion wave for a lane
export function createMinionWave(hasPhoenixDown = false, hasFireGiant = false) {
  const wave = [];
  const melee = MINIONS.find(m => m.type === 'melee');
  const ranged = MINIONS.find(m => m.type === 'ranged');
  const superMinion = MINIONS.find(m => m.type === 'super');
  const fireMinion = MINIONS.find(m => m.type === 'fire');

  for (let i = 0; i < melee.spawnCount; i++) {
    wave.push({ ...melee, id: `melee-${Date.now()}-${i}`, currentHp: melee.hp });
  }
  for (let i = 0; i < ranged.spawnCount; i++) {
    wave.push({ ...ranged, id: `ranged-${Date.now()}-${i}`, currentHp: ranged.hp });
  }
  if (hasPhoenixDown) {
    wave.push({ ...superMinion, id: `super-${Date.now()}`, currentHp: superMinion.hp });
  }
  if (hasFireGiant) {
    wave.push({ ...fireMinion, id: `fire-${Date.now()}`, currentHp: fireMinion.hp });
  }
  return wave;
}

export default MINIONS;
