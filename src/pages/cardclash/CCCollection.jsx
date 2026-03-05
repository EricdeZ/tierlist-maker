import { useState, useMemo } from 'react';
import { useCardClash } from './CardClashContext';
import GodCard from './components/GodCard';
import { RARITIES } from '../../data/cardclash/economy';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'power', label: 'Power' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'role', label: 'Role' },
  { value: 'class', label: 'Class' },
  { value: 'name', label: 'Name' },
];

const FILTER_ROLES = ['all', 'solo', 'jungle', 'mid', 'support', 'adc'];
const FILTER_RARITIES = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'];

export default function Collection() {
  const { collection, disenchantCard, lineup, setLineupCard } = useCardClash();
  const [sortBy, setSortBy] = useState('newest');
  const [filterRole, setFilterRole] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);

  const filtered = useMemo(() => {
    let cards = [...collection];

    if (filterRole !== 'all') cards = cards.filter(c => c.role === filterRole);
    if (filterRarity !== 'all') cards = cards.filter(c => c.rarity === filterRarity);
    if (search) cards = cards.filter(c => (c.godName || c.name || '').toLowerCase().includes(search.toLowerCase()));

    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    switch (sortBy) {
      case 'power': cards.sort((a, b) => (b.power || 0) - (a.power || 0)); break;
      case 'rarity': cards.sort((a, b) => (rarityOrder[a.rarity] || 4) - (rarityOrder[b.rarity] || 4)); break;
      case 'role': cards.sort((a, b) => (a.role || '').localeCompare(b.role || '')); break;
      case 'class': cards.sort((a, b) => (a.godClass || a.class || '').localeCompare(b.godClass || b.class || '')); break;
      case 'name': cards.sort((a, b) => (a.godName || a.name || '').localeCompare(b.godName || b.name || '')); break;
      default: cards.sort((a, b) => (b.acquiredAt || 0) - (a.acquiredAt || 0));
    }

    return cards;
  }, [collection, sortBy, filterRole, filterRarity, search]);

  const selected = selectedCard ? collection.find(c => c.id === selectedCard) : null;

  // Check if a card is in the lineup
  const isInLineup = (cardId) => Object.values(lineup).some(l => l?.id === cardId);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Collection</h1>
          <p className="text-sm text-gray-400">{collection.length} cards</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search gods..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 w-48"
        />

        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="flex gap-1">
          {FILTER_ROLES.map(role => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-2 py-1 text-xs rounded capitalize ${filterRole === role ? 'bg-gold text-black font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {FILTER_RARITIES.map(r => (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className={`px-2 py-1 text-xs rounded capitalize ${filterRarity === r ? 'bg-gold text-black font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              style={filterRarity === r && r !== 'all' ? { backgroundColor: RARITIES[r]?.color } : {}}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Card grid */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No cards match your filters</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {filtered.map(card => (
                <GodCard
                  key={card.id}
                  card={card}
                  onClick={() => setSelectedCard(card.id === selectedCard ? null : card.id)}
                  selected={card.id === selectedCard}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 bg-gray-900 border border-gray-800 rounded-xl p-4 sticky top-4 h-fit">
            <h3 className="text-lg font-bold text-white mb-1">{selected.godName || selected.name}</h3>
            <div className="text-sm text-gray-400 mb-3">
              {selected.godClass || selected.class} &middot; {selected.role} &middot;{' '}
              <span style={{ color: RARITIES[selected.rarity]?.color }}>{RARITIES[selected.rarity]?.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-orange-400 font-bold">{selected.power}</div>
                <div className="text-[10px] text-gray-500">Power</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-yellow-400 font-bold">Lv.{selected.level || 1}</div>
                <div className="text-[10px] text-gray-500">Level</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-cyan-400 font-bold">{selected.xp || 0}</div>
                <div className="text-[10px] text-gray-500">XP</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-gray-300 font-bold">#{selected.serialNumber}</div>
                <div className="text-[10px] text-gray-500">Serial</div>
              </div>
            </div>

            {selected.ability && (
              <div className="bg-gray-800 rounded p-2 mb-4">
                <div className="text-xs font-bold text-amber-400">{selected.ability.name}</div>
                <p className="text-[10px] text-gray-400 mt-0.5">{selected.ability.description}</p>
                <div className="text-[10px] text-mana mt-1">{selected.ability.manaCost} mana &middot; {selected.ability.cooldown}t CD</div>
              </div>
            )}

            <div className="space-y-2">
              {!isInLineup(selected.id) && (
                <button
                  onClick={() => { setLineupCard(selected.role, selected.id); }}
                  className="w-full bg-gold/20 text-gold border border-gold/30 rounded py-1.5 text-sm font-bold hover:bg-gold/30"
                >
                  Set as {selected.role?.toUpperCase()}
                </button>
              )}
              {isInLineup(selected.id) && (
                <button
                  onClick={() => { setLineupCard(selected.role, null); }}
                  className="w-full bg-gray-800 text-gray-400 border border-gray-700 rounded py-1.5 text-sm hover:bg-gray-700"
                >
                  Remove from Lineup
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Disenchant ${selected.godName || selected.name}? You'll get ${RARITIES[selected.rarity]?.emberValue || 5} Embers.`)) {
                    disenchantCard(selected.id);
                    setSelectedCard(null);
                  }
                }}
                className="w-full bg-red-900/30 text-red-400 border border-red-800/30 rounded py-1.5 text-sm hover:bg-red-900/50"
              >
                Disenchant ({RARITIES[selected.rarity]?.emberValue || 5} Embers)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
