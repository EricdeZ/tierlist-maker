// Core game state manager for SMITE Card Clash
// Manages the full board: 3 lanes + jungle, structures, gods, minions, items

import { createSideStructures, JUNGLE_OBJECTIVES } from '../../../data/cardclash/structures';
import { createMinionWave } from '../../../data/cardclash/minions';

let nextId = 1;
function uid() { return `e${nextId++}`; }

export function createInitialGameState(player1Deck, player2Deck) {
  return {
    id: uid(),
    turn: 1,
    phase: 'draw', // draw → deploy → combat → cleanup
    activePlayer: 1, // alternates: 1 or 2
    mana: { 1: 3, 2: 3 }, // starting mana, grows each turn
    maxMana: { 1: 3, 2: 3 },
    manaPerTurn: 1, // mana growth rate

    // Per-player state
    players: {
      1: createPlayerState(player1Deck, 1),
      2: createPlayerState(player2Deck, 2),
    },

    // Board: 3 lanes + jungle
    board: {
      solo: createLaneState(),
      mid: createLaneState(),
      duo: createLaneState(),
      jungle: createJungleState(),
    },

    // Structures per side
    structures: {
      1: createSideStructures(),
      2: createSideStructures(),
    },

    // Game log
    log: [],
    winner: null,
    gameOver: false,

    // Buffs / temporary effects
    activeBuffs: [], // { targetId, stat, value, turnsRemaining, source }
    activeDebuffs: [],
  };
}

function createPlayerState(deck, playerId) {
  // Deck = { gods: [...godCardIds], items: [...itemCardIds], minions: [...minionTypes] }
  return {
    id: playerId,
    deck: shuffleArray([...deck.gods, ...deck.items, ...deck.minions]),
    hand: [],
    graveyard: [],
    gods: {}, // deployed gods keyed by lane: { solo: godState, mid: godState, ... }
    handSize: 0,
    passiveEffects: [],
  };
}

function createLaneState() {
  return {
    minions: { 1: [], 2: [] }, // per-side minion arrays
    gods: { 1: null, 2: null }, // one god per side per lane (or null)
    effects: [], // active lane effects (zones, walls, etc.)
  };
}

function createJungleState() {
  return {
    gods: { 1: [], 2: [] }, // gods in jungle (roaming)
    objectives: {
      gold_fury: { ...JUNGLE_OBJECTIVES.gold_fury, currentHp: JUNGLE_OBJECTIVES.gold_fury.hp, alive: true, respawnTimer: 0 },
      fire_giant: { ...JUNGLE_OBJECTIVES.fire_giant, currentHp: JUNGLE_OBJECTIVES.fire_giant.hp, alive: true, respawnTimer: 0 },
      pyromancer: { ...JUNGLE_OBJECTIVES.pyromancer, currentHp: JUNGLE_OBJECTIVES.pyromancer.hp, alive: true, respawnTimer: 0 },
    },
    buffs: { 1: [], 2: [] }, // active jungle buffs per team
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ==========================================
// PHASE MANAGEMENT
// ==========================================

export function advancePhase(state) {
  const phases = ['draw', 'deploy', 'combat', 'cleanup'];
  const currentIdx = phases.indexOf(state.phase);

  if (currentIdx === phases.length - 1) {
    // End of cleanup → switch active player or advance turn
    if (state.activePlayer === 1) {
      return { ...state, phase: 'draw', activePlayer: 2 };
    } else {
      return advanceTurn({ ...state, phase: 'draw', activePlayer: 1 });
    }
  }

  return { ...state, phase: phases[currentIdx + 1] };
}

function advanceTurn(state) {
  const turn = state.turn + 1;
  const newMana1 = Math.min(state.maxMana[1] + state.manaPerTurn, 10);
  const newMana2 = Math.min(state.maxMana[2] + state.manaPerTurn, 10);

  let newState = {
    ...state,
    turn,
    maxMana: { 1: newMana1, 2: newMana2 },
    mana: { 1: newMana1, 2: newMana2 }, // refill mana
  };

  // Spawn minion waves
  newState = spawnMinionWaves(newState);

  // Tick phoenix respawn timers
  newState = tickPhoenixTimers(newState);

  // Tick jungle objective respawn timers
  newState = tickJungleTimers(newState);

  // Tick buffs/debuffs
  newState = tickTemporaryEffects(newState);

  return newState;
}

// ==========================================
// DRAW PHASE
// ==========================================

export function drawCards(state, playerId, count = 1) {
  const player = { ...state.players[playerId] };
  const drawn = [];

  for (let i = 0; i < count; i++) {
    if (player.deck.length === 0) break;
    const card = player.deck[0];
    player.deck = player.deck.slice(1);
    player.hand = [...player.hand, card];
    drawn.push(card);
  }

  player.handSize = player.hand.length;

  return {
    ...state,
    players: { ...state.players, [playerId]: player },
    log: [...state.log, { turn: state.turn, action: 'draw', player: playerId, cards: drawn }],
  };
}

// ==========================================
// DEPLOY PHASE
// ==========================================

export function deployGod(state, playerId, cardIndex, lane) {
  const player = { ...state.players[playerId] };
  const card = player.hand[cardIndex];
  if (!card || card.cardType !== 'god') return state;
  if (state.mana[playerId] < card.manaCost) return state; // not enough mana

  // Remove from hand
  player.hand = player.hand.filter((_, i) => i !== cardIndex);
  player.handSize = player.hand.length;

  // Create god instance on board
  const godInstance = createGodInstance(card, playerId, lane);

  // Place in lane or jungle
  const board = { ...state.board };
  if (lane === 'jungle') {
    board.jungle = {
      ...board.jungle,
      gods: { ...board.jungle.gods, [playerId]: [...board.jungle.gods[playerId], godInstance] },
    };
  } else {
    const laneState = { ...board[lane] };
    laneState.gods = { ...laneState.gods, [playerId]: godInstance };
    board[lane] = laneState;
  }

  return {
    ...state,
    board,
    players: { ...state.players, [playerId]: player },
    mana: { ...state.mana, [playerId]: state.mana[playerId] - card.manaCost },
    log: [...state.log, { turn: state.turn, action: 'deploy_god', player: playerId, god: card.name, lane }],
  };
}

export function playItem(state, playerId, cardIndex, targetGodId) {
  const player = { ...state.players[playerId] };
  const card = player.hand[cardIndex];
  if (!card || card.cardType !== 'item') return state;
  if (state.mana[playerId] < card.manaCost) return state;

  // Find target god and attach item
  const newState = attachItemToGod(state, targetGodId, card);
  if (!newState) return state;

  // Remove from hand
  player.hand = player.hand.filter((_, i) => i !== cardIndex);
  player.handSize = player.hand.length;

  return {
    ...newState,
    players: { ...newState.players, [playerId]: player },
    mana: { ...newState.mana, [playerId]: newState.mana[playerId] - card.manaCost },
    log: [...newState.log, { turn: state.turn, action: 'play_item', player: playerId, item: card.name, target: targetGodId }],
  };
}

export function deployMinion(state, playerId, cardIndex, lane) {
  const player = { ...state.players[playerId] };
  const card = player.hand[cardIndex];
  if (!card || card.cardType !== 'minion') return state;
  if (state.mana[playerId] < card.manaCost) return state;

  player.hand = player.hand.filter((_, i) => i !== cardIndex);
  player.handSize = player.hand.length;

  const minionInstance = { ...card, id: uid(), currentHp: card.hp, owner: playerId };
  const board = { ...state.board };
  const laneState = { ...board[lane] };
  laneState.minions = {
    ...laneState.minions,
    [playerId]: [...laneState.minions[playerId], minionInstance],
  };
  board[lane] = laneState;

  return {
    ...state,
    board,
    players: { ...state.players, [playerId]: player },
    mana: { ...state.mana, [playerId]: state.mana[playerId] - card.manaCost },
    log: [...state.log, { turn: state.turn, action: 'deploy_minion', player: playerId, minion: card.name, lane }],
  };
}

export function useAbility(state, playerId, lane, targetLane, targetId) {
  const god = state.board[lane]?.gods?.[playerId];
  if (!god || !god.ability) return state;
  if (god.abilityCooldown > 0) return state;
  if (state.mana[playerId] < god.ability.manaCost) return state;

  let newState = { ...state };
  newState.mana = { ...newState.mana, [playerId]: newState.mana[playerId] - god.ability.manaCost };

  // Apply ability effect based on type
  newState = applyAbility(newState, playerId, god, lane, targetLane, targetId);

  // Set cooldown
  newState = setGodCooldown(newState, playerId, lane, god.ability.cooldown);

  return newState;
}

// ==========================================
// COMBAT PHASE
// ==========================================

export function resolveCombat(state) {
  let newState = { ...state };

  // For each lane, resolve combat
  for (const lane of ['solo', 'mid', 'duo']) {
    newState = resolveLaneCombat(newState, lane);
  }

  // Resolve jungle combat
  newState = resolveJungleCombat(newState);

  return newState;
}

function resolveLaneCombat(state, lane) {
  let s = { ...state };
  const laneState = s.board[lane];
  const p1Structures = s.structures[1][lane];
  const p2Structures = s.structures[2][lane];

  // 1. Minions attack each other
  s = resolveMinionsVsMinions(s, lane);

  // 2. Gods attack (their basic attacks hit prioritized targets)
  for (const playerId of [1, 2]) {
    const god = laneState.gods[playerId];
    if (!god || god.currentHp <= 0) continue;

    const enemyId = playerId === 1 ? 2 : 1;
    const target = getAttackTarget(s, lane, playerId, enemyId);
    if (target) {
      s = applyDamage(s, god, target, god.attack, lane);
    }
  }

  // 3. Structures attack enemies (towers target strongest enemy)
  for (const playerId of [1, 2]) {
    const enemyId = playerId === 1 ? 2 : 1;
    const structures = s.structures[playerId][lane];

    for (const structKey of ['t1', 't2', 'phoenix']) {
      const struct = structures[structKey];
      if (struct.destroyed) continue;
      if (structKey !== 't1' && !structures.t1?.destroyed && structKey === 't2') continue;
      if (structKey === 'phoenix' && !structures.t2?.destroyed) continue;

      const target = getStrongestEnemy(s, lane, enemyId);
      if (target) {
        s = applyDamage(s, struct, target, struct.attack, lane);
      }
    }
  }

  // 4. Minions/gods attack structures (if no enemy minions/gods in the way)
  for (const playerId of [1, 2]) {
    const enemyId = playerId === 1 ? 2 : 1;
    const enemyMinions = s.board[lane].minions[enemyId];
    const enemyGod = s.board[lane].gods[enemyId];

    // Only attack structures if no enemy units remain
    if (enemyMinions.length === 0 && (!enemyGod || enemyGod.currentHp <= 0)) {
      const myMinions = s.board[lane].minions[playerId];
      const myGod = s.board[lane].gods[playerId];
      const struct = getNextStructure(s, lane, enemyId);

      if (struct) {
        // Minions attack structure
        for (const minion of myMinions) {
          if (minion.currentHp <= 0) continue;
          let dmg = minion.attack;
          if (minion.structureDamageMultiplier) dmg *= minion.structureDamageMultiplier;
          // Minion protection
          if (struct.minionProtection && s.board[lane].minions[enemyId].filter(m => m.currentHp > 0).length > 0) {
            dmg = Math.floor(dmg * 0.5);
          }
          s = applyStructureDamage(s, struct, dmg, lane, enemyId);
        }

        // God attacks structure
        if (myGod && myGod.currentHp > 0) {
          let dmg = myGod.attack;
          if (struct.minionProtection && s.board[lane].minions[enemyId].filter(m => m.currentHp > 0).length > 0) {
            dmg = Math.floor(dmg * 0.5);
          }
          s = applyStructureDamage(s, struct, dmg, lane, enemyId);
        }
      }
    }
  }

  return s;
}

function resolveMinionsVsMinions(state, lane) {
  let s = { ...state };
  const p1Minions = [...s.board[lane].minions[1]];
  const p2Minions = [...s.board[lane].minions[2]];

  // Each minion attacks one enemy minion (front to front)
  const maxFights = Math.min(p1Minions.length, p2Minions.length);
  for (let i = 0; i < maxFights; i++) {
    const m1 = p1Minions[i];
    const m2 = p2Minions[i];
    if (!m1 || !m2) break;

    const dmg1 = Math.max(m1.attack - m2.defense, 1);
    const dmg2 = Math.max(m2.attack - m1.defense, 1);

    m2.currentHp -= dmg1;
    m1.currentHp -= dmg2;
  }

  // Remove dead minions
  s.board = {
    ...s.board,
    [lane]: {
      ...s.board[lane],
      minions: {
        1: p1Minions.filter(m => m.currentHp > 0),
        2: p2Minions.filter(m => m.currentHp > 0),
      },
    },
  };

  return s;
}

function resolveJungleCombat(state) {
  // Gods in jungle can fight each other or attack objectives
  // Simplified: jungle gods auto-attack objectives if no enemy present
  let s = { ...state };

  for (const playerId of [1, 2]) {
    const jungleGods = s.board.jungle.gods[playerId];
    for (const god of jungleGods) {
      if (god.currentHp <= 0) continue;

      // Check if enemy gods in jungle
      const enemyId = playerId === 1 ? 2 : 1;
      const enemyGods = s.board.jungle.gods[enemyId].filter(g => g.currentHp > 0);

      if (enemyGods.length > 0) {
        // Fight enemy god
        const target = enemyGods[0];
        s = applyDamage(s, god, target, god.attack, 'jungle');
        s = applyDamage(s, target, god, target.attack, 'jungle');
      }
    }
  }

  return s;
}

// ==========================================
// CLEANUP PHASE
// ==========================================

export function cleanupPhase(state) {
  let s = { ...state };

  // Remove dead units
  for (const lane of ['solo', 'mid', 'duo']) {
    for (const playerId of [1, 2]) {
      const god = s.board[lane].gods[playerId];
      if (god && god.currentHp <= 0) {
        s.board = {
          ...s.board,
          [lane]: {
            ...s.board[lane],
            gods: { ...s.board[lane].gods, [playerId]: null },
          },
        };
        s.players[playerId].graveyard = [...s.players[playerId].graveyard, god];
      }
    }
  }

  // Check win condition
  if (s.structures[1].titan.destroyed) {
    s.winner = 2;
    s.gameOver = true;
  } else if (s.structures[2].titan.destroyed) {
    s.winner = 1;
    s.gameOver = true;
  }

  // Check alt win: 30 turn limit → most structures standing wins
  if (s.turn >= 30 && !s.gameOver) {
    const p1Structures = countStructures(s, 1);
    const p2Structures = countStructures(s, 2);
    if (p1Structures > p2Structures) {
      s.winner = 1;
    } else if (p2Structures > p1Structures) {
      s.winner = 2;
    } else {
      // Tie: compare titan HP
      s.winner = s.structures[1].titan.currentHp >= s.structures[2].titan.currentHp ? 1 : 2;
    }
    s.gameOver = true;
  }

  return s;
}

// ==========================================
// HELPERS
// ==========================================

function createGodInstance(card, playerId, lane) {
  return {
    ...card,
    id: uid(),
    owner: playerId,
    lane,
    currentHp: card.hp,
    attack: card.attack,
    defense: card.defense,
    items: [],
    abilityCooldown: 0,
    buffs: [],
    debuffs: [],
    // Role affinity bonus
    ...(card.roleAffinity === lane ? getRoleAffinityBonus(card.class) : {}),
  };
}

function getRoleAffinityBonus(godClass) {
  switch (godClass) {
    case 'Warrior': return { defense: 2 }; // bonus defense in solo
    case 'Assassin': return { attack: 2 }; // bonus attack in jungle
    case 'Mage': return { attack: 2 }; // bonus ability power in mid
    case 'Guardian': return { hp: 10 }; // bonus hp in support
    case 'Hunter': return { attack: 2 }; // bonus attack in duo
    default: return {};
  }
}

function attachItemToGod(state, targetGodId, item) {
  // Find god on board and attach item
  for (const lane of ['solo', 'mid', 'duo']) {
    for (const playerId of [1, 2]) {
      const god = state.board[lane].gods[playerId];
      if (god && god.id === targetGodId) {
        if (god.items.length >= 3) return null; // max 3 items
        const updated = {
          ...god,
          items: [...god.items, item],
          attack: god.attack + (item.effects.attack || 0),
          defense: god.defense + (item.effects.defense || 0),
          currentHp: god.currentHp + (item.effects.hp || 0),
          hp: god.hp + (item.effects.hp || 0),
        };
        const board = { ...state.board };
        board[lane] = {
          ...board[lane],
          gods: { ...board[lane].gods, [playerId]: updated },
        };
        return { ...state, board };
      }
    }
  }
  return null;
}

function getAttackTarget(state, lane, attackerId, enemyId) {
  // Priority: enemy god → enemy minions (front first)
  const enemyGod = state.board[lane].gods[enemyId];
  if (enemyGod && enemyGod.currentHp > 0) return enemyGod;

  const enemyMinions = state.board[lane].minions[enemyId].filter(m => m.currentHp > 0);
  if (enemyMinions.length > 0) return enemyMinions[0];

  return null;
}

function getStrongestEnemy(state, lane, enemyId) {
  const enemies = [
    state.board[lane].gods[enemyId],
    ...state.board[lane].minions[enemyId],
  ].filter(e => e && e.currentHp > 0);

  if (enemies.length === 0) return null;
  return enemies.reduce((a, b) => (b.attack > a.attack ? b : a));
}

function getNextStructure(state, lane, defenderId) {
  const structs = state.structures[defenderId][lane];
  if (!structs.t1.destroyed) return structs.t1;
  if (!structs.t2.destroyed) return structs.t2;
  if (!structs.phoenix.destroyed) return structs.phoenix;

  // Titan
  const titan = state.structures[defenderId].titan;
  if (!titan.destroyed) return titan;

  return null;
}

function applyDamage(state, attacker, target, rawDamage, lane) {
  const defense = target.defense || 0;
  let damage = Math.max(rawDamage - defense, 1);

  // Apply item passives
  if (attacker.items) {
    for (const item of attacker.items) {
      if (item.passive.armorPen) {
        damage = Math.max(rawDamage - Math.floor(defense * (1 - item.passive.armorPen)), 1);
      }
      if (item.passive.percentHpDmg) {
        damage += Math.floor(target.hp * item.passive.percentHpDmg / 100);
      }
      if (item.passive.critChance) {
        if (Math.random() * 100 < item.passive.critChance) {
          damage *= 2;
        }
      }
    }
  }

  // Apply lifesteal
  let healAmount = 0;
  if (attacker.items) {
    const lifestealItem = attacker.items.find(i => i.passive.lifesteal);
    if (lifestealItem) {
      healAmount = Math.floor(damage * lifestealItem.passive.lifesteal / 100);
    }
  }

  target.currentHp -= damage;
  if (healAmount > 0 && attacker.currentHp !== undefined) {
    attacker.currentHp = Math.min(attacker.currentHp + healAmount, attacker.hp);
  }

  state.log = [...state.log, {
    turn: state.turn,
    action: 'damage',
    source: attacker.name,
    target: target.name,
    damage,
    lane,
  }];

  return state;
}

function applyStructureDamage(state, structure, damage, lane, defenderId) {
  structure.currentHp -= damage;

  if (structure.currentHp <= 0 && !structure.destroyed) {
    structure.destroyed = true;
    structure.currentHp = 0;

    // Phoenix starts respawn timer
    if (structure.type === 'phoenix') {
      structure.respawnTimer = structure.respawnTurns;
    }

    state.log = [...state.log, {
      turn: state.turn,
      action: 'structure_destroyed',
      structure: structure.name,
      lane,
      defender: defenderId,
    }];

    // Check if titan is now exposed
    if (structure.type === 'phoenix') {
      // Titan becomes attackable
      state.log = [...state.log, {
        turn: state.turn,
        action: 'titan_exposed',
        defender: defenderId,
      }];
    }
  }

  return state;
}

function applyAbility(state, playerId, god, fromLane, targetLane, targetId) {
  const ability = god.ability;
  const enemyId = playerId === 1 ? 2 : 1;

  switch (ability.type) {
    case 'damage': {
      const target = findUnitById(state, targetId) || getAttackTarget(state, targetLane || fromLane, playerId, enemyId);
      if (target) {
        state = applyDamage(state, god, target, ability.value, targetLane || fromLane);
      }
      break;
    }
    case 'aoe_damage': {
      const lane = targetLane || fromLane;
      const enemies = [
        state.board[lane].gods[enemyId],
        ...state.board[lane].minions[enemyId],
      ].filter(e => e && e.currentHp > 0);
      for (const enemy of enemies) {
        state = applyDamage(state, god, enemy, ability.value, lane);
      }
      break;
    }
    case 'heal': {
      const target = findUnitById(state, targetId) || state.board[fromLane].gods[playerId];
      if (target) {
        target.currentHp = Math.min(target.currentHp + ability.value, target.hp);
        state.log = [...state.log, { turn: state.turn, action: 'heal', source: god.name, target: target.name, amount: ability.value }];
      }
      break;
    }
    case 'buff': {
      const allies = [
        state.board[fromLane].gods[playerId],
        ...state.board[fromLane].minions[playerId],
      ].filter(e => e && e.currentHp > 0);
      for (const ally of allies) {
        ally.attack = (ally.attack || 0) + (ability.value || 0);
        state.activeBuffs.push({ targetId: ally.id, stat: 'attack', value: ability.value, turnsRemaining: 2, source: god.name });
      }
      break;
    }
    case 'cc': {
      const enemies = [
        state.board[fromLane].gods[enemyId],
        ...state.board[fromLane].minions[enemyId],
      ].filter(e => e && e.currentHp > 0);
      for (const enemy of enemies) {
        enemy.stunned = true;
        state.activeDebuffs.push({ targetId: enemy.id, stat: 'stunned', value: true, turnsRemaining: 1, source: god.name });
      }
      if (ability.value > 0) {
        for (const enemy of enemies) {
          state = applyDamage(state, god, enemy, ability.value, fromLane);
        }
      }
      break;
    }
    case 'execute': {
      const target = findUnitById(state, targetId) || getAttackTarget(state, targetLane || fromLane, playerId, enemyId);
      if (target) {
        const threshold = target.hp * 0.2;
        if (target.currentHp <= threshold) {
          target.currentHp = 0;
          state.log = [...state.log, { turn: state.turn, action: 'execute', source: god.name, target: target.name }];
        } else {
          state = applyDamage(state, god, target, ability.value, targetLane || fromLane);
        }
      }
      break;
    }
    case 'shield': {
      const allies = [
        state.board[fromLane].gods[playerId],
        ...state.board[fromLane].minions[playerId],
      ].filter(e => e && e.currentHp > 0);
      for (const ally of allies) {
        ally.shield = (ally.shield || 0) + ability.value;
      }
      break;
    }
    case 'global': {
      // Affects all lanes
      for (const lane of ['solo', 'mid', 'duo']) {
        const enemies = [
          state.board[lane].gods[enemyId],
          ...state.board[lane].minions[enemyId],
        ].filter(e => e && e.currentHp > 0);
        for (const enemy of enemies) {
          state = applyDamage(state, god, enemy, ability.value, lane);
        }
      }
      break;
    }
    case 'stealth': {
      god.stealthed = true;
      god.nextAttackBonus = ability.value;
      state.activeBuffs.push({ targetId: god.id, stat: 'stealthed', value: true, turnsRemaining: 1, source: god.name });
      break;
    }
    default:
      break;
  }

  state.log = [...state.log, {
    turn: state.turn,
    action: 'ability',
    source: god.name,
    ability: ability.name,
    type: ability.type,
  }];

  return state;
}

function setGodCooldown(state, playerId, lane, cooldown) {
  const god = state.board[lane]?.gods?.[playerId];
  if (god) god.abilityCooldown = cooldown;
  return state;
}

function findUnitById(state, id) {
  if (!id) return null;
  for (const lane of ['solo', 'mid', 'duo']) {
    for (const playerId of [1, 2]) {
      const god = state.board[lane].gods[playerId];
      if (god?.id === id) return god;
      const minion = state.board[lane].minions[playerId].find(m => m.id === id);
      if (minion) return minion;
    }
  }
  for (const playerId of [1, 2]) {
    const god = state.board.jungle.gods[playerId].find(g => g.id === id);
    if (god) return god;
  }
  return null;
}

function spawnMinionWaves(state) {
  for (const lane of ['solo', 'mid', 'duo']) {
    for (const playerId of [1, 2]) {
      const hasPhoenixDown = state.structures[playerId === 1 ? 2 : 1][lane].phoenix.destroyed;
      const hasFireGiant = state.board.jungle.buffs[playerId].some(b => b.type === 'fire_giant');
      const wave = createMinionWave(hasPhoenixDown, hasFireGiant);
      wave.forEach(m => { m.id = uid(); m.owner = playerId; });

      state.board = {
        ...state.board,
        [lane]: {
          ...state.board[lane],
          minions: {
            ...state.board[lane].minions,
            [playerId]: [...state.board[lane].minions[playerId], ...wave],
          },
        },
      };
    }
  }
  return state;
}

function tickPhoenixTimers(state) {
  for (const playerId of [1, 2]) {
    for (const lane of ['solo', 'mid', 'duo']) {
      const phoenix = state.structures[playerId][lane].phoenix;
      if (phoenix.destroyed && phoenix.respawnTimer > 0) {
        phoenix.respawnTimer--;
        if (phoenix.respawnTimer === 0) {
          phoenix.destroyed = false;
          phoenix.currentHp = phoenix.hp;
          state.log = [...state.log, { turn: state.turn, action: 'phoenix_respawn', lane, player: playerId }];
        }
      }
    }
  }
  return state;
}

function tickJungleTimers(state) {
  const jungle = state.board.jungle;
  for (const objKey of Object.keys(jungle.objectives)) {
    const obj = jungle.objectives[objKey];
    if (!obj.alive && obj.respawnTimer > 0) {
      obj.respawnTimer--;
      if (obj.respawnTimer === 0) {
        obj.alive = true;
        obj.currentHp = obj.hp;
      }
    }
  }
  return state;
}

function tickTemporaryEffects(state) {
  state.activeBuffs = state.activeBuffs.filter(b => {
    b.turnsRemaining--;
    if (b.turnsRemaining <= 0) {
      const unit = findUnitById(state, b.targetId);
      if (unit && typeof b.value === 'number') {
        unit[b.stat] = (unit[b.stat] || 0) - b.value;
      } else if (unit && typeof b.value === 'boolean') {
        unit[b.stat] = false;
      }
      return false;
    }
    return true;
  });

  state.activeDebuffs = state.activeDebuffs.filter(d => {
    d.turnsRemaining--;
    if (d.turnsRemaining <= 0) {
      const unit = findUnitById(state, d.targetId);
      if (unit) unit[d.stat] = false;
      return false;
    }
    return true;
  });

  // Tick god ability cooldowns
  for (const lane of ['solo', 'mid', 'duo']) {
    for (const playerId of [1, 2]) {
      const god = state.board[lane].gods[playerId];
      if (god && god.abilityCooldown > 0) {
        god.abilityCooldown--;
      }
    }
  }

  return state;
}

function countStructures(state, playerId) {
  let count = 0;
  for (const lane of ['solo', 'mid', 'duo']) {
    if (!state.structures[playerId][lane].t1.destroyed) count++;
    if (!state.structures[playerId][lane].t2.destroyed) count++;
    if (!state.structures[playerId][lane].phoenix.destroyed) count++;
  }
  if (!state.structures[playerId].titan.destroyed) count++;
  return count;
}

export default {
  createInitialGameState,
  advancePhase,
  drawCards,
  deployGod,
  playItem,
  deployMinion,
  useAbility,
  resolveCombat,
  cleanupPhase,
};
