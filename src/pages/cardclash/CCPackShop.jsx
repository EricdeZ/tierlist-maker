import { useState, useCallback, useEffect, useRef } from 'react';
import { useCardClash } from './CardClashContext';
import { usePassion } from '../../context/PassionContext';
import { PACKS, RARITIES } from '../../data/cardclash/economy';
import { ITEMS } from '../../data/cardclash/items';
import { CONSUMABLES } from '../../data/cardclash/buffs';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';
import CDChargeButton from './components/CDChargeButton';
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
  const pressure = Math.min((ratio - 1) / 4 * 100, 100)
  const needleAngle = -90 + (pressure / 100) * 180

  const getColor = (pct) => {
    if (pct < 25) return '#00e5ff'
    if (pct < 50) return '#b44aff'
    if (pct < 75) return '#ff2d78'
    return '#ef4444'
  }
  const color = getColor(pressure)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Rate Pressure</div>
      <div className="relative w-24 h-14 overflow-hidden">
        <svg viewBox="0 0 100 55" className="w-full h-full">
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="6" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 30 17" fill="none" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M 30 17 A 40 40 0 0 1 50 10" fill="none" stroke="#b44aff" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M 50 10 A 40 40 0 0 1 70 17" fill="none" stroke="#ff2d78" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M 70 17 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <g transform={`rotate(${needleAngle}, 50, 50)`} style={{ transition: 'transform 0.5s ease-out' }}>
            <line x1="50" y1="50" x2="50" y2="15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="50" r="3" fill={color} />
          </g>
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
// Core Conversion Panel
// ═══════════════════════════════════════════════
function CoreConversion({ ember, passion, onConvert }) {
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
    <div className="cd-panel cd-corners rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img src={emberIcon} alt="Cores" className="h-5 w-auto object-contain cd-icon-glow" />
          <span className="text-sm font-bold text-[var(--cd-cyan)] cd-head">Passion &rarr; Cores</span>
        </div>
        <GasValve
          conversionsToday={ember.conversionsToday}
          nextCost={ember.nextConversionCost}
          baseCost={50}
        />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-amber-400 tabular-nums cd-num">{ember.nextConversionCost}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Passion cost</div>
        </div>
        <svg className="w-5 h-5 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-1">
            <div className="text-2xl font-bold text-[var(--cd-cyan)] tabular-nums cd-num cd-text-glow">{ember.conversionEmberAmount}</div>
            <img src={emberIcon} alt="" className="h-4 w-auto object-contain" />
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Cores gained</div>
        </div>
      </div>

      {result ? (
        <div className="text-center py-1.5 text-sm cd-result-flash rounded-lg">
          <span className="text-[var(--cd-cyan)] font-bold cd-text-glow cd-num">+{result.emberGained}</span>
          <span className="text-white/60 ml-1">Cores received</span>
        </div>
      ) : (
        <button
          onClick={handleConvert}
          disabled={!canAfford || converting}
          className={`w-full py-2 rounded-lg font-bold text-sm cd-head tracking-wider ${
            canAfford
              ? 'cd-btn-solid cd-btn-action'
              : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cursor-not-allowed'
          }`}
        >
          {converting ? 'Converting...' : canAfford ? 'Convert' : `Need ${ember.nextConversionCost} Passion`}
        </button>
      )}

      {ember.conversionsToday > 0 && (
        <div className="text-[10px] text-white/30 text-center mt-2">
          {ember.conversionsToday} conversion{ember.conversionsToday !== 1 ? 's' : ''} today &mdash; rates reset at midnight UTC
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// Daily Core Claim
// ═══════════════════════════════════════════════
function DailyClaim({ ember, onClaim }) {
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
    <div className="cd-panel cd-corners rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <img src={emberIcon} alt="Cores" className="h-5 w-auto object-contain cd-icon-glow" />
        <span className="text-sm font-bold text-[var(--cd-cyan)] cd-head">Daily Cores</span>
        {ember.currentStreak > 0 && (
          <span className="ml-auto text-xs text-white/50">
            Streak: <span className="text-[var(--cd-cyan)] font-bold">{ember.currentStreak}</span>
          </span>
        )}
      </div>

      {ember.canClaimDaily && !claimResult ? (
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full py-2.5 rounded-lg font-bold text-sm cd-btn-solid cd-btn-action cd-head tracking-wider disabled:opacity-50"
        >
          {claiming ? 'Claiming...' : `Claim ${10 + Math.min((ember.currentStreak) * 1, 10)} Cores`}
        </button>
      ) : claimResult ? (
        <div className="text-center py-1.5 cd-result-flash rounded-lg">
          <div className="text-sm">
            <span className="text-[var(--cd-cyan)] font-bold cd-text-glow cd-num">+{claimResult.earned}</span>
            <span className="text-white/60 ml-1">Cores claimed!</span>
          </div>
          {claimResult.streakBonus > 0 && (
            <div className="text-xs text-[var(--cd-cyan)]/70 mt-0.5">
              includes +{claimResult.streakBonus} streak bonus
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-1.5 text-xs text-white/50">
          {countdown
            ? <>Next claim in <span className="text-[var(--cd-cyan)] font-mono font-medium tabular-nums">{countdown}</span></>
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
  const [focusedPack, setFocusedPack] = useState(null);
  const focused = focusedPack ? PACKS[focusedPack] : null;
  const focusedMeta = focusedPack ? PACK_META[focusedPack] : null;
  const focusedAfford = focused ? (testMode || emberBalance >= focused.cost) : false;
  const rowRef = useRef(null);
  const packRefs = useRef({});
  const [packOffset, setPackOffset] = useState({ x: 0, y: 0 });

  // Compute how far the selected pack needs to translate to reach viewport center
  useEffect(() => {
    if (!focusedPack || !packRefs.current[focusedPack]) {
      setPackOffset({ x: 0, y: 0 });
      return;
    }
    const packEl = packRefs.current[focusedPack];
    const packRect = packEl.getBoundingClientRect();
    const packCenterX = packRect.left + packRect.width / 2;
    const packCenterY = packRect.top + packRect.height / 2;
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    setPackOffset({
      x: viewportCenterX - packCenterX,
      y: viewportCenterY - packCenterY,
    });
  }, [focusedPack]);

  return (
    <div>
      {/* ═══ Pack Showcase ═══ */}
      <div
        className="relative py-8"
        style={{ minHeight: 420 }}
        onClick={() => focusedPack && setFocusedPack(null)}
      >
        {/* Packs row — always in place */}
        <div ref={rowRef} className="flex items-center justify-center gap-8 sm:gap-16">
          {LEAGUE_PACKS.map((key) => {
            const pack = PACKS[key];
            const meta = PACK_META[key];
            const isSelected = focusedPack === key;
            const isOther = focusedPack && !isSelected;
            const canAfford = testMode || emberBalance >= pack.cost;

            return (
              <div
                key={key}
                ref={(el) => { packRefs.current[key] = el; }}
                className="flex flex-col items-center cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedPack(isSelected ? null : key);
                }}
              >
                <div className="relative transition-all duration-500 ease-out"
                  style={{
                    transform: isSelected ? `translate(${packOffset.x}px, ${packOffset.y}px) scale(2.2)` : 'scale(1.15)',
                    zIndex: isSelected ? 20 : 1,
                    filter: isOther ? 'blur(4px)' : 'none',
                    opacity: isOther ? 0.25 : 1,
                    pointerEvents: isOther ? 'none' : undefined,
                  }}
                >
                  {/* Ambient glow */}
                  <div
                    className="absolute -inset-20 rounded-3xl transition-all duration-500"
                    style={{
                      background: `radial-gradient(ellipse, ${pack.color || 'var(--cd-cyan)'}40 0%, transparent 70%)`,
                      filter: `blur(${isSelected ? 80 : 0}px)`,
                      opacity: isSelected ? 0.7 : 0,
                    }}
                  />
                  {/* Pedestal glow */}
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-4 rounded-full transition-all duration-500"
                    style={{
                      background: pack.color || 'var(--cd-cyan)',
                      filter: 'blur(16px)',
                      opacity: isSelected ? 0.5 : 0,
                    }}
                  />
                  <div className={`transition-all duration-500 ease-out ${!canAfford && !isSelected ? 'opacity-40' : ''} ${!focusedPack ? 'group-hover:scale-110' : ''}`}
                  >
                    <PackArt tier={key} name={pack.name} subtitle={meta.subtitle} cardCount={pack.cards} seed={meta.seed} />
                  </div>
                </div>
                {/* Label */}
                <div className="transition-all duration-300 overflow-hidden"
                  style={{ maxHeight: focusedPack ? 0 : 30, opacity: focusedPack ? 0 : 1, marginTop: focusedPack ? 0 : 20 }}
                >
                  <span className="text-xs text-white/30 cd-head tracking-widest group-hover:text-white/50 transition-colors">
                    {meta.subtitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info panel — fixed to viewport, right of center */}
        <div
          className="fixed top-1/2 transition-all duration-500 ease-out"
          style={{
            left: '50%',
            marginLeft: 200,
            transform: `translateY(-50%) translateX(${focusedPack ? '0' : '40px'})`,
            opacity: focusedPack ? 1 : 0,
            pointerEvents: focusedPack ? undefined : 'none',
            zIndex: 30,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(focused || focusedPack) && (() => {
            const pack = focused || PACKS[LEAGUE_PACKS[0]];
            const meta = focusedMeta || PACK_META[LEAGUE_PACKS[0]];
            const afford = focusedAfford;
            return (
              <div className="cd-panel cd-corners rounded-xl p-6 lg:p-8 w-80 lg:w-96 relative overflow-hidden">
                <div className="cd-data-overlay" />
                <div className="relative z-1">
                  <h3 className="cd-head text-2xl font-bold mb-1" style={{ color: pack.color || 'var(--cd-cyan)', letterSpacing: '0.12em' }}>
                    {pack.name}
                  </h3>
                  <p className="text-xs text-white/40 cd-head tracking-widest mb-6">{meta?.subtitle}</p>

                  <div className="space-y-2.5 mb-8 text-[13px] text-white/60">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l4 6-10 13L2 9z" /></svg>
                      <span><span className="text-white font-bold">6</span> cards per pack</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
                      <span>1 guaranteed <span className="font-bold" style={{ color: pack.color }}>{pack.leagueName?.split(' ')[0]}</span> player</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-green-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                      <span>1 <span className="text-green-400 font-bold">Rare+</span> guaranteed slot</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" /></svg>
                      <span>1 <span className="text-[var(--cd-cyan)] font-bold">Wildcard</span> slot</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 mb-5">
                    <img src={emberIcon} alt="" className="h-6 w-auto object-contain cd-icon-glow" />
                    <span className="text-3xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{pack.cost}</span>
                    <span className="text-sm text-white/40 cd-head tracking-wider">Cores</span>
                  </div>

                  <CDChargeButton
                    label={afford ? `Open for ${pack.cost}` : `Need ${pack.cost} Cores`}
                    onFire={() => handleBuyPack(focusedPack)}
                    disabled={!afford || !!openResult}
                  />

                  <button
                    onClick={() => setFocusedPack(null)}
                    className="mt-5 text-[11px] text-white/20 cd-head tracking-widest hover:text-white/40 transition-colors cursor-pointer w-full text-center"
                  >
                    ← Back to packs
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ═══ Bottom UI — blurs when pack is focused ═══ */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          filter: focusedPack ? 'blur(6px)' : 'none',
          opacity: focusedPack ? 0.3 : 1,
          pointerEvents: focusedPack ? 'none' : undefined,
        }}
      >
        {/* Hint when nothing selected */}
        {!openResult && (
          <div className="text-center text-[11px] text-white/20 cd-head tracking-widest mb-8 -mt-2">
            {focusedPack ? '' : 'Select a pack to open'}
          </div>
        )}

        {/* ═══ Divider ═══ */}
        {!testMode && <div className="cd-divider max-w-lg mx-auto mb-8" />}

        {/* ═══ Core Economy Panel ═══ */}
        {!testMode && (
          <div className="max-w-md mx-auto mb-8">
            <div className="text-center mb-4">
              <h3 className="cd-head text-sm text-[var(--cd-text-mid)] tracking-widest">Get Cores</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 cd-stagger">
              <DailyClaim ember={ember} onClaim={claimEmberDaily} />
              <CoreConversion ember={ember} passion={passion} onConvert={convertPassionToEmber} />
            </div>
          </div>
        )}

        {/* Dev: test opening animation */}
        {testMode && (
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => testMixedPack('osl-mixed', 'OSL Pack')}
            className="cd-clip-tag px-4 py-1 text-xs font-bold cd-head tracking-wider cd-btn-magenta"
          >
            Test OSL
          </button>
          <button
            onClick={() => testMixedPack('bsl-mixed', 'BSL Pack')}
            className="cd-clip-tag px-4 py-1 text-xs font-bold cd-head tracking-wider cd-btn"
          >
            Test BSL
          </button>
          <button
            onClick={testAllRarities}
            className="cd-clip-tag px-4 py-1 text-xs font-bold cd-head tracking-wider bg-[var(--cd-purple)]/15 border border-[var(--cd-purple)]/30 text-[var(--cd-purple)] hover:bg-[var(--cd-purple)]/25 transition-all"
          >
            Test All Rarities
          </button>
          {lastTest && !openResult && (
            <>
              <button
                onClick={() => setOpenResult({ ...lastTest })}
                className="cd-clip-tag px-4 py-1 text-xs font-bold cd-head tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                Replay last
              </button>
              <button
                onClick={() => setOpenResult({ ...lastTest, _skipToStack: true })}
                className="cd-clip-tag px-4 py-1 text-xs font-bold cd-head tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                Skip to stack
              </button>
            </>
          )}
          </div>
        )}
      </div>

      {/* Loading overlay while buying pack */}
      {loading && !openResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="cd-spinner w-12 h-12" />
            <p className="text-sm text-[var(--cd-cyan)] font-semibold tracking-widest uppercase cd-head cd-text-glow">Opening pack...</p>
            <div className="w-48 h-1 rounded-full overflow-hidden bg-[var(--cd-edge)]">
              <div className="h-full cd-shimmer rounded-full" style={{ width: '100%' }} />
            </div>
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
