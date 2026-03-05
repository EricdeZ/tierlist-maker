import { useState, useCallback } from 'react';
import { useCardClash } from './CardClashContext';
import { PACKS, RARITIES } from '../../data/cardclash/economy';
import GodCard from './components/GodCard';

const PACK_STYLES = {
  standard: { gradient: 'from-gray-600 to-gray-800', glow: 'shadow-gray-500/20', icon: '📦' },
  premium: { gradient: 'from-blue-600 to-blue-900', glow: 'shadow-blue-500/20', icon: '💎' },
  elite: { gradient: 'from-purple-600 to-purple-900', glow: 'shadow-purple-500/20', icon: '👑' },
  legendary: { gradient: 'from-amber-500 to-orange-700', glow: 'shadow-amber-500/30', icon: '🔥' },
};

export default function PackShop() {
  const { passion, buyPack, testMode } = useCardClash();
  const [openResult, setOpenResult] = useState(null);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [isOpening, setIsOpening] = useState(false);

  const handleBuyPack = useCallback(async (packType) => {
    try {
      const result = await buyPack(packType);
      if (!result) return;

      setIsOpening(true);
      setOpenResult(result);
      setRevealIndex(-1);

      // Auto-reveal cards one by one
      let i = 0;
      const interval = setInterval(() => {
        setRevealIndex(i);
        i++;
        if (i >= result.cards.length) {
          clearInterval(interval);
          setIsOpening(false);
        }
      }, 600);
    } catch (err) {
      alert(err.message || 'Failed to open pack');
    }
  }, [buyPack]);

  const closeResult = () => {
    setOpenResult(null);
    setRevealIndex(-1);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Pack Shop</h1>
      <p className="text-sm text-gray-400 mb-8">Spend Passion to open card packs. Better packs guarantee rarer cards.</p>

      {/* Pack options */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {Object.entries(PACKS).map(([key, pack]) => {
          const style = PACK_STYLES[key];
          const canAfford = testMode || passion >= pack.cost;

          return (
            <div
              key={key}
              className={`bg-gradient-to-b ${style.gradient} rounded-xl overflow-hidden border border-white/10 shadow-xl ${style.glow} ${
                canAfford ? 'hover:scale-[1.02] transition-transform cursor-pointer' : 'opacity-50'
              }`}
              onClick={() => canAfford && !isOpening && handleBuyPack(key)}
            >
              <div className="p-6 text-center">
                <div className="text-4xl mb-3">{style.icon}</div>
                <h2 className="text-lg font-bold text-white">{pack.name}</h2>
                <p className="text-sm text-white/60 mt-1">{pack.cards} cards</p>

                <div className="mt-3 space-y-1">
                  {pack.guarantees.map((g, i) => (
                    <div key={i} className="text-xs text-white/80">
                      {g.count}x <span style={{ color: RARITIES[g.minRarity]?.color }}>{RARITIES[g.minRarity]?.name}+</span> guaranteed
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black/30 px-4 py-3 flex justify-between items-center border-t border-white/10">
                <span className="text-amber-400 font-bold">{pack.cost} Passion</span>
                <button
                  disabled={!canAfford || isOpening}
                  className={`px-4 py-1.5 rounded font-bold text-sm ${
                    canAfford ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {canAfford ? 'Buy' : 'Need more'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current balance */}
      <div className="text-center text-sm text-gray-400">
        {testMode
          ? <span className="text-amber-400 font-bold">Test Mode — All packs free!</span>
          : <>Your balance: <span className="text-amber-400 font-bold">{passion.toLocaleString()} Passion</span></>
        }
      </div>

      {/* Pack opening overlay */}
      {openResult && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={revealIndex >= openResult.cards.length - 1 ? closeResult : undefined}>
          <div className="text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-2">{openResult.packName}</h2>
            <p className="text-sm text-gray-400 mb-6">{isOpening ? 'Revealing...' : 'Click anywhere to close'}</p>

            <div className="flex gap-4 justify-center flex-wrap max-w-4xl">
              {openResult.cards.map((card, i) => (
                <div
                  key={card.id}
                  className={`transition-all duration-500 ${
                    i <= revealIndex
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-75 translate-y-8'
                  }`}
                >
                  {i <= revealIndex ? (
                    <div className="animate-[bounce_0.5s_ease-in-out]">
                      <GodCard card={card} />
                    </div>
                  ) : (
                    <div className="w-52 h-72 bg-gray-800 rounded-lg border-2 border-gray-700 flex items-center justify-center">
                      <span className="text-4xl">?</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isOpening && (
              <button
                onClick={closeResult}
                className="mt-8 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
