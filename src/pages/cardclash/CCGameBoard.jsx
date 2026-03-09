import { useState, useCallback, useMemo } from 'react';
import { createInitialGameState, advancePhase, drawCards, deployGod, playItem, useAbility, resolveCombat, cleanupPhase } from './engine/GameState';
import { createStarterDeck } from './engine/DeckBuilder';

const LANE_COLORS = {
  solo: { bg: 'bg-blue-900/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  mid: { bg: 'bg-purple-900/20', border: 'border-purple-500/30', text: 'text-purple-400' },
  duo: { bg: 'bg-red-900/20', border: 'border-red-500/30', text: 'text-red-400' },
};

export default function GameBoard() {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedLane, setSelectedLane] = useState(null);

  const startGame = useCallback(() => {
    const p1Deck = createStarterDeck();
    const p2Deck = createStarterDeck();
    let state = createInitialGameState(p1Deck, p2Deck);
    // Initial draw
    state = drawCards(state, 1, 5);
    state = drawCards(state, 2, 5);
    setGameState(state);
  }, []);

  const handleAction = useCallback((action, ...args) => {
    if (!gameState || gameState.gameOver) return;

    let newState = { ...gameState };

    switch (action) {
      case 'deploy': {
        const [cardIndex, lane] = args;
        const card = newState.players[1].hand[cardIndex];
        if (card?.cardType === 'god') {
          newState = deployGod(newState, 1, cardIndex, lane);
        } else if (card?.cardType === 'item') {
          // For items, need to select a target god
          // Simplified: auto-attach to first god in lane
          newState = playItem(newState, 1, cardIndex, null);
        } else if (card?.cardType === 'minion') {
          newState = deployGod(newState, 1, cardIndex, lane); // reuse deploy
        }
        break;
      }
      case 'ability': {
        const [lane] = args;
        newState = useAbility(newState, 1, lane, lane, null);
        break;
      }
      case 'end_turn': {
        // AI takes its turn automatically
        newState = aiTurn(newState);
        // Resolve combat
        newState = resolveCombat(newState);
        // Cleanup
        newState = cleanupPhase(newState);
        // Advance turn
        newState = advancePhase(newState);
        newState = advancePhase(newState); // skip through deploy/combat
        newState = advancePhase(newState);
        newState = advancePhase(newState);
        // Draw for next turn
        newState = drawCards(newState, 1, 2);
        newState = drawCards(newState, 2, 2);
        break;
      }
    }

    setGameState(newState);
    setSelectedCard(null);
    setSelectedLane(null);
  }, [gameState]);

  if (!gameState) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">SMITE Compdeck - Full Game</h1>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto">
          Three lanes. Towers, Phoenixes, and a Titan. Deploy gods, cast abilities, equip items,
          and destroy the enemy Titan to win.
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-lg hover:from-green-400 hover:to-emerald-500"
        >
          Start Game
        </button>
      </div>
    );
  }

  if (gameState.gameOver) {
    return (
      <div className="p-6 text-center">
        <h1 className={`text-4xl font-black ${gameState.winner === 1 ? 'text-green-400' : 'text-red-400'}`}>
          {gameState.winner === 1 ? 'VICTORY!' : 'DEFEAT'}
        </h1>
        <p className="text-gray-400 mt-2">Game ended on turn {gameState.turn}</p>
        <button onClick={startGame} className="mt-6 px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">
          Play Again
        </button>
      </div>
    );
  }

  const player = gameState.players[1];

  return (
    <div className="p-4 h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-2 mb-3">
        <div className="text-sm">
          <span className="text-gray-400">Turn</span> <span className="text-white font-bold">{gameState.turn}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-400">Phase</span> <span className="text-gold font-bold capitalize">{gameState.phase}</span>
        </div>
        <div className="flex gap-4">
          <div>
            <span className="text-mana text-sm">Mana: </span>
            <span className="text-mana font-bold">{gameState.mana[1]}/{gameState.maxMana[1]}</span>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Deck: </span>
            <span className="text-white font-bold">{player.deck.length}</span>
          </div>
        </div>
        <button
          onClick={() => handleAction('end_turn')}
          className="px-4 py-1.5 bg-amber-500 text-black font-bold rounded text-sm hover:bg-amber-400"
        >
          End Turn
        </button>
      </div>

      {/* Game board - 3 lanes */}
      <div className="flex-1 grid grid-cols-3 gap-3 mb-3">
        {['solo', 'mid', 'duo'].map(lane => {
          const colors = LANE_COLORS[lane];
          const p1God = gameState.board[lane].gods[1];
          const p2God = gameState.board[lane].gods[2];
          const p1Minions = gameState.board[lane].minions[1];
          const p2Minions = gameState.board[lane].minions[2];
          const p1Structs = gameState.structures[1][lane];
          const p2Structs = gameState.structures[2][lane];

          return (
            <div key={lane} className={`${colors.bg} border ${colors.border} rounded-lg flex flex-col`}>
              {/* Lane header */}
              <div className={`px-3 py-1.5 border-b ${colors.border} flex justify-between`}>
                <span className={`text-xs font-bold ${colors.text} uppercase`}>{lane} Lane</span>
              </div>

              {/* Enemy side */}
              <div className="flex-1 p-2 flex flex-col justify-between">
                {/* Enemy structures */}
                <div className="flex gap-1 justify-center mb-1">
                  {['t1', 't2', 'phoenix'].map(s => (
                    <StructureIcon key={s} structure={p2Structs[s]} enemy />
                  ))}
                </div>

                {/* Enemy god */}
                <div className="flex justify-center">
                  {p2God && p2God.currentHp > 0 ? (
                    <GodOnBoard god={p2God} enemy />
                  ) : (
                    <div className="w-16 h-16 border border-dashed border-red-800/30 rounded flex items-center justify-center text-xs text-gray-600">
                      Empty
                    </div>
                  )}
                </div>

                {/* Enemy minions */}
                <div className="flex gap-0.5 justify-center">
                  {p2Minions.slice(0, 5).map((m, i) => (
                    <MinionIcon key={i} minion={m} enemy />
                  ))}
                  {p2Minions.length > 5 && <span className="text-[9px] text-red-400">+{p2Minions.length - 5}</span>}
                </div>

                <div className="border-t border-gray-700/30 my-1" />

                {/* Player minions */}
                <div className="flex gap-0.5 justify-center">
                  {p1Minions.slice(0, 5).map((m, i) => (
                    <MinionIcon key={i} minion={m} />
                  ))}
                  {p1Minions.length > 5 && <span className="text-[9px] text-blue-400">+{p1Minions.length - 5}</span>}
                </div>

                {/* Player god */}
                <div className="flex justify-center">
                  {p1God && p1God.currentHp > 0 ? (
                    <GodOnBoard
                      god={p1God}
                      onClick={() => handleAction('ability', lane)}
                      canUseAbility={p1God.abilityCooldown === 0 && gameState.mana[1] >= (p1God.ability?.manaCost || 99)}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 border border-dashed border-blue-800/30 rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:border-blue-500/50"
                      onClick={() => {
                        if (selectedCard !== null) {
                          handleAction('deploy', selectedCard, lane);
                        }
                        setSelectedLane(lane);
                      }}
                    >
                      {selectedCard !== null ? 'Deploy here' : 'Empty'}
                    </div>
                  )}
                </div>

                {/* Player structures */}
                <div className="flex gap-1 justify-center mt-1">
                  {['t1', 't2', 'phoenix'].map(s => (
                    <StructureIcon key={s} structure={p1Structs[s]} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Titan status */}
      <div className="flex justify-between mb-2">
        <TitanBar titan={gameState.structures[1].titan} label="Your Titan" />
        <TitanBar titan={gameState.structures[2].titan} label="Enemy Titan" enemy />
      </div>

      {/* Player hand */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">Hand ({player.hand.length} cards)</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {player.hand.map((card, i) => (
            <button
              key={i}
              onClick={() => setSelectedCard(selectedCard === i ? null : i)}
              className={`shrink-0 w-24 bg-gray-800 border rounded p-2 text-left transition-all ${
                selectedCard === i ? 'border-gold ring-1 ring-gold scale-105' : 'border-gray-700 hover:border-gray-600'
              } ${gameState.mana[1] < (card.manaCost || 0) ? 'opacity-50' : ''}`}
            >
              <div className="text-[9px] text-gray-500 uppercase">{card.cardType}</div>
              <div className="text-xs font-bold text-white truncate">{card.name}</div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-mana">{card.manaCost}m</span>
                {card.attack && <span className="text-[10px] text-orange-400">{card.attack}A</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Game log (last 5) */}
      <div className="mt-2 max-h-20 overflow-y-auto bg-gray-900/50 rounded px-3 py-1">
        {gameState.log.slice(-5).map((entry, i) => (
          <div key={i} className="text-[10px] text-gray-500">
            T{entry.turn}: {entry.action} - {entry.source || entry.god || entry.structure || ''} {entry.damage ? `(${entry.damage} dmg)` : ''} {entry.target ? `→ ${entry.target}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// AI turn - simple AI that deploys units and attacks
function aiTurn(state) {
  const ai = state.players[2];
  let s = { ...state };

  // Deploy gods from hand to empty lanes
  for (let i = ai.hand.length - 1; i >= 0; i--) {
    const card = ai.hand[i];
    if (card.cardType !== 'god') continue;
    if (s.mana[2] < (card.manaCost || 5)) continue;

    for (const lane of ['solo', 'mid', 'duo']) {
      if (!s.board[lane].gods[2] || s.board[lane].gods[2].currentHp <= 0) {
        s = deployGod(s, 2, i, lane);
        break;
      }
    }
  }

  // Use abilities if available
  for (const lane of ['solo', 'mid', 'duo']) {
    const god = s.board[lane].gods[2];
    if (god && god.abilityCooldown === 0 && god.ability && s.mana[2] >= god.ability.manaCost) {
      s = useAbility(s, 2, lane, lane, null);
    }
  }

  return s;
}

function GodOnBoard({ god, enemy, onClick, canUseAbility }) {
  const hpPercent = Math.max(0, (god.currentHp / god.hp) * 100);
  return (
    <div
      onClick={onClick}
      className={`w-20 rounded border p-1 text-center ${
        enemy ? 'border-red-800/50 bg-red-950/30' : 'border-blue-800/50 bg-blue-950/30'
      } ${canUseAbility ? 'cursor-pointer hover:border-amber-400 ring-1 ring-amber-400/30' : ''}`}
    >
      <div className="text-[10px] font-bold text-white truncate">{god.name}</div>
      <div className="w-full h-1 bg-gray-700 rounded mt-0.5">
        <div className={`h-full rounded ${enemy ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${hpPercent}%` }} />
      </div>
      <div className="text-[8px] text-gray-400 mt-0.5">{god.currentHp}/{god.hp} HP</div>
      <div className="flex justify-center gap-1 text-[8px]">
        <span className="text-orange-400">{god.attack}A</span>
        <span className="text-blue-400">{god.defense}D</span>
      </div>
      {canUseAbility && (
        <div className="text-[8px] text-amber-400 font-bold mt-0.5">[{god.ability?.name}]</div>
      )}
    </div>
  );
}

function MinionIcon({ minion, enemy }) {
  return (
    <div className={`w-5 h-5 rounded-sm text-[8px] flex items-center justify-center font-bold ${
      enemy ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'
    }`} title={`${minion.name}: ${minion.currentHp}HP`}>
      {minion.currentHp}
    </div>
  );
}

function StructureIcon({ structure, enemy }) {
  if (structure.destroyed) {
    return (
      <div className="w-8 h-8 rounded border border-gray-800 bg-gray-900/50 flex items-center justify-center text-[8px] text-gray-600 line-through">
        {structure.type === 'phoenix' && structure.respawnTimer > 0 ? structure.respawnTimer : 'X'}
      </div>
    );
  }
  const hpPercent = (structure.currentHp / structure.hp) * 100;
  return (
    <div className={`w-8 h-8 rounded border flex flex-col items-center justify-center text-[7px] ${
      enemy ? 'border-red-700/50 bg-red-950/40' : 'border-blue-700/50 bg-blue-950/40'
    }`} title={`${structure.name}: ${structure.currentHp}/${structure.hp}`}>
      <div className={`font-bold ${hpPercent > 50 ? 'text-green-400' : hpPercent > 25 ? 'text-yellow-400' : 'text-red-400'}`}>
        {structure.currentHp}
      </div>
      <div className="text-gray-500">{structure.type.replace('_', '')}</div>
    </div>
  );
}

function TitanBar({ titan, label, enemy }) {
  const hpPercent = Math.max(0, (titan.currentHp / titan.hp) * 100);
  return (
    <div className={`flex-1 mx-2 bg-gray-900 border rounded-lg px-3 py-1.5 ${enemy ? 'border-red-800/30' : 'border-blue-800/30'}`}>
      <div className="flex justify-between items-center text-xs mb-0.5">
        <span className={enemy ? 'text-red-400' : 'text-blue-400'}>{label}</span>
        <span className="text-white">{titan.currentHp}/{titan.hp}</span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded">
        <div
          className={`h-full rounded transition-all ${enemy ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
    </div>
  );
}
