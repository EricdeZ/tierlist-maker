// Item cards for the game - derived from SMITE 2 items (smitesource.com/items)
// Only T3 (finished) items are usable as equipment cards in the game

const CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75';

export const ITEM_CATEGORIES = {
  PHYSICAL_OFFENSE: 'Physical Offense',
  MAGICAL_OFFENSE: 'Magical Offense',
  PHYSICAL_DEFENSE: 'Physical Defense',
  MAGICAL_DEFENSE: 'Magical Defense',
  UTILITY: 'Utility',
  STARTER: 'Starter',
  RELIC: 'Relic',
  CONSUMABLE: 'Consumable',
};

export const ITEMS = [
  // === PHYSICAL OFFENSE ===
  { id: 1, name: 'Deathbringer', slug: 'deathbringer', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_Deathbringer', effects: { attack: 6 }, passive: { name: 'Crit Master', description: '25% chance to deal 2x damage', critChance: 25 } },
  { id: 2, name: 'Bloodforge', slug: 'bloodforge', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_BloodForgedBlade', effects: { attack: 5 }, passive: { name: 'Blood Shield', description: 'On kill: gain 15 HP shield for 2 turns', onKillShield: 15 } },
  { id: 3, name: 'Titan\'s Bane', slug: 'titans-bane', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ObsidianMacuahuitl', effects: { attack: 3 }, passive: { name: 'Sundering', description: 'Ignore 40% of target Defense', armorPen: 0.4 } },
  { id: 4, name: 'Transcendence', slug: 'transcendence', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_Transcendence', effects: { attack: 4, mana: 3 }, passive: { name: 'Mana Conversion', description: '+1 Attack per 3 max Mana', manaConvert: true } },
  { id: 5, name: 'The Crusher', slug: 'the-crusher', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Crusher', effects: { attack: 3 }, passive: { name: 'Demolish', description: '+50% damage to structures', structureDmg: 1.5 } },
  { id: 6, name: 'Jotunn\'s Revenge', slug: 'jotunns-revenge', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_JotunnsRevenge', effects: { attack: 3 }, passive: { name: 'CDR', description: 'Ability cooldowns -1', cdr: 1 } },
  { id: 7, name: 'Heartseeker', slug: 'heartseeker', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Heartseeker', effects: { attack: 3 }, passive: { name: 'Heart Strike', description: 'Abilities deal 3% target max HP bonus damage', percentHpDmg: 3 } },
  { id: 8, name: 'Hydra\'s Lament', slug: 'hydras-lament', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_HydrasLament', effects: { attack: 3 }, passive: { name: 'After Ability', description: 'Next basic after ability: +50% damage', afterAbilityBonus: 1.5 } },
  { id: 9, name: 'The Executioner', slug: 'the-executioner', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_TheExecutioner', effects: { attack: 3 }, passive: { name: 'Shred', description: 'Each hit reduces target Defense by 1 (stacks 4x)', defShred: 1 } },
  { id: 10, name: 'Qin\'s Blade', slug: 'qins-blade', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_QinsBlade', effects: { attack: 2 }, passive: { name: 'Precision', description: 'Deal 4% target max HP as bonus damage', percentHpDmg: 4 } },
  { id: 11, name: 'Rage', slug: 'rage', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Rage', effects: { attack: 3 }, passive: { name: 'Fury', description: '20% crit. Crits increase crit chance by 10% (max 50%)', critChance: 20 } },
  { id: 12, name: 'Odysseus\' Bow', slug: 'odysseus-bow', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_OdysseusBow', effects: { attack: 2 }, passive: { name: 'Chain Lightning', description: 'Every 4th attack chains to 2 nearby enemies for 4 damage', chainDmg: 4 } },
  { id: 13, name: 'Arondight', slug: 'arondight', category: 'Physical Offense', manaCost: 4, imageKey: 'Items/T3/Icons_T3_Arondight', effects: { attack: 4 }, passive: { name: 'Ultimate Rush', description: 'After using ultimate: +30% movement and +4 damage for 2 turns', afterUltBonus: 4 } },
  { id: 14, name: 'Devourer\'s Gauntlet', slug: 'devourers-gauntlet', category: 'Physical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_DevoursGloves', effects: { attack: 3 }, passive: { name: 'Devour', description: 'Lifesteal 15%. Gain +1 Attack per 3 kills (max +5)', lifesteal: 15 } },

  // === MAGICAL OFFENSE ===
  { id: 20, name: 'Rod of Tahuti', slug: 'rod-of-tahuti', category: 'Magical Offense', manaCost: 5, imageKey: 'Items/T3/Icon_T3_EldritchOrb', effects: { attack: 7 }, passive: { name: 'Archmage', description: '+25% ability damage to targets below 50% HP', lowHpBonus: 0.25 } },
  { id: 21, name: 'Soul Reaver', slug: 'soul-reaver', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_SoulDevourer', effects: { attack: 4 }, passive: { name: 'Soul Blast', description: 'Abilities deal 5% target max HP bonus damage', percentHpDmg: 5 } },
  { id: 22, name: 'Chronos\' Pendant', slug: 'chronos-pendant', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ChronosPendant', effects: { attack: 3, mana: 2 }, passive: { name: 'Temporal', description: 'All ability cooldowns -1', cdr: 1 } },
  { id: 23, name: 'Spear of Desolation', slug: 'spear-of-desolation', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_SpearofDesolation', effects: { attack: 5 }, passive: { name: 'Desolation', description: 'On kill: all cooldowns reset', onKillCdr: true } },
  { id: 24, name: 'Gem of Isolation', slug: 'gem-of-isolation', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_GemOfIsolation', effects: { attack: 3, hp: 5 }, passive: { name: 'Isolate', description: 'Abilities reduce enemy Attack by 2 for 1 turn', slowDebuff: 2 } },
  { id: 25, name: 'Book of Thoth', slug: 'book-of-thoth', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_BookofThroth', effects: { attack: 4, mana: 4 }, passive: { name: 'Mana to Power', description: '+1 Attack per 3 max Mana', manaConvert: true } },
  { id: 26, name: 'Doom Orb', slug: 'doom-orb', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_DoomOrb', effects: { attack: 3 }, passive: { name: 'Stacks', description: 'Gain +1 Attack per kill (max +5). Lose half on death', stackBonus: true } },
  { id: 27, name: 'Polynomicon', slug: 'polynomicon', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_Polynomicon', effects: { attack: 3 }, passive: { name: 'Focus', description: 'After ability: next basic deals +75% damage', afterAbilityBonus: 1.75 } },
  { id: 28, name: 'Obsidian Shard', slug: 'obsidian-shard', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_BalorsEye', effects: { attack: 3 }, passive: { name: 'Pierce', description: 'Ignore 40% of target Defense', armorPen: 0.4 } },
  { id: 29, name: 'Bancroft\'s Talon', slug: 'bancrofts-talon', category: 'Magical Offense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_BancroftsTalon', effects: { attack: 3 }, passive: { name: 'Desperate Power', description: '+1 Attack per 10% HP missing (max +5)', lowHpAttack: true } },
  { id: 30, name: 'Typhon\'s Heart', slug: 'typhons-heart', category: 'Magical Offense', manaCost: 4, imageKey: 'Items/T3/Icon_T3_TyphonsHeart', effects: { attack: 4 }, passive: { name: 'Typhonic', description: 'Lifesteal 20%. Bonus healing from lifesteal', lifesteal: 20 } },
  { id: 31, name: 'Divine Ruin', slug: 'divine-ruin', category: 'Magical Offense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_DivineRuin', effects: { attack: 2 }, passive: { name: 'Anti-Heal', description: 'Abilities reduce enemy healing by 50% for 2 turns', antiHeal: 50 } },

  // === PHYSICAL DEFENSE ===
  { id: 40, name: 'Breastplate of Valor', slug: 'breastplate-of-valor', category: 'Physical Defense', manaCost: 2, imageKey: 'Items/TemporaryUI/SMITE1ItemIcons/Icon_BreastplateOfValor', effects: { defense: 4, mana: 2 }, passive: { name: 'Valor', description: 'Ability cooldowns -1', cdr: 1 } },
  { id: 41, name: 'Hide of the Nemean Lion', slug: 'hide-of-the-nemean-lion', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_HideoftheNemeanLion', effects: { defense: 5, hp: 5 }, passive: { name: 'Reflect', description: 'Reflect 20% of basic attack damage back to attacker', reflect: 20 } },
  { id: 42, name: 'Mystical Mail', slug: 'mystical-mail', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icons_T3_MysticalMail', effects: { defense: 3, hp: 10 }, passive: { name: 'Radiance', description: 'Deal 2 damage per turn to all nearby enemies', aura: 2 } },
  { id: 43, name: 'Spectral Armor', slug: 'spectral-armor', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_SpectralArmor', effects: { defense: 5, hp: 5 }, passive: { name: 'Anti-Crit', description: 'Enemy crits deal normal damage instead', antiCrit: true } },
  { id: 44, name: 'Gladiator\'s Shield', slug: 'gladiators-shield', category: 'Physical Defense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_LorgMor', effects: { defense: 3, attack: 2 }, passive: { name: 'Gladiate', description: 'Abilities heal for 3 HP', abilityHeal: 3 } },
  { id: 45, name: 'Berserker\'s Shield', slug: 'berserkers-shield', category: 'Physical Defense', manaCost: 2, imageKey: 'Items/T3/Icons_T3_Berserker', effects: { defense: 2, attack: 3 }, passive: { name: 'Berserk', description: 'Below 50% HP: +3 Attack', lowHpAttack: true } },
  { id: 46, name: 'Void Shield', slug: 'void-shield', category: 'Physical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_VoidShield', effects: { defense: 3, attack: 2 }, passive: { name: 'Void Aura', description: 'Nearby enemies -2 Defense', defReduction: 2 } },

  // === MAGICAL DEFENSE ===
  { id: 50, name: 'Genji\'s Guard', slug: 'genjis-guard', category: 'Magical Defense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_GenjisGuard', effects: { defense: 4, mana: 2 }, passive: { name: 'Fortify', description: 'When hit by ability: reduce all cooldowns by 1', abilityCdr: true } },
  { id: 51, name: 'Ancile', slug: 'ancile', category: 'Magical Defense', manaCost: 2, imageKey: 'Items/T3/Icon_T3_AncileShield', effects: { defense: 3, attack: 2 }, passive: { name: 'Silence Pulse', description: 'When hit by ability: silence attacker for 1 turn', silenceOnHit: true } },
  { id: 52, name: 'Void Stone', slug: 'void-stone', category: 'Magical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_VoidStone', effects: { defense: 3, attack: 2 }, passive: { name: 'Void Aura', description: 'Nearby enemies -2 Defense', defReduction: 2 } },
  { id: 53, name: 'Oni Hunter\'s Garb', slug: 'oni-hunters-garb', category: 'Magical Defense', manaCost: 3, imageKey: 'Items/T3/Icons_T3_OniHuntersGarb', effects: { defense: 4, hp: 5 }, passive: { name: 'Oni', description: '3+ enemies nearby: take 10% less damage', dmgReduction: 10 } },
  { id: 54, name: 'Shogun\'s Ofuda', slug: 'shoguns-ofuda', category: 'Magical Defense', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ShogunsOfuda', effects: { defense: 3 }, passive: { name: 'Aura', description: 'Nearby allies +2 Attack', allyAtkBuff: 2 } },

  // === HYBRID / UTILITY ===
  { id: 60, name: 'Mantle of Discord', slug: 'mantle-of-discord', category: 'Utility', manaCost: 4, imageKey: 'Items/T3/Icon_T3_MantleOfDiscord', effects: { defense: 4 }, passive: { name: 'Discord', description: 'Below 30% HP: stun all nearby enemies for 1 turn (once per match)', emergencyStun: true } },
  { id: 61, name: 'Spirit Robe', slug: 'spirit-robe', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/Icon_T3_SpiritRobe', effects: { defense: 3, hp: 5 }, passive: { name: 'Resilience', description: 'When CC\'d: take 15% less damage for 2 turns', ccReduction: 15 } },
  { id: 62, name: 'Magi\'s Cloak', slug: 'magis-cloak', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/magisshelter', effects: { defense: 3, hp: 5 }, passive: { name: 'Bubble', description: 'Block the first CC effect (refreshes every 4 turns)', ccImmune: true } },
  { id: 63, name: 'Shifter\'s Shield', slug: 'shifters-shield', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/Icon_T3_ShapeShifterShield', effects: { attack: 2, defense: 2 }, passive: { name: 'Shift', description: 'Above 50% HP: +3 Attack. Below 50%: +3 Defense', shiftStats: true } },
  { id: 64, name: 'Runeforged Hammer', slug: 'runeforged-hammer', category: 'Utility', manaCost: 3, imageKey: 'Items/T3/Icon_T3_RuneforgedHammer', effects: { attack: 3, hp: 5 }, passive: { name: 'Rune', description: '+15% damage to CC\'d targets', ccBonusDmg: 15 } },
  { id: 65, name: 'Gauntlet of Thebes', slug: 'gauntlet-of-thebes', category: 'Utility', manaCost: 2, imageKey: 'Items/T3/Icon_T3_GauntletOfThebes', effects: { hp: 15 }, passive: { name: 'Thebes Aura', description: 'Nearby allies +2 Defense', allyDefBuff: 2 } },
  { id: 66, name: 'Stone of Binding', slug: 'stone-of-binding', category: 'Utility', manaCost: 2, imageKey: 'Items/T3/Icon_T3_BindingsOfLyngvi', effects: { defense: 2 }, passive: { name: 'Binding', description: 'CC\'ing enemy: they lose 3 Defense for 2 turns', bindDebuff: 3 } },

  // === RELICS (one-time use per match) ===
  { id: 70, name: 'Purification Beads', slug: 'purification-beads', category: 'Relic', manaCost: 0, imageKey: 'Items/Utility/T_Icon_Utility_PurificationBeads', effects: {}, passive: { name: 'Purify', description: 'Cleanse all CC. Immune to CC for 1 turn. Single use', singleUse: true, ccCleanse: true } },
  { id: 71, name: 'Blink Rune', slug: 'blink-rune', category: 'Relic', manaCost: 0, imageKey: 'Items/Utility/t_Blink_128', effects: {}, passive: { name: 'Blink', description: 'Teleport to any lane. Single use', singleUse: true, blink: true } },
  { id: 72, name: 'Phantom Shell', slug: 'phantom-shell', category: 'Relic', manaCost: 0, imageKey: 'Items/T3/Icon_Relic_PhantomShell', effects: {}, passive: { name: 'Phantom', description: 'All allies immune to damage for 1 turn. Single use', singleUse: true, immunity: true } },
  { id: 73, name: 'Aegis of Acceleration', slug: 'aegis-of-acceleration', category: 'Relic', manaCost: 0, imageKey: 'Items/T3/Icon_Relic_AegisOfAcceleration', effects: {}, passive: { name: 'Aegis', description: 'Self immune to damage for 1 turn but can\'t attack. Single use', singleUse: true, selfImmune: true } },
];

export function getItemImageUrl(item) {
  return `${CDN}/${item.imageKey}.png`;
}

export function getItem(id) {
  return ITEMS.find(i => i.id === id);
}

export function getItemsByCategory(category) {
  return ITEMS.filter(i => i.category === category);
}

export default ITEMS;
