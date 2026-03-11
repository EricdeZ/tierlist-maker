import { useState, useCallback, useMemo, useEffect } from 'react';
import { useCardClash } from './CardClashContext';
import { PACKS } from '../../data/cardclash/economy';
import PackArt from './components/PackArt';
import PackOpening from './components/PackOpening';
import emberIcon from '../../assets/ember.png';
import './vendingmachine.css';

const PACK_SEEDS = {
  'osl-mixed': 5, 'bsl-mixed': 6, standard: 0, premium: 1, elite: 2, legendary: 3,
};

const MIN_SLOTS = 6;

function buildSlots(packs) {
  if (!packs?.length) return [];
  const rows = 'ABCDEFGH';
  return packs.map((p, i) => ({
    code: `${rows[Math.floor(i / 2)]}${(i % 2) + 1}`,
    pack: p,
  }));
}

function padSlots(slots) {
  if (slots.length >= MIN_SLOTS) return slots;
  const rows = 'ABCDEFGH';
  const padded = [...slots];
  while (padded.length < MIN_SLOTS) {
    const i = padded.length;
    padded.push({
      code: `${rows[Math.floor(i / 2)]}${(i % 2) + 1}`,
      pack: null,
    });
  }
  return padded;
}

// ═══ Alley scene — SVG illustration backdrop ═══

const L_WIN = [[40,170,true],[150,170,false],[40,290,false],[150,290,true],[40,410,false],[150,410,false],[40,530,true],[150,530,false]];
const R_WIN = [[1150,150,false],[1270,150,true],[1150,280,true],[1270,280,false],[1150,410,false],[1270,410,false],[1150,540,false],[1270,540,false]];

function AlleyScene({ children }) {
  return (
    <div className="alley">
      <svg className="alley-svg" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <radialGradient id="ag-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd264" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#ffb838" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffb838" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ag-cone" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#ffd264" stopOpacity="0.09" />
            <stop offset="60%" stopColor="#ffc848" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffc848" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ag-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e0a18" />
            <stop offset="100%" stopColor="#080510" />
          </linearGradient>
          <linearGradient id="ag-win" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffdc8c" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffb050" stopOpacity="0.08" />
          </linearGradient>
          <filter id="ag-neon">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="ag-soft">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
          </filter>
        </defs>

        {/* Sky */}
        <rect width="1400" height="900" fill="#050308" />

        {/* Stars */}
        <circle cx="420" cy="30" r="1.2" fill="#fff" fillOpacity="0.25" />
        <circle cx="580" cy="18" r="0.8" fill="#fff" fillOpacity="0.18" />
        <circle cx="700" cy="45" r="1" fill="#fff" fillOpacity="0.22" />
        <circle cx="850" cy="12" r="1.3" fill="#fff" fillOpacity="0.2" />
        <circle cx="950" cy="38" r="0.7" fill="#fff" fillOpacity="0.15" />
        <circle cx="500" cy="60" r="0.6" fill="#fff" fillOpacity="0.16" />

        {/* Left building */}
        <rect fill="#0a0716" x="0" y="80" width="300" height="820" />
        <rect fill="#080510" x="300" y="160" width="65" height="740" />
        <rect fill="#0e0a1c" x="0" y="78" width="302" height="3" />

        {/* Left windows */}
        {L_WIN.map(([wx,wy,lit], i) => (
          <g key={`lw${i}`}>
            <rect fill="#0c081a" x={wx} y={wy} width="36" height="50" rx="2" />
            {lit && <rect fill="url(#ag-win)" x={wx+2} y={wy+2} width="32" height="46" rx="1" />}
          </g>
        ))}

        {/* Drain pipe */}
        <line x1="265" y1="85" x2="265" y2="690" stroke="#0c0918" strokeWidth="4" />
        <line x1="265" y1="85" x2="265" y2="690" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />

        {/* Neon VAULT sign */}
        <g className="alley-neon" filter="url(#ag-neon)">
          <rect x="50" y="480" width="110" height="32" rx="3" fill="none" stroke="#00e6ff" strokeOpacity="0.5" strokeWidth="1.5" />
          <text x="105" y="502" textAnchor="middle" fill="#00e6ff" fillOpacity="0.6" fontSize="16" fontFamily="'Teko', sans-serif" fontWeight="700" letterSpacing="6">VAULT</text>
        </g>
        <ellipse cx="105" cy="698" rx="35" ry="6" fill="#00e6ff" fillOpacity="0.015" />

        {/* Right building */}
        <rect fill="#0c0818" x="1100" y="55" width="300" height="845" />
        <rect fill="#090614" x="1035" y="140" width="65" height="760" />
        <rect fill="#100c22" x="1098" y="53" width="302" height="3" />

        {/* Right windows */}
        {R_WIN.map(([wx,wy,lit], i) => (
          <g key={`rw${i}`}>
            <rect fill="#0c081a" x={wx} y={wy} width="36" height="50" rx="2" />
            {lit && <rect fill="url(#ag-win)" x={wx+2} y={wy+2} width="32" height="46" rx="1" />}
          </g>
        ))}

        {/* Ground */}
        <rect fill="url(#ag-ground)" x="0" y="690" width="1400" height="210" />
        <rect fill="#12101e" x="0" y="688" width="1400" height="3" />

        {/* Streetlamp — positioned over the machine */}
        <g transform="translate(-130, 0)">
          <rect fill="#1a1530" x="1020" y="230" width="7" height="460" rx="2" />
          <path d="M1024,232 Q1024,222 1014,222 L985,222 Q978,222 978,228" stroke="#221e38" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M966,228 L998,228 L994,238 L970,238 Z" fill="#2a244a" />
          <rect fill="rgba(255,240,200,0.06)" x="972" y="238" width="20" height="12" rx="2" />
          <ellipse cx="982" cy="243" rx="5" ry="3.5" fill="#fff5dc" />
          <ellipse cx="982" cy="243" rx="120" ry="90" fill="url(#ag-glow)" filter="url(#ag-soft)" />
          <polygon points="958,248 1006,248 1200,690 760,690" fill="url(#ag-cone)" />
          <ellipse cx="982" cy="698" rx="200" ry="28" fill="#ffc848" fillOpacity="0.04" />
        </g>
      </svg>

      <div className="alley-content">{children}</div>
    </div>
  );
}

// ═══ Pack Zoom Modal — shows pack details on click ═══

function PackZoomModal({ slot, onClose }) {
  const pack = slot.pack;
  const packTypeId = pack.packTypeId || pack.id;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="vm-zoom-overlay" onClick={onClose}>
      <div className="vm-zoom-content" onClick={(e) => e.stopPropagation()}>
        {/* Pack art with ambient glow */}
        <div className="vm-zoom-pack-wrap">
          <div
            className="absolute -inset-20 rounded-3xl"
            style={{
              background: `radial-gradient(ellipse, ${PACKS[packTypeId]?.color || 'var(--cd-cyan)'}40 0%, transparent 70%)`,
              filter: 'blur(60px)',
              opacity: 0.7,
            }}
          />
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-4 rounded-full"
            style={{ background: PACKS[packTypeId]?.color || 'var(--cd-cyan)', filter: 'blur(16px)', opacity: 0.5 }}
          />
          <PackArt
            tier={packTypeId}
            name={pack.name}
            cardCount={pack.cards}
            seed={PACK_SEEDS[packTypeId] ?? 0}
          />
        </div>

        {/* Info panel — matches regular shop style */}
        <div className="cd-panel cd-corners rounded-xl p-6 w-80 relative overflow-hidden">
          <div className="cd-data-overlay" />
          <div className="relative z-1">
            <h3 className="cd-head text-2xl font-bold mb-1" style={{ color: PACKS[packTypeId]?.color || 'var(--cd-cyan)', letterSpacing: '0.12em' }}>
              {pack.name}
            </h3>
            {pack.description && (
              <p className="text-xs text-white/40 cd-head tracking-widest mb-5">{pack.description}</p>
            )}

            <div className="space-y-2.5 mb-6 text-[13px] text-white/60">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l4 6-10 13L2 9z" /></svg>
                <span><span className="text-white font-bold">{pack.cards}</span> cards per pack</span>
              </div>
              {pack.category === 'mixed' && (
                <>
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
                    <span>1 guaranteed <span className="font-bold" style={{ color: PACKS[packTypeId]?.color }}>Player</span> card</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-green-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                    <span>1 <span className="text-green-400 font-bold">Rare+</span> guaranteed slot</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-[var(--cd-cyan-dim)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" /></svg>
                    <span>1 <span className="text-[var(--cd-cyan)] font-bold">Wildcard</span> slot</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 mb-4">
              <img src={emberIcon} alt="" className="h-6 w-auto object-contain cd-icon-glow" />
              <span className="text-3xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{pack.price}</span>
              <span className="text-sm text-white/40 cd-head tracking-wider">Cores</span>
            </div>

            <div className="flex items-center justify-between text-xs text-white/30 cd-head tracking-widest">
              <span>Stock</span>
              <span className="text-white/50 font-bold">{pack.stock} <span className="font-normal text-white/20">/ {pack.initialStock}</span></span>
            </div>

            <button
              onClick={onClose}
              className="mt-5 text-[11px] text-white/20 cd-head tracking-widest hover:text-white/40 transition-colors cursor-pointer w-full text-center"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Sale vending machine — always renders with min 6 slots ═══

export default function SaleVendingMachine() {
  const { salePacks, ember, buySalePack } = useCardClash();

  const emberBalance = ember?.balance ?? 0;
  const hasPacks = salePacks?.length > 0;
  const rawSlots = useMemo(() => buildSlots(salePacks), [salePacks]);
  const slots = useMemo(() => padSlots(rawSlots), [rawSlots]);

  const [inputCode, setInputCode] = useState('');
  const [coinsInserted, setCoinsInserted] = useState(false);
  const [coinAnimating, setCoinAnimating] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [dispensedSlot, setDispensedSlot] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);
  const [openResult, setOpenResult] = useState(null);
  const [error, setError] = useState('');
  const [zoomedSlot, setZoomedSlot] = useState(null);

  const slotMap = useMemo(() => Object.fromEntries(slots.map(s => [s.code, s])), [slots]);
  const rowLetters = useMemo(() => [...new Set(slots.map(s => s.code[0]))], [slots]);
  const colNumbers = useMemo(() => [...new Set(slots.map(s => s.code[1]))], [slots]);

  const selectedSlot = slotMap[inputCode];
  const selectedPack = selectedSlot?.pack || null;
  const selectedCost = selectedPack ? selectedPack.price : 0;
  const selectedStock = selectedPack ? selectedPack.stock : 0;
  const selectedSoldOut = selectedPack ? selectedStock <= 0 : false;
  const canAfford = selectedPack ? emberBalance >= selectedCost && !selectedSoldOut : false;

  const handleKey = useCallback((key) => {
    if (phase !== 'idle') return;
    setError('');
    if (key === 'CLR') {
      setInputCode('');
      setCoinsInserted(false);
      return;
    }
    if (rowLetters.includes(key)) {
      setInputCode(key);
      setCoinsInserted(false);
    } else if (colNumbers.includes(key) && inputCode.length === 1 && rowLetters.includes(inputCode)) {
      setInputCode(prev => prev + key);
    }
  }, [phase, inputCode, rowLetters, colNumbers]);

  const handleInsertCoins = useCallback(() => {
    if (!selectedPack || !canAfford || coinsInserted || phase !== 'idle') return;
    setCoinAnimating(true);
    setTimeout(() => {
      setCoinsInserted(true);
      setCoinAnimating(false);
    }, 400);
  }, [selectedPack, canAfford, coinsInserted, phase]);

  const handleVend = useCallback(async () => {
    if (!selectedSlot || !coinsInserted || phase !== 'idle') return;
    setPhase('dispensing');
    setDispensedSlot(selectedSlot);

    try {
      const result = await buySalePack(selectedSlot.pack.id);
      if (!result) {
        setPhase('idle');
        setCoinsInserted(false);
        setDispensedSlot(null);
        return;
      }
      setTimeout(() => {
        setPhase('dropped');
        setPendingResult({ ...result, packType: selectedSlot.pack.packTypeId || selectedSlot.pack.id });
      }, 2000);
    } catch (err) {
      setError(err.message || 'MACHINE ERROR');
      setPhase('idle');
      setCoinsInserted(false);
      setDispensedSlot(null);
    }
  }, [selectedSlot, coinsInserted, phase, buySalePack]);

  const handleGrabPack = useCallback(() => {
    if (phase !== 'dropped' || !pendingResult) return;
    setOpenResult(pendingResult);
    setPendingResult(null);
    setPhase('idle');
    setInputCode('');
    setCoinsInserted(false);
    setDispensedSlot(null);
  }, [phase, pendingResult]);

  const closeResult = () => setOpenResult(null);

  const getDisplay = () => {
    if (!hasPacks) return { line1: 'SOLD OUT!', line2: 'CHECK BACK LATER', isError: true };
    if (error) return { line1: 'ERROR', line2: error, isError: true };
    if (phase === 'dispensing') return { line1: 'VENDING...', line2: 'PLEASE WAIT' };
    if (phase === 'dropped') return { line1: 'COMPLETE', line2: 'TAKE YOUR PACK' };
    if (!inputCode) return { line1: 'READY', line2: 'ENTER CODE' };
    if (inputCode.length === 1) return { line1: inputCode + '_', line2: 'ENTER NUMBER' };
    if (selectedSlot && !selectedPack) return { line1: inputCode, line2: 'EMPTY SLOT' };
    if (selectedSlot && selectedPack) {
      if (selectedSoldOut) return { line1: `${inputCode}`, line2: 'SOLD OUT', isError: true };
      if (coinsInserted) return { line1: `${inputCode} \u2014 ${selectedCost}`, line2: 'PRESS VEND' };
      if (!canAfford) return { line1: `${inputCode} \u2014 ${selectedCost}`, line2: 'INSUFFICIENT CORES' };
      return { line1: `${inputCode} \u2014 ${selectedPack.name}`, line2: `INSERT ${selectedCost} CORES` };
    }
    return { line1: inputCode, line2: 'INVALID CODE' };
  };

  const display = getDisplay();

  return (
    <AlleyScene>
      <div className="vm-container">
        <div className={`vm-body ${phase === 'dispensing' ? 'vm-dispensing' : ''}`}>
          <div className="vm-header">
            <span className="vm-header-text">LIMITED SALE</span>
          </div>

          <div className="vm-main">
            <div className="vm-glass">
              <div className="vm-backlight" />
              <div className="vm-glass-inner">
                {slots.map((slot, idx) => {
                  const pack = slot.pack;
                  const isEmpty = !pack;
                  const packTypeId = pack?.packTypeId || pack?.id;
                  const stock = pack ? pack.stock : 0;
                  const soldOut = pack && stock <= 0;
                  const isSelected = inputCode === slot.code;
                  const isDispensing = phase === 'dispensing' && dispensedSlot?.code === slot.code;
                  const isDispensed = dispensedSlot?.code === slot.code && phase === 'dropped';

                  return (
                    <div
                      key={slot.code}
                      className={`vm-slot ${isSelected && !isEmpty ? 'vm-slot-selected' : ''} ${isDispensed ? 'vm-slot-empty' : ''} ${isEmpty ? 'vm-slot-vacant' : ''}`}
                      onClick={() => {
                        if (phase === 'idle' && pack && !soldOut) {
                          setZoomedSlot(slot);
                        }
                        if (phase === 'idle') {
                          setInputCode(slot.code);
                          setCoinsInserted(false);
                          setError('');
                        }
                      }}
                    >
                      {pack ? (
                        <>
                          <span className="vm-label-stock">{stock}</span>
                          <div className={`vm-slot-pack ${isDispensing ? 'vm-pack-drop' : ''}`}>
                            <PackArt
                              tier={packTypeId}
                              name={pack.name}
                              cardCount={pack.cards}
                              seed={PACK_SEEDS[packTypeId] ?? idx}
                              compact
                            />
                          </div>
                          <div className="vm-shelf" />
                          <div className="vm-slot-label">
                            <span className="vm-label-code">{slot.code}</span>
                            <span className="vm-label-price">
                              <img src={emberIcon} alt="" className="vm-price-icon" />
                              {pack.price}
                            </span>
                          </div>
                          {soldOut && (
                            <div className="vm-sold-out-overlay">
                              <span className="vm-sold-out-text">SOLD OUT</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="vm-slot-empty-label">EMPTY</div>
                          <div className="vm-shelf" />
                          <div className="vm-slot-label">
                            <span className="vm-label-code">{slot.code}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="vm-glass-reflection" />
              <div className="vm-glass-scanline" />
            </div>

            <div className="vm-controls">
              <div className={`vm-display ${display.isError ? 'vm-display-error' : ''}`}>
                <div className="vm-display-line1">{display.line1}</div>
                <div className="vm-display-line2">{display.line2}</div>
              </div>

              <div className="vm-keypad">
                {rowLetters.map(k => (
                  <button key={k} className="vm-key" onClick={() => handleKey(k)}>{k}</button>
                ))}
                {colNumbers.map(k => (
                  <button key={k} className="vm-key" onClick={() => handleKey(k)}>{k}</button>
                ))}
                <button className="vm-key vm-key-clr" onClick={() => handleKey('CLR')}>CLR</button>
              </div>

              <button
                className={`vm-coin-slot ${coinsInserted ? 'vm-coin-inserted' : ''} ${selectedPack && canAfford && !coinsInserted && phase === 'idle' ? 'vm-coin-ready' : ''}`}
                onClick={handleInsertCoins}
                disabled={!selectedPack || !canAfford || coinsInserted || phase !== 'idle'}
              >
                {coinAnimating && <img src={emberIcon} alt="" className="vm-coin-anim" />}
                <div className="vm-coin-opening" />
                <div className="vm-coin-label">
                  {coinsInserted ? 'CORES INSERTED' : 'COIN SLOT'}
                </div>
              </button>

              <button
                className={`vm-vend-btn ${coinsInserted && phase === 'idle' ? 'vm-vend-ready' : ''}`}
                onClick={handleVend}
                disabled={!coinsInserted || phase !== 'idle'}
              >
                VEND
              </button>

              <div className="vm-balance">
                <img src={emberIcon} alt="" className="vm-balance-icon" />
                <span className="vm-balance-amount">{emberBalance}</span>
                <span className="vm-balance-label">CORES</span>
              </div>
            </div>
          </div>

          <div className="vm-tray">
            <div className="vm-tray-inner">
              {phase === 'dropped' && dispensedSlot?.pack ? (
                <div className="vm-tray-pack" onClick={handleGrabPack}>
                  <div className="vm-tray-pack-art">
                    <PackArt
                      tier={dispensedSlot.pack.packTypeId || dispensedSlot.pack.id}
                      name={dispensedSlot.pack.name}
                      cardCount={dispensedSlot.pack.cards}
                      seed={PACK_SEEDS[dispensedSlot.pack.packTypeId] ?? 0}
                      compact
                    />
                  </div>
                  <div className="vm-tray-grab">GRAB PACK</div>
                </div>
              ) : (
                <span className="vm-tray-empty-text">Dispensing Tray</span>
              )}
            </div>
            <div className="vm-tray-flap" />
          </div>

          <div className="vm-base" />
        </div>

        {openResult && (
          <PackOpening
            result={openResult}
            packType={openResult.packType}
            onClose={closeResult}
            onOpenMore={closeResult}
          />
        )}
      </div>

      {/* Pack zoom modal */}
      {zoomedSlot && zoomedSlot.pack && (
        <PackZoomModal slot={zoomedSlot} onClose={() => setZoomedSlot(null)} />
      )}
    </AlleyScene>
  );
}
