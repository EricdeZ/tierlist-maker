// Server-side Card Clash catalog data
// Mirrors: src/data/vault/gods.js, items.js, buffs.js (CONSUMABLES)

const CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75'
const ITEM_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75'
const WIKI = 'https://wiki.smite2.com/images'

export const CLASS_ROLE = {
  Guardian: 'support', Warrior: 'solo', Assassin: 'jungle', Mage: 'mid', Hunter: 'adc',
}

export function getGodImageUrl(god) {
  return `${CDN}/Gods/${god.imageKey}/Default/t_GodCard_${god.imageKey}.png`
}

export function getItemImageUrl(item) {
  return `${ITEM_CDN}/${item.imageKey}.png`
}

// ═══════════════════════════════════════════════
// 77 gods — full ability data for card generation
// ═══════════════════════════════════════════════
const BASE_GODS = [
  // ─── WARRIORS ───
  { id: 1, slug: 'achilles', name: 'Achilles', class: 'Warrior', imageKey: 'Achilles',
    ability: { name: 'Combat Stance', type: 'split', description: 'Toggle: Offensive (+3 ATK, deal double structure damage this turn) or Defensive (+4 DEF, block enemy rotation through your zone)', manaCost: 2, cooldown: 1, value: 3 } },
  { id: 4, slug: 'amaterasu', name: 'Amaterasu', class: 'Warrior', imageKey: 'Amaterasu',
    ability: { name: 'Divine Aura', type: 'buff', description: 'All allied gods in your zone and adjacent zones gain +2 ATK for 2 turns. If solo in zone, also +2 DEF', manaCost: 3, cooldown: 3, value: 2 } },
  { id: 16, slug: 'bellona', name: 'Bellona', class: 'Warrior', imageKey: 'Bellona',
    ability: { name: 'Rally Point', type: 'zone', description: 'Plant flag in current zone: allies here gain +3 DEF and clear waves 50% faster for 3 turns. Zone persists if you leave', manaCost: 4, cooldown: 4, value: 3 } },
  { id: 20, slug: 'chaac', name: 'Chaac', class: 'Warrior', imageKey: 'Chaac',
    ability: { name: 'Storm Strike', type: 'wave', description: 'Instantly clear the minion wave in your zone. Heal 5 HP. Can teleport to where the axe landed (adjacent zone) next turn', manaCost: 3, cooldown: 3, value: 5 } },
  { id: 30, slug: 'guan-yu', name: 'Guan Yu', class: 'Warrior', imageKey: 'Guan_Yu',
    ability: { name: 'Cavalry Charge', type: 'rotate', description: 'Ride through up to 3 connected zones, dealing 4 damage to each enemy god along the path. End in any zone you passed through', manaCost: 5, cooldown: 4, value: 4 } },
  { id: 33, slug: 'hercules', name: 'Hercules', class: 'Warrior', imageKey: 'Hercules',
    ability: { name: 'Boulder Toss', type: 'zone', description: 'Launch boulder into an adjacent zone: deal 8 damage to one enemy and push them to the next zone away from you', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 35, slug: 'mulan', name: 'Hua Mulan', class: 'Warrior', imageKey: 'Mulan',
    ability: { name: 'Training Arc', type: 'buff', description: 'Each zone you visit for the first time grants permanent +1 to a random stat. Using abilities in 3 different zones unlocks +3 ATK', manaCost: 2, cooldown: 2, value: 1 } },
  { id: 48, slug: 'mordred', name: 'Mordred', class: 'Warrior', imageKey: 'Mordred',
    ability: { name: 'Dark Rebellion', type: 'gank', description: 'Dash from jungle into adjacent lane. Deal 10 damage to the enemy god there. If target is a tank, deal 14 instead', manaCost: 4, cooldown: 3, value: 10 } },
  { id: 55, slug: 'odin', name: 'Odin', class: 'Warrior', imageKey: 'Odin',
    ability: { name: 'Ring of Spears', type: 'zone', description: 'Lock down your zone for 2 turns: no enemy can enter or leave. Enemy healing inside is disabled. Traps anyone already here', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 56, slug: 'osiris', name: 'Osiris', class: 'Warrior', imageKey: 'Osiris',
    ability: { name: 'Afterlife Leap', type: 'gank', description: 'Jump to any zone within 2 connections. Deal 8 damage on landing. Enemies in that zone cannot heal for 2 turns', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 65, slug: 'sun-wukong', name: 'Sun Wukong', class: 'Warrior', imageKey: 'Sun_Wukong',
    ability: { name: 'Cloud Retreat', type: 'rotate', description: 'Fly to any allied zone. Heal 15 HP over 3 turns. Leave a decoy (10 HP, 3 ATK) in the zone you left', manaCost: 5, cooldown: 4, value: 15 } },

  // ─── ASSASSINS ───
  { id: 3, slug: 'aladdin', name: 'Aladdin', class: 'Assassin', imageKey: 'Aladdin',
    ability: { name: 'Carpet Gank', type: 'gank', description: 'Fly from jungle to any lane. Deal 8 damage to one enemy god and steal 1 buff or item from them', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 13, slug: 'awilix', name: 'Awilix', class: 'Assassin', imageKey: 'Awilix',
    ability: { name: 'Gravity Surge', type: 'gank', description: 'Pull one enemy god from an adjacent zone into your zone. Deal 10 damage. They lose their next action', manaCost: 4, cooldown: 3, value: 10 } },
  { id: 23, slug: 'da-ji', name: 'Da Ji', class: 'Assassin', imageKey: 'Daji',
    ability: { name: 'Paolao Trap', type: 'zone', description: 'Set up Paolao in current jungle zone. Next 3 enemies who enter take 5 damage and are rooted for 1 turn each', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 27, slug: 'fenrir', name: 'Fenrir', class: 'Assassin', imageKey: 'Fenrir',
    ability: { name: 'Ragnarok', type: 'gank', description: 'Grab one enemy god and drag them into an adjacent zone of your choice. Deal 8 damage. Perfect for pulling into your team', manaCost: 5, cooldown: 4, value: 8 } },
  { id: 36, slug: 'hun-batz', name: 'Hun Batz', class: 'Assassin', imageKey: 'Hun_Batz',
    ability: { name: 'Fear No Evil', type: 'zone', description: 'All enemies in your zone flee to adjacent zones (random direction). They skip their next action. Seize the objective', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 41, slug: 'kali', name: 'Kali', class: 'Assassin', imageKey: 'Kali',
    ability: { name: 'Mark for Death', type: 'execute', description: 'Mark an enemy god anywhere on the map. If you reach their zone and they are below 25% HP, instant kill. Otherwise deal 8 damage', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 44, slug: 'loki', name: 'Loki', class: 'Assassin', imageKey: 'Loki',
    ability: { name: 'Vanish & Strike', type: 'stealth', description: 'Go invisible for 2 turns (cannot be targeted or revealed). Move freely. When you attack, deal 14 damage from stealth', manaCost: 5, cooldown: 4, value: 14 } },
  { id: 46, slug: 'mercury', name: 'Mercury', class: 'Assassin', imageKey: 'Mercury',
    ability: { name: 'Sonic Boom', type: 'rotate', description: 'Dash through up to 4 zones in a line. Deal 6 damage to every enemy god you pass through. End in the last zone', manaCost: 4, cooldown: 3, value: 6 } },
  { id: 50, slug: 'ne-zha', name: 'Ne Zha', class: 'Assassin', imageKey: 'Ne_Zha',
    ability: { name: 'Sash Engage', type: 'gank', description: 'Target an enemy god within 2 zones. Dash to them, carry both into the air (untargetable), deal 12 damage, then drop them in any adjacent zone', manaCost: 5, cooldown: 4, value: 12 } },
  { id: 52, slug: 'nemesis', name: 'Nemesis', class: 'Assassin', imageKey: 'Nemesis',
    ability: { name: 'Divine Judgement', type: 'debuff', description: 'Target an enemy god in your zone. Steal 30% of their ATK and DEF for 3 turns. Slow their movement (costs extra action to leave zone)', manaCost: 4, cooldown: 3, value: 0 } },
  { id: 57, slug: 'pele', name: 'Pele', class: 'Assassin', imageKey: 'Pele',
    ability: { name: 'Eruption Gank', type: 'gank', description: 'Dash from jungle into lane. Deal 6 damage twice and knock target back one zone. You take their position', manaCost: 4, cooldown: 3, value: 12 } },
  { id: 66, slug: 'susano', name: 'Susano', class: 'Assassin', imageKey: 'Susano',
    ability: { name: 'Typhoon', type: 'zone', description: 'Create a vortex in your zone. Pull all enemies from adjacent zones into yours, then knock them back. 8 damage to all affected', manaCost: 5, cooldown: 3, value: 8 } },
  { id: 68, slug: 'thanatos', name: 'Thanatos', class: 'Assassin', imageKey: 'Thanatos',
    ability: { name: 'Hovering Death', type: 'global', description: 'Fly over the entire map. Land on any zone. Execute any god below 20% HP there, or deal 10 damage. Reveals all enemies briefly', manaCost: 5, cooldown: 4, value: 10 } },
  { id: 70, slug: 'thor', name: 'Thor', class: 'Assassin', imageKey: 'Thor',
    ability: { name: 'Anvil of Dawn', type: 'global', description: 'Launch into the sky and land anywhere on the map. Deal 10 damage and stun target for 1 turn on landing. Perfect rotation tool', manaCost: 5, cooldown: 4, value: 10 } },
  { id: 71, slug: 'tsukuyomi', name: 'Tsukuyomi', class: 'Assassin', imageKey: 'Tsukuyomi',
    ability: { name: 'Dark Moon', type: 'gank', description: 'Dash to an enemy in adjacent zone. 3 rapid strikes of 4 damage. Final hit disarms them (no basic attacks) for 1 turn', manaCost: 5, cooldown: 3, value: 12 } },

  // ─── MAGES ───
  { id: 2, slug: 'agni', name: 'Agni', class: 'Mage', imageKey: 'Agni',
    ability: { name: 'Rain Fire', type: 'aoe_damage', description: 'Launch meteors at your zone or any adjacent zone. Clear the minion wave and deal 6 damage to all enemy gods there', manaCost: 4, cooldown: 3, value: 6 } },
  { id: 6, slug: 'anubis', name: 'Anubis', class: 'Mage', imageKey: 'Anubis',
    ability: { name: 'Death Gaze', type: 'zone', description: 'Channel: deal 14 damage to one enemy in your zone but you are rooted in place (cannot move for 1 turn). Massive single-target threat', manaCost: 5, cooldown: 3, value: 14 } },
  { id: 7, slug: 'aphrodite', name: 'Aphrodite', class: 'Mage', imageKey: 'Aphrodite',
    ability: { name: 'Love Link', type: 'heal', description: 'Link to an ally anywhere on the map. Heal them 8 HP. While linked, if either takes lethal damage, redirect half to the other. Lasts 3 turns', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 15, slug: 'baron-samedi', name: 'Baron Samedi', class: 'Mage', imageKey: 'BaronSamedi',
    ability: { name: 'Hysteria', type: 'zone', description: 'Your zone becomes a dread zone for 3 turns. Enemies inside take 3 damage per turn and heal 50% less. If below 50% HP: pull them toward you', manaCost: 5, cooldown: 3, value: 3 } },
  { id: 25, slug: 'discordia', name: 'Discordia', class: 'Mage', imageKey: 'Discordia',
    ability: { name: 'Golden Apple', type: 'debuff', description: 'Throw apple into adjacent zone. Two random enemies there attack each other for 1 turn. Sow chaos before a rotation', manaCost: 4, cooldown: 4, value: 0 } },
  { id: 26, slug: 'eset', name: 'Eset', class: 'Mage', imageKey: 'Eset',
    ability: { name: 'Protection Zone', type: 'shield', description: 'Place a protective circle in your zone for 2 turns. Allies inside gain 8 HP shield. When circle expires, deal stored damage to enemies', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 31, slug: 'hades', name: 'Hades', class: 'Mage', imageKey: 'Hades',
    ability: { name: 'Pillar of Agony', type: 'zone', description: 'Lock all enemies in your zone for 2 turns (they cannot leave). Deal 5 damage per turn. Forces a fight at your location', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 32, slug: 'hecate', name: 'Hecate', class: 'Mage', imageKey: 'Hecate',
    ability: { name: 'Witch Strike', type: 'damage', description: 'Deal 12 damage to an enemy in your zone. If they die, cooldown resets and you may move to an adjacent zone for free', manaCost: 4, cooldown: 3, value: 12 } },
  { id: 38, slug: 'janus', name: 'Janus', class: 'Mage', imageKey: 'Janus',
    ability: { name: 'Portal Rotation', type: 'global', description: 'Open portal between any two zones on the map. You and all allies can travel through it this turn. Also deals 8 damage to the first enemy at destination', manaCost: 5, cooldown: 4, value: 8 } },
  { id: 43, slug: 'kukulkan', name: 'Kukulkan', class: 'Mage', imageKey: 'Kukulkan',
    ability: { name: 'Spirit Winds', type: 'wave', description: 'Unleash tornado down your lane. Instantly clears current and adjacent lane zone minion waves. Deals 8 damage to enemy gods hit', manaCost: 4, cooldown: 3, value: 8 } },
  { id: 47, slug: 'merlin', name: 'Merlin', class: 'Mage', imageKey: 'Merlin',
    ability: { name: 'Elemental Stance', type: 'buff', description: 'Cycle: Fire (clear wave + 8 damage in zone) | Ice (slow all enemies in zone, -1 action) | Arcane (move to adjacent zone + 6 damage)', manaCost: 3, cooldown: 2, value: 8 } },
  { id: 49, slug: 'morgan-le-fay', name: 'Morgan Le Fay', class: 'Mage', imageKey: 'MorganLeFay',
    ability: { name: 'Dark Mark', type: 'debuff', description: 'Mark enemy god anywhere on map. They take +3 damage from all sources for 3 turns. If they enter a zone you control, take 5 bonus damage', manaCost: 3, cooldown: 3, value: 3 } },
  { id: 53, slug: 'nu-wa', name: 'Nu Wa', class: 'Mage', imageKey: 'NuWa',
    ability: { name: 'Fire Shards', type: 'global', description: 'Deal 5 damage to ALL enemy gods on the entire map. Reveals their positions for 1 turn. Ultimate map awareness play', manaCost: 6, cooldown: 4, value: 5 } },
  { id: 54, slug: 'nut', name: 'Nut', class: 'Mage', imageKey: 'Nut',
    ability: { name: 'Star Fall', type: 'aoe_damage', description: 'Rain stars across your zone and both adjacent zones. Deal 3 damage to each enemy in those zones. Great lane pressure', manaCost: 4, cooldown: 3, value: 3 } },
  { id: 58, slug: 'poseidon', name: 'Poseidon', class: 'Mage', imageKey: 'Poseidon',
    ability: { name: 'Release the Kraken', type: 'zone', description: 'Summon Kraken in your zone. Deal 12 damage to all enemies there and knock them into adjacent zones. Zone is impassable for 1 turn', manaCost: 6, cooldown: 4, value: 12 } },
  { id: 60, slug: 'ra', name: 'Ra', class: 'Mage', imageKey: 'Ra',
    ability: { name: 'Celestial Beam', type: 'wave', description: 'Fire beam down lane: clear minion wave and deal 7 damage to all enemies in your lane zone. Also heals allies in zone for 4 HP', manaCost: 3, cooldown: 2, value: 7 } },
  { id: 62, slug: 'scylla', name: 'Scylla', class: 'Mage', imageKey: 'Scylla',
    ability: { name: 'Monster Unleashed', type: 'aoe_damage', description: 'Deal 14 damage in your zone. If an enemy god dies, you may immediately recast once (free) in any adjacent zone', manaCost: 6, cooldown: 4, value: 14 } },
  { id: 64, slug: 'sol', name: 'Sol', class: 'Mage', imageKey: 'Sol',
    ability: { name: 'Supernova', type: 'split', description: 'Deal 4 damage to all enemies in zone per turn for 2 turns. While active, Sol deals double damage to structures in this zone', manaCost: 5, cooldown: 3, value: 4 } },
  { id: 69, slug: 'the-morrigan', name: 'The Morrigan', class: 'Mage', imageKey: 'TheMorrigan',
    ability: { name: 'Changeling', type: 'stealth', description: 'Become invisible and transform into any god on the field. Copy their ability for 1 use. Perfect for surprise rotations', manaCost: 5, cooldown: 5, value: 0 } },
  { id: 73, slug: 'vulcan', name: 'Vulcan', class: 'Mage', imageKey: 'Vulcan',
    ability: { name: 'Earthshaker', type: 'global', description: 'Launch mortar at any zone on the map. Deal 12 damage to all enemies there. Long range poke for objective fights', manaCost: 6, cooldown: 4, value: 12 } },
  { id: 77, slug: 'zeus', name: 'Zeus', class: 'Mage', imageKey: 'Zeus',
    ability: { name: 'Lightning Storm', type: 'zone', description: 'Place storm over any zone for 2 turns. Enemies inside take 5 damage per turn and cannot use abilities. Zone denial tool', manaCost: 5, cooldown: 3, value: 5 } },

  // ─── GUARDIANS ───
  { id: 9, slug: 'ares', name: 'Ares', class: 'Guardian', imageKey: 'Ares',
    ability: { name: 'No Escape', type: 'cc', description: 'Pull all enemy gods within 2 zones toward your location. They are forced into your zone and skip their next action. Ultimate engage', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 11, slug: 'artio', name: 'Artio', class: 'Guardian', imageKey: 'Artio',
    ability: { name: 'Bear Form', type: 'buff', description: 'Toggle: Druid (+4 DEF, heal ally in zone 3 HP/turn) or Bear (+4 ATK, enemies in zone cannot leave for 1 turn)', manaCost: 2, cooldown: 1, value: 4 } },
  { id: 12, slug: 'athena', name: 'Athena', class: 'Guardian', imageKey: 'Athena',
    ability: { name: 'Defender of Olympus', type: 'global', description: 'Teleport to any allied god on the map. Grant them +5 DEF for 2 turns and taunt all enemies in that zone (they must attack you)', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 14, slug: 'bacchus', name: 'Bacchus', class: 'Guardian', imageKey: 'Bacchus',
    ability: { name: 'Intoxicate', type: 'cc', description: 'All enemies in your zone and adjacent zones: -3 ATK and costs them an extra action to move for 2 turns. Slow the enemy rotation', manaCost: 4, cooldown: 3, value: 3 } },
  { id: 17, slug: 'cabrakan', name: 'Cabrakan', class: 'Guardian', imageKey: 'Cabrakan',
    ability: { name: 'Tectonic Shift', type: 'zone', description: 'Create a wall between two adjacent zones. No one can pass through for 2 turns. Split the enemy team and force fights', manaCost: 4, cooldown: 3, value: 0 } },
  { id: 18, slug: 'cerberus', name: 'Cerberus', class: 'Guardian', imageKey: 'Cerberus',
    ability: { name: 'Stygian Torment', type: 'cc', description: 'Pull all enemies in your zone toward you. Reduce their healing by 50% for 2 turns. Great for disrupting objective heals', manaCost: 5, cooldown: 4, value: 0 } },
  { id: 28, slug: 'ganesha', name: 'Ganesha', class: 'Guardian', imageKey: 'Ganesha',
    ability: { name: 'Dharmic Pillars', type: 'zone', description: 'Place pillars on the border of two zones. Enemies crossing take 5 damage. Lasts 3 turns. Controls jungle entry points', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 29, slug: 'geb', name: 'Geb', class: 'Guardian', imageKey: 'Geb',
    ability: { name: 'Stone Shield', type: 'shield', description: 'Shield an ally anywhere on the map for 15 HP. Cleanses all CC effects on them. Can save a teammate across the map', manaCost: 3, cooldown: 2, value: 15 } },
  { id: 40, slug: 'jormungandr', name: 'Jormungandr', class: 'Guardian', imageKey: 'Jormungandr',
    ability: { name: 'World Serpent', type: 'zone', description: 'Submerge and travel underground through 2 zones. Emerge dealing 8 damage to all enemies in destination. Gain +5 DEF for 2 turns', manaCost: 5, cooldown: 4, value: 8 } },
  { id: 42, slug: 'khepri', name: 'Khepri', class: 'Guardian', imageKey: 'Khepri',
    ability: { name: 'Scarab Blessing', type: 'heal', description: 'Mark an ally god anywhere. If they would die within 2 turns, resurrect with 30% HP at your location instead. Ultimate save', manaCost: 5, cooldown: 5, value: 0 } },
  { id: 63, slug: 'sobek', name: 'Sobek', class: 'Guardian', imageKey: 'Sobek',
    ability: { name: 'Charge Prey', type: 'gank', description: 'Pluck an enemy god from adjacent zone and throw them behind you (2 zones away from their original position). Deal 6 damage. Displacement king', manaCost: 3, cooldown: 3, value: 6 } },
  { id: 67, slug: 'sylvanus', name: 'Sylvanus', class: 'Guardian', imageKey: 'Sylvanus',
    ability: { name: 'Nature Grasp', type: 'cc', description: 'Root all enemies in your zone for 2 turns (cannot move). Heal all allies in zone 3 HP per turn. Lockdown for objectives', manaCost: 5, cooldown: 4, value: 3 } },
  { id: 75, slug: 'yemoja', name: 'Yemoja', class: 'Guardian', imageKey: 'Yemoja',
    ability: { name: 'River Rebuke', type: 'zone', description: 'Create water wall splitting your zone. Enemies pushed to one side, allies healed 6 HP. Wall blocks passage for 1 turn', manaCost: 4, cooldown: 3, value: 6 } },
  { id: 76, slug: 'ymir', name: 'Ymir', class: 'Guardian', imageKey: 'Ymir',
    ability: { name: 'Glacial Strike', type: 'zone', description: 'Channel 2 turns in your zone. Then explode: 18 damage to all enemies in your zone. They are frozen (skip 1 turn). Objective zoning', manaCost: 6, cooldown: 5, value: 18 } },

  // ─── HUNTERS ───
  { id: 5, slug: 'anhur', name: 'Anhur', class: 'Hunter', imageKey: 'Anhur',
    ability: { name: 'Obelisk', type: 'zone', description: 'Place obelisk in your zone. Enemies here take +3 damage from all sources. Push one enemy into an adjacent zone. Lasts 3 turns', manaCost: 3, cooldown: 2, value: 3 } },
  { id: 8, slug: 'apollo', name: 'Apollo', class: 'Hunter', imageKey: 'Apollo',
    ability: { name: 'Across the Sky', type: 'global', description: 'Fly to any zone on the map. Deal 6 damage on arrival. Perfect for split pushing or joining a fight across the map', manaCost: 5, cooldown: 4, value: 6 } },
  { id: 10, slug: 'artemis', name: 'Artemis', class: 'Hunter', imageKey: 'Artemis',
    ability: { name: 'Calydonian Boar', type: 'summon', description: 'Release boar into an adjacent zone. It has 15 HP, 6 ATK and charges toward the nearest enemy structure, clearing waves along the way', manaCost: 5, cooldown: 4, value: 15 } },
  { id: 19, slug: 'cernunnos', name: 'Cernunnos', class: 'Hunter', imageKey: 'Cernunnos',
    ability: { name: 'Season Shift', type: 'buff', description: 'Cycle: Summer (+4 ATK) | Autumn (+4 DEF) | Winter (enemies in zone -2 ATK) | Spring (lifesteal 30%)', manaCost: 2, cooldown: 1, value: 4 } },
  { id: 21, slug: 'chiron', name: 'Chiron', class: 'Hunter', imageKey: 'Chiron',
    ability: { name: 'Training Camp', type: 'heal', description: 'Heal ally in your zone 6 HP. Your next 2 basic attacks deal +3 bonus damage. Sustain and pressure in lane', manaCost: 3, cooldown: 2, value: 6 } },
  { id: 22, slug: 'cupid', name: 'Cupid', class: 'Hunter', imageKey: 'Cupid',
    ability: { name: 'Heart Bomb', type: 'zone', description: 'Attach bomb to enemy in your zone. After 1 turn: 10 damage to target + 5 to all others in same zone. Zone denial', manaCost: 4, cooldown: 3, value: 10 } },
  { id: 24, slug: 'danzaburou', name: 'Danzaburou', class: 'Hunter', imageKey: 'Danzaburou',
    ability: { name: 'Sake Barrage', type: 'cc', description: 'Toss sake across adjacent zone. All enemies there: -4 ATK and cost extra action to move for 2 turns. Lane control tool', manaCost: 3, cooldown: 3, value: 4 } },
  { id: 34, slug: 'hou-yi', name: 'Hou Yi', class: 'Hunter', imageKey: 'Hou_Yi',
    ability: { name: 'Sunbreaker', type: 'zone', description: 'Rain suns over target zone for 3 turns. Deal 4 damage per turn to all enemies there. Zone is dangerous to contest during objective', manaCost: 5, cooldown: 4, value: 4 } },
  { id: 37, slug: 'izanami', name: 'Izanami', class: 'Hunter', imageKey: 'Izanami',
    ability: { name: 'Dark Portal', type: 'stealth', description: 'Become untargetable for 1 turn. Move to any adjacent zone without being seen. Next attack deals +6 damage. Sneaky split push', manaCost: 3, cooldown: 3, value: 6 } },
  { id: 39, slug: 'jing-wei', name: 'Jing Wei', class: 'Hunter', imageKey: 'JingWei',
    ability: { name: 'Persistent Gust', type: 'rotate', description: 'After being in base or fountain, fly to any lane for free (no action cost). Passive: always return to lane faster after backing', manaCost: 2, cooldown: 2, value: 0 } },
  { id: 45, slug: 'medusa', name: 'Medusa', class: 'Hunter', imageKey: 'Medusa',
    ability: { name: 'Petrify', type: 'cc', description: 'Stun all enemies in your zone for 2 turns (they cannot move or act). Deal 6 damage to each. Forces objectives or free structures', manaCost: 5, cooldown: 4, value: 6 } },
  { id: 51, slug: 'neith', name: 'Neith', class: 'Hunter', imageKey: 'Neith',
    ability: { name: 'World Weaver', type: 'global', description: 'Snipe any god on any zone on the map. Deal 10 damage and stun for 1 turn. Cross-map pick potential', manaCost: 5, cooldown: 4, value: 10 } },
  { id: 59, slug: 'bari', name: 'Princess Bari', class: 'Hunter', imageKey: 'Bari',
    ability: { name: 'Soul Guidance', type: 'heal', description: 'Heal ALL allied gods on the entire map for 5 HP each. Cleanse debuffs. Global sustain for split-map plays', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 61, slug: 'rama', name: 'Rama', class: 'Hunter', imageKey: 'Rama',
    ability: { name: 'Astral Barrage', type: 'global', description: 'Fly up: 3 shots at any targets anywhere on the map. Deal 5 damage each. Reveals all zones you fire at', manaCost: 5, cooldown: 4, value: 5 } },
  { id: 72, slug: 'ullr', name: 'Ullr', class: 'Hunter', imageKey: 'Ullr',
    ability: { name: 'Stance Switch', type: 'buff', description: 'Toggle: Bow (+4 ATK, deal bonus structure damage) or Axe (+4 DEF, lifesteal 20%). Adapt to lane or teamfight', manaCost: 2, cooldown: 1, value: 4 } },
  { id: 74, slug: 'xbalanque', name: 'Xbalanque', class: 'Hunter', imageKey: 'Xbalanque',
    ability: { name: 'Darkest of Nights', type: 'vision', description: 'All enemies on the map lose vision for 2 turns. -3 ATK and cannot use abilities. Map-wide disruption for objective steals', manaCost: 5, cooldown: 4, value: 3 } },
]

// ═══════════════════════════════════════════════
// Off-role variants — same god, different role
// ═══════════════════════════════════════════════
const ROLE_VARIANTS = [
  // Solo variants
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
  // Jungle variants
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
  // Mid variants
  { ref: 'chiron', id: 106, role: 'mid' },
  { ref: 'neith', id: 107, role: 'mid' },
  { ref: 'bari', id: 108, role: 'mid' },
  { ref: 'ullr', id: 109, role: 'mid' },
  { ref: 'ganesha', id: 126, role: 'mid' },
  // Support variants
  { ref: 'aphrodite', id: 110, role: 'support' },
  { ref: 'apollo', id: 111, role: 'support' },
  { ref: 'baron-samedi', id: 112, role: 'support' },
  { ref: 'eset', id: 113, role: 'support' },
  { ref: 'guan-yu', id: 114, role: 'support' },
  { ref: 'hercules', id: 115, role: 'support' },
  { ref: 'ne-zha', id: 116, role: 'support' },
  { ref: 'nu-wa', id: 117, role: 'support' },
  { ref: 'scylla', id: 118, role: 'support' },
  // ADC variants
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

// ═══════════════════════════════════════════════
// 73 items — full effects & passives
// ═══════════════════════════════════════════════
export const ITEMS = [
  // Physical Offense
  { id: 1, name: 'Deathbringer', slug: 'deathbringer', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_Deathbringer', effects: { attack: 6 }, passive: { name: 'Crit Master', description: '25% chance to deal 2x damage', critChance: 25 } },
  { id: 2, name: 'Bloodforge', slug: 'bloodforge', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_BloodForgedBlade', effects: { attack: 5 }, passive: { name: 'Blood Shield', description: 'On kill: gain 15 HP shield for 2 turns', onKillShield: 15 } },
  { id: 3, name: "Titan's Bane", slug: 'titans-bane', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ObsidianMacuahuitl', effects: { attack: 3 }, passive: { name: 'Sundering', description: 'Ignore 40% of target Defense', armorPen: 0.4 } },
  { id: 4, name: 'Transcendence', slug: 'transcendence', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_Transcendence', effects: { attack: 4, mana: 3 }, passive: { name: 'Mana Conversion', description: '+1 Attack per 3 max Mana', manaConvert: true } },
  { id: 5, name: 'The Crusher', slug: 'the-crusher', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Crusher', effects: { attack: 3 }, passive: { name: 'Demolish', description: '+50% damage to structures', structureDmg: 1.5 } },
  { id: 6, name: "Jotunn's Revenge", slug: 'jotunns-revenge', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_JotunnsRevenge', effects: { attack: 3 }, passive: { name: 'CDR', description: 'Ability cooldowns -1', cdr: 1 } },
  { id: 7, name: 'Heartseeker', slug: 'heartseeker', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Heartseeker', effects: { attack: 3 }, passive: { name: 'Heart Strike', description: 'Abilities deal 3% target max HP bonus damage', percentHpDmg: 3 } },
  { id: 8, name: "Hydra's Lament", slug: 'hydras-lament', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_HydrasLament', effects: { attack: 3 }, passive: { name: 'After Ability', description: 'Next basic after ability: +50% damage', afterAbilityBonus: 1.5 } },
  { id: 9, name: 'The Executioner', slug: 'the-executioner', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_TheExecutioner', effects: { attack: 3 }, passive: { name: 'Shred', description: 'Each hit reduces target Defense by 1 (stacks 4x)', defShred: 1 } },
  { id: 10, name: "Qin's Blade", slug: 'qins-blade', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_QinsBlade', effects: { attack: 2 }, passive: { name: 'Precision', description: 'Deal 4% target max HP as bonus damage', percentHpDmg: 4 } },
  { id: 11, name: 'Rage', slug: 'rage', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Rage', effects: { attack: 3 }, passive: { name: 'Fury', description: '20% crit. Crits increase crit chance by 10% (max 50%)', critChance: 20 } },
  { id: 12, name: "Odysseus' Bow", slug: 'odysseus-bow', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_OdysseusBow', effects: { attack: 2 }, passive: { name: 'Chain Lightning', description: 'Every 4th attack chains to 2 nearby enemies for 4 damage', chainDmg: 4 } },
  { id: 13, name: 'Arondight', slug: 'arondight', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icons_T3_Arondight', effects: { attack: 4 }, passive: { name: 'Ultimate Rush', description: 'After using ultimate: +30% movement and +4 damage for 2 turns', afterUltBonus: 4 } },
  { id: 14, name: "Devourer's Gauntlet", slug: 'devourers-gauntlet', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_DevoursGloves', effects: { attack: 3 }, passive: { name: 'Devour', description: 'Lifesteal 15%. Gain +1 Attack per 3 kills (max +5)', lifesteal: 15 } },
  // Magical Offense
  { id: 20, name: 'Rod of Tahuti', slug: 'rod-of-tahuti', category: 'Magical Offense', manaCost: 5, imageKey: 'Items/T3/Icon_T3_EldritchOrb', effects: { attack: 7 }, passive: { name: 'Archmage', description: '+25% ability damage to targets below 50% HP', lowHpBonus: 0.25 } },
  { id: 21, name: 'Soul Reaver', slug: 'soul-reaver', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_SoulDevourer', effects: { attack: 4 }, passive: { name: 'Soul Blast', description: 'Abilities deal 5% target max HP bonus damage', percentHpDmg: 5 } },
  { id: 22, name: "Chronos' Pendant", slug: 'chronos-pendant', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ChronosPendant', effects: { attack: 3, mana: 2 }, passive: { name: 'Temporal', description: 'All ability cooldowns -1', cdr: 1 } },
  { id: 23, name: 'Spear of Desolation', slug: 'spear-of-desolation', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_SpearofDesolation', effects: { attack: 5 }, passive: { name: 'Desolation', description: 'On kill: all cooldowns reset', onKillCdr: true } },
  { id: 24, name: 'Gem of Isolation', slug: 'gem-of-isolation', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_GemOfIsolation', effects: { attack: 3, hp: 5 }, passive: { name: 'Isolate', description: 'Abilities reduce enemy Attack by 2 for 1 turn', slowDebuff: 2 } },
  { id: 25, name: 'Book of Thoth', slug: 'book-of-thoth', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_BookofThroth', effects: { attack: 4, mana: 4 }, passive: { name: 'Mana to Power', description: '+1 Attack per 3 max Mana', manaConvert: true } },
  { id: 26, name: 'Doom Orb', slug: 'doom-orb', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_DoomOrb', effects: { attack: 3 }, passive: { name: 'Stacks', description: 'Gain +1 Attack per kill (max +5). Lose half on death', stackBonus: true } },
  { id: 27, name: 'Polynomicon', slug: 'polynomicon', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Polynomicon', effects: { attack: 3 }, passive: { name: 'Focus', description: 'After ability: next basic deals +75% damage', afterAbilityBonus: 1.75 } },
  { id: 28, name: 'Obsidian Shard', slug: 'obsidian-shard', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_BalorsEye', effects: { attack: 3 }, passive: { name: 'Pierce', description: 'Ignore 40% of target Defense', armorPen: 0.4 } },
  { id: 29, name: "Bancroft's Talon", slug: 'bancrofts-talon', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_BancroftsTalon', effects: { attack: 3 }, passive: { name: 'Desperate Power', description: '+1 Attack per 10% HP missing (max +5)', lowHpAttack: true } },
  { id: 30, name: "Typhon's Heart", slug: 'typhons-heart', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_TyphonsHeart', effects: { attack: 4 }, passive: { name: 'Typhonic', description: 'Lifesteal 20%. Bonus healing from lifesteal', lifesteal: 20 } },
  { id: 31, name: 'Divine Ruin', slug: 'divine-ruin', category: 'Magical Offense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_DivineRuin', effects: { attack: 2 }, passive: { name: 'Anti-Heal', description: 'Abilities reduce enemy healing by 50% for 2 turns', antiHeal: 50 } },
  // Physical Defense
  { id: 40, name: 'Breastplate of Valor', slug: 'breastplate-of-valor', category: 'Physical Defense', manaCost: 2, imageKey: 'Items/TemporaryUI/SMITE1ItemIcons/Icon_BreastplateOfValor', effects: { defense: 4, mana: 2 }, passive: { name: 'Valor', description: 'Ability cooldowns -1', cdr: 1 } },
  { id: 41, name: 'Hide of the Nemean Lion', slug: 'hide-of-the-nemean-lion', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_HideoftheNemeanLion', effects: { defense: 5, hp: 5 }, passive: { name: 'Reflect', description: 'Reflect 20% of basic attack damage back to attacker', reflect: 20 } },
  { id: 42, name: 'Mystical Mail', slug: 'mystical-mail', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icons_T3_MysticalMail', effects: { defense: 3, hp: 10 }, passive: { name: 'Radiance', description: 'Deal 2 damage per turn to all nearby enemies', aura: 2 } },
  { id: 43, name: 'Spectral Armor', slug: 'spectral-armor', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_SpectralArmor', effects: { defense: 5, hp: 5 }, passive: { name: 'Anti-Crit', description: 'Enemy crits deal normal damage instead', antiCrit: true } },
  { id: 44, name: "Gladiator's Shield", slug: 'gladiators-shield', category: 'Physical Defense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_LorgMor', effects: { defense: 3, attack: 2 }, passive: { name: 'Gladiate', description: 'Abilities heal for 3 HP', abilityHeal: 3 } },
  { id: 45, name: "Berserker's Shield", slug: 'berserkers-shield', category: 'Physical Defense', manaCost: 2, imageKey: 'Items/T3/Icons_T3_Berserker', effects: { defense: 2, attack: 3 }, passive: { name: 'Berserk', description: 'Below 50% HP: +3 Attack', lowHpAttack: true } },
  { id: 46, name: 'Void Shield', slug: 'void-shield', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_VoidShield', effects: { defense: 3, attack: 2 }, passive: { name: 'Void Aura', description: 'Nearby enemies -2 Defense', defReduction: 2 } },
  // Magical Defense
  { id: 50, name: "Genji's Guard", slug: 'genjis-guard', category: 'Magical Defense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_GenjisGuard', effects: { defense: 4, mana: 2 }, passive: { name: 'Fortify', description: 'When hit by ability: reduce all cooldowns by 1', abilityCdr: true } },
  { id: 51, name: 'Ancile', slug: 'ancile', category: 'Magical Defense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_AncileShield', effects: { defense: 3, attack: 2 }, passive: { name: 'Silence Pulse', description: 'When hit by ability: silence attacker for 1 turn', silenceOnHit: true } },
  { id: 52, name: 'Void Stone', slug: 'void-stone', category: 'Magical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_VoidStone', effects: { defense: 3, attack: 2 }, passive: { name: 'Void Aura', description: 'Nearby enemies -2 Defense', defReduction: 2 } },
  { id: 53, name: "Oni Hunter's Garb", slug: 'oni-hunters-garb', category: 'Magical Defense', manaCost: 3, imageKey: 'Items/T3/Icons_T3_OniHuntersGarb', effects: { defense: 4, hp: 5 }, passive: { name: 'Oni', description: '3+ enemies nearby: take 10% less damage', dmgReduction: 10 } },
  { id: 54, name: "Shogun's Ofuda", slug: 'shoguns-ofuda', category: 'Magical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ShogunsOfuda', effects: { defense: 3 }, passive: { name: 'Aura', description: 'Nearby allies +2 Attack', allyAtkBuff: 2 } },
  // Utility
  { id: 60, name: 'Mantle of Discord', slug: 'mantle-of-discord', category: 'Utility', manaCost: 4, imageKey: 'Items/T3/Icon_T3_MantleOfDiscord', effects: { defense: 4 }, passive: { name: 'Discord', description: 'Below 30% HP: stun all nearby enemies for 1 turn (once per match)', emergencyStun: true } },
  { id: 61, name: 'Spirit Robe', slug: 'spirit-robe', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/Icon_T3_SpiritRobe', effects: { defense: 3, hp: 5 }, passive: { name: 'Resilience', description: "When CC'd: take 15% less damage for 2 turns", ccReduction: 15 } },
  { id: 62, name: "Magi's Cloak", slug: 'magis-cloak', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/magisshelter', effects: { defense: 3, hp: 5 }, passive: { name: 'Bubble', description: 'Block the first CC effect (refreshes every 4 turns)', ccImmune: true } },
  { id: 63, name: "Shifter's Shield", slug: 'shifters-shield', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ShapeShifterShield', effects: { attack: 2, defense: 2 }, passive: { name: 'Shift', description: 'Above 50% HP: +3 Attack. Below 50%: +3 Defense', shiftStats: true } },
  { id: 64, name: 'Runeforged Hammer', slug: 'runeforged-hammer', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/Icon_T3_RuneforgedHammer', effects: { attack: 3, hp: 5 }, passive: { name: 'Rune', description: "+15% damage to CC'd targets", ccBonusDmg: 15 } },
  { id: 65, name: 'Gauntlet of Thebes', slug: 'gauntlet-of-thebes', category: 'Utility', manaCost: 2, imageKey: 'Items/T3/Icon_T3_GauntletOfThebes', effects: { hp: 15 }, passive: { name: 'Thebes Aura', description: 'Nearby allies +2 Defense', allyDefBuff: 2 } },
  { id: 66, name: 'Stone of Binding', slug: 'stone-of-binding', category: 'Utility', manaCost: 2, imageKey: 'Items/T3/Icon_T3_BindingsOfLyngvi', effects: { defense: 2 }, passive: { name: 'Binding', description: "CC'ing enemy: they lose 3 Defense for 2 turns", bindDebuff: 3 } },
  // Relics
  { id: 70, name: 'Purification Beads', slug: 'purification-beads', category: 'Relic', manaCost: 0, imageKey: 'Items/Utility/T_Icon_Utility_PurificationBeads', effects: {}, passive: { name: 'Purify', description: 'Cleanse all CC. Immune to CC for 1 turn. Single use', singleUse: true, ccCleanse: true } },
  { id: 71, name: 'Blink Rune', slug: 'blink-rune', category: 'Relic', manaCost: 0, imageKey: 'Items/Utility/t_Blink_128', effects: {}, passive: { name: 'Blink', description: 'Teleport to any lane. Single use', singleUse: true, blink: true } },
  { id: 72, name: 'Phantom Shell', slug: 'phantom-shell', category: 'Relic', manaCost: 0, imageKey: 'Items/T3/Icon_Relic_PhantomShell', effects: {}, passive: { name: 'Phantom', description: 'All allies immune to damage for 1 turn. Single use', singleUse: true, immunity: true } },
  { id: 73, name: 'Aegis of Acceleration', slug: 'aegis-of-acceleration', category: 'Relic', manaCost: 0, imageKey: 'Items/T3/Icon_Relic_AegisOfAcceleration', effects: {}, passive: { name: 'Aegis', description: "Self immune to damage for 1 turn but can't attack. Single use", singleUse: true, selfImmune: true } },
]

// ═══════════════════════════════════════════════
// 7 consumables
// ═══════════════════════════════════════════════
export const CONSUMABLES = [
  { id: 'health-pot', name: 'Health Potion', color: '#ef4444', icon: 'heart',
    imageUrl: `${WIKI}/Consumable_Health_Potion.png`,
    description: 'Restore 8 HP to target ally.', manaCost: 1, uses: 1 },
  { id: 'mana-pot', name: 'Mana Potion', color: '#3b82f6', icon: 'droplet',
    imageUrl: `${WIKI}/Consumable_Mana_Potion.png`,
    description: 'Restore 3 mana.', manaCost: 0, uses: 1 },
  { id: 'multi-pot', name: 'Multi Potion', color: '#a855f7', icon: 'sparkles',
    imageUrl: `${WIKI}/Consumable_Multi_Potion.png`,
    description: 'Restore 5 HP and 2 mana to target ally.', manaCost: 1, uses: 1 },
  { id: 'elixir-str', name: 'Elixir of Strength', color: '#f97316', icon: 'swords',
    imageUrl: `${WIKI}/Consumable_Elixir_of_Strength.png`,
    description: '+5 Attack for the rest of the match. Single use.', manaCost: 3, uses: 1 },
  { id: 'elixir-int', name: 'Elixir of Intelligence', color: '#8b5cf6', icon: 'brain',
    imageUrl: `${WIKI}/Consumable_Elixir_of_Intelligence.png`,
    description: 'All ability cooldowns reset. -1 to all future cooldowns.', manaCost: 3, uses: 1 },
  { id: 'ward', name: 'Vision Ward', color: '#22c55e', icon: 'eye',
    imageUrl: `${WIKI}/Consumable_Vision_Ward.png`,
    description: 'Reveal all enemy cards in one zone for 3 turns.', manaCost: 1, uses: 1 },
  { id: 'sentry', name: 'Sentry Ward', color: '#f59e0b', icon: 'eye-off',
    imageUrl: `${WIKI}/Consumable_Sentry_Ward.png`,
    description: 'Reveal and destroy enemy wards in a zone. Grants vision for 3 turns.', manaCost: 1, uses: 1 },
]
