import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCardClash } from './CardClashContext'
import { Cog, AlertTriangle, ChevronRight } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'
import coinSide from '../../assets/passion/flipping3.png'
import emberIcon from '../../assets/ember.png'

const BASE_COST = 50
const MULTIPLIER = 1.7
const CORES_PER_PACK = 10
const getCost = (n) => Math.round(BASE_COST * Math.pow(MULTIPLIER, n))
const sleep = (ms) => new Promise(r => setTimeout(r, ms))


// ═══════════════════════════════════════════════
// Rate Gauge — compact gas valve for inside machine
// ═══════════════════════════════════════════════
function RateGauge({ conversionsToday, nextCost }) {
  const ratio = nextCost / BASE_COST
  const pressure = Math.min(((ratio - 1) / 7) * 100, 100)
  const needleAngle = -90 + (pressure / 100) * 180

  const getColor = (pct) => {
    if (pct < 15) return '#00e5ff'
    if (pct < 35) return '#22c55e'
    if (pct < 60) return '#ff8c00'
    if (pct < 80) return '#ff2d78'
    return '#ef4444'
  }
  const color = getColor(pressure)
  const dangerLevel = pressure > 60 ? 'DANGER' : pressure > 30 ? 'ELEVATED' : 'NOMINAL'

  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] text-white/35 uppercase tracking-[0.2em] font-bold mb-1 cd-head">
        Rate Pressure
      </div>

      <div className="relative w-36 h-20">
        <div className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(ellipse at 50% 90%, ${color}12, transparent 70%)`, filter: 'blur(12px)' }}
        />
        <svg viewBox="0 0 200 110" className="w-full h-full relative z-1">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#111a2a" strokeWidth="16" strokeLinecap="round" />
          <path d="M 20 100 A 80 80 0 0 1 43 43" fill="none" stroke="#00e5ff" strokeWidth="13" strokeLinecap="round" opacity="0.5" />
          <path d="M 46 40 A 80 80 0 0 1 100 20" fill="none" stroke="#22c55e" strokeWidth="13" opacity="0.5" />
          <path d="M 100 20 A 80 80 0 0 1 154 40" fill="none" stroke="#ff8c00" strokeWidth="13" opacity="0.5" />
          <path d="M 157 43 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="13" strokeLinecap="round" opacity="0.5" />
          {pressure > 0 && (
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${pressure * 2.51} 251`} opacity="0.8"
              style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          )}
          {[...Array(11)].map((_, i) => {
            const angle = (180 - i * 18) * Math.PI / 180
            return <line key={i} x1={100 + 68 * Math.cos(angle)} y1={100 - 68 * Math.sin(angle)}
              x2={100 + 63 * Math.cos(angle)} y2={100 - 63 * Math.sin(angle)} stroke="white" strokeWidth="1" opacity="0.15" />
          })}
          <g transform={`rotate(${needleAngle}, 100, 100)`} style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <line x1="100" y1="100" x2="100" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          </g>
          <circle cx="100" cy="100" r="8" fill="#0a0f1a" stroke={color} strokeWidth="2" opacity="0.8" />
          <circle cx="100" cy="100" r="3" fill={color} opacity="0.9" />
          <text x="15" y="108" fill="white" opacity="0.15" fontSize="7" fontFamily="'Share Tech Mono', monospace" textAnchor="start">LOW</text>
          <text x="185" y="108" fill="white" opacity="0.15" fontSize="7" fontFamily="'Share Tech Mono', monospace" textAnchor="end">MAX</text>
        </svg>
      </div>

      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="text-lg font-bold tabular-nums cd-num cd-text-glow" style={{ color }}>
          {ratio <= 1 ? '1.0' : ratio.toFixed(1)}x
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider cd-head" style={{ color: color + 'bb' }}>
          {dangerLevel}
        </div>
      </div>
      {conversionsToday > 0 && (
        <div className="text-[11px] text-white/30 mt-0.5 cd-mono">
          {conversionsToday} conversion{conversionsToday !== 1 ? 's' : ''} today
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════
// Terminal Display — top-right readout
// ═══════════════════════════════════════════════
function TerminalDisplay({ conversionsToday, nextCost, processing }) {
  const now = new Date()
  const timeStr = now.toISOString().slice(11, 19)
  const multiplier = nextCost / BASE_COST

  return (
    <div className="cd-terminal w-44 sm:w-52 overflow-hidden relative"
      style={{ background: 'rgba(0,8,4,0.9)', padding: '10px 12px' }}>
      {/* Scanline overlay */}
      <div className="absolute inset-0 cd-scanline pointer-events-none opacity-40" />
      {/* Content */}
      <div className="relative z-1 cd-mono text-[10px] sm:text-[11px] leading-relaxed">
        <div className="text-green-500/80">
          <span className="text-green-500/40">$</span> sys.status
        </div>
        <div className="text-white font-bold mt-1" style={{ textShadow: '0 0 8px rgba(255,255,255,0.5)' }}>
          {'>'}  insert coin to convert
        </div>
        <div className="text-green-500/50 mt-1">
          CONV_TODAY: <span className="text-green-400/90">{conversionsToday}</span>
        </div>
        <div className="text-green-500/50">
          NEXT_COST:  <span className="text-green-400/90">{nextCost}</span>
        </div>
        <div className="text-green-500/50">
          MULTIPLIER: <span style={{ color: multiplier > 3 ? '#ef4444' : multiplier > 1.5 ? '#ff8c00' : '#4ade80' }}>
            {multiplier.toFixed(1)}x
          </span>
        </div>
        <div className="text-green-500/50">
          ENGINE:     <span className={processing ? 'text-amber-400/90' : 'text-green-400/90'}>
            {processing ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        <div className="text-green-500/30 mt-1 text-[9px]">
          UTC {timeStr}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════
// Draggable Coin
// ═══════════════════════════════════════════════
function DraggableCoin({ slotRef, onInsert, onElevatedDrop, canAfford, disabled, shouldWarn, nextCost, onHoverSlot, onDragChange }) {
  const coinRef = useRef(null)
  const drag = useRef({ active: false, originX: 0, originY: 0 })
  const [dragging, setDragging] = useState(false)

  const getSlotCenter = () => {
    if (!slotRef.current) return null
    const sr = slotRef.current.getBoundingClientRect()
    return { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 }
  }

  const isOverSlot = (clientX, clientY) => {
    const center = getSlotCenter()
    if (!center) return false
    const dist = Math.sqrt((clientX - center.x) ** 2 + (clientY - center.y) ** 2)
    return dist < 55
  }

  // Calculate rotation (0°→90°) based on proximity to slot
  const getRotation = (clientX, clientY) => {
    const center = getSlotCenter()
    if (!center) return 0
    const dist = Math.sqrt((clientX - center.x) ** 2 + (clientY - center.y) ** 2)
    const maxDist = 300 // start rotating within 300px
    if (dist >= maxDist) return 0
    const progress = 1 - dist / maxDist
    return Math.min(progress * 90, 90)
  }

  const handlePointerDown = (e) => {
    if (!canAfford || disabled) return
    e.preventDefault()
    const el = coinRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    drag.current = {
      active: true,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
    }
    el.style.transition = 'none'
    setDragging(true)
    onDragChange?.(true)
  }

  const handlePointerMove = (e) => {
    if (!drag.current.active) return
    const el = coinRef.current
    if (!el) return
    const dx = e.clientX - drag.current.originX
    const dy = e.clientY - drag.current.originY
    const rot = getRotation(e.clientX, e.clientY)
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(1.05)`
    onHoverSlot(isOverSlot(e.clientX, e.clientY))
  }

  const handlePointerUp = (e) => {
    if (!drag.current.active) return
    drag.current.active = false
    const el = coinRef.current
    if (!el) return

    const over = isOverSlot(e.clientX, e.clientY)
    onHoverSlot(false)

    if (over && canAfford) {
      if (shouldWarn) {
        // Elevated rate — snap back, parent shows warning
        el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        el.style.transform = ''
        setTimeout(() => { setDragging(false); onDragChange?.(false) }, 400)
        onElevatedDrop()
        return
      }
      // Animate coin into slot (vertical slit — shrink width, keep height)
      const center = getSlotCenter()
      const dx = center.x - drag.current.originX
      const dy = center.y - drag.current.originY
      el.style.transition = 'transform 0.35s ease-in, opacity 0.3s ease-in 0.05s'
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(90deg) scaleX(0.15) scaleY(0.5)`
      onDragChange?.(false)
      setTimeout(() => onInsert(), 350)
    } else {
      // Snap back
      el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
      el.style.transform = ''
      setTimeout(() => { setDragging(false); onDragChange?.(false) }, 500)
    }
  }

  // Reset styles on mount (coin reappearing)
  useEffect(() => {
    const el = coinRef.current
    if (el) {
      el.style.transform = ''
      el.style.opacity = ''
      el.style.transition = ''
    }
  }, [])

  return (
    <div className="flex flex-col items-center shrink-0 sm:self-center">
      {canAfford && !disabled && !dragging && (
        <svg className="w-6 h-6 text-white mb-1 animate-bounce" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}
      <img
        ref={coinRef}
        src={coinSide}
        alt="Drag to convert"
        className={`w-32 sm:w-36 select-none ${
          canAfford && !disabled && !dragging ? 'cursor-grab cd-coin-float'
            : dragging ? 'cursor-grabbing'
            : 'opacity-25 cursor-not-allowed'
        }`}
        style={{
          touchAction: 'none',
          filter: canAfford && !disabled ? 'drop-shadow(0 8px 20px rgba(200,160,50,0.4))' : 'none',
        }}
        draggable={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {canAfford && !disabled && !dragging && (
        <div className="text-[11px] text-amber-400/35 cd-head tracking-wider mt-0.5">
          Drag to insert
        </div>
      )}
      {!canAfford && !disabled && (
        <div className="text-[11px] text-white/20 cd-head tracking-wider mt-0.5">
          Need {nextCost} Passion
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════
// Conversion Machine
// ═══════════════════════════════════════════════
function ConversionMachine({
  processing, nextCost, passion, ember, result, conversionsToday,
  inputRef, outputRef, passionDisplayRef, coresDisplayRef,
  slotRef, isOverSlot, isDragging,
}) {
  return (
    <div className={`cd-machine relative ${processing ? 'cd-machine-active' : ''}`}>
      {/* Ambient glow */}
      <div className="absolute -inset-16 pointer-events-none"
        style={{
          background: processing
            ? 'radial-gradient(ellipse, rgba(0,229,255,0.15) 0%, rgba(180,74,255,0.05) 40%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(0,229,255,0.05) 0%, transparent 60%)',
          transition: 'background 0.5s',
        }}
      />

      {/* Machine body */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0e1c, #060a14, #040810)' }}>

        {/* Top edge neon line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.4), rgba(255,45,120,0.3), rgba(0,229,255,0.4), transparent)' }} />

        {/* Side accent lines */}
        <div className="absolute top-0 bottom-0 left-0 w-[2px]" style={{ background: 'rgba(0,229,255,0.08)' }} />
        <div className="absolute top-0 bottom-0 right-0 w-[2px]" style={{ background: 'rgba(0,229,255,0.08)' }} />

        {/* ── Top section: Coin Slot (left) + Gauge + Terminal ── */}
        <div className="flex items-stretch px-5 sm:px-8 pt-5 pb-3 relative gap-4 sm:gap-5">
          {/* Vertical coin slot — top-left */}
          <div ref={slotRef} className="shrink-0 flex flex-col items-center">
            <div className="text-[11px] text-white/60 uppercase tracking-[0.15em] cd-head mb-1.5 whitespace-nowrap">
              Insert
            </div>
            <div className="relative w-5 flex-1 min-h-[100px] overflow-hidden transition-all duration-300"
              style={{
                background: '#020406',
                borderLeft: `1px solid ${isOverSlot ? 'rgba(248,197,106,0.7)' : isDragging ? 'rgba(248,197,106,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRight: `1px solid ${isOverSlot ? 'rgba(248,197,106,0.7)' : isDragging ? 'rgba(248,197,106,0.5)' : 'rgba(255,255,255,0.15)'}`,
                boxShadow: isOverSlot
                  ? '0 0 25px rgba(248,197,106,0.5), inset 0 0 15px rgba(248,197,106,0.25)'
                  : isDragging
                    ? '0 0 18px rgba(248,197,106,0.35), inset 0 0 10px rgba(248,197,106,0.15)'
                    : '0 0 6px rgba(255,255,255,0.05), inset 2px 0 6px rgba(0,0,0,0.8)',
              }}>
              {/* Inner glow */}
              <div className={`absolute inset-0 ${isOverSlot ? 'animate-pulse' : ''}`}
                style={{ background: `linear-gradient(180deg, transparent, rgba(248,197,106,${isOverSlot ? '0.35' : isDragging ? '0.2' : '0.05'}), transparent)` }} />
              {/* Vertical label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] uppercase tracking-[0.2em] cd-head"
                  style={{
                    color: isOverSlot ? 'rgba(248,197,106,1)' : isDragging ? 'rgba(248,197,106,0.7)' : 'rgba(255,255,255,0.45)',
                    textShadow: isOverSlot ? '0 0 6px rgba(248,197,106,0.5)' : isDragging ? '0 0 4px rgba(248,197,106,0.3)' : 'none',
                    writingMode: 'vertical-rl', textOrientation: 'mixed',
                  }}>
                  Coin
                </span>
              </div>
            </div>
          </div>

          {/* Gauge + Terminal */}
          <div className="flex-1 flex items-start justify-between">
            <RateGauge conversionsToday={conversionsToday} nextCost={nextCost} />
            <TerminalDisplay conversionsToday={conversionsToday} nextCost={nextCost} processing={processing} />
          </div>
        </div>

        {/* ── Center section: Input → Gears → Output ── */}
        <div className="px-5 sm:px-8 py-6 relative">
          <div className="flex items-center justify-center gap-3 sm:gap-5 relative z-1">
            {/* Input port */}
            <div ref={inputRef}
              className="flex flex-col items-center gap-1.5 px-4 py-3 relative shrink-0 transition-all"
              style={{
                background: processing ? 'rgba(248,197,106,0.08)' : 'rgba(248,197,106,0.03)',
                boxShadow: processing ? '0 0 25px rgba(248,197,106,0.2), inset 0 0 15px rgba(248,197,106,0.05)' : 'none',
              }}>
              <img src={passionCoin} alt="" className="w-10 h-10" />
              <div className="text-[11px] text-amber-400/50 uppercase tracking-wider cd-head">In</div>
            </div>

            <ChevronRight className="w-4 h-4 text-white/8 shrink-0" />

            {/* GEARS */}
            <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
              <div className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: processing ? '0 0 30px rgba(0,229,255,0.15), 0 0 60px rgba(0,229,255,0.05)' : 'none',
                  transition: 'box-shadow 0.5s',
                }}
              />
              <Cog className={`absolute w-32 h-32 sm:w-40 sm:h-40 ${processing ? 'cd-gear-spin-fast' : 'cd-gear-spin'}`}
                style={{
                  color: processing ? 'rgba(0,229,255,0.5)' : 'rgba(0,229,255,0.12)',
                  filter: processing ? 'drop-shadow(0 0 8px rgba(0,229,255,0.3))' : 'none',
                  transition: 'color 0.5s, filter 0.5s',
                }} />
              <Cog className={`absolute w-20 h-20 sm:w-24 sm:h-24 ${processing ? 'cd-gear-spin-fast-reverse' : 'cd-gear-spin-reverse'}`}
                style={{
                  color: processing ? 'rgba(255,45,120,0.4)' : 'rgba(255,45,120,0.08)',
                  filter: processing ? 'drop-shadow(0 0 6px rgba(255,45,120,0.2))' : 'none',
                  transition: 'color 0.5s, filter 0.5s',
                }} />
              <Cog className={`absolute w-10 h-10 sm:w-12 sm:h-12 ${processing ? 'cd-gear-spin-fast' : 'cd-gear-spin'}`}
                style={{
                  color: processing ? 'rgba(180,74,255,0.5)' : 'rgba(180,74,255,0.1)',
                  transition: 'color 0.5s',
                }} />
              <div className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-full z-10"
                style={{
                  background: processing
                    ? 'radial-gradient(circle, var(--cd-cyan), rgba(0,229,255,0.3))'
                    : 'radial-gradient(circle, rgba(0,229,255,0.3), rgba(0,229,255,0.05))',
                  boxShadow: processing
                    ? '0 0 15px var(--cd-cyan), 0 0 30px rgba(0,229,255,0.4), 0 0 60px rgba(0,229,255,0.1)'
                    : '0 0 4px rgba(0,229,255,0.2)',
                  transition: 'all 0.3s',
                }}>
                {processing && (
                  <div className="absolute inset-0 rounded-full animate-ping"
                    style={{ background: 'rgba(0,229,255,0.3)' }} />
                )}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-white/8 shrink-0" />

            {/* Output port */}
            <div ref={outputRef}
              className="flex flex-col items-center gap-1.5 px-4 py-3 relative shrink-0 transition-all"
              style={{
                background: processing ? 'rgba(0,229,255,0.08)' : 'rgba(0,229,255,0.03)',
                boxShadow: processing ? '0 0 25px rgba(0,229,255,0.2), inset 0 0 15px rgba(0,229,255,0.05)' : 'none',
              }}>
              <img src={emberIcon} alt="" className="h-10 w-auto object-contain" />
              <div className="text-[11px] text-[var(--cd-cyan)]/50 uppercase tracking-wider cd-head">Out</div>
            </div>
          </div>
        </div>

        {/* ── Rate display ── */}
        <div className="mx-5 sm:mx-8 mb-4">
          <div className="flex items-center justify-center gap-4 py-3 px-5 bg-black/40 relative overflow-hidden">
            <div className="absolute inset-0 cd-scanline pointer-events-none" />
            <div className="flex items-center gap-2 relative z-1">
              <img src={passionCoin} alt="" className="w-7 h-7" />
              <span className="text-4xl font-black text-amber-400 tabular-nums cd-num">{nextCost}</span>
            </div>
            <svg className="w-7 h-7 text-white/20 relative z-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="flex items-center gap-2 relative z-1">
              <span className="text-4xl font-black text-[var(--cd-cyan)] tabular-nums cd-num cd-text-glow">{CORES_PER_PACK}</span>
              <img src={emberIcon} alt="" className="h-7 w-auto object-contain" />
            </div>
          </div>
        </div>

        {/* ── Bottom section: Balances + LEDs ── */}
        <div className="flex items-center justify-between px-5 sm:px-8 pb-5">
          <div className="flex items-center gap-6">
            <div ref={passionDisplayRef} className="flex items-center gap-2">
              <img src={passionCoin} alt="" className="w-8 h-8" />
              <div>
                <div className="text-xl font-black text-amber-400 tabular-nums cd-num leading-none">
                  {result ? result.passionBalance : passion}
                </div>
                <div className="text-[10px] text-amber-400/45 uppercase tracking-wider cd-head mt-0.5">Passion</div>
              </div>
            </div>
            <div ref={coresDisplayRef} className="flex items-center gap-2">
              <img src={emberIcon} alt="" className="h-8 w-auto object-contain" />
              <div>
                <div className="text-xl font-black text-[var(--cd-cyan)] tabular-nums cd-num cd-text-glow leading-none">
                  {result ? result.emberBalance : (ember.balance || 0)}
                </div>
                <div className="text-[10px] text-[var(--cd-cyan)]/45 uppercase tracking-wider cd-head mt-0.5">Cores</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: processing
                    ? ['var(--cd-cyan)', 'var(--cd-magenta)', 'var(--cd-purple)', 'var(--cd-cyan)', '#22c55e', 'var(--cd-magenta)', 'var(--cd-cyan)', 'var(--cd-purple)', 'var(--cd-cyan)'][i]
                    : i % 3 === 0 ? 'rgba(0,229,255,0.15)' : '#111a2a',
                  boxShadow: processing
                    ? `0 0 8px ${['var(--cd-cyan)', 'var(--cd-magenta)', 'var(--cd-purple)', 'var(--cd-cyan)', '#22c55e', 'var(--cd-magenta)', 'var(--cd-cyan)', 'var(--cd-purple)', 'var(--cd-cyan)'][i]}`
                    : 'none',
                  transitionDelay: `${i * 0.04}s`,
                  animation: processing ? `cd-led-blink 0.6s ease-in-out ${i * 0.08}s infinite alternate` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Bottom edge neon line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.2), rgba(255,45,120,0.15), rgba(0,229,255,0.2), transparent)' }} />
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════
// Warning Modal
// ═══════════════════════════════════════════════
function WarningModal({ nextCost, conversionsToday, multiplier, onConfirm, onCancel }) {
  const color = multiplier > 4 ? '#ef4444' : multiplier > 2.5 ? '#ff2d78' : '#ff8c00'

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="cd-panel cd-corners rounded-2xl p-6 w-[340px] max-w-[90vw] relative overflow-hidden"
        onClick={e => e.stopPropagation()} style={{ borderColor: color + '40' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: color + '15', border: `1px solid ${color}40` }}>
            <AlertTriangle className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <div className="text-sm font-bold cd-head tracking-wider" style={{ color }}>Elevated Rate Warning</div>
            <div className="text-[10px] text-white/30">Conversion #{conversionsToday + 1} today</div>
          </div>
        </div>
        <div className="rounded-lg p-3 mb-4" style={{ background: color + '08', border: `1px solid ${color}15` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">Base rate</span>
            <span className="text-xs text-white/50 cd-mono">{BASE_COST} Passion</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color }}>Current rate</span>
            <span className="text-lg font-black cd-num" style={{ color }}>{nextCost} Passion</span>
          </div>
          <div className="text-right text-[10px] mt-0.5" style={{ color: color + '80' }}>{multiplier.toFixed(1)}x base price</div>
        </div>
        <div className="mb-4">
          <div className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 cd-head">If you continue...</div>
          <div className="flex gap-1">
            {[0, 1, 2].map(offset => {
              const cost = getCost(conversionsToday + 1 + offset)
              return (
                <div key={offset} className="flex-1 text-center py-1.5 rounded bg-white/3 border border-white/5">
                  <div className="text-[9px] text-white/20">Next{offset > 0 ? ` +${offset + 1}` : ''}</div>
                  <div className="text-xs font-bold text-white/50 cd-num">{cost}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold cd-head tracking-wider bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-all cursor-pointer">
            Back Away
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold cd-head tracking-wider transition-all cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${color}30, ${color}15)`, border: `1px solid ${color}40`, color }}>
            Convert Anyway
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


// ═══════════════════════════════════════════════
// Flying Particles
// ═══════════════════════════════════════════════
function FlyingParticles({ particles }) {
  if (particles.length === 0) return null
  return createPortal(
    <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full"
          style={{
            left: p.startX, top: p.startY, width: p.size, height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}, 0 0 ${p.size * 4}px ${p.color}50`,
            animation: `cd-particle-fly ${p.duration}ms cubic-bezier(0.25, 0.1, 0.25, 1) ${p.delay}ms forwards`,
            '--dx': `${p.endX - p.startX}px`, '--dy': `${p.endY - p.startY}px`, '--arc': `${p.arc}px`,
          }}
        />
      ))}
    </div>,
    document.body
  )
}


// ═══════════════════════════════════════════════
// Rate Schedule
// ═══════════════════════════════════════════════
function RateSchedule({ conversionsToday }) {
  const entries = [...Array(6)].map((_, i) => ({
    n: i, cost: getCost(i), done: i < conversionsToday, current: i === conversionsToday,
  }))

  return (
    <div className="mt-6 max-w-md mx-auto px-4 sm:px-0">
      <div className="text-xs text-white/30 uppercase tracking-[0.2em] mb-3 cd-head text-center">Rate Schedule</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {entries.map(e => {
          const ratio = e.cost / BASE_COST
          const color = ratio <= 1 ? '#00e5ff' : ratio < 2 ? '#22c55e' : ratio < 3.5 ? '#ff8c00' : ratio < 6 ? '#ff2d78' : '#ef4444'
          return (
            <div key={e.n} className={`text-center py-2.5 rounded-lg border transition-all ${
              e.current ? 'border-[var(--cd-cyan)]/30 bg-[var(--cd-cyan)]/8'
                : e.done ? 'border-white/5 bg-white/2 opacity-40' : 'border-white/5 bg-white/2'
            }`}>
              <div className="text-[11px] text-white/35 cd-head">#{e.n + 1}</div>
              <div className="text-base font-bold tabular-nums cd-num" style={{ color: e.current ? color : color + '90' }}>{e.cost}</div>
              {e.done && <div className="text-[10px] text-white/30">done</div>}
              {e.current && <div className="text-[10px]" style={{ color: 'var(--cd-cyan)' }}>next</div>}
            </div>
          )
        })}
      </div>
      <div className="text-xs text-white/25 text-center mt-2.5 cd-mono">Rates reset at midnight UTC</div>
    </div>
  )
}


// ═══════════════════════════════════════════════
// Main Converter Component
// ═══════════════════════════════════════════════
export default function CCConverter() {
  const { passion, ember, convertPassionToEmber } = useCardClash()
  const [showWarning, setShowWarning] = useState(false)
  const [converting, setConverting] = useState(false)
  const [particles, setParticles] = useState([])
  const [result, setResult] = useState(null)
  const [localConversions, setLocalConversions] = useState(null)
  const [localNextCost, setLocalNextCost] = useState(null)
  const [isOverSlot, setIsOverSlot] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [coinVisible, setCoinVisible] = useState(true)
  const inputRef = useRef(null)
  const outputRef = useRef(null)
  const passionDisplayRef = useRef(null)
  const coresDisplayRef = useRef(null)
  const slotRef = useRef(null)

  const conversionsToday = localConversions ?? ember.conversionsToday ?? 0
  const nextCost = localNextCost ?? ember.nextConversionCost ?? getCost(conversionsToday)
  const multiplier = nextCost / BASE_COST
  const canAfford = passion >= nextCost

  const spawnParticles = useCallback((fromEl, toEl, count, color) => {
    if (!fromEl || !toEl) return
    const fromRect = fromEl.getBoundingClientRect()
    const toRect = toEl.getBoundingClientRect()
    const newParticles = []
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: `${Date.now()}-${Math.random()}`,
        startX: fromRect.left + fromRect.width / 2 - 3,
        startY: fromRect.top + fromRect.height / 2 - 3,
        endX: toRect.left + toRect.width / 2 - 3,
        endY: toRect.top + toRect.height / 2 - 3,
        delay: i * 60 + Math.random() * 40,
        duration: 600 + Math.random() * 400,
        color, size: 4 + Math.random() * 5, arc: -30 - Math.random() * 40,
      })
    }
    setParticles(prev => [...prev, ...newParticles])
    const ids = newParticles.map(p => p.id)
    setTimeout(() => setParticles(prev => prev.filter(p => !ids.includes(p.id))), 2000)
  }, [])

  // Core conversion logic — shared by drag and button paths
  const doConvert = useCallback(async () => {
    setShowWarning(false)
    setConverting(true)
    setCoinVisible(false)
    setResult(null)

    spawnParticles(passionDisplayRef.current, inputRef.current, 8, '#f8c56a')
    await sleep(900)

    try {
      const res = await convertPassionToEmber()
      setResult(res)
      if (res.conversionsToday != null) setLocalConversions(res.conversionsToday)
      if (res.nextConversionCost != null) setLocalNextCost(res.nextConversionCost)

      await sleep(200)
      const navEmber = document.getElementById('ember-balance-icon')
      const target = navEmber || coresDisplayRef.current
      spawnParticles(outputRef.current, target, 8, '#00e5ff')

      await sleep(1000)
      setConverting(false)
      // Coin reappears after machine finishes
      setTimeout(() => setCoinVisible(true), 500)
      setTimeout(() => setResult(null), 4000)
    } catch {
      setConverting(false)
      setCoinVisible(true)
    }
  }, [convertPassionToEmber, spawnParticles])

  // Drag dropped on slot — convert immediately
  const handleCoinInsert = useCallback(() => {
    doConvert()
  }, [doConvert])

  // Drag dropped on slot at elevated rate — show warning, snap coin back
  const handleElevatedDrop = useCallback(() => {
    setShowWarning(true)
  }, [])

  // Button click fallback
  const handleConvertClick = () => {
    if (!canAfford) return
    if (conversionsToday > 0) setShowWarning(true)
    else doConvert()
  }

  // Warning confirmed (from either drag or button)
  const handleWarningConfirm = () => {
    doConvert()
  }

  return (
    <div className="cd-alley pb-12">
      <div className="cd-alley-fog" />

      {/* ── Header Sign ── */}
      <div className="flex flex-col items-center mt-6 mb-6 sm:mb-10">
        <div className="flex items-center gap-4 sm:gap-6 px-6 sm:px-10 py-4 sm:py-5 rounded-2xl border border-white/6 bg-black/30 relative">
          <img src={passionCoin} alt="Passion" className="w-12 h-12 sm:w-20 sm:h-20" />
          <svg className="w-8 h-8 sm:w-14 sm:h-14 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <img src={emberIcon} alt="Cores" className="h-12 sm:h-20 w-auto object-contain" />

          <div className="absolute -bottom-3 right-4 px-3 rounded bg-[var(--cd-magenta)]/15 border border-[var(--cd-magenta)]/25 -rotate-3 flex items-center"
            style={{ transformOrigin: 'top right', height: '18px' }}>
            <span className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: 'rgba(255,45,120,0.7)', fontFamily: "'Teko', sans-serif", lineHeight: 1 }}>
              no refunds
            </span>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-white/30 mt-5 sm:mt-7 cd-head tracking-widest">
          Rates increase with each daily conversion
        </p>
      </div>

      {/* ══════════════════════════════════════════════
          MOBILE LAYOUT
         ══════════════════════════════════════════════ */}
      <div className="sm:hidden px-4 mb-4">
        {/* Gears + Gauge side by side */}
        <div className="flex items-center justify-center gap-4 mb-3">
          {/* Gears — smaller */}
          <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
            <Cog className={`absolute w-20 h-20 ${converting ? 'cd-gear-spin-fast' : 'cd-gear-spin'}`}
              style={{
                color: converting ? 'rgba(0,229,255,0.5)' : 'rgba(0,229,255,0.12)',
                filter: converting ? 'drop-shadow(0 0 8px rgba(0,229,255,0.3))' : 'none',
                transition: 'color 0.5s, filter 0.5s',
              }} />
            <Cog className={`absolute w-12 h-12 ${converting ? 'cd-gear-spin-fast-reverse' : 'cd-gear-spin-reverse'}`}
              style={{
                color: converting ? 'rgba(255,45,120,0.4)' : 'rgba(255,45,120,0.08)',
                filter: converting ? 'drop-shadow(0 0 6px rgba(255,45,120,0.2))' : 'none',
                transition: 'color 0.5s, filter 0.5s',
              }} />
            <Cog className={`absolute w-6 h-6 ${converting ? 'cd-gear-spin-fast' : 'cd-gear-spin'}`}
              style={{
                color: converting ? 'rgba(180,74,255,0.5)' : 'rgba(180,74,255,0.1)',
                transition: 'color 0.5s',
              }} />
            <div className="relative w-3 h-3 rounded-full z-10"
              style={{
                background: converting
                  ? 'radial-gradient(circle, var(--cd-cyan), rgba(0,229,255,0.3))'
                  : 'radial-gradient(circle, rgba(0,229,255,0.3), rgba(0,229,255,0.05))',
                boxShadow: converting
                  ? '0 0 15px var(--cd-cyan), 0 0 30px rgba(0,229,255,0.4)'
                  : '0 0 4px rgba(0,229,255,0.2)',
                transition: 'all 0.3s',
              }}>
              {converting && (
                <div className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: 'rgba(0,229,255,0.3)' }} />
              )}
            </div>
          </div>

          {/* Rate gauge */}
          <RateGauge conversionsToday={conversionsToday} nextCost={nextCost} />
        </div>

        {/* Rate summary — compact */}
        <div className="flex items-center justify-center gap-3 py-2 px-3 bg-black/40 mb-3 relative overflow-hidden rounded">
          <div className="absolute inset-0 cd-scanline pointer-events-none" />
          <div className="flex items-center gap-1 relative z-1">
            <img src={passionCoin} alt="" className="w-5 h-5" />
            <span className="text-xl font-black text-amber-400 tabular-nums cd-num">{nextCost}</span>
          </div>
          <svg className="w-4 h-4 text-white/20 relative z-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="flex items-center gap-1 relative z-1">
            <span className="text-xl font-black text-[var(--cd-cyan)] tabular-nums cd-num cd-text-glow">{CORES_PER_PACK}</span>
            <img src={emberIcon} alt="" className="h-5 w-auto object-contain" />
          </div>
        </div>

        {/* Result flash */}
        {result && !converting && (
          <div className="text-center py-1.5 mb-2 cd-result-flash rounded-lg text-sm">
            <span className="text-amber-400 font-bold cd-num">-{result.passionSpent}</span>
            <span className="text-white/30 mx-2">{">"}</span>
            <span className="text-[var(--cd-cyan)] font-bold cd-num cd-text-glow">+{result.emberGained} Cores</span>
          </div>
        )}

        {/* Convert button */}
        <button onClick={handleConvertClick} disabled={!canAfford || converting}
          className={`w-full py-2.5 text-sm font-bold tracking-[0.15em] transition-all mb-2 flex items-center justify-center gap-2 ${
            converting ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]/50 cursor-wait'
              : canAfford ? 'bg-blue-500 text-white border border-blue-400 cursor-pointer hover:bg-blue-400'
              : 'bg-white/3 text-white/15 cursor-not-allowed'
          }`} style={{ fontFamily: "'Teko', sans-serif", fontSize: '18px', letterSpacing: '0.15em' }}>
          {converting ? 'CONVERTING...' : canAfford ? (
            <>CONVERT — <img src={passionCoin} alt="" className="w-5 h-5 inline" /><span className="text-amber-300">{nextCost}</span></>
          ) : (
            <>NEED <img src={passionCoin} alt="" className="w-5 h-5 inline" /><span>{nextCost}</span></>
          )}
        </button>

        {/* Balances — compact text line */}
        <div className="text-center text-[11px] text-white/30 mb-2 cd-mono">
          <span className="text-amber-400/60">{result ? result.passionBalance : passion}</span>
          <span className="text-white/15"> Passion</span>
          <span className="text-white/10 mx-1.5">&middot;</span>
          <span className="text-[var(--cd-cyan)]/60">{result ? result.emberBalance : (ember.balance || 0)}</span>
          <span className="text-white/15"> Cores</span>
        </div>

        {/* Rate info */}
        {conversionsToday > 0 && !converting && (
          <div className="text-center text-[10px] text-white/30 mb-2">
            <span style={{ color: multiplier > 3 ? '#ff2d78' : multiplier > 1.5 ? '#ff8c00' : 'var(--cd-cyan)' }}>
              {multiplier.toFixed(1)}x base rate
            </span>
            <span className="text-white/15 mx-1">&middot;</span>
            Resets at midnight UTC
          </div>
        )}

        {/* LED strip */}
        <div className="flex items-center justify-center gap-1.5">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
              style={{
                background: converting
                  ? ['var(--cd-cyan)', 'var(--cd-magenta)', 'var(--cd-purple)', 'var(--cd-cyan)', '#22c55e', 'var(--cd-magenta)', 'var(--cd-cyan)', 'var(--cd-purple)', 'var(--cd-cyan)'][i]
                  : i % 3 === 0 ? 'rgba(0,229,255,0.15)' : '#111a2a',
                boxShadow: converting
                  ? `0 0 6px ${['var(--cd-cyan)', 'var(--cd-magenta)', 'var(--cd-purple)', 'var(--cd-cyan)', '#22c55e', 'var(--cd-magenta)', 'var(--cd-cyan)', 'var(--cd-purple)', 'var(--cd-cyan)'][i]}`
                  : 'none',
                transitionDelay: `${i * 0.04}s`,
                animation: converting ? `cd-led-blink 0.6s ease-in-out ${i * 0.08}s infinite alternate` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT
         ══════════════════════════════════════════════ */}

      {/* Machine (centered) with coin floating in front */}
      <div className="hidden sm:flex justify-center mb-5 px-2">
        <div className="relative">
          <ConversionMachine
            processing={converting}
            nextCost={nextCost}
            passion={passion}
            ember={ember}
            result={result}
            conversionsToday={conversionsToday}
            inputRef={inputRef}
            outputRef={outputRef}
            passionDisplayRef={passionDisplayRef}
            coresDisplayRef={coresDisplayRef}
            slotRef={slotRef}
            isOverSlot={isOverSlot}
            isDragging={isDragging}
          />

          {/* Coin floating in front of machine, near the slot */}
          {coinVisible && (
            <div className="absolute z-20" style={{ left: '-170px', top: '20px', animation: 'cd-fade-in 0.5s ease' }}>
              <DraggableCoin
                slotRef={slotRef}
                onInsert={handleCoinInsert}
                onElevatedDrop={handleElevatedDrop}
                canAfford={canAfford}
                disabled={converting}
                shouldWarn={conversionsToday > 0}
                nextCost={nextCost}
                onHoverSlot={setIsOverSlot}
                onDragChange={setIsDragging}
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop fallback button + result */}
      <div className="hidden sm:flex justify-center mb-2">
        {result && !converting ? (
          <div className="text-center py-3 px-8 cd-result-flash rounded-xl">
            <div className="text-base">
              <span className="text-amber-400 font-bold cd-num">-{result.passionSpent}</span>
              <span className="text-white/30 mx-2">{">"}</span>
              <span className="text-[var(--cd-cyan)] font-bold cd-num cd-text-glow">+{result.emberGained} Cores</span>
            </div>
            <div className="text-xs text-white/35 mt-1">Next: {result.nextConversionCost} Passion</div>
          </div>
        ) : !converting && (
          <button onClick={handleConvertClick} disabled={!canAfford}
            className={`px-6 py-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
              canAfford ? 'bg-blue-500 text-white hover:bg-blue-400 border border-blue-400'
                : 'text-white/15 cursor-not-allowed'
            }`} style={{ fontFamily: "'Teko', sans-serif", fontSize: '18px', letterSpacing: '0.15em' }}>
            {canAfford ? (
              <>OR CLICK TO CONVERT — <img src={passionCoin} alt="" className="w-5 h-5" /><span className="text-amber-300">{nextCost}</span></>
            ) : (
              <>NEED <img src={passionCoin} alt="" className="w-5 h-5" /><span>{nextCost}</span></>
            )}
          </button>
        )}
      </div>

      {conversionsToday > 0 && !converting && (
        <div className="hidden sm:block text-center text-xs text-white/30 mb-2">
          <span style={{ color: multiplier > 3 ? '#ff2d78' : multiplier > 1.5 ? '#ff8c00' : 'var(--cd-cyan)' }}>
            {multiplier.toFixed(1)}x base rate
          </span>
          <span className="text-white/15 mx-1.5">&middot;</span>
          Rates reset at midnight UTC
        </div>
      )}

      <RateSchedule conversionsToday={conversionsToday} />
      {showWarning && (
        <WarningModal
          nextCost={nextCost}
          conversionsToday={conversionsToday}
          multiplier={multiplier}
          onConfirm={handleWarningConfirm}
          onCancel={() => setShowWarning(false)}
        />
      )}
      <FlyingParticles particles={particles} />
    </div>
  )
}
