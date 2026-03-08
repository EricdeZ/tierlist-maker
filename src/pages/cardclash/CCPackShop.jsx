import { useState, useCallback } from 'react';
import { useCardClash } from './CardClashContext';
import { PACKS, RARITIES } from '../../data/cardclash/economy';
import { ITEMS } from '../../data/cardclash/items';
import { CONSUMABLES } from '../../data/cardclash/buffs';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';

const RARITY_PACKS = ['standard', 'premium', 'elite', 'legendary']

const PACK_META = {
  standard: { subtitle: 'Basic Collection', seed: 0 },
  premium: { subtitle: 'Enhanced Drops', seed: 1 },
  elite: { subtitle: 'Rare Guaranteed', seed: 2 },
  legendary: { subtitle: 'The Ultimate Pull', seed: 3 },
  mixed: { subtitle: 'Gods, Items & Players', seed: 4 },
};

export default function PackShop() {
  const { passion, buyPack, testMode } = useCardClash();
  const [openResult, setOpenResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuyPack = useCallback(async (packType) => {
    try {
      setLoading(true);
      const result = await buyPack(packType);
      if (!result) { setLoading(false); return; }
      setOpenResult({ ...result, packType });
      setLoading(false);
    } catch (err) {
      setLoading(false);
      alert(err.message || 'Failed to open pack');
    }
  }, [buyPack]);

  const [lastTest, setLastTest] = useState(null);
  const closeResult = () => setOpenResult(null);

  const godNames = ['Zeus', 'Athena', 'Anubis', 'Thor', 'Hecate', 'Bellona', 'Ares', 'Medusa'];
  const godUrl = (name) => `https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods/${name}/Default/t_GodCard_${name}.png`;

  const testOpening = useCallback((packType = 'premium') => {
    const pack = PACKS[packType];
    const rarityKeys = Object.keys(RARITIES);
    const fakeCards = Array.from({ length: pack.cards }, (_, i) => ({
      godName: godNames[i % 8],
      godClass: 'Mage',
      imageUrl: godUrl(godNames[i % 8]),
      ability: { name: 'Test Ability', description: 'A test ability.' },
      godId: i + 1,
      serialNumber: 1000 + i,
      rarity: i === 0 ? 'legendary' : i === 1 ? 'epic' : i < 4 ? 'rare' : rarityKeys[Math.floor(Math.random() * 3)],
      isNew: i < 3,
    }));
    const result = { cards: fakeCards, packName: pack.name, packType, _skipTear: true };
    setLastTest(result);
    setOpenResult(result);
  }, []);

  const testAllRarities = useCallback(() => {
    const allRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const fakeCards = allRarities.map((rarity, i) => ({
      godName: godNames[i],
      godClass: ['Mage', 'Warrior', 'Hunter', 'Guardian', 'Assassin', 'Mage'][i],
      imageUrl: godUrl(godNames[i]),
      ability: { name: `${RARITIES[rarity].name} Ability`, description: `A ${rarity} test ability.` },
      godId: i + 1,
      serialNumber: 2000 + i,
      rarity,
      isNew: true,
    }));
    const result = { cards: fakeCards, packName: 'All Rarities Test', packType: 'legendary', _skipToStack: true };
    setLastTest(result);
    setOpenResult(result);
  }, []);

  const testMixedPack = useCallback(() => {
    const rarityKeys = Object.keys(RARITIES);
    const nonPlayerTypes = ['god', 'item', 'consumable'];
    const allTypes = ['god', 'item', 'consumable', 'player'];

    const makeCard = (type, rarity, order) => {
      if (type === 'player') {
        return { cardType: 'player', godName: 'TestPlayer', godClass: 'ADC',
          imageUrl: '', cardData: { role: 'ADC', teamName: 'Test Team', teamColor: '#6366f1' },
          godId: 'player-test', serialNumber: 3000 + order, rarity, isNew: true, _revealOrder: order };
      }
      if (type === 'item') {
        const pick = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        return { cardType: 'item', godName: pick.name, godClass: pick.category,
          imageUrl: pick.imageKey ? `https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75/${pick.imageKey}.png` : '',
          cardData: { category: pick.category, manaCost: pick.manaCost, effects: pick.effects, passive: pick.passive },
          godId: `item-${pick.id}`, serialNumber: 3000 + order, rarity, isNew: true, _revealOrder: order };
      }
      if (type === 'consumable') {
        const pick = CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)];
        return { cardType: 'consumable', godName: pick.name, godClass: 'Consumable',
          imageUrl: pick.imageUrl || '', cardData: { color: pick.color, description: pick.description, manaCost: pick.manaCost },
          godId: `con-${pick.id}`, serialNumber: 3000 + order, rarity, isNew: true, _revealOrder: order };
      }
      // god
      const g = godNames[Math.floor(Math.random() * godNames.length)];
      return { cardType: 'god', godName: g, godClass: 'Mage', imageUrl: godUrl(g),
        ability: { name: 'Test Ability', description: 'A test ability.' },
        godId: Math.floor(Math.random() * 100), serialNumber: 3000 + order,
        rarity, isNew: true, _revealOrder: order };
    };

    // Slots 1-4: 1 player + 3 random type, shuffled
    const base = [
      makeCard('player', rarityKeys[Math.floor(Math.random() * 3)], 0),
      makeCard(nonPlayerTypes[Math.floor(Math.random() * 3)], rarityKeys[Math.floor(Math.random() * 3)], 1),
      makeCard(nonPlayerTypes[Math.floor(Math.random() * 3)], rarityKeys[Math.floor(Math.random() * 3)], 2),
      makeCard(nonPlayerTypes[Math.floor(Math.random() * 3)], rarityKeys[Math.floor(Math.random() * 3)], 3),
    ];
    // Shuffle and reassign order
    for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
    base.forEach((c, i) => { c._revealOrder = i; });

    // Slot 5: uncommon+ guaranteed, random type
    const rareType = allTypes[Math.floor(Math.random() * 4)];
    const rareRarities = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    base.push(makeCard(rareType, rareRarities[Math.floor(Math.random() * rareRarities.length)], 4));

    // Slot 6: wildcard — any type, any rarity
    const wcType = allTypes[Math.floor(Math.random() * 4)];
    base.push(makeCard(wcType, rarityKeys[Math.floor(Math.random() * 6)], 5));

    const result = { cards: base, packName: 'Mixed Pack', packType: 'mixed', _skipTear: true };
    setLastTest(result);
    setOpenResult(result);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Pack Shop</h1>
      <p className="text-sm text-gray-400 mb-8">Spend Passion to open card packs. Better packs guarantee rarer cards.</p>

      {/* Rarity Packs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 justify-items-center">
        {RARITY_PACKS.map((key) => {
          const pack = PACKS[key];
          const meta = PACK_META[key];
          const canAfford = testMode || passion >= pack.cost;

          return (
            <div
              key={key}
              className={`flex flex-col items-center gap-4 ${
                canAfford ? 'cursor-pointer group' : 'opacity-50'
              }`}
              onClick={() => canAfford && !openResult && handleBuyPack(key)}
            >
              <PackArt
                tier={key}
                name={pack.name}
                subtitle={meta.subtitle}
                cardCount={pack.cards}
                seed={meta.seed}
              />

              <div className="text-center">
                <div className="space-y-0.5 mb-2">
                  {pack.guarantees.map((g, i) => (
                    <div key={i} className="text-xs text-white/60">
                      {g.count}x <span style={{ color: RARITIES[g.minRarity]?.color }}>{RARITIES[g.minRarity]?.name}+</span> guaranteed
                    </div>
                  ))}
                </div>

                <button
                  disabled={!canAfford || !!openResult}
                  className={`px-5 py-1.5 rounded font-bold text-sm ${
                    canAfford ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {canAfford ? `${pack.cost} Passion` : 'Need more'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mixed Packs */}
      <div className="border-t border-white/10 pt-8 mb-8">
        <h2 className="text-lg font-bold mb-1 text-center">Mixed Packs</h2>
        <p className="text-xs text-gray-500 mb-6 text-center">Cards of every type — gods, items, consumables, and real player cards</p>
        <div className="flex justify-center">
          {(() => {
            const pack = PACKS.mixed;
            const meta = PACK_META.mixed;
            const canAfford = testMode || passion >= pack.cost;
            return (
              <div
                className={`flex flex-col items-center gap-4 ${
                  canAfford ? 'cursor-pointer group' : 'opacity-50'
                }`}
                onClick={() => canAfford && !openResult && handleBuyPack('mixed')}
              >
                <PackArt
                  tier="mixed"
                  name={pack.name}
                  subtitle={meta.subtitle}
                  cardCount={pack.cards}
                  seed={meta.seed}
                />

                <div className="text-center">
                  <div className="space-y-0.5 mb-2">
                    <div className="text-xs text-white/60">
                      6 cards &middot; 1 guaranteed <span className="text-violet-400">Player</span> &middot; random mix of types
                    </div>
                    <div className="text-xs text-white/60">
                      <span className="text-green-400">Uncommon+</span> rare slot &middot; <span className="text-amber-400">Wildcard</span> finale
                    </div>
                  </div>

                  <button
                    disabled={!canAfford || !!openResult}
                    className={`px-5 py-1.5 rounded font-bold text-sm ${
                      canAfford ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? `${pack.cost} Passion` : 'Need more'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Current balance */}
      <div className="text-center text-sm text-gray-400">
        {testMode
          ? <span className="text-amber-400 font-bold">Test Mode -- All packs free!</span>
          : <>Your balance: <span className="text-amber-400 font-bold">{passion.toLocaleString()} Passion</span></>
        }
      </div>

      {/* Dev: test opening animation */}
      {testMode && (
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          {RARITY_PACKS.map(key => (
            <button
              key={key}
              onClick={() => testOpening(key)}
              className="px-3 py-1 text-xs bg-purple-600/30 border border-purple-500/40 rounded text-purple-300 hover:bg-purple-600/50"
            >
              Test {key}
            </button>
          ))}
          <button
            onClick={testMixedPack}
            className="px-3 py-1 text-xs bg-indigo-600/30 border border-indigo-500/40 rounded text-indigo-300 hover:bg-indigo-600/50 font-bold"
          >
            Test Mixed
          </button>
          <button
            onClick={testAllRarities}
            className="px-3 py-1 text-xs bg-red-600/30 border border-red-500/40 rounded text-red-300 hover:bg-red-600/50 font-bold"
          >
            Test All Rarities
          </button>
          {lastTest && !openResult && (
            <>
              <button
                onClick={() => setOpenResult({ ...lastTest })}
                className="px-3 py-1 text-xs bg-amber-600/30 border border-amber-500/40 rounded text-amber-300 hover:bg-amber-600/50"
              >
                Replay last
              </button>
              <button
                onClick={() => setOpenResult({ ...lastTest, _skipToStack: true })}
                className="px-3 py-1 text-xs bg-green-600/30 border border-green-500/40 rounded text-green-300 hover:bg-green-600/50"
              >
                Skip to stack
              </button>
            </>
          )}
        </div>
      )}

      {/* Loading overlay while buying pack */}
      {loading && !openResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-white/20 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-sm text-white/60 font-semibold tracking-widest uppercase">Opening pack...</p>
          </div>
        </div>
      )}

      {/* Pack opening ceremony */}
      {openResult && (
        <PackOpening
          result={openResult}
          packType={openResult.packType}
          onClose={closeResult}
          onOpenMore={closeResult}
          skipTear={openResult._skipTear}
          skipToStack={openResult._skipToStack}
          onReplay={(openResult._skipTear || openResult._skipToStack) ? () => {
            const flags = openResult._skipToStack ? { _skipToStack: true } : { _skipTear: true };
            setOpenResult(null);
            setTimeout(() => setOpenResult({ ...lastTest, ...flags }), 50);
          } : undefined}
        />
      )}
    </div>
  );
}
