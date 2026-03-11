import { lazy, Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCardClash } from './CardClashContext';
import { usePassion } from '../../context/PassionContext';
import { PACKS } from '../../data/cardclash/economy';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';
import CDChargeButton from './components/CDChargeButton';
import { Package } from 'lucide-react';
import emberIcon from '../../assets/ember.png';

const CCPackSale = lazy(() => import('./CCPackSale'));

const LEAGUE_PACKS = ['osl-mixed', 'bsl-mixed']

const PACK_META = {
  'osl-mixed': { subtitle: 'Olympus League', seed: 5 },
  'bsl-mixed': { subtitle: 'Babylon League', seed: 6 },
};

// ═══════════════════════════════════════════════
// Convert Link
// ═══════════════════════════════════════════════
function ConvertLink() {
  const [, setSearchParams] = useSearchParams()

  return (
    <div
      onClick={() => setSearchParams({ tab: 'convert' })}
      className="cd-panel cd-corners rounded-xl p-4 cursor-pointer hover:bg-white/[0.03] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-3">
        <img src={emberIcon} alt="Cores" className="h-5 w-auto object-contain cd-icon-glow" />
        <span className="text-sm font-bold text-[var(--cd-cyan)] cd-head">Passion &rarr; Cores</span>
      </div>
      <p className="text-xs text-white/50 mb-3">Convert your Passion into Cores to open more packs.</p>
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--cd-cyan)]/70 cd-head tracking-wider group-hover:text-[var(--cd-cyan)] transition-colors">
        <span>Convert Now</span>
        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
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
// Complete Challenges Link
// ═══════════════════════════════════════════════
function ChallengesLink() {
  const [, setSearchParams] = useSearchParams()

  return (
    <div
      onClick={() => setSearchParams({ tab: 'challenges' })}
      className="cd-panel cd-corners rounded-xl p-4 cursor-pointer hover:bg-white/[0.03] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-3">
        <img src={emberIcon} alt="Cores" className="h-5 w-auto object-contain cd-icon-glow" />
        <span className="text-sm font-bold text-[var(--cd-cyan)] cd-head">Challenges</span>
      </div>
      <p className="text-xs text-white/50 mb-3">Complete challenges to earn Cores and Passion rewards.</p>
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--cd-cyan)]/70 cd-head tracking-wider group-hover:text-[var(--cd-cyan)] transition-colors">
        <span>View Challenges</span>
        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// "Not enough cores" hint — links to challenges or converter
// ═══════════════════════════════════════════════
function GetCoresHint({ claimableCount }) {
  const [, setSearchParams] = useSearchParams()
  const hasChallenges = claimableCount > 0

  return (
    <div className="mt-3 text-center text-xs text-white/40">
      <span>Not enough Cores? </span>
      <button
        onClick={() => setSearchParams({ tab: hasChallenges ? 'challenges' : 'convert' })}
        className="text-[var(--cd-cyan)] hover:text-[var(--cd-cyan)]/80 transition-colors cursor-pointer font-semibold"
      >
        {hasChallenges ? `Claim ${claimableCount} challenge${claimableCount !== 1 ? 's' : ''}` : 'Convert Passion'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════
// My Packs — inventory + unopened gifts
// ═══════════════════════════════════════════════
function MyPacks() {
  const { inventory, openInventoryPack, giftData, openGift } = useCardClash();
  const [openResult, setOpenResult] = useState(null);
  const [loading, setLoading] = useState(null);

  const unopenedGifts = (giftData?.received || []).filter(g => !g.opened);
  const hasAny = (inventory?.length || 0) + unopenedGifts.length > 0;

  const handleOpenInventory = useCallback(async (item) => {
    try {
      setLoading(`inv-${item.id}`);
      const result = await openInventoryPack(item.id);
      if (!result) { setLoading(null); return; }
      setOpenResult({ ...result, packType: item.packTypeId });
      setLoading(null);
    } catch (err) {
      setLoading(null);
      alert(err.message || 'Failed to open pack');
    }
  }, [openInventoryPack]);

  const handleOpenGift = useCallback(async (gift) => {
    try {
      setLoading(`gift-${gift.id}`);
      const result = await openGift(gift.id);
      if (!result) { setLoading(null); return; }
      setOpenResult(result);
      setLoading(null);
    } catch (err) {
      setLoading(null);
      alert(err.message || 'Failed to open gift');
    }
  }, [openGift]);

  if (!hasAny) {
    return (
      <div className="text-center py-16">
        <Package className="w-10 h-10 text-white/15 mx-auto mb-3" />
        <p className="text-white/30 cd-head tracking-wider text-sm">No packs in your inventory</p>
        <p className="text-white/20 text-xs mt-1">Buy packs from the Shop or receive gifts from friends</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inventory Packs */}
      {inventory.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">
            Starter Packs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {inventory.map((item, i) => {
              const pack = PACKS[item.packTypeId];
              if (!pack) return null;
              const meta = PACK_META[item.packTypeId];
              const isOpening = loading === `inv-${item.id}`;
              return (
                <button
                  key={item.id}
                  onClick={() => handleOpenInventory(item)}
                  disabled={!!loading}
                  className="cd-panel cd-corners rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-white/[0.03] transition-all disabled:opacity-50 group"
                  style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div className="relative group-hover:scale-105 transition-transform">
                    <PackArt
                      tier={item.packTypeId}
                      name={pack.name}
                      subtitle={meta?.subtitle || ''}
                      cardCount={pack.cards}
                      seed={meta?.seed || 5}
                      compact
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold cd-head tracking-wider" style={{ color: pack.color || 'var(--cd-cyan)' }}>
                      {pack.name}
                    </div>
                    <div className="text-[10px] text-white/30">{pack.cards} cards</div>
                  </div>
                  {isOpening ? (
                    <div className="cd-spinner w-4 h-4" />
                  ) : (
                    <span className="text-[10px] text-emerald-400/70 cd-head tracking-wider font-bold group-hover:text-emerald-400 transition-colors">
                      TAP TO OPEN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unopened Gifts */}
      {unopenedGifts.length > 0 && (
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">
            Gift Packs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {unopenedGifts.map((gift, i) => {
              const packType = gift.packType || 'gift';
              const pack = PACKS[packType];
              const isOpening = loading === `gift-${gift.id}`;
              return (
                <button
                  key={gift.id}
                  onClick={() => handleOpenGift(gift)}
                  disabled={!!loading}
                  className="cd-panel cd-corners rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-white/[0.03] transition-all disabled:opacity-50 group"
                  style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div className="relative group-hover:scale-105 transition-transform">
                    <PackArt
                      tier={packType}
                      name={pack?.name || 'Gift Pack'}
                      subtitle="Gift"
                      cardCount={pack?.cards || 5}
                      seed={i + 10}
                      compact
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold cd-head tracking-wider text-red-400">
                      From {gift.senderName}
                    </div>
                    {gift.message && (
                      <div className="text-[10px] text-white/30 truncate max-w-[120px] italic">"{gift.message}"</div>
                    )}
                  </div>
                  {isOpening ? (
                    <div className="cd-spinner w-4 h-4" />
                  ) : (
                    <span className="text-[10px] text-emerald-400/70 cd-head tracking-wider font-bold group-hover:text-emerald-400 transition-colors">
                      TAP TO OPEN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pack opening ceremony */}
      {openResult && (
        <PackOpening
          result={openResult}
          packType={openResult.packType}
          onClose={() => setOpenResult(null)}
          onOpenMore={() => setOpenResult(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Top-level toggle — MY PACKS / SHOP / LIMITED SALE
// ═══════════════════════════════════════════════
export default function PackShopRouter() {
  const { inventory, giftData } = useCardClash();
  const [mode, setMode] = useState('shop');

  const unopenedGifts = (giftData?.received || []).filter(g => !g.opened).length;
  const myPacksCount = (inventory?.length || 0) + unopenedGifts;

  return (
    <>
      <div className="flex justify-center gap-1.5 sm:gap-2 -mt-2 sm:mt-0 mb-2 sm:mb-4 relative z-40">
        <button
          onClick={() => setMode('my-packs')}
          className={`relative px-4 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'my-packs'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          MY PACKS
          {myPacksCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-black flex items-center justify-center">
              {myPacksCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMode('shop')}
          className={`px-4 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'shop'
              ? 'bg-white/10 text-white border-white/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          SHOP
        </button>
        <button
          onClick={() => setMode('sale')}
          className={`px-4 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'sale'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          LIMITED SALE
        </button>
      </div>
      {mode === 'my-packs' ? (
        <MyPacks />
      ) : mode === 'shop' ? (
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
// Mobile Pack Showcase — fullscreen with tilt
// ═══════════════════════════════════════════════
function MobilePackShowcase({ packs, emberBalance, onBuy, openResult, claimableCount }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Device orientation tilt (phone gyroscope only)
  useEffect(() => {
    const handler = (e) => {
      if (e.gamma === null || e.beta === null) return;
      const x = Math.max(-15, Math.min(15, e.gamma));
      const y = Math.max(-15, Math.min(15, e.beta - 45));
      setTilt({ x: x / 15 * 12, y: y / 15 * 8 });
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // Track which pack is visible via scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setActiveIndex(Math.max(0, Math.min(idx, packs.length - 1)));
  }, [packs.length]);

  return (
    <div className="sm:hidden">
      {/* Horizontal snap scroll for packs */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto -mx-4"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {packs.map((key) => {
          const pack = PACKS[key];
          const meta = PACK_META[key];
          const canAfford = emberBalance >= pack.cost;

          return (
            <div key={key} className="snap-center shrink-0 w-full flex flex-col items-center px-4 pt-2 pb-4">
              {/* Pack art with gyro 3D tilt */}
              <div
                className="relative"
                style={{
                  transform: `perspective(600px) rotateY(${tilt.x}deg) rotateX(${-tilt.y}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {/* Ambient glow — follows tilt */}
                <div
                  className="absolute -inset-16 rounded-3xl"
                  style={{
                    background: `radial-gradient(ellipse at ${50 + tilt.x * 2}% ${50 + tilt.y * 2}%, ${pack.color || 'var(--cd-cyan)'}40 0%, transparent 70%)`,
                    filter: 'blur(40px)',
                    opacity: 0.6,
                  }}
                />
                {/* Specular highlight — shifts with tilt */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none z-10"
                  style={{
                    background: `radial-gradient(ellipse at ${50 + tilt.x * 3}% ${40 + tilt.y * 3}%, rgba(255,255,255,0.15) 0%, transparent 55%)`,
                  }}
                />
                <PackArt tier={key} name={pack.name} subtitle={meta.subtitle} cardCount={pack.cards} seed={meta.seed} />
              </div>

              {/* Pack info */}
              <div className="w-full mt-5">
                <h3 className="cd-head text-xl font-bold mb-0.5" style={{ color: pack.color || 'var(--cd-cyan)', letterSpacing: '0.12em' }}>
                  {pack.name}
                </h3>
                <p className="text-xs text-white/40 cd-head tracking-widest mb-3">{meta.subtitle}</p>

                <div className="flex gap-4 mb-4 text-[12px] text-white/50">
                  <span><span className="text-white font-bold">6</span> cards</span>
                  <span>1 <span className="font-bold" style={{ color: pack.color }}>{pack.leagueName?.split(' ')[0]}</span> player</span>
                  <span>1 <span className="text-green-400 font-bold">Rare+</span></span>
                </div>

                <div className="flex items-center gap-2.5 mb-4">
                  <img src={emberIcon} alt="" className="h-5 w-auto object-contain cd-icon-glow" />
                  <span className="text-2xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{pack.cost}</span>
                  <span className="text-sm text-white/40 cd-head tracking-wider">Cores</span>
                </div>

                <CDChargeButton
                  label={canAfford ? `Open for ${pack.cost}` : `Need ${pack.cost} Cores`}
                  onFire={() => onBuy(key)}
                  disabled={!canAfford || !!openResult}
                />
                {!canAfford && <GetCoresHint claimableCount={claimableCount} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll indicator dots */}
      <div className="flex justify-center gap-3 mt-1 mb-1">
        {packs.map((k, i) => {
          const pack = PACKS[k];
          return (
            <button
              key={k}
              onClick={() => {
                scrollRef.current?.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' });
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                i === activeIndex ? 'scale-125' : 'bg-white/20'
              }`}
              style={i === activeIndex ? {
                background: pack.color || 'var(--cd-cyan)',
                boxShadow: `0 0 8px ${pack.color || 'var(--cd-cyan)'}`,
              } : undefined}
            />
          );
        })}
      </div>

      {/* Scroll down indicator */}
      <div className="flex flex-col items-center mt-3 mb-1 animate-bounce">
        <span className="text-[10px] text-white/20 cd-head tracking-widest mb-1">Scroll for more</span>
        <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Pack Shop (original)
// ═══════════════════════════════════════════════
function PackShop() {
  const { ember, buyPack } = useCardClash();
  const { claimEmberDaily, claimableCount } = usePassion();
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
      {/* ═══ Pack Showcase — Desktop (>=640px) ═══ */}
      <div
        className="relative py-8 hidden sm:block"
        style={{ minHeight: 420 }}
        onClick={() => focusedPack && setFocusedPack(null)}
      >
        {/* Packs row — always in place */}
        <div ref={rowRef} className="flex items-center justify-center gap-16">
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
                  {!afford && <GetCoresHint claimableCount={claimableCount} />}

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

      {/* ═══ Pack Showcase — Mobile (<640px) ═══ */}
      <MobilePackShowcase
        packs={LEAGUE_PACKS}
        emberBalance={emberBalance}
        onBuy={handleBuyPack}
        openResult={openResult}
        claimableCount={claimableCount}
      />

      {/* ═══ Bottom UI — blurs when pack is focused ═══ */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          filter: focusedPack ? 'blur(6px)' : 'none',
          opacity: focusedPack ? 0.3 : 1,
          pointerEvents: focusedPack ? 'none' : undefined,
        }}
      >
        {/* Hint when nothing selected — desktop only */}
        {!openResult && (
          <div className="hidden sm:block text-center text-[11px] text-white/20 cd-head tracking-widest mb-8 -mt-2">
            {focusedPack ? '' : 'Select a pack to open'}
          </div>
        )}

        {/* ═══ Divider ═══ */}
        <div className="cd-divider max-w-lg mx-auto mb-8" />

        {/* ═══ Core Economy Panel ═══ */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="text-center mb-4">
            <h3 className="cd-head text-sm text-[var(--cd-text-mid)] tracking-widest">Get Cores</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 cd-stagger">
            <DailyClaim ember={ember} onClaim={claimEmberDaily} />
            <ConvertLink />
            <ChallengesLink />
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
