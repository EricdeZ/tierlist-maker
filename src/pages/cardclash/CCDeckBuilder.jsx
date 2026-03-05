import { useState, useMemo, useCallback } from 'react';
import { useCardClash } from './CardClashContext';
import GodCard from './components/GodCard';
import { createStarterDeck, DECK_RULES } from './engine/DeckBuilder';
import { RARITIES } from '../../data/cardclash/economy';
import { ITEMS } from '../../data/cardclash/items';
import { MINION_TYPES } from '../../data/cardclash/minions';

const CARD_TYPES = ['gods', 'items', 'minions'];

export default function DeckBuilder() {
  const { collection, decks, saveDeck, deleteDeck } = useCardClash();
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [deckName, setDeckName] = useState('');
  const [deckCards, setDeckCards] = useState([]);
  const [addTab, setAddTab] = useState('gods');
  const [search, setSearch] = useState('');
  const [showNewDeck, setShowNewDeck] = useState(false);

  const godCards = useMemo(() => collection.filter(c => c.godName), [collection]);

  // Available items (these come from the items data, not collection)
  const itemCards = useMemo(() => {
    return ITEMS.map(item => ({
      id: `item-${item.id}`,
      type: 'item',
      name: item.name,
      category: item.category,
      manaCost: item.manaCost,
      effects: item.effects,
      passive: item.passive,
      imageKey: item.imageKey,
    }));
  }, []);

  const minionCards = useMemo(() => {
    return Object.entries(MINION_TYPES)
      .filter(([key]) => key === 'brute' || key === 'siege')
      .map(([key, m]) => ({
        id: `minion-${key}`,
        type: 'minion',
        name: m.name,
        hp: m.hp,
        attack: m.attack,
        manaCost: key === 'brute' ? 2 : 3,
      }));
  }, []);

  const filtered = useMemo(() => {
    let cards = addTab === 'gods' ? godCards : addTab === 'items' ? itemCards : minionCards;
    if (search) {
      const s = search.toLowerCase();
      cards = cards.filter(c => (c.godName || c.name || '').toLowerCase().includes(s));
    }
    return cards;
  }, [addTab, godCards, itemCards, minionCards, search]);

  const validation = useMemo(() => {
    if (deckCards.length === 0) return null;
    const gods = deckCards.filter(c => c.godName || c.cardType === 'god');
    const items = deckCards.filter(c => c.type === 'item' || c.cardType === 'item');
    const minions = deckCards.filter(c => c.type === 'minion' || c.cardType === 'minion');
    const total = deckCards.length;
    const errors = [];
    if (gods.length < DECK_RULES.minGods) errors.push(`Need ${DECK_RULES.minGods}+ gods (have ${gods.length})`);
    if (gods.length > DECK_RULES.maxGods) errors.push(`Max ${DECK_RULES.maxGods} gods`);
    if (items.length < DECK_RULES.minItems) errors.push(`Need ${DECK_RULES.minItems}+ items (have ${items.length})`);
    if (items.length > DECK_RULES.maxItems) errors.push(`Max ${DECK_RULES.maxItems} items`);
    if (minions.length < DECK_RULES.minMinions) errors.push(`Need ${DECK_RULES.minMinions}+ minions (have ${minions.length})`);
    if (minions.length > DECK_RULES.maxMinions) errors.push(`Max ${DECK_RULES.maxMinions} minions`);
    if (total < DECK_RULES.totalMin) errors.push(`Need ${DECK_RULES.totalMin}+ cards (have ${total})`);
    if (total > DECK_RULES.totalMax) errors.push(`Max ${DECK_RULES.totalMax} cards`);
    return { valid: errors.length === 0, errors };
  }, [deckCards]);

  const addToDeck = useCallback((card) => {
    setDeckCards(prev => {
      const dupeCount = prev.filter(c => c.id === card.id).length;
      if (dupeCount >= DECK_RULES.maxCopies) return prev;
      if (prev.length >= DECK_RULES.totalMax) return prev;
      return [...prev, card];
    });
  }, []);

  const removeFromDeck = useCallback((index) => {
    setDeckCards(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = () => {
    if (!deckName.trim()) return;
    const deck = {
      id: selectedDeck || `deck-${Date.now()}`,
      name: deckName,
      cards: deckCards.map(c => ({ id: c.id, type: c.type || 'god' })),
      createdAt: Date.now(),
    };
    saveDeck(deck);
    setShowNewDeck(false);
    setSelectedDeck(null);
    setDeckCards([]);
    setDeckName('');
  };

  const handleLoadDeck = (deck) => {
    setSelectedDeck(deck.id);
    setDeckName(deck.name);
    // Resolve card references back to full objects
    const resolved = deck.cards.map(ref => {
      if (ref.type === 'god') return collection.find(c => c.id === ref.id);
      if (ref.type === 'item') return itemCards.find(c => c.id === ref.id);
      if (ref.type === 'minion') return minionCards.find(c => c.id === ref.id);
      return collection.find(c => c.id === ref.id);
    }).filter(Boolean);
    setDeckCards(resolved);
    setShowNewDeck(true);
  };

  const handleNewDeck = () => {
    setSelectedDeck(null);
    setDeckName('');
    setDeckCards([]);
    setShowNewDeck(true);
  };

  const handleStarterDeck = () => {
    const starter = createStarterDeck(collection);
    if (!starter) return;
    setDeckName('Starter Deck');
    setDeckCards(starter.all || []);
    setShowNewDeck(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Deck Builder</h1>
          <p className="text-sm text-gray-400">Build decks for the full 3-lane game mode</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStarterDeck}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded font-bold text-sm hover:bg-gray-700"
          >
            Auto-Build
          </button>
          <button
            onClick={handleNewDeck}
            className="px-4 py-2 bg-amber-500 text-black rounded font-bold text-sm hover:bg-amber-400"
          >
            New Deck
          </button>
        </div>
      </div>

      {!showNewDeck ? (
        <>
          {/* Deck list */}
          {decks.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No decks yet</p>
              <p className="text-sm mt-1">Create a new deck or auto-build one to get started</p>
              <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 max-w-md mx-auto text-left">
                <h3 className="font-bold text-white text-sm mb-2">Deck Rules</h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>- {DECK_RULES.minGods}-{DECK_RULES.maxGods} God cards (1 per role required)</li>
                  <li>- {DECK_RULES.minItems}-{DECK_RULES.maxItems} Item cards</li>
                  <li>- {DECK_RULES.minMinions}-{DECK_RULES.maxMinions} Minion cards</li>
                  <li>- {DECK_RULES.totalMin}-{DECK_RULES.totalMax} cards total</li>
                  <li>- Max {DECK_RULES.maxCopies} copies of any card</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {decks.map(deck => (
                <div key={deck.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-white">{deck.name}</h3>
                      <p className="text-xs text-gray-500">{deck.cards.length} cards</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${deck.name}"?`)) deleteDeck(deck.id);
                      }}
                      className="text-gray-600 hover:text-red-400 text-sm"
                    >
                      x
                    </button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    {['god', 'item', 'minion'].map(type => {
                      const count = deck.cards.filter(c => c.type === type).length;
                      return (
                        <span key={type} className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                          {count} {type}s
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadDeck(deck)}
                      className="flex-1 px-3 py-1.5 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700"
                    >
                      Edit
                    </button>
                    <button className="flex-1 px-3 py-1.5 bg-gold/20 text-gold rounded text-sm font-bold hover:bg-gold/30">
                      Play
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Deck editor */}
          <div className="flex gap-6">
            {/* Left: card pool */}
            <div className="flex-1">
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 w-48"
                />
                <div className="flex gap-1">
                  {CARD_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setAddTab(t)}
                      className={`px-3 py-1.5 rounded text-sm font-bold capitalize ${
                        addTab === t ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-h-[60vh] overflow-y-auto">
                {addTab === 'gods' && filtered.map(card => (
                  <div key={card.id} onClick={() => addToDeck(card)} className="cursor-pointer hover:scale-[1.02] transition-transform">
                    <GodCard card={card} size="small" />
                  </div>
                ))}
                {addTab === 'items' && filtered.map(card => (
                  <div
                    key={card.id}
                    onClick={() => addToDeck(card)}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-gray-600"
                  >
                    <div className="font-bold text-white text-sm">{card.name}</div>
                    <div className="text-xs text-gray-500">{card.category}</div>
                    <div className="text-xs text-mana mt-1">{card.manaCost} mana</div>
                  </div>
                ))}
                {addTab === 'minions' && filtered.map(card => (
                  <div
                    key={card.id}
                    onClick={() => addToDeck(card)}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-gray-600"
                  >
                    <div className="font-bold text-white text-sm">{card.name}</div>
                    <div className="text-xs text-gray-500">HP: {card.hp} | ATK: {card.attack}</div>
                    <div className="text-xs text-mana mt-1">{card.manaCost} mana</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: current deck */}
            <div className="w-80">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sticky top-4">
                <input
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="Deck name..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 mb-3"
                />

                <div className="text-xs text-gray-500 mb-3">
                  {deckCards.length}/{DECK_RULES.totalMax} cards
                  {' | '}
                  Gods: {deckCards.filter(c => c.godName).length}
                  {' | '}
                  Items: {deckCards.filter(c => c.type === 'item').length}
                  {' | '}
                  Minions: {deckCards.filter(c => c.type === 'minion').length}
                </div>

                {validation && !validation.valid && (
                  <div className="bg-red-900/20 border border-red-800/30 rounded p-2 mb-3">
                    {validation.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-400">{err}</div>
                    ))}
                  </div>
                )}
                {validation?.valid && (
                  <div className="bg-green-900/20 border border-green-800/30 rounded p-2 mb-3 text-xs text-green-400">
                    Deck is valid!
                  </div>
                )}

                <div className="space-y-1 max-h-96 overflow-y-auto mb-3">
                  {deckCards.map((card, i) => (
                    <div key={`${card.id}-${i}`} className="flex justify-between items-center bg-gray-800 rounded px-2 py-1">
                      <div className="text-xs text-white truncate flex-1">
                        {card.godName || card.name}
                        {card.rarity && (
                          <span className="ml-1" style={{ color: RARITIES[card.rarity]?.color }}>
                            ({RARITIES[card.rarity]?.name?.[0]})
                          </span>
                        )}
                      </div>
                      <button onClick={() => removeFromDeck(i)} className="text-gray-600 hover:text-red-400 ml-2 text-xs">x</button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowNewDeck(false); setDeckCards([]); setDeckName(''); }}
                    className="flex-1 px-3 py-2 bg-gray-800 text-gray-400 rounded text-sm hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!deckName.trim() || deckCards.length === 0}
                    className="flex-1 px-3 py-2 bg-amber-500 text-black rounded font-bold text-sm hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    Save Deck
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
