// God data scraped from smitesource.com/gods + class assignments
// imageUrl pattern: https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods/{Key}/Default/t_GodCard_{Key}.png

const CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75';

export const GOD_CLASSES = {
  GUARDIAN: 'Guardian',
  WARRIOR: 'Warrior',
  ASSASSIN: 'Assassin',
  MAGE: 'Mage',
  HUNTER: 'Hunter',
};

export const DAMAGE_TYPES = {
  PHYSICAL: 'Physical',
  MAGICAL: 'Magical',
};

// Class → damage type mapping
export const CLASS_DAMAGE = {
  Guardian: 'Magical',
  Warrior: 'Physical',
  Assassin: 'Physical',
  Mage: 'Magical',
  Hunter: 'Physical',
};

// Class → default role affinity
export const CLASS_ROLE = {
  Guardian: 'support',
  Warrior: 'solo',
  Assassin: 'jungle',
  Mage: 'mid',
  Hunter: 'adc',
};

// Base stat profiles per class for card game
export const CLASS_STATS = {
  Guardian: { hp: 50, attack: 4, defense: 7, mana: 5 },
  Warrior:  { hp: 45, attack: 6, defense: 6, mana: 5 },
  Assassin: { hp: 30, attack: 9, defense: 3, mana: 5 },
  Mage:     { hp: 35, attack: 3, defense: 3, mana: 7 },
  Hunter:   { hp: 30, attack: 8, defense: 3, mana: 5 },
};

// Ability types — macro conquest focused
export const ABILITY_TYPES = {
  DAMAGE: 'damage',
  AOE_DAMAGE: 'aoe_damage',
  HEAL: 'heal',
  BUFF: 'buff',
  DEBUFF: 'debuff',
  CC: 'cc',
  EXECUTE: 'execute',
  SHIELD: 'shield',
  SUMMON: 'summon',
  GLOBAL: 'global',
  STEALTH: 'stealth',
  MOBILITY: 'mobility',
  ROTATE: 'rotate',
  GANK: 'gank',
  SPLIT: 'split',
  VISION: 'vision',
  ZONE: 'zone',
  OBJECTIVE: 'objective',
  WAVE: 'wave',
  INVADE: 'invade',
};

// ═══════════════════════════════════════════════
// All 77 gods — macro conquest abilities
// Zones: Solo Lane, Mid Lane, Duo Lane (each Order/Chaos side)
//        Left Jungle, Right Jungle (Order/Chaos/Neutral)
//        Fire Giant pit, Gold Fury pit
// Each player has 5 gods as chess pieces on the map.
// ═══════════════════════════════════════════════

const BASE_GODS = [
  // ─── WARRIORS (Solo lane: split push, 1v1, frontline, teleport) ───
  { id: 1, name: 'Achilles', slug: 'achilles', class: 'Warrior', imageKey: 'Achilles',
    ability: { name: 'Combat Stance', type: 'split', description: 'Toggle: Offensive (+3 ATK, deal double structure damage this turn) or Defensive (+4 DEF, block enemy rotation through your zone)', manaCost: 2, cooldown: 1, value: 3 } },
  { id: 4, name: 'Amaterasu', slug: 'amaterasu', class: 'Warrior', imageKey: 'Amaterasu',
    ability: { name: 'Divine Aura', type: 'buff', description: 'All allied gods in your zone and adjacent zones gain +2 ATK for 2 turns. If solo in zone, also +2 DEF', manaCost: 3, cooldown: 3, value: 2 } },
  { id: 16, name: 'Bellona', slug: 'bellona', class: 'Warrior', imageKey: 'Bellona',
    ability: { name: 'Rally Point', type: 'zone', description: 'Plant flag in current zone: allies here gain +3 DEF and clear waves 50% faster for 3 turns. Zone persists if you leave', manaCost: 4, cooldown: 4, value: 3 } },
  { id: 20, name: 'Chaac', slug: 'chaac', class: 'Warrior', imageKey: 'Chaac',
    ability: { name: 'Storm Strike', type: 'wave', description: 'Instantly clear the minion wave in your zone. Heal 5 HP. Can teleport to where the axe landed (adjacent zone) next turn', manaCost: 3, cooldown: 3, value: 5 } },
  { id: 30, name: 'Guan Yu', slug: 'guan-yu', class: 'Warrior', imageKey: 'Guan_Yu',
    ability: { name: 'Cavalry Charge', type: 'rotate', description: 'Ride through up to 3 connected zones, dealing 4 damage to each enemy god along the path. End in any zone you passed through', manaCost: 5, cooldown: 4, value: 4 } },
  { id: 33, name: 'Hercules', slug: 'hercules', class: 'Warrior', imageKey: 'Hercules',
    ability: { name: 'Boulder Toss', type: 'zone', description: 'Launch boulder into an adjacent zone: deal 8 damage to one enemy and push them to the next zone away from you', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 35, name: 'Hua Mulan', slug: 'mulan', class: 'Warrior', imageKey: 'Mulan',
    ability: { name: 'Training Arc', type: 'buff', description: 'Each zone you visit for the first time grants permanent +1 to a random stat. Using abilities in 3 different zones unlocks +3 ATK', manaCost: 2, cooldown: 2, value: 1 } },
  { id: 48, name: 'Mordred', slug: 'mordred', class: 'Warrior', imageKey: 'Mordred',
    ability: { name: 'Dark Rebellion', type: 'gank', description: 'Dash from jungle into adjacent lane. Deal 10 damage to the enemy god there. If target is a tank, deal 14 instead', manaCost: 4, cooldown: 3, value: 10 } },
  { id: 55, name: 'Odin', slug: 'odin', class: 'Warrior', imageKey: 'Odin',
    ability: { name: 'Ring of Spears', type: 'zone', description: 'Lock down your zone for 2 turns: no enemy can enter or leave. Enemy healing inside is disabled. Traps anyone already here', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 56, name: 'Osiris', slug: 'osiris', class: 'Warrior', imageKey: 'Osiris',
    ability: { name: 'Afterlife Leap', type: 'gank', description: 'Jump to any zone within 2 connections. Deal 8 damage on landing. Enemies in that zone cannot heal for 2 turns', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 65, name: 'Sun Wukong', slug: 'sun-wukong', class: 'Warrior', imageKey: 'Sun_Wukong',
    ability: { name: 'Cloud Retreat', type: 'rotate', description: 'Fly to any allied zone. Heal 15 HP over 3 turns. Leave a decoy (10 HP, 3 ATK) in the zone you left', manaCost: 5, cooldown: 4, value: 15 } },

  // ─── ASSASSINS (Jungle: gank, invade, camp clear, pick-offs) ───
  { id: 3, name: 'Aladdin', slug: 'aladdin', class: 'Assassin', imageKey: 'Aladdin',
    ability: { name: 'Carpet Gank', type: 'gank', description: 'Fly from jungle to any lane. Deal 8 damage to one enemy god and steal 1 buff or item from them', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 13, name: 'Awilix', slug: 'awilix', class: 'Assassin', imageKey: 'Awilix',
    ability: { name: 'Gravity Surge', type: 'gank', description: 'Pull one enemy god from an adjacent zone into your zone. Deal 10 damage. They lose their next action', manaCost: 4, cooldown: 3, value: 10 } },
  { id: 23, name: 'Da Ji', slug: 'da-ji', class: 'Assassin', imageKey: 'Daji',
    ability: { name: 'Paolao Trap', type: 'zone', description: 'Set up Paolao in current jungle zone. Next 3 enemies who enter take 5 damage and are rooted for 1 turn each', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 27, name: 'Fenrir', slug: 'fenrir', class: 'Assassin', imageKey: 'Fenrir',
    ability: { name: 'Ragnarok', type: 'gank', description: 'Grab one enemy god and drag them into an adjacent zone of your choice. Deal 8 damage. Perfect for pulling into your team', manaCost: 5, cooldown: 4, value: 8 } },
  { id: 36, name: 'Hun Batz', slug: 'hun-batz', class: 'Assassin', imageKey: 'Hun_Batz',
    ability: { name: 'Fear No Evil', type: 'zone', description: 'All enemies in your zone flee to adjacent zones (random direction). They skip their next action. Seize the objective', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 41, name: 'Kali', slug: 'kali', class: 'Assassin', imageKey: 'Kali',
    ability: { name: 'Mark for Death', type: 'execute', description: 'Mark an enemy god anywhere on the map. If you reach their zone and they are below 25% HP, instant kill. Otherwise deal 8 damage', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 44, name: 'Loki', slug: 'loki', class: 'Assassin', imageKey: 'Loki',
    ability: { name: 'Vanish & Strike', type: 'stealth', description: 'Go invisible for 2 turns (cannot be targeted or revealed). Move freely. When you attack, deal 14 damage from stealth', manaCost: 5, cooldown: 4, value: 14 } },
  { id: 46, name: 'Mercury', slug: 'mercury', class: 'Assassin', imageKey: 'Mercury',
    ability: { name: 'Sonic Boom', type: 'rotate', description: 'Dash through up to 4 zones in a line. Deal 6 damage to every enemy god you pass through. End in the last zone', manaCost: 4, cooldown: 3, value: 6 } },
  { id: 50, name: 'Ne Zha', slug: 'ne-zha', class: 'Assassin', imageKey: 'Ne_Zha',
    ability: { name: 'Sash Engage', type: 'gank', description: 'Target an enemy god within 2 zones. Dash to them, carry both into the air (untargetable), deal 12 damage, then drop them in any adjacent zone', manaCost: 5, cooldown: 4, value: 12 } },
  { id: 52, name: 'Nemesis', slug: 'nemesis', class: 'Assassin', imageKey: 'Nemesis',
    ability: { name: 'Divine Judgement', type: 'debuff', description: 'Target an enemy god in your zone. Steal 30% of their ATK and DEF for 3 turns. Slow their movement (costs extra action to leave zone)', manaCost: 4, cooldown: 3, value: 0 } },
  { id: 57, name: 'Pele', slug: 'pele', class: 'Assassin', imageKey: 'Pele',
    ability: { name: 'Eruption Gank', type: 'gank', description: 'Dash from jungle into lane. Deal 6 damage twice and knock target back one zone. You take their position', manaCost: 4, cooldown: 3, value: 12 } },
  { id: 66, name: 'Susano', slug: 'susano', class: 'Assassin', imageKey: 'Susano',
    ability: { name: 'Typhoon', type: 'zone', description: 'Create a vortex in your zone. Pull all enemies from adjacent zones into yours, then knock them back. 8 damage to all affected', manaCost: 5, cooldown: 3, value: 8 } },
  { id: 68, name: 'Thanatos', slug: 'thanatos', class: 'Assassin', imageKey: 'Thanatos',
    ability: { name: 'Hovering Death', type: 'global', description: 'Fly over the entire map. Land on any zone. Execute any god below 20% HP there, or deal 10 damage. Reveals all enemies briefly', manaCost: 5, cooldown: 4, value: 10 } },
  { id: 70, name: 'Thor', slug: 'thor', class: 'Assassin', imageKey: 'Thor',
    ability: { name: 'Anvil of Dawn', type: 'global', description: 'Launch into the sky and land anywhere on the map. Deal 10 damage and stun target for 1 turn on landing. Perfect rotation tool', manaCost: 5, cooldown: 4, value: 10 } },
  { id: 71, name: 'Tsukuyomi', slug: 'tsukuyomi', class: 'Assassin', imageKey: 'Tsukuyomi',
    ability: { name: 'Dark Moon', type: 'gank', description: 'Dash to an enemy in adjacent zone. 3 rapid strikes of 4 damage. Final hit disarms them (no basic attacks) for 1 turn', manaCost: 5, cooldown: 3, value: 12 } },

  // ─── MAGES (Mid lane: wave clear, rotation threat, area denial, poke) ───
  { id: 2, name: 'Agni', slug: 'agni', class: 'Mage', imageKey: 'Agni',
    ability: { name: 'Rain Fire', type: 'aoe_damage', description: 'Launch meteors at your zone or any adjacent zone. Clear the minion wave and deal 6 damage to all enemy gods there', manaCost: 4, cooldown: 3, value: 6 } },
  { id: 6, name: 'Anubis', slug: 'anubis', class: 'Mage', imageKey: 'Anubis',
    ability: { name: 'Death Gaze', type: 'zone', description: 'Channel: deal 14 damage to one enemy in your zone but you are rooted in place (cannot move for 1 turn). Massive single-target threat', manaCost: 5, cooldown: 3, value: 14 } },
  { id: 7, name: 'Aphrodite', slug: 'aphrodite', class: 'Mage', imageKey: 'Aphrodite',
    ability: { name: 'Love Link', type: 'heal', description: 'Link to an ally anywhere on the map. Heal them 8 HP. While linked, if either takes lethal damage, redirect half to the other. Lasts 3 turns', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 15, name: 'Baron Samedi', slug: 'baron-samedi', class: 'Mage', imageKey: 'BaronSamedi',
    ability: { name: 'Hysteria', type: 'zone', description: 'Your zone becomes a dread zone for 3 turns. Enemies inside take 3 damage per turn and heal 50% less. If below 50% HP: pull them toward you', manaCost: 5, cooldown: 3, value: 3 } },
  { id: 25, name: 'Discordia', slug: 'discordia', class: 'Mage', imageKey: 'Discordia',
    ability: { name: 'Golden Apple', type: 'debuff', description: 'Throw apple into adjacent zone. Two random enemies there attack each other for 1 turn. Sow chaos before a rotation', manaCost: 4, cooldown: 4, value: 0 } },
  { id: 26, name: 'Eset', slug: 'eset', class: 'Mage', imageKey: 'Eset',
    ability: { name: 'Protection Zone', type: 'shield', description: 'Place a protective circle in your zone for 2 turns. Allies inside gain 8 HP shield. When circle expires, deal stored damage to enemies', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 31, name: 'Hades', slug: 'hades', class: 'Mage', imageKey: 'Hades',
    ability: { name: 'Pillar of Agony', type: 'zone', description: 'Lock all enemies in your zone for 2 turns (they cannot leave). Deal 5 damage per turn. Forces a fight at your location', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 32, name: 'Hecate', slug: 'hecate', class: 'Mage', imageKey: 'Hecate',
    ability: { name: 'Witch Strike', type: 'damage', description: 'Deal 12 damage to an enemy in your zone. If they die, cooldown resets and you may move to an adjacent zone for free', manaCost: 4, cooldown: 3, value: 12 } },
  { id: 38, name: 'Janus', slug: 'janus', class: 'Mage', imageKey: 'Janus',
    ability: { name: 'Portal Rotation', type: 'global', description: 'Open portal between any two zones on the map. You and all allies can travel through it this turn. Also deals 8 damage to the first enemy at destination', manaCost: 5, cooldown: 4, value: 8 } },
  { id: 43, name: 'Kukulkan', slug: 'kukulkan', class: 'Mage', imageKey: 'Kukulkan',
    ability: { name: 'Spirit Winds', type: 'wave', description: 'Unleash tornado down your lane. Instantly clears current and adjacent lane zone minion waves. Deals 8 damage to enemy gods hit', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 47, name: 'Merlin', slug: 'merlin', class: 'Mage', imageKey: 'Merlin',
    ability: { name: 'Elemental Stance', type: 'buff', description: 'Cycle: Fire (clear wave + 8 damage in zone) | Ice (slow all enemies in zone, -1 action) | Arcane (move to adjacent zone + 6 damage)', manaCost: 3, cooldown: 2, value: 8 } },
  { id: 49, name: 'Morgan Le Fay', slug: 'morgan-le-fay', class: 'Mage', imageKey: 'MorganLeFay',
    ability: { name: 'Dark Mark', type: 'debuff', description: 'Mark enemy god anywhere on map. They take +3 damage from all sources for 3 turns. If they enter a zone you control, take 5 bonus damage', manaCost: 3, cooldown: 3, value: 3 } },
  { id: 53, name: 'Nu Wa', slug: 'nu-wa', class: 'Mage', imageKey: 'NuWa',
    ability: { name: 'Fire Shards', type: 'global', description: 'Deal 5 damage to ALL enemy gods on the entire map. Reveals their positions for 1 turn. Ultimate map awareness play', manaCost: 6, cooldown: 4, value: 5 } },
  { id: 54, name: 'Nut', slug: 'nut', class: 'Mage', imageKey: 'Nut',
    ability: { name: 'Star Fall', type: 'aoe_damage', description: 'Rain stars across your zone and both adjacent zones. Deal 3 damage to each enemy in those zones. Great lane pressure', manaCost: 4, cooldown: 3, value: 3 } },
  { id: 58, name: 'Poseidon', slug: 'poseidon', class: 'Mage', imageKey: 'Poseidon',
    ability: { name: 'Release the Kraken', type: 'zone', description: 'Summon Kraken in your zone. Deal 12 damage to all enemies there and knock them into adjacent zones. Zone is impassable for 1 turn', manaCost: 6, cooldown: 4, value: 12 } },
  { id: 60, name: 'Ra', slug: 'ra', class: 'Mage', imageKey: 'Ra',
    ability: { name: 'Celestial Beam', type: 'wave', description: 'Fire beam down lane: clear minion wave and deal 7 damage to all enemies in your lane zone. Also heals allies in zone for 4 HP', manaCost: 3, cooldown: 2, value: 7 } },
  { id: 62, name: 'Scylla', slug: 'scylla', class: 'Mage', imageKey: 'Scylla',
    ability: { name: 'Monster Unleashed', type: 'aoe_damage', description: 'Deal 14 damage in your zone. If an enemy god dies, you may immediately recast once (free) in any adjacent zone', manaCost: 6, cooldown: 4, value: 14 } },
  { id: 64, name: 'Sol', slug: 'sol', class: 'Mage', imageKey: 'Sol',
    ability: { name: 'Supernova', type: 'split', description: 'Deal 4 damage to all enemies in zone per turn for 2 turns. While active, Sol deals double damage to structures in this zone', manaCost: 5, cooldown: 3, value: 4 } },
  { id: 69, name: 'The Morrigan', slug: 'the-morrigan', class: 'Mage', imageKey: 'TheMorrigan',
    ability: { name: 'Changeling', type: 'stealth', description: 'Become invisible and transform into any god on the field. Copy their ability for 1 use. Perfect for surprise rotations', manaCost: 5, cooldown: 5, value: 0 } },
  { id: 73, name: 'Vulcan', slug: 'vulcan', class: 'Mage', imageKey: 'Vulcan',
    ability: { name: 'Earthshaker', type: 'global', description: 'Launch mortar at any zone on the map. Deal 12 damage to all enemies there. Long range poke for objective fights', manaCost: 6, cooldown: 4, value: 12 } },
  { id: 77, name: 'Zeus', slug: 'zeus', class: 'Mage', imageKey: 'Zeus',
    ability: { name: 'Lightning Storm', type: 'zone', description: 'Place storm over any zone for 2 turns. Enemies inside take 5 damage per turn and cannot use abilities. Zone denial tool', manaCost: 5, cooldown: 3, value: 5 } },

  // ─── GUARDIANS (Support: vision, engage, peel, rotation assist) ───
  { id: 9, name: 'Ares', slug: 'ares', class: 'Guardian', imageKey: 'Ares',
    ability: { name: 'No Escape', type: 'cc', description: 'Pull all enemy gods within 2 zones toward your location. They are forced into your zone and skip their next action. Ultimate engage', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 11, name: 'Artio', slug: 'artio', class: 'Guardian', imageKey: 'Artio',
    ability: { name: 'Bear Form', type: 'buff', description: 'Toggle: Druid (+4 DEF, heal ally in zone 3 HP/turn) or Bear (+4 ATK, enemies in zone cannot leave for 1 turn)', manaCost: 2, cooldown: 1, value: 4 } },
  { id: 12, name: 'Athena', slug: 'athena', class: 'Guardian', imageKey: 'Athena',
    ability: { name: 'Defender of Olympus', type: 'global', description: 'Teleport to any allied god on the map. Grant them +5 DEF for 2 turns and taunt all enemies in that zone (they must attack you)', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 14, name: 'Bacchus', slug: 'bacchus', class: 'Guardian', imageKey: 'Bacchus',
    ability: { name: 'Intoxicate', type: 'cc', description: 'All enemies in your zone and adjacent zones: -3 ATK and costs them an extra action to move for 2 turns. Slow the enemy rotation', manaCost: 4, cooldown: 3, value: 3 } },
  { id: 17, name: 'Cabrakan', slug: 'cabrakan', class: 'Guardian', imageKey: 'Cabrakan',
    ability: { name: 'Tectonic Shift', type: 'zone', description: 'Create a wall between two adjacent zones. No one can pass through for 2 turns. Split the enemy team and force fights', manaCost: 4, cooldown: 3, value: 0 } },
  { id: 18, name: 'Cerberus', slug: 'cerberus', class: 'Guardian', imageKey: 'Cerberus',
    ability: { name: 'Stygian Torment', type: 'cc', description: 'Pull all enemies in your zone toward you. Reduce their healing by 50% for 2 turns. Great for disrupting objective heals', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 28, name: 'Ganesha', slug: 'ganesha', class: 'Guardian', imageKey: 'Ganesha',
    ability: { name: 'Dharmic Pillars', type: 'zone', description: 'Place pillars on the border of two zones. Enemies crossing take 5 damage. Lasts 3 turns. Controls jungle entry points', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 29, name: 'Geb', slug: 'geb', class: 'Guardian', imageKey: 'Geb',
    ability: { name: 'Stone Shield', type: 'shield', description: 'Shield an ally anywhere on the map for 15 HP. Cleanses all CC effects on them. Can save a teammate across the map', manaCost: 3, cooldown: 2, value: 15 } },
  { id: 40, name: 'Jormungandr', slug: 'jormungandr', class: 'Guardian', imageKey: 'Jormungandr',
    ability: { name: 'World Serpent', type: 'zone', description: 'Submerge and travel underground through 2 zones. Emerge dealing 8 damage to all enemies in destination. Gain +5 DEF for 2 turns', manaCost: 5, cooldown: 4, value: 8 } },
  { id: 42, name: 'Khepri', slug: 'khepri', class: 'Guardian', imageKey: 'Khepri',
    ability: { name: 'Scarab Blessing', type: 'heal', description: 'Mark an ally god anywhere. If they would die within 2 turns, resurrect with 30% HP at your location instead. Ultimate save', manaCost: 5, cooldown: 5, value: 0 } },
  { id: 63, name: 'Sobek', slug: 'sobek', class: 'Guardian', imageKey: 'Sobek',
    ability: { name: 'Charge Prey', type: 'gank', description: 'Pluck an enemy god from adjacent zone and throw them behind you (2 zones away from their original position). Deal 6 damage. Displacement king', manaCost: 3, cooldown: 3, value: 6 } },
  { id: 67, name: 'Sylvanus', slug: 'sylvanus', class: 'Guardian', imageKey: 'Sylvanus',
    ability: { name: 'Nature Grasp', type: 'cc', description: 'Root all enemies in your zone for 2 turns (cannot move). Heal all allies in zone 3 HP per turn. Lockdown for objectives', manaCost: 5, cooldown: 4, value: 3 } },
  { id: 75, name: 'Yemoja', slug: 'yemoja', class: 'Guardian', imageKey: 'Yemoja',
    ability: { name: 'River Rebuke', type: 'zone', description: 'Create water wall splitting your zone. Enemies pushed to one side, allies healed 6 HP. Wall blocks passage for 1 turn', manaCost: 4, cooldown: 3, value: 6 } },
  { id: 76, name: 'Ymir', slug: 'ymir', class: 'Guardian', imageKey: 'Ymir',
    ability: { name: 'Glacial Strike', type: 'zone', description: 'Channel 2 turns in your zone. Then explode: 18 damage to all enemies in your zone. They are frozen (skip 1 turn). Objective zoning', manaCost: 6, cooldown: 5, value: 18 } },

  // ─── HUNTERS (ADC: objective DPS, lane pressure, structure damage, late game) ───
  { id: 5, name: 'Anhur', slug: 'anhur', class: 'Hunter', imageKey: 'Anhur',
    ability: { name: 'Obelisk', type: 'zone', description: 'Place obelisk in your zone. Enemies here take +3 damage from all sources. Push one enemy into an adjacent zone. Lasts 3 turns', manaCost: 3, cooldown: 2, value: 3 } },
  { id: 8, name: 'Apollo', slug: 'apollo', class: 'Hunter', imageKey: 'Apollo',
    ability: { name: 'Across the Sky', type: 'global', description: 'Fly to any zone on the map. Deal 6 damage on arrival. Perfect for split pushing or joining a fight across the map', manaCost: 5, cooldown: 4, value: 6 } },
  { id: 10, name: 'Artemis', slug: 'artemis', class: 'Hunter', imageKey: 'Artemis',
    ability: { name: 'Calydonian Boar', type: 'summon', description: 'Release boar into an adjacent zone. It has 15 HP, 6 ATK and charges toward the nearest enemy structure, clearing waves along the way', manaCost: 5, cooldown: 4, value: 15 } },
  { id: 19, name: 'Cernunnos', slug: 'cernunnos', class: 'Hunter', imageKey: 'Cernunnos',
    ability: { name: 'Season Shift', type: 'buff', description: 'Cycle: Summer (+4 ATK) | Autumn (+4 DEF) | Winter (enemies in zone -2 ATK) | Spring (lifesteal 30%)', manaCost: 2, cooldown: 1, value: 4 } },
  { id: 21, name: 'Chiron', slug: 'chiron', class: 'Hunter', imageKey: 'Chiron',
    ability: { name: 'Training Camp', type: 'heal', description: 'Heal ally in your zone 6 HP. Your next 2 basic attacks deal +3 bonus damage. Sustain and pressure in lane', manaCost: 3, cooldown: 2, value: 6 } },
  { id: 22, name: 'Cupid', slug: 'cupid', class: 'Hunter', imageKey: 'Cupid',
    ability: { name: 'Heart Bomb', type: 'zone', description: 'Attach bomb to enemy in your zone. After 1 turn: 10 damage to target + 5 to all others in same zone. Zone denial', manaCost: 4, cooldown: 3, value: 10 } },
  { id: 24, name: 'Danzaburou', slug: 'danzaburou', class: 'Hunter', imageKey: 'Danzaburou',
    ability: { name: 'Sake Barrage', type: 'cc', description: 'Toss sake across adjacent zone. All enemies there: -4 ATK and cost extra action to move for 2 turns. Lane control tool', manaCost: 3, cooldown: 3, value: 4 } },
  { id: 34, name: 'Hou Yi', slug: 'hou-yi', class: 'Hunter', imageKey: 'Hou_Yi',
    ability: { name: 'Sunbreaker', type: 'zone', description: 'Rain suns over target zone for 3 turns. Deal 4 damage per turn to all enemies there. Zone is dangerous to contest during objective', manaCost: 5, cooldown: 4, value: 4 } },
  { id: 37, name: 'Izanami', slug: 'izanami', class: 'Hunter', imageKey: 'Izanami',
    ability: { name: 'Dark Portal', type: 'stealth', description: 'Become untargetable for 1 turn. Move to any adjacent zone without being seen. Next attack deals +6 damage. Sneaky split push', manaCost: 3, cooldown: 3, value: 6 } },
  { id: 39, name: 'Jing Wei', slug: 'jing-wei', class: 'Hunter', imageKey: 'JingWei',
    ability: { name: 'Persistent Gust', type: 'rotate', description: 'After being in base or fountain, fly to any lane for free (no action cost). Passive: always return to lane faster after backing', manaCost: 2, cooldown: 2, value: 0 } },
  { id: 45, name: 'Medusa', slug: 'medusa', class: 'Hunter', imageKey: 'Medusa',
    ability: { name: 'Petrify', type: 'cc', description: 'Stun all enemies in your zone for 2 turns (they cannot move or act). Deal 6 damage to each. Forces objectives or free structures', manaCost: 5, cooldown: 4, value: 6 } },
  { id: 51, name: 'Neith', slug: 'neith', class: 'Hunter', imageKey: 'Neith',
    ability: { name: 'World Weaver', type: 'global', description: 'Snipe any god on any zone on the map. Deal 10 damage and stun for 1 turn. Cross-map pick potential', manaCost: 5, cooldown: 4, value: 10 } },
  { id: 59, name: 'Princess Bari', slug: 'bari', class: 'Hunter', imageKey: 'Bari',
    ability: { name: 'Soul Guidance', type: 'heal', description: 'Heal ALL allied gods on the entire map for 5 HP each. Cleanse debuffs. Global sustain for split-map plays', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 61, name: 'Rama', slug: 'rama', class: 'Hunter', imageKey: 'Rama',
    ability: { name: 'Astral Barrage', type: 'global', description: 'Fly up: 3 shots at any targets anywhere on the map. Deal 5 damage each. Reveals all zones you fire at', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 72, name: 'Ullr', slug: 'ullr', class: 'Hunter', imageKey: 'Ullr',
    ability: { name: 'Stance Switch', type: 'buff', description: 'Toggle: Bow (+4 ATK, deal bonus structure damage) or Axe (+4 DEF, lifesteal 20%). Adapt to lane or teamfight', manaCost: 2, cooldown: 1, value: 4 } },
  { id: 74, name: 'Xbalanque', slug: 'xbalanque', class: 'Hunter', imageKey: 'Xbalanque',
    ability: { name: 'Darkest of Nights', type: 'vision', description: 'All enemies on the map lose vision for 2 turns. -3 ATK and cannot use abilities. Map-wide disruption for objective steals', manaCost: 5, cooldown: 4, value: 3 } },
];

// ═══════════════════════════════════════════════
// Off-role variants — same god, different role
// Derived from match data (5+ games in off-role)
// ═══════════════════════════════════════════════
const ROLE_VARIANTS = [
  // ─── Solo variants ───
  { ref: 'artio', id: 78, role: 'solo' },
  { ref: 'baron-samedi', id: 79, role: 'solo' },
  { ref: 'cabrakan', id: 80, role: 'solo' },
  { ref: 'cerberus', id: 81, role: 'solo' },
  { ref: 'eset', id: 82, role: 'solo' },
  { ref: 'hades', id: 83, role: 'solo' },
  { ref: 'jormungandr', id: 84, role: 'solo' },
  { ref: 'kukulkan', id: 85, role: 'solo' },
  { ref: 'loki', id: 86, role: 'solo' },
  { ref: 'ne-zha', id: 87, role: 'solo' },
  { ref: 'pele', id: 88, role: 'solo' },
  { ref: 'sobek', id: 89, role: 'solo' },
  { ref: 'thor', id: 90, role: 'solo' },
  { ref: 'vulcan', id: 91, role: 'solo' },
  { ref: 'apollo', id: 92, role: 'solo' },
  { ref: 'ganesha', id: 127, role: 'solo' },
  // ─── Jungle variants ───
  { ref: 'achilles', id: 93, role: 'jungle' },
  { ref: 'anhur', id: 94, role: 'jungle' },
  { ref: 'apollo', id: 95, role: 'jungle' },
  { ref: 'athena', id: 96, role: 'jungle' },
  { ref: 'cernunnos', id: 97, role: 'jungle' },
  { ref: 'hercules', id: 98, role: 'jungle' },
  { ref: 'hou-yi', id: 99, role: 'jungle' },
  { ref: 'kukulkan', id: 100, role: 'jungle' },
  { ref: 'medusa', id: 101, role: 'jungle' },
  { ref: 'odin', id: 102, role: 'jungle' },
  { ref: 'osiris', id: 103, role: 'jungle' },
  { ref: 'poseidon', id: 104, role: 'jungle' },
  { ref: 'ullr', id: 105, role: 'jungle' },
  { ref: 'ganesha', id: 125, role: 'jungle' },
  // ─── Mid variants ───
  { ref: 'chiron', id: 106, role: 'mid' },
  { ref: 'neith', id: 107, role: 'mid' },
  { ref: 'bari', id: 108, role: 'mid' },
  { ref: 'ullr', id: 109, role: 'mid' },
  { ref: 'ganesha', id: 126, role: 'mid' },
  // ─── Support variants ───
  { ref: 'aphrodite', id: 110, role: 'support' },
  { ref: 'apollo', id: 111, role: 'support' },
  { ref: 'baron-samedi', id: 112, role: 'support' },
  { ref: 'eset', id: 113, role: 'support' },
  { ref: 'guan-yu', id: 114, role: 'support' },
  { ref: 'hercules', id: 115, role: 'support' },
  { ref: 'ne-zha', id: 116, role: 'support' },
  { ref: 'nu-wa', id: 117, role: 'support' },
  { ref: 'scylla', id: 118, role: 'support' },
  // ─── ADC variants ───
  { ref: 'agni', id: 119, role: 'adc' },
  { ref: 'da-ji', id: 120, role: 'adc' },
  { ref: 'geb', id: 121, role: 'adc' },
  { ref: 'nut', id: 122, role: 'adc' },
  { ref: 'sol', id: 123, role: 'adc' },
  { ref: 'susano', id: 124, role: 'adc' },
]

const VARIANTS = ROLE_VARIANTS.map(v => {
  const base = BASE_GODS.find(g => g.slug === v.ref)
  return { ...base, id: v.id, slug: `${v.ref}-${v.role}`, role: v.role }
})

export const GODS = [...BASE_GODS, ...VARIANTS]

// Helper to get god image URL
export function getGodImageUrl(god, size = 256) {
  return `${CDN.replace('width=256', `width=${size}`)}/Gods/${god.imageKey}/Default/t_GodPortrait_${god.imageKey}.png`;
}

// Get god by id
export function getGod(id) {
  return GODS.find(g => g.id === id);
}

// Get gods by class
export function getGodsByClass(cls) {
  return GODS.filter(g => g.class === cls);
}

// Get a god's full stats for the card game
export function getGodCardStats(god) {
  const base = CLASS_STATS[god.class];
  return {
    ...god,
    ...base,
    damageType: CLASS_DAMAGE[god.class],
    roleAffinity: god.role || CLASS_ROLE[god.class],
    imageUrl: getGodImageUrl(god),
  };
}

export default GODS;
