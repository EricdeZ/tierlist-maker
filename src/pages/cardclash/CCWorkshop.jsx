import { useState, useMemo } from 'react';
import { useCardClash } from './CardClashContext';
import GodCard from './components/GodCard';
import { RARITIES } from '../../data/cardclash/economy';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const CRAFT_COSTS = { common: 25, uncommon: 100, rare: 400, epic: 1500, legendary: 5000 };
const DISENCHANT_VALUES = { common: 5, uncommon: 20, rare: 75, epic: 300, legendary: 1200 };
const UPGRADE_EMBERS = { common: 10, uncommon: 30, rare: 100, epic: 400, legendary: 0 };

export default function Workshop() {
  const { collection, embers, disenchantCard } = useCardClash();
  const [tab, setTab] = useState('disenchant');
  const [selectedCards, setSelectedCards] = useState([]);
  const [craftTarget, setCraftTarget] = useState('uncommon');
  const [filterRarity, setFilterRarity] = useState('all');

  const filteredCollection = useMemo(() => {
    let cards = [...collection];
    if (filterRarity !== 'all') cards = cards.filter(c => c.rarity === filterRarity);
    return cards.sort((a, b) => (a.power || 0) - (b.power || 0));
  }, [collection, filterRarity]);

  const selectedTotal = useMemo(() => {
    return selectedCards.reduce((sum, id) => {
      const card = collection.find(c => c.id === id);
      return sum + (DISENCHANT_VALUES[card?.rarity] || 5);
    }, 0);
  }, [selectedCards, collection]);

  const toggleCard = (cardId) => {
    setSelectedCards(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handleDisenchantAll = () => {
    if (selectedCards.length === 0) return;
    const names = selectedCards.map(id => collection.find(c => c.id === id)?.godName).filter(Boolean).join(', ');
    if (confirm(`Disenchant ${selectedCards.length} cards (${names})?\nYou'll receive ${selectedTotal} Embers.`)) {
      selectedCards.forEach(id => disenchantCard(id));
      setSelectedCards([]);
    }
  };

  // Find cards that have 3+ copies (for upgrades)
  const upgradeGroups = useMemo(() => {
    const groups = {};
    collection.forEach(card => {
      const key = `${card.godName}-${card.rarity}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });
    return Object.entries(groups)
      .filter(([, cards]) => cards.length >= 3)
      .map(([key, cards]) => ({
        key,
        godName: cards[0].godName,
        rarity: cards[0].rarity,
        count: cards.length,
        cards,
        nextRarity: RARITY_ORDER[RARITY_ORDER.indexOf(cards[0].rarity) + 1],
        emberCost: UPGRADE_EMBERS[cards[0].rarity] || 0,
      }))
      .filter(g => g.nextRarity);
  }, [collection]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workshop</h1>
          <p className="text-sm text-gray-400">Disenchant, craft, and upgrade your cards</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Embers</div>
          <div className="text-xl font-bold text-orange-400">{embers.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {['disenchant', 'craft', 'upgrade'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedCards([]); }}
            className={`px-4 py-2 rounded text-sm font-bold capitalize transition-colors ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'disenchant' && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">
                  Select cards to disenchant. You'll receive Embers that can be used for crafting.
                </p>
                <div className="mt-2 text-sm">
                  {RARITY_ORDER.map(r => (
                    <span key={r} className="mr-4">
                      <span style={{ color: RARITIES[r]?.color }}>{RARITIES[r]?.name}</span>
                      <span className="text-gray-500"> = {DISENCHANT_VALUES[r]} Embers</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">{selectedCards.length} selected</div>
                <div className="text-lg font-bold text-orange-400">+{selectedTotal} Embers</div>
                <button
                  onClick={handleDisenchantAll}
                  disabled={selectedCards.length === 0}
                  className="mt-2 px-4 py-1.5 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  Disenchant Selected
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-1 mb-4">
            {['all', ...RARITY_ORDER].map(r => (
              <button
                key={r}
                onClick={() => setFilterRarity(r)}
                className={`px-2 py-1 text-xs rounded capitalize ${filterRarity === r ? 'bg-gold text-black font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {r}
              </button>
            ))}
          </div>

          {filteredCollection.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No cards to disenchant</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {filteredCollection.map(card => (
                <div
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  className={`cursor-pointer rounded-lg transition-all ${
                    selectedCards.includes(card.id) ? 'ring-2 ring-red-500 opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <GodCard card={card} size="small" />
                  <div className="text-center text-xs mt-1">
                    <span className="text-orange-400">{DISENCHANT_VALUES[card.rarity]} Embers</span>
                    {selectedCards.includes(card.id) && <span className="text-red-400 ml-2">Selected</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'craft' && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-400 mb-4">
              Spend Embers to craft a random card of a specific rarity. Targeted crafting (choosing a god) costs 2x.
            </p>
            <div className="grid grid-cols-5 gap-4">
              {RARITY_ORDER.map(rarity => {
                const cost = CRAFT_COSTS[rarity];
                const canAfford = embers >= cost;
                return (
                  <div
                    key={rarity}
                    className={`bg-gray-800 border rounded-lg p-4 text-center transition-colors ${
                      canAfford ? 'border-gray-600 hover:border-gray-500 cursor-pointer' : 'border-gray-800 opacity-50'
                    }`}
                  >
                    <div className="text-2xl mb-2" style={{ color: RARITIES[rarity]?.color }}>
                      {rarity === 'common' ? '*' : rarity === 'uncommon' ? '**' : rarity === 'rare' ? '***' : rarity === 'epic' ? '****' : '*****'}
                    </div>
                    <div className="font-bold text-white capitalize">{rarity}</div>
                    <div className="text-sm text-orange-400 font-bold mt-1">{cost} Embers</div>
                    <button
                      disabled={!canAfford}
                      className="mt-3 w-full px-3 py-1.5 bg-orange-600 text-white rounded text-sm font-bold hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      Craft Random
                    </button>
                    <button
                      disabled={embers < cost * 2}
                      className="mt-2 w-full px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
                    >
                      Targeted ({cost * 2})
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="font-bold text-white mb-2">Crafting Rates</h3>
            <div className="text-sm text-gray-400 space-y-1">
              <p>Random craft gives you a card of the selected rarity with random god, role, and power within that rarity's range.</p>
              <p>Targeted craft lets you choose a specific god but costs 2x Embers.</p>
              <p className="text-xs text-gray-600 mt-2">Disenchant 5 cards of a rarity to craft 1 of the same rarity (5:1 ratio)</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'upgrade' && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-400">
              Combine 3 copies of the same god and rarity + Embers to upgrade to the next rarity tier.
              The upgraded card keeps the highest power and level from the 3 source cards, plus a bonus.
            </p>
          </div>

          {upgradeGroups.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No upgrade paths available</p>
              <p className="text-sm mt-1">You need 3 copies of the same god at the same rarity to upgrade</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upgradeGroups.map(group => (
                <div key={group.key} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-6">
                  <div className="flex-1">
                    <div className="font-bold text-white">{group.godName}</div>
                    <div className="text-sm">
                      <span style={{ color: RARITIES[group.rarity]?.color }}>{RARITIES[group.rarity]?.name}</span>
                      <span className="text-gray-500 mx-2">→</span>
                      <span style={{ color: RARITIES[group.nextRarity]?.color }}>{RARITIES[group.nextRarity]?.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {group.count} copies available (3 required)
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-xs text-gray-400">Cost</div>
                    <div className="text-sm text-orange-400 font-bold">{group.emberCost} Embers</div>
                  </div>

                  <button
                    disabled={embers < group.emberCost}
                    className="px-4 py-2 bg-purple-600 text-white rounded font-bold text-sm hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    Upgrade
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
