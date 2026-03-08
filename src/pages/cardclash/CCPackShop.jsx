import { useState, useCallback, useEffect } from 'react';
import { useCardClash } from './CardClashContext';
import { usePassion } from '../../context/PassionContext';
import { PACKS, RARITIES } from '../../data/cardclash/economy';
import { ITEMS } from '../../data/cardclash/items';
import { CONSUMABLES } from '../../data/cardclash/buffs';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';
import emberIcon from '../../assets/ember.png';

const LEAGUE_PACKS = ['osl-mixed', 'bsl-mixed']

const PACK_META = {
  'osl-mixed': { subtitle: 'Olympus League', seed: 5 },
  'bsl-mixed': { subtitle: 'Babylon League', seed: 6 },
};

// ═══════════════════════════════════════════════
// Gas Valve Gauge — shows conversion rate pressure
// ═══════════════════════════════════════════════
function GasValve({ conversionsToday, nextCost, baseCost }) {
  const ratio = nextCost / baseCost
  // 0 conversions = 0%, clamp at 100%
  const pressure = Math.min((ratio - 1) / 4 * 100, 100)
  // Needle angle: -90 (left/green) to 90 (right/red)
  const needleAngle = -90 + (pressure / 100) * 180

  const getColor = (pct) => {
    if (pct < 25) return '#22c55e'
    if (pct < 50) return '#eab308'
    if (pct < 75) return '#f97316'
    return '#ef4444'
  }
  const color = getColor(pressure)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Rate Pressure</div>
      <div className="relative w-24 h-14 overflow-hidden">
        {/* Gauge arc background */}
        <svg viewBox="0 0 100 55" className="w-full h-full">
          {/* Background arc */}
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="6" strokeLinecap="round" />
          {/* Colored arc segments */}
          <path d="M 10 50 A 40 40 0 0 1 30 17" fill="none" stroke="#22c55e" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M 30 17 A 40 40 0 0 1 50 10" fill="none" stroke="#eab308" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M 50 10 A 40 40 0 0 1 70 17" fill="none" stroke="#f97316" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M 70 17 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          {/* Needle */}
          <g transform={`rotate(${needleAngle}, 50, 50)`} style={{ transition: 'transform 0.5s ease-out' }}>
            <line x1="50" y1="50" x2="50" y2="15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="50" r="3" fill={color} />
          </g>
          {/* Center dot */}
          <circle cx="50" cy="50" r="2" fill="white" fillOpacity="0.8" />
        </svg>
      </div>
      <div className="text-xs font-bold tabular-nums" style={{ color }}>
        {conversionsToday === 0 ? 'Base rate' : `${ratio.toFixed(1)}x cost`}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Ember Conversion Panel
// ═══════════════════════════════════════════════
function EmberConversion({ ember, passion, onConvert }) {
  const [converting, setConverting] = useState(false)
  const [result, setResult] = useState(null)
  const canAfford = passion >= ember.nextConversionCost

  const handleConvert = async () => {
    setConverting(true)
    setResult(null)
    try {
      const res = await onConvert()
      setResult(res)
      setTimeout(() => setResult(null), 3000)
    } catch (err) {
      // error handled by context
    }
    setConverting(false)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img src={emberIcon} alt="Ember" className="h-5 w-auto object-contain" />
          <span className="text-sm font-bold text-orange-400">Passion → Ember</span>
        </div>
        <GasValve
          conversionsToday={ember.conversionsToday}
          nextCost={ember.nextConversionCost}
          baseCost={50}
        />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-amber-400 tabular-nums">{ember.nextConversionCost}</div>
          <div className="text-[10px] text-white/40 uppercase">Passion cost</div>
        </div>
        <svg className="w-5 h-5 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-1">
            <div className="text-2xl font-bold text-orange-400 tabular-nums">{ember.conversionEmberAmount}</div>
            <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
          </div>
          <div className="text-[10px] text-white/40 uppercase">Ember gained</div>
        </div>
      </div>

      {result ? (
        <div className="text-center py-1.5 text-sm">
          <span className="text-orange-400 font-bold">+{result.emberGained}</span>
          <span className="text-white/60 ml-1">Ember received</span>
        </div>
      ) : (
        <button
          onClick={handleConvert}
          disabled={!canAfford || converting}
          className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${
            canAfford
              ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:from-orange-500 hover:to-orange-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {converting ? 'Converting...' : canAfford ? 'Convert' : `Need ${ember.nextConversionCost} Passion`}
        </button>
      )}

      {ember.conversionsToday > 0 && (
        <div className="text-[10px] text-white/30 text-center mt-2">
          {ember.conversionsToday} conversion{ember.conversionsToday !== 1 ? 's' : ''} today — rates reset at midnight UTC
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// Ember Daily Claim
// ═══════════════════════════════════════════════
function EmberDailyClaim({ ember, onClaim }) {
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState(null)
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    if (ember.canClaimDaily || !ember.lastDailyClaim) {
      setCountdown('')
      return
    }
    const tick = () => {
      const now = new Date()
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const diff = tomorrow - now
      if (diff <= 0) { setCountdown(''); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [ember.canClaimDaily, ember.lastDailyClaim])

  const handleClaim = async () => {
    setClaiming(true)
    const result = await onClaim()
    setClaiming(false)
    if (result && !result.alreadyClaimed) {
      setClaimResult(result)
      setTimeout(() => setClaimResult(null), 4000)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <img src={emberIcon} alt="Ember" className="h-5 w-auto object-contain" />
        <span className="text-sm font-bold text-orange-400">Daily Ember</span>
        {ember.currentStreak > 0 && (
          <span className="ml-auto text-xs text-white/50">
            Streak: <span className="text-orange-400 font-bold">{ember.currentStreak}</span>
          </span>
        )}
      </div>

      {ember.canClaimDaily && !claimResult ? (
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full py-2.5 rounded-lg font-bold text-sm transition-all bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-500 hover:to-amber-400 disabled:opacity-50"
        >
          {claiming ? 'Claiming...' : `Claim ${10 + Math.min((ember.currentStreak) * 1, 10)} Ember`}
        </button>
      ) : claimResult ? (
        <div className="text-center py-1.5">
          <div className="text-sm">
            <span className="text-orange-400 font-bold">+{claimResult.earned}</span>
            <span className="text-white/60 ml-1">Ember claimed!</span>
          </div>
          {claimResult.streakBonus > 0 && (
            <div className="text-xs text-orange-400/70 mt-0.5">
              includes +{claimResult.streakBonus} streak bonus
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-1.5 text-xs text-white/50">
          {countdown
            ? <>Next claim in <span className="text-orange-400 font-mono font-medium tabular-nums">{countdown}</span></>
            : 'Come back tomorrow!'
          }
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// Main Pack Shop
// ═══════════════════════════════════════════════
export default function PackShop() {
  const { passion, ember, buyPack, testMode, convertPassionToEmber } = useCardClash();
  const { claimEmberDaily } = usePassion();
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
    const result = { cards: fakeCards, packName: 'All Rarities Test', packType: 'osl-mixed', _skipToStack: true };
    setLastTest(result);
    setOpenResult(result);
  }, []);

  const testMixedPack = useCallback((packType, packName) => {
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
      const g = godNames[Math.floor(Math.random() * godNames.length)];
      return { cardType: 'god', godName: g, godClass: 'Mage', imageUrl: godUrl(g),
        ability: { name: 'Test Ability', description: 'A test ability.' },
        godId: Math.floor(Math.random() * 100), serialNumber: 3000 + order,
        rarity, isNew: true, _revealOrder: order };
    };

    const playerSlot = Math.floor(Math.random() * 5);
    const rareRarities = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const base = [];
    for (let i = 0; i < 6; i++) {
      const rarity = i === 4
        ? rareRarities[Math.floor(Math.random() * rareRarities.length)]
        : rarityKeys[Math.floor(Math.random() * (i === 5 ? 6 : 3))];
      let type;
      if (i === playerSlot) type = 'player';
      else if (i === 5) type = allTypes[Math.floor(Math.random() * 4)];
      else type = nonPlayerTypes[Math.floor(Math.random() * 3)];
      base.push(makeCard(type, rarity, i));
    }

    const result = { cards: base, packName: packName || 'Mixed Pack', packType: packType || 'mixed', _skipTear: true };
    setLastTest(result);
    setOpenResult(result);
  }, []);

  const emberBalance = ember?.balance ?? 0;

  return (
    <div>
      {/* ═══ Ember Balance Bar ═══ */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="flex items-center gap-2 bg-white/5 border border-orange-500/20 rounded-xl px-4 py-2">
          <img src={emberIcon} alt="Ember" className="h-6 w-auto object-contain" />
          <span className="text-lg font-bold text-orange-400 tabular-nums">{emberBalance}</span>
          <span className="text-xs text-white/40">Ember</span>
        </div>
        {!testMode && (
          <div className="text-xs text-white/30">
            Passion: <span className="text-amber-400 font-bold">{passion.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ═══ League Packs ═══ */}
      <div className="flex justify-center gap-10 mb-8">
        {LEAGUE_PACKS.map((key) => {
          const pack = PACKS[key];
          const meta = PACK_META[key];
          const canAfford = testMode || emberBalance >= pack.cost;
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
                  <div className="text-xs text-white/60">
                    6 cards &middot; 1 <span style={{ color: pack.color }}>{pack.leagueName?.split(' ')[0]}</span> player &middot; random mix
                  </div>
                  <div className="text-xs text-white/60">
                    <span className="text-green-400">Uncommon+</span> rare slot &middot; <span className="text-amber-400">Wildcard</span> finale
                  </div>
                </div>

                <button
                  disabled={!canAfford || !!openResult}
                  className={`px-5 py-1.5 rounded font-bold text-sm flex items-center gap-1.5 mx-auto ${
                    canAfford ? 'bg-orange-500 text-black hover:bg-orange-400' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
                  {canAfford ? `${pack.cost} Ember` : 'Need more'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Current balance ═══ */}
      <div className="text-center text-sm text-gray-400 mb-6">
        {testMode
          ? <span className="text-amber-400 font-bold">Test Mode -- All packs free!</span>
          : <span className="flex items-center justify-center gap-1.5">
              <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
              <span className="text-orange-400 font-bold">{emberBalance} Ember</span>
            </span>
        }
      </div>

      {/* ═══ Ember Economy Panel ═══ */}
      {!testMode && (
        <div className="max-w-sm mx-auto space-y-3 mb-8">
          <EmberDailyClaim ember={ember} onClaim={claimEmberDaily} />
          <EmberConversion ember={ember} passion={passion} onConvert={convertPassionToEmber} />
        </div>
      )}

      {/* Dev: test opening animation */}
      {testMode && (
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => testMixedPack('osl-mixed', 'OSL Pack')}
            className="px-3 py-1 text-xs bg-yellow-600/30 border border-yellow-500/40 rounded text-yellow-300 hover:bg-yellow-600/50 font-bold"
          >
            Test OSL
          </button>
          <button
            onClick={() => testMixedPack('bsl-mixed', 'BSL Pack')}
            className="px-3 py-1 text-xs bg-sky-600/30 border border-sky-500/40 rounded text-sky-300 hover:bg-sky-600/50 font-bold"
          >
            Test BSL
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
            <div className="w-10 h-10 border-3 border-white/20 border-t-orange-400 rounded-full animate-spin" />
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
