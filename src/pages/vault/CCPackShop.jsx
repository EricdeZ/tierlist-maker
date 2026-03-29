import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import lazyRetry from '../../utils/lazyRetry';
import { useSearchParams } from 'react-router-dom';
import { useVault } from './VaultContext';
import { usePassion } from '../../context/PassionContext';
import { useAuth } from '../../context/AuthContext';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';
import usePendingPackOpen from './components/usePendingPackOpen';
import CDChargeButton from './components/CDChargeButton';
import { Package } from 'lucide-react';
import emberIcon from '../../assets/ember.png';
import PackLeaderboard from './components/PackLeaderboard';

const CCPackSale = lazyRetry(() => import('./CCPackSale'));
const CCBlackMarket = lazyRetry(() => import('./CCBlackMarket'));

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
  const { inventory, openInventoryPack, giftData, openGift, packTypesMap, lockedPackIds } = useVault();
  const { openResult, setOpenResult, closeResult } = usePendingPackOpen();
  const [loading, setLoading] = useState(null);
  const lockedSet = useMemo(() => new Set(lockedPackIds || []), [lockedPackIds]);

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

  if (!hasAny && !openResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/30 cd-head tracking-wider text-sm">No packs in your inventory</p>
          <p className="text-white/20 text-xs mt-1">Buy packs from the Shop or receive gifts from friends</p>
        </div>
        <PackLeaderboard />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inventory Packs */}
      {inventory.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">
            My Packs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {inventory.map((item, i) => {
              const pack = packTypesMap[item.packTypeId];
              if (!pack) return null;
              const isOpening = loading === `inv-${item.id}`;
              const isLocked = lockedSet.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => !isLocked && handleOpenInventory(item)}
                  disabled={!!loading || isLocked}
                  className={`cd-panel cd-corners rounded-xl p-3 flex flex-col items-center gap-2 transition-all group ${
                    isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.03] disabled:opacity-50'
                  }`}
                  style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div className="relative group-hover:scale-105 transition-transform">
                    <PackArt
                      tier={item.packTypeId}
                      name={pack.name}
                      subtitle={pack.leagueName || ''}
                      cardCount={pack.cards}
                      seed={pack.sortOrder ?? 5}
                      color={pack.color}
                      compact
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold cd-head tracking-wider" style={{ color: pack.color || 'var(--cd-cyan)' }}>
                      {pack.name}
                    </div>
                    <div className="text-[10px] text-white/30">{pack.cards} cards</div>
                  </div>
                  {isLocked ? (
                    <span className="text-[10px] text-amber-400/70 cd-head tracking-wider font-bold">
                      LISTED
                    </span>
                  ) : isOpening ? (
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
              const pack = packTypesMap[packType];
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
                      color={pack?.color}
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
        <InventoryPackOpening
          openResult={openResult}
          setOpenResult={setOpenResult}
          closeResult={closeResult}
          inventory={inventory}
          lockedSet={lockedSet}
          openInventoryPack={openInventoryPack}
          packTypesMap={packTypesMap}
        />
      )}

      <PackLeaderboard />
    </div>
  );
}

function InventoryPackOpening({ openResult, setOpenResult, closeResult, inventory, lockedSet, openInventoryPack, packTypesMap }) {
  const openKeyRef = useRef(0);

  const handleOpenMore = useCallback(async () => {
    const nextPack = getNextInventoryPack(inventory, lockedSet, openResult.packType);
    if (!nextPack) return;
    try {
      const result = await openInventoryPack(nextPack.id);
      if (!result) return;
      openKeyRef.current += 1;
      setOpenResult({ ...result, packType: nextPack.packTypeId });
    } catch (err) {
      alert(err.message || 'Failed to open pack');
    }
  }, [inventory, lockedSet, openResult.packType, openInventoryPack, setOpenResult]);

  const nextPack = getNextInventoryPack(inventory, lockedSet, openResult.packType);

  return (
    <PackOpening
      key={openKeyRef.current}
      result={openResult}
      packType={openResult.packType}
      onClose={closeResult}
      onOpenMore={nextPack ? handleOpenMore : null}
    />
  );
}

function getNextInventoryPack(inventory, lockedSet, preferType) {
  if (!inventory?.length) return null;
  const available = inventory.filter(i => !lockedSet.has(i.id));
  if (!available.length) return null;
  const sameType = available.find(i => i.packTypeId === preferType);
  return sameType || available[0];
}

function ShopPackOpening({ openResult, setOpenResult, closeResult, buyPack, packTypesMap, emberBalance }) {
  const openKeyRef = useRef(0);
  const pack = packTypesMap[openResult.packType];
  const cost = pack?.cost ?? 0;
  const canAfford = emberBalance >= cost;

  const handleOpenMore = useCallback(async () => {
    if (!canAfford) return;
    try {
      const result = await buyPack(openResult.packType);
      if (!result) return;
      openKeyRef.current += 1;
      setOpenResult({ ...result, packType: openResult.packType });
    } catch (err) {
      alert(err.message || 'Failed to open pack');
    }
  }, [canAfford, buyPack, openResult.packType, setOpenResult]);

  const openMoreLabel = pack ? (
    <>Open More ({cost} <img src={emberIcon} alt="Cores" className="inline h-4 w-auto -mt-0.5" />)</>
  ) : 'Open More';

  return (
    <PackOpening
      key={openKeyRef.current}
      result={openResult}
      packType={openResult.packType}
      onClose={closeResult}
      onOpenMore={handleOpenMore}
      openMoreLabel={openMoreLabel}
      openMoreDisabled={!canAfford}
    />
  );
}

// ═══════════════════════════════════════════════
// Top-level toggle — MY PACKS / SHOP / LIMITED SALE
// ═══════════════════════════════════════════════
export default function PackShopRouter() {
  const { inventory, giftData, pendingReveal, markRevealed } = useVault();
  const [searchParams, setSearchParams] = useSearchParams();

  const unopenedGifts = (giftData?.received || []).filter(g => !g.opened).length;
  const myPacksCount = (inventory?.length || 0) + unopenedGifts;

  // Stabilize default so opening the last pack doesn't auto-switch to 'shop'
  // and unmount MyPacks (killing the pack-opening animation mid-flight)
  const stableDefaultRef = useRef('shop');
  if (myPacksCount > 0) stableDefaultRef.current = 'my-packs';

  const mode = searchParams.get('packMode') || stableDefaultRef.current;

  const setMode = (m) => {
    const next = new URLSearchParams(searchParams);
    if (m === stableDefaultRef.current) next.delete('packMode'); else next.set('packMode', m);
    setSearchParams(next);
  };

  return (
    <>
      {/* Desktop toggles */}
      <div className="hidden sm:flex justify-center gap-2 mb-4 relative">
        <button
          onClick={() => setMode('my-packs')}
          className={`relative px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'my-packs'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          MY PACKS
          {myPacksCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] leading-none font-bold text-black flex items-center justify-center">
              {myPacksCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMode('shop')}
          className={`px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
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
          className={`px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'sale'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          LIMITED SALE
        </button>
        <button
          onClick={() => setMode('black-market')}
          className={`px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer relative ${
            mode === 'black-market'
              ? 'bg-red-900/20 text-red-500 border-red-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          BLACK MARKET
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
        </button>
      </div>
      {mode === 'my-packs' ? (
        <MyPacks />
      ) : mode === 'shop' ? (
        <PackShop />
      ) : mode === 'black-market' ? (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="cd-spinner w-8 h-8" /></div>}>
          <CCBlackMarket />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="cd-spinner w-8 h-8" /></div>}>
          <CCPackSale />
        </Suspense>
      )}

      {/* Force replay of unrevealed pack opening (anti-refresh-skip) */}
      {pendingReveal && (
        <PackOpening
          result={pendingReveal}
          packType={pendingReveal.packType}
          onClose={markRevealed}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// Mobile Pack Showcase — fullscreen with tilt
// ═══════════════════════════════════════════════
function MobilePackShowcase({ packs, packTypesMap, emberBalance, onBuy, openResult, claimableCount, quantity, setQuantity }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const quantityBeforeFocus = useRef(1);
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
    const clamped = Math.max(0, Math.min(idx, packs.length - 1));
    setActiveIndex(prev => {
      if (prev !== clamped) setQuantity(1);
      return clamped;
    });
  }, [packs.length, setQuantity]);

  const [hasScrolled, setHasScrolled] = useState(false);

  const onScroll = useCallback(() => {
    handleScroll();
    if (!hasScrolled) setHasScrolled(true);
  }, [handleScroll, hasScrolled]);

  return (
    <div className="sm:hidden relative">
      {/* Swipe hint — above dots, fixed height to prevent jump */}
      <div className="h-5 flex items-center justify-center z-20 relative">
        {!hasScrolled ? (
          <div className="flex items-center gap-1 animate-bounce-right">
            <span className="text-xs text-white/60 cd-head tracking-widest">More</span>
            <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ) : <div />}
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-3 pb-1 mb-3 z-20 relative">
        {packs.map((k, i) => {
          const pack = packTypesMap[k];
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
                background: pack?.color || 'var(--cd-cyan)',
                boxShadow: `0 0 8px ${pack?.color || 'var(--cd-cyan)'}`,
              } : undefined}
            />
          );
        })}
      </div>

      {/* Horizontal snap scroll for packs */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto -mx-4"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {packs.map((key) => {
          const pack = packTypesMap[key];
          if (!pack) return null;
          const totalCost = pack.cost * quantity;
          const canAfford = emberBalance >= totalCost;

          return (
            <div key={key} className="snap-center shrink-0 w-full flex flex-col items-center px-4 pb-2 relative">
              {/* Pack art — large, overlaps behind info */}
              <div
                className="relative z-0 mobile-pack-large"
                style={{
                  transform: `perspective(600px) rotateY(${tilt.x}deg) rotateX(${-tilt.y}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.15s ease-out',
                  marginBottom: -20,
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
                <PackArt tier={key} name={pack.name} subtitle={pack.leagueName || ''} cardCount={pack.cards} seed={pack.sortOrder ?? 0} color={pack.color} />
              </div>

              {/* Pack info — slim frosted glass overlay */}
              <div className="w-full relative z-10 rounded-lg px-3 py-2" style={{ background: 'rgba(10, 12, 18, 0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="cd-head text-base font-bold" style={{ color: pack.color || 'var(--cd-cyan)', letterSpacing: '0.12em' }}>
                    {pack.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <img src={emberIcon} alt="" className="h-3.5 w-auto object-contain cd-icon-glow" />
                    <span className="text-base font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{totalCost}</span>
                  </div>
                </div>

                <div className="flex gap-3 mb-2 text-[10px] text-white/50">
                  <span><span className="text-white font-bold">{pack.cards}</span> cards</span>
                  <span>1 <span className="font-bold" style={{ color: pack.color }}>{pack.leagueName?.split(' ')[0]}</span> player</span>
                  <span>1 <span className="text-green-400 font-bold">Rare+</span></span>
                </div>

                {/* Quantity counter */}
                <div className="flex items-center justify-center gap-3 mb-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cd-head text-base flex items-center justify-center cursor-pointer"
                  >−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantity}
                    onFocus={() => { quantityBeforeFocus.current = quantity; setQuantity(''); }}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      if (v === '') { setQuantity(''); return; }
                      const n = Math.min(99, Math.max(1, parseInt(v, 10)));
                      const max = Math.floor(emberBalance / pack.cost);
                      setQuantity(Math.min(n, max));
                    }}
                    onBlur={() => { if (!quantity) setQuantity(quantityBeforeFocus.current); }}
                    className="text-lg font-bold text-white cd-num w-8 text-center bg-transparent border-b border-white/30 outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQuantity(q => Math.min(99, Math.min(q + 1, Math.floor(emberBalance / pack.cost))))}
                    disabled={quantity >= 99 || emberBalance < pack.cost * (quantity + 1)}
                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cd-head text-base flex items-center justify-center cursor-pointer"
                  >+</button>
                </div>

                <CDChargeButton
                  label={!canAfford
                    ? `Need ${totalCost} Cores`
                    : quantity > 1
                      ? `Add to Inventory for ${totalCost}`
                      : `Open for ${pack.cost}`}
                  onFire={() => onBuy(key)}
                  disabled={!canAfford || !!openResult}
                />
                {!canAfford && <GetCoresHint claimableCount={claimableCount} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Rotation Countdown — time until midnight UTC
// ═══════════════════════════════════════════════
function RotationCountdown() {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = tomorrow - now;
      if (diff <= 0) { setCountdown('0h 0m 0s'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-[var(--cd-cyan)] font-mono font-medium tabular-nums">{countdown}</span>
  );
}

// ═══════════════════════════════════════════════
// Special Rotation Section
// ═══════════════════════════════════════════════
function RotationSection({ packs, packTypesMap, emberBalance, onBuy, loading, quantity, setQuantity }) {
  const quantityBeforeFocus = useRef(1);
  const [selectedPack, setSelectedPack] = useState(null);

  // Reset quantity when changing selected rotation pack
  useEffect(() => { setQuantity(1); }, [selectedPack, setQuantity]);

  const selected = selectedPack ? packTypesMap[selectedPack] : null;
  const totalCost = selected ? selected.cost * quantity : 0;
  const canAfford = selected ? emberBalance >= totalCost : false;

  return (
    <div className="max-w-4xl mx-auto mb-10">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="cd-head text-sm text-amber-400 tracking-widest uppercase font-bold">Special Rotation</h3>
          <p className="text-[10px] text-white/30 mt-0.5">Refreshes daily at midnight UTC</p>
        </div>
        <div className="text-xs text-white/40">
          Next rotation: <RotationCountdown />
        </div>
      </div>

      {/* Pack Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {packs.map((packId) => {
          const pack = packTypesMap[packId];
          if (!pack) return null;
          const isSelected = selectedPack === packId;
          const afford = emberBalance >= pack.cost;

          return (
            <button
              key={packId}
              onClick={() => setSelectedPack(isSelected ? null : packId)}
              className={`cd-panel cd-corners rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all group ${
                isSelected
                  ? 'ring-2 bg-white/[0.05]'
                  : 'hover:bg-white/[0.03]'
              } ${!afford && !isSelected ? 'opacity-40' : ''}`}
              style={isSelected ? { ringColor: pack.color || 'var(--cd-cyan)' } : undefined}
            >
              <div className="relative group-hover:scale-105 transition-transform">
                <PackArt
                  tier={packId}
                  name={pack.name}
                  subtitle={pack.leagueName || ''}
                  cardCount={pack.cards}
                  seed={pack.sortOrder ?? 0}
                  color={pack.color}
                  compact
                />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold cd-head tracking-wider truncate max-w-[100px]" style={{ color: pack.color || 'var(--cd-cyan)' }}>
                  {pack.name}
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <img src={emberIcon} alt="" className="h-3 w-auto object-contain" />
                  <span className="text-xs font-bold text-[var(--cd-cyan)] cd-num">{pack.cost}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Pack Details */}
      {selected && (
        <div className="mt-4 cd-panel cd-corners rounded-xl p-5 max-w-md mx-auto" style={{ animation: 'vault-card-enter 0.3s ease-out' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="cd-head text-lg font-bold" style={{ color: selected.color || 'var(--cd-cyan)', letterSpacing: '0.1em' }}>
                {selected.name}
              </h4>
              {selected.leagueName && (
                <p className="text-[10px] text-white/30 cd-head tracking-widest">{selected.leagueName}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedPack(null)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer cd-head tracking-wider"
            >
              Close
            </button>
          </div>

          <div className="space-y-1.5 mb-4 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l4 6-10 13L2 9z" /></svg>
              <span><span className="text-white font-bold">{selected.cards}</span> cards per pack</span>
            </div>
            {selected.description && (
              <p className="text-white/40 text-[11px] pl-5.5">{selected.description}</p>
            )}
          </div>

          {/* Price + Quantity */}
          <div className="flex items-center gap-2 mb-3">
            <img src={emberIcon} alt="" className="h-5 w-auto object-contain cd-icon-glow" />
            <span className="text-2xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{totalCost}</span>
            <span className="text-xs text-white/40 cd-head tracking-wider">Cores</span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cd-head text-base flex items-center justify-center cursor-pointer"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={quantity}
              onFocus={() => { quantityBeforeFocus.current = quantity; setQuantity(''); }}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '');
                if (v === '') { setQuantity(''); return; }
                const n = Math.min(99, Math.max(1, parseInt(v, 10)));
                const max = Math.floor(emberBalance / selected.cost);
                setQuantity(Math.min(n, max));
              }}
              onBlur={() => { if (!quantity) setQuantity(quantityBeforeFocus.current); }}
              className="text-lg font-bold text-white cd-num w-8 text-center bg-transparent border-b border-white/30 outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              onClick={() => setQuantity(q => Math.min(99, Math.min(q + 1, Math.floor(emberBalance / selected.cost))))}
              disabled={quantity >= 99 || emberBalance < selected.cost * (quantity + 1)}
              className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cd-head text-base flex items-center justify-center cursor-pointer"
            >+</button>
          </div>

          <CDChargeButton
            label={!canAfford
              ? `Need ${totalCost} Cores`
              : quantity > 1
                ? `Add to Inventory for ${totalCost}`
                : `Open for ${selected.cost}`}
            onFire={() => onBuy(selectedPack)}
            disabled={!canAfford || loading}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Pack Shop (original)
// ═══════════════════════════════════════════════
function PackShop() {
  const { ember, buyPack, buyPacksToInventory, packTypes, packTypesMap, rotationPacks } = useVault();
  const { claimEmberDaily, claimableCount } = usePassion();
  const { isAdmin } = useAuth();
  const showStaffPacks = FEATURE_FLAGS.STAFF_CARDS_RELEASED || isAdmin;
  const leaguePacks = useMemo(() =>
    packTypes.filter(p => (p.leagueId && !p.rotationOnly) || (showStaffPacks && p.id === 'staff-mixed')).map(p => p.id),
    [packTypes, showStaffPacks]
  );
  const activeRotationPacks = useMemo(() =>
    (rotationPacks || []).filter(id => packTypesMap[id]),
    [rotationPacks, packTypesMap]
  );
  const { openResult, setOpenResult, closeResult } = usePendingPackOpen();
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const quantityBeforeFocus = useRef(1);

  const handleBuyPack = useCallback(async (packType) => {
    try {
      setLoading(true);
      if (quantity > 1) {
        await buyPacksToInventory(packType, quantity);
        setQuantity(1);
        setLoading(false);
        return;
      }
      const result = await buyPack(packType);
      if (!result) { setLoading(false); return; }
      setOpenResult({ ...result, packType });
      setLoading(false);
    } catch (err) {
      setLoading(false);
      alert(err.message || 'Failed to open pack');
    }
  }, [buyPack, buyPacksToInventory, quantity]);

  const emberBalance = ember?.balance ?? 0;
  const [focusedPack, setFocusedPack] = useState(null);

  // Reset quantity when changing focused pack
  useEffect(() => { setQuantity(1); }, [focusedPack]);
  const focused = focusedPack ? packTypesMap[focusedPack] : null;
  const focusedTotalCost = focused ? focused.cost * quantity : 0;
  const focusedAfford = focused ? emberBalance >= focusedTotalCost : false;
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
          {leaguePacks.map((key) => {
            const pack = packTypesMap[key];
            if (!pack) return null;
            const isSelected = focusedPack === key;
            const isOther = focusedPack && !isSelected;
            const canAfford = emberBalance >= pack.cost;

            return (
              <div
                key={key}
                ref={(el) => { packRefs.current[key] = el; }}
                className="flex flex-col items-center"
              >
                <div className="relative transition-all duration-500 ease-out cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedPack(isSelected ? null : key);
                  }}
                  style={{
                    transform: isSelected ? `translate(${packOffset.x}px, ${packOffset.y}px) scale(2.2)` : 'scale(1.15)',
                    zIndex: isSelected ? 50 : 1,
                    filter: isOther ? 'blur(4px)' : 'none',
                    opacity: isOther ? 0.25 : 1,
                    pointerEvents: isOther ? 'none' : undefined,
                  }}
                >
                  {/* Ambient glow */}
                  <div
                    className="absolute -inset-20 rounded-3xl transition-all duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse, ${pack.color || 'var(--cd-cyan)'}40 0%, transparent 70%)`,
                      filter: `blur(${isSelected ? 80 : 0}px)`,
                      opacity: isSelected ? 0.7 : 0,
                    }}
                  />
                  {/* Pedestal glow */}
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-4 rounded-full transition-all duration-500 pointer-events-none"
                    style={{
                      background: pack.color || 'var(--cd-cyan)',
                      filter: 'blur(16px)',
                      opacity: isSelected ? 0.5 : 0,
                    }}
                  />
                  <div className={`transition-all duration-500 ease-out ${!canAfford && !isSelected ? 'opacity-40' : ''} ${!focusedPack ? 'group-hover:scale-110' : ''}`}
                  >
                    <PackArt tier={key} name={pack.name} subtitle={pack.leagueName || ''} cardCount={pack.cards} seed={pack.sortOrder ?? 0} color={pack.color} />
                  </div>
                </div>
                {/* Label */}
                <div className="transition-all duration-300 overflow-hidden"
                  style={{ maxHeight: focusedPack ? 0 : 30, opacity: focusedPack ? 0 : 1, marginTop: focusedPack ? 0 : 20 }}
                >
                  <span className="text-xs text-white/30 cd-head tracking-widest group-hover:text-white/50 transition-colors">
                    {pack.leagueName || ''}
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
            zIndex: 50,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(focused || focusedPack) && (() => {
            const pack = focused || packTypesMap[leaguePacks[0]];
            const afford = focusedAfford;
            if (!pack) return null;
            return (
              <div className="cd-panel cd-corners rounded-xl p-6 lg:p-8 w-80 lg:w-96 relative overflow-hidden">
                <div className="cd-data-overlay" />
                <div className="relative z-1">
                  <h3 className="cd-head text-2xl font-bold mb-1" style={{ color: pack.color || 'var(--cd-cyan)', letterSpacing: '0.12em' }}>
                    {pack.name}
                  </h3>
                  <p className="text-xs text-white/40 cd-head tracking-widest mb-6">{pack.leagueName || ''}</p>

                  <div className="space-y-2.5 mb-8 text-[13px] text-white/60">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l4 6-10 13L2 9z" /></svg>
                      <span><span className="text-white font-bold">{pack.cards}</span> cards per pack</span>
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

                  <div className="flex items-center gap-2.5 mb-3">
                    <img src={emberIcon} alt="" className="h-6 w-auto object-contain cd-icon-glow" />
                    <span className="text-3xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{focusedTotalCost}</span>
                    <span className="text-sm text-white/40 cd-head tracking-wider">Cores</span>
                  </div>

                  {/* Quantity counter */}
                  <div className="flex items-center justify-center gap-3 mb-5">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cd-head text-lg flex items-center justify-center cursor-pointer"
                    >−</button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={quantity}
                      onFocus={() => { quantityBeforeFocus.current = quantity; setQuantity(''); }}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        if (v === '') { setQuantity(''); return; }
                        const n = Math.min(99, Math.max(1, parseInt(v, 10)));
                        const max = Math.floor(emberBalance / pack.cost);
                        setQuantity(Math.min(n, max));
                      }}
                      onBlur={() => { if (!quantity) setQuantity(quantityBeforeFocus.current); }}
                      className="text-xl font-bold text-white cd-num w-10 text-center bg-transparent border-b border-white/30 outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setQuantity(q => Math.min(99, Math.min(q + 1, Math.floor(emberBalance / pack.cost))))}
                      disabled={quantity >= 99 || emberBalance < pack.cost * (quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cd-head text-lg flex items-center justify-center cursor-pointer"
                    >+</button>
                  </div>

                  <CDChargeButton
                    label={!afford
                      ? `Need ${focusedTotalCost} Cores`
                      : quantity > 1
                        ? `Add to Inventory for ${focusedTotalCost}`
                        : `Open for ${pack.cost}`}
                    onFire={() => handleBuyPack(focusedPack)}
                    disabled={!afford || !!openResult || loading}
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
        packs={leaguePacks}
        packTypesMap={packTypesMap}
        emberBalance={emberBalance}
        onBuy={handleBuyPack}
        openResult={openResult}
        claimableCount={claimableCount}
        quantity={quantity}
        setQuantity={setQuantity}
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
        <div className="cd-divider max-w-lg mx-auto mb-8 hidden sm:block" />

        {/* ═══ Special Rotation Section ═══ */}
        {activeRotationPacks.length > 0 && (
          <RotationSection
            packs={activeRotationPacks}
            packTypesMap={packTypesMap}
            emberBalance={emberBalance}
            onBuy={handleBuyPack}
            loading={loading}
            quantity={quantity}
            setQuantity={setQuantity}
          />
        )}

        {/* ═══ Core Economy Panel ═══ */}
        <div className="max-w-3xl mx-auto mb-8 hidden sm:block">
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
        <ShopPackOpening
          openResult={openResult}
          setOpenResult={setOpenResult}
          closeResult={closeResult}
          buyPack={buyPack}
          packTypesMap={packTypesMap}
          emberBalance={emberBalance}
        />
      )}
    </div>
  );
}
