import { lazy, Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useCardClash } from './CardClashContext';
import { usePassion } from '../../context/PassionContext';
import { PACKS } from '../../data/cardclash/economy';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';
import CDChargeButton from './components/CDChargeButton';
import emberIcon from '../../assets/ember.png';

const CCPackSale = lazy(() => import('./CCPackSale'));

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
// Top-level toggle — SHOP vs LIMITED SALE
// ═══════════════════════════════════════════════
export default function PackShopRouter() {
  const [mode, setMode] = useState('shop');
  return (
    <>
      <div className="flex justify-center gap-2 mb-4 relative z-40">
        <button
          onClick={() => setMode('shop')}
          className={`px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'shop'
              ? 'bg-white/10 text-white border-white/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 14, letterSpacing: '0.2em' }}
        >
          SHOP
        </button>
        <button
          onClick={() => setMode('sale')}
          className={`px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'sale'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 14, letterSpacing: '0.2em' }}
        >
          LIMITED SALE
        </button>
      </div>
      {mode === 'shop' ? (
        <PackShop />
      ) : (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="cd-spinner w-8 h-8" /></div>}>
          <CCPackSale />
        </Suspense>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// Main Pack Shop (original)
// ═══════════════════════════════════════════════
function PackShop() {
  const { passion, ember, buyPack, convertPassionToEmber } = useCardClash();
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

  const closeResult = () => setOpenResult(null);

  const emberBalance = ember?.balance ?? 0;
  const [focusedPack, setFocusedPack] = useState(null);
  const focused = focusedPack ? PACKS[focusedPack] : null;
  const focusedMeta = focusedPack ? PACK_META[focusedPack] : null;
  const focusedAfford = focused ? emberBalance >= focused.cost : false;
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
            const canAfford = emberBalance >= pack.cost;

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
        <div className="cd-divider max-w-lg mx-auto mb-8" />

        {/* ═══ Core Economy Panel ═══ */}
        <div className="max-w-md mx-auto mb-8">
          <div className="text-center mb-4">
            <h3 className="cd-head text-sm text-[var(--cd-text-mid)] tracking-widest">Get Cores</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 cd-stagger">
            <DailyClaim ember={ember} onClaim={claimEmberDaily} />
            <CoreConversion ember={ember} passion={passion} onConvert={convertPassionToEmber} />
          </div>
        </div>
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
        />
      )}
    </div>
  );
}
