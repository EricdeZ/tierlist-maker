import { useState, useMemo } from 'react';
import { useCardClash } from './CardClashContext';
import { RARITIES } from '../../data/cardclash/economy';
import { estimateValue } from './economy/Marketplace';

const TABS = ['browse', 'my-listings', 'trades'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low' },
  { value: 'price-high', label: 'Price: High' },
  { value: 'power', label: 'Power' },
  { value: 'rarity', label: 'Rarity' },
];

// Simulated marketplace listings (will be replaced by API)
function generateFakeListings(count = 20) {
  const names = ['Zeus', 'Thor', 'Ra', 'Loki', 'Athena', 'Ymir', 'Anubis', 'Bellona', 'Thanatos', 'Khepri', 'Scylla', 'Ares', 'Neith', 'Guan Yu', 'Poseidon'];
  const roles = ['solo', 'jungle', 'mid', 'support', 'adc'];
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const classes = ['Warrior', 'Assassin', 'Mage', 'Guardian', 'Hunter'];

  return Array.from({ length: count }, (_, i) => {
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const power = rarity === 'legendary' ? 85 + Math.floor(Math.random() * 15)
      : rarity === 'epic' ? 70 + Math.floor(Math.random() * 15)
      : rarity === 'rare' ? 55 + Math.floor(Math.random() * 15)
      : rarity === 'uncommon' ? 40 + Math.floor(Math.random() * 15)
      : 20 + Math.floor(Math.random() * 20);

    return {
      id: `listing-${i}`,
      cardId: `fake-${i}`,
      godName: names[Math.floor(Math.random() * names.length)],
      godClass: classes[Math.floor(Math.random() * classes.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      rarity,
      power,
      level: Math.ceil(power / 25),
      price: Math.floor(estimateValue({ rarity, power, level: Math.ceil(power / 25) }) * (0.8 + Math.random() * 0.6)),
      seller: `Player${1000 + Math.floor(Math.random() * 9000)}`,
      listedAt: Date.now() - Math.floor(Math.random() * 86400000 * 7),
    };
  });
}

export default function Marketplace() {
  const { passion, collection, testMode } = useCardClash();
  const [tab, setTab] = useState('browse');
  const [sortBy, setSortBy] = useState('newest');
  const [filterRole, setFilterRole] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedListing, setSelectedListing] = useState(null);
  const [listingCard, setListingCard] = useState(null);
  const [listingPrice, setListingPrice] = useState('');

  // Fake listings for demo
  const [listings] = useState(() => generateFakeListings(30));
  const [myListings] = useState([]);
  const [trades] = useState([]);

  const filtered = useMemo(() => {
    let items = [...listings];
    if (filterRole !== 'all') items = items.filter(l => l.role === filterRole);
    if (filterRarity !== 'all') items = items.filter(l => l.rarity === filterRarity);
    if (search) items = items.filter(l => l.godName.toLowerCase().includes(search.toLowerCase()));

    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    switch (sortBy) {
      case 'price-low': items.sort((a, b) => a.price - b.price); break;
      case 'price-high': items.sort((a, b) => b.price - a.price); break;
      case 'power': items.sort((a, b) => b.power - a.power); break;
      case 'rarity': items.sort((a, b) => (rarityOrder[a.rarity] || 4) - (rarityOrder[b.rarity] || 4)); break;
      default: items.sort((a, b) => b.listedAt - a.listedAt);
    }
    return items;
  }, [listings, sortBy, filterRole, filterRarity, search]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-gray-400">Buy, sell, and trade cards with other players</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Balance</div>
          <div className="text-xl font-bold text-amber-400">{passion.toLocaleString()} Passion</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-bold capitalize transition-colors ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
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
              {['all', 'solo', 'jungle', 'mid', 'support', 'adc'].map(role => (
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
              {['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'].map(r => (
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

          {/* Listings grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {filtered.map(listing => (
              <div
                key={listing.id}
                onClick={() => setSelectedListing(listing.id === selectedListing ? null : listing.id)}
                className={`bg-gray-900 border rounded-lg overflow-hidden cursor-pointer transition-colors ${
                  listing.id === selectedListing ? 'border-gold' : 'border-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-white">{listing.godName}</div>
                      <div className="text-xs text-gray-500">{listing.godClass} - {listing.role}</div>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${RARITIES[listing.rarity]?.color}20`, color: RARITIES[listing.rarity]?.color }}
                    >
                      {RARITIES[listing.rarity]?.name}
                    </span>
                  </div>

                  <div className="flex gap-3 text-sm mb-3">
                    <div className="bg-gray-800 rounded px-2 py-1">
                      <span className="text-orange-400 font-bold">{listing.power}</span>
                      <span className="text-gray-500 text-xs ml-1">PWR</span>
                    </div>
                    <div className="bg-gray-800 rounded px-2 py-1">
                      <span className="text-yellow-400 font-bold">Lv.{listing.level}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-amber-400 font-bold">{listing.price.toLocaleString()} P</div>
                    <button
                      onClick={e => { e.stopPropagation(); }}
                      disabled={passion < listing.price}
                      className={`px-3 py-1 rounded text-sm font-bold ${
                        passion >= listing.price
                          ? 'bg-amber-500 text-black hover:bg-amber-400'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Buy
                    </button>
                  </div>

                  <div className="text-[10px] text-gray-600 mt-2">
                    Listed by {listing.seller} - {new Date(listing.listedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No listings match your filters</p>
            </div>
          )}
        </>
      )}

      {tab === 'my-listings' && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">List a Card for Sale</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1">Select Card</label>
                <select
                  value={listingCard || ''}
                  onChange={e => setListingCard(e.target.value || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="">Choose a card...</option>
                  {collection.map(card => (
                    <option key={card.id} value={card.id}>
                      {card.godName} - {RARITIES[card.rarity]?.name} - Power {card.power}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="text-sm text-gray-400 block mb-1">Price (Passion)</label>
                <input
                  type="number"
                  value={listingPrice}
                  onChange={e => setListingPrice(e.target.value)}
                  placeholder="100"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                disabled={!listingCard || !listingPrice}
                className="px-4 py-2 bg-amber-500 text-black font-bold rounded hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                List for Sale
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">5% marketplace fee applies on successful sale</p>
          </div>

          {myListings.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No active listings</p>
              <p className="text-sm mt-1">List a card above to start selling</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myListings.map(listing => (
                <div key={listing.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white">{listing.godName}</span>
                    <span className="text-gray-500 ml-2">{listing.price} Passion</span>
                  </div>
                  <button className="px-3 py-1 bg-red-900/30 text-red-400 rounded text-sm hover:bg-red-900/50">Cancel</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'trades' && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-2">Trade Offers</h3>
            <p className="text-sm text-gray-400">Send and receive card trade offers with other players</p>
          </div>

          {trades.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No active trades</p>
              <p className="text-sm mt-1">Trade offers from other players will appear here</p>
              <p className="text-xs mt-4 text-gray-600">Trading requires server connectivity (coming soon)</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trades.map(trade => (
                <div key={trade.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  {trade.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
