import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useCardClash } from './CardClashContext'
import { RARITIES, STARTING_FIVE_RATES, STARTING_FIVE_CAP_DAYS, getHoloEffect } from '../../data/cardclash/economy'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import CardZoomModal from './components/CardZoomModal'
import passionCoin from '../../assets/passion/passion.png'
import emberIcon from '../../assets/ember.png'
import { Shield, TreePine, Sparkles, Heart, Crosshair, Flame, Hexagon, Plus, X, ArrowRightLeft, Trash2, ZoomIn } from 'lucide-react'

const ROLES = [
  { key: 'solo', label: 'SOLO', icon: Shield },
  { key: 'jungle', label: 'JUNGLE', icon: TreePine },
  { key: 'mid', label: 'MID', icon: Sparkles },
  { key: 'support', label: 'SUPPORT', icon: Heart },
  { key: 'adc', label: 'ADC', icon: Crosshair },
]

const RARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']
const RARITY_TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }

function getCardType(card) {
  return card.cardType || 'god'
}

function toGameCardData(card) {
  const type = getCardType(card)
  const cd = card.cardData || {}
  const base = {
    name: card.godName, class: card.godClass, imageUrl: card.imageUrl,
    id: card.godId, serialNumber: card.serialNumber,
  }
  if (type === 'god') return { ...base, ability: card.ability || cd.ability, imageKey: cd?.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.godClass, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd?.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, winRate: 0, kda: 0,
  avgDamage: 0, avgMitigated: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0,
}

function toPlayerCardProps(card) {
  const cd = card.cardData || {}
  return {
    playerName: card.godName, teamName: cd.teamName || '', teamColor: cd.teamColor || '#6366f1',
    role: cd.role || card.role || 'ADC', avatarUrl: card.imageUrl || '',
    leagueName: cd.leagueName || '', divisionName: cd.divisionName || '',
    stats: EMPTY_STATS,
  }
}

function getIncomeRate(card) {
  if (!card) return { passion: 0, cores: 0 }
  const ht = card.holoType
  const r = card.rarity
  if (ht === 'full') {
    return {
      passion: STARTING_FIVE_RATES.full?.passion?.[r] || 0,
      cores: STARTING_FIVE_RATES.full?.cores?.[r] || 0,
    }
  }
  if (ht === 'holo') return { passion: STARTING_FIVE_RATES.holo?.[r] || 0, cores: 0 }
  if (ht === 'reverse') return { passion: 0, cores: STARTING_FIVE_RATES.reverse?.[r] || 0 }
  return { passion: 0, cores: 0 }
}

function HoloTypeIcon({ holoType, size = 14 }) {
  if (holoType === 'full') return (
    <span className="inline-flex items-center gap-0.5">
      <Flame size={size} className="text-amber-400" />
      <Hexagon size={size} className="text-[var(--cd-cyan)]" />
    </span>
  )
  if (holoType === 'holo') return <Flame size={size} className="text-amber-400" />
  if (holoType === 'reverse') return <Hexagon size={size} className="text-[var(--cd-cyan)]" />
  return null
}

function generateParticles(count, color) {
  const particles = []
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
    const dist = 60 + Math.random() * 80
    particles.push({
      id: i,
      tx: `${Math.cos(angle) * dist}px`,
      ty: `${Math.sin(angle) * dist}px`,
      dur: `${0.6 + Math.random() * 0.4}s`,
      size: `${3 + Math.random() * 4}px`,
      delay: `${Math.random() * 0.15}s`,
      color,
    })
  }
  return particles
}

function getAnimationConfig(rarity) {
  const color = RARITIES[rarity]?.color || '#9ca3af'
  switch (rarity) {
    case 'mythic':
      return { flash: true, ring: true, doubleRing: true, particles: generateParticles(40, color), rays: true, banner: true, duration: 3000, color }
    case 'legendary':
      return { flash: true, ring: true, doubleRing: false, particles: generateParticles(25, color), rays: true, banner: true, duration: 2500, color }
    case 'epic':
      return { flash: true, ring: true, doubleRing: false, particles: generateParticles(15, color), rays: false, banner: false, duration: 1800, color }
    case 'rare':
      return { flash: false, ring: true, doubleRing: false, particles: [], rays: false, banner: false, duration: 1200, color }
    default:
      return { flash: false, ring: false, doubleRing: false, particles: [], rays: false, banner: false, duration: 800, color }
  }
}


export default function CCStartingFive() {
  const { collection, startingFive, slotS5Card, unslotS5Card, collectS5Income } = useCardClash()
  const [pickerRole, setPickerRole] = useState(null)
  const [optionsRole, setOptionsRole] = useState(null)
  const [slotAnimation, setSlotAnimation] = useState(null)
  const [collecting, setCollecting] = useState(false)
  const [collectNotif, setCollectNotif] = useState(null)
  const [slotting, setSlotting] = useState(false)
  const [zoomedCard, setZoomedCard] = useState(null)

  // Live-ticking income counter
  const [displayPassion, setDisplayPassion] = useState(0)
  const [displayCores, setDisplayCores] = useState(0)

  useEffect(() => {
    if (!startingFive) return
    setDisplayPassion(startingFive.passionPending || 0)
    setDisplayCores(startingFive.coresPending || 0)
  }, [startingFive?.passionPending, startingFive?.coresPending])

  useEffect(() => {
    if (!startingFive) return
    const pph = startingFive.totalPassionPerHour || 0
    const cph = startingFive.totalCoresPerHour || 0
    if (pph === 0 && cph === 0) return

    const interval = setInterval(() => {
      setDisplayPassion(prev => {
        const cap = startingFive.passionCap || Infinity
        return Math.min(prev + pph / 3600, cap)
      })
      setDisplayCores(prev => {
        const cap = startingFive.coresCap || Infinity
        return Math.min(prev + cph / 3600, cap)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [startingFive?.totalPassionPerHour, startingFive?.totalCoresPerHour, startingFive?.passionCap, startingFive?.coresCap])

  const slottedCards = useMemo(() => {
    if (!startingFive?.cards) return {}
    const map = {}
    for (const card of startingFive.cards) {
      map[card.slotRole] = card
    }
    return map
  }, [startingFive?.cards])

  const handleSlot = useCallback(async (cardId, role) => {
    setSlotting(true)
    try {
      await slotS5Card(cardId, role)
      // Find the card to determine rarity for animation
      const card = collection.find(c => c.id === cardId)
      if (card) {
        setSlotAnimation({ role, rarity: card.rarity, color: RARITIES[card.rarity]?.color || '#9ca3af' })
        const config = getAnimationConfig(card.rarity)
        setTimeout(() => setSlotAnimation(null), config.duration)
      }
      setPickerRole(null)
    } catch (err) {
      console.error('Failed to slot card:', err)
    } finally {
      setSlotting(false)
    }
  }, [slotS5Card, collection])

  const handleUnslot = useCallback(async (role) => {
    try {
      await unslotS5Card(role)
      setOptionsRole(null)
    } catch (err) {
      console.error('Failed to unslot card:', err)
    }
  }, [unslotS5Card])

  const handleCollect = useCallback(async () => {
    if (collecting) return
    setCollecting(true)
    try {
      const prev = { passion: displayPassion, cores: displayCores }
      await collectS5Income()
      setCollectNotif({ passion: Math.floor(prev.passion), cores: Math.floor(prev.cores) })
      setTimeout(() => setCollectNotif(null), 3000)
    } catch (err) {
      console.error('Failed to collect income:', err)
    } finally {
      setCollecting(false)
    }
  }, [collecting, collectS5Income, displayPassion, displayCores])

  const passionCap = startingFive?.passionCap || 0
  const coresCap = startingFive?.coresCap || 0
  const passionPct = passionCap > 0 ? Math.min((displayPassion / passionCap) * 100, 100) : 0
  const coresPct = coresCap > 0 ? Math.min((displayCores / coresCap) * 100, 100) : 0
  const canCollect = displayPassion >= 1 || displayCores >= 1
  const totalPph = startingFive?.totalPassionPerHour || 0
  const totalCph = startingFive?.totalCoresPerHour || 0

  if (!startingFive) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="cd-spinner w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="max-w-[1100px] mx-auto pb-12">
      {/* Header */}
      <div className="mb-6 cd-section-accent pb-3">
        <h1 className="text-2xl font-bold text-[var(--cd-text)] cd-head">Starting 5</h1>
        <p className="text-xs text-white/40 mt-1">Slot your best holo cards to earn passive income</p>
      </div>

      {/* Income Dashboard */}
      <div className="cd-panel cd-corners rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            {/* Passion income */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <img src={passionCoin} alt="" className="w-4 h-4" />
                <span className="text-xs text-white/40 cd-head tracking-wider">PASSION</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold cd-num" style={{ color: '#f8c56a' }}>
                  {displayPassion.toFixed(1)}
                </span>
                {passionCap > 0 && (
                  <span className="text-xs text-white/20 cd-num">/ {passionCap % 1 === 0 ? passionCap : passionCap.toFixed(1)}</span>
                )}
              </div>
              {passionCap > 0 && (
                <div className="w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${passionPct}%`,
                      background: 'linear-gradient(90deg, #f8c56a88, #f8c56a)',
                      boxShadow: '0 0 6px #f8c56a66',
                    }}
                  />
                </div>
              )}
              {totalPph > 0 && (
                <span className="text-[10px] text-white/30 cd-num">+{totalPph.toFixed(1)}/hr</span>
              )}
            </div>

            {/* Cores income */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <img src={emberIcon} alt="" className="w-4 h-4 cd-icon-glow" />
                <span className="text-xs text-white/40 cd-head tracking-wider">CORES</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold cd-num text-[var(--cd-cyan)]">
                  {displayCores.toFixed(1)}
                </span>
                {coresCap > 0 && (
                  <span className="text-xs text-white/20 cd-num">/ {coresCap % 1 === 0 ? coresCap : coresCap.toFixed(1)}</span>
                )}
              </div>
              {coresCap > 0 && (
                <div className="w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${coresPct}%`,
                      background: 'linear-gradient(90deg, var(--cd-cyan-dim), var(--cd-cyan))',
                      boxShadow: '0 0 6px rgba(0,229,255,0.4)',
                    }}
                  />
                </div>
              )}
              {totalCph > 0 && (
                <span className="text-[10px] text-white/30 cd-num">+{totalCph.toFixed(1)}/hr</span>
              )}
            </div>
          </div>

          {/* Collect button */}
          <div className="relative">
            <button
              onClick={handleCollect}
              disabled={!canCollect || collecting}
              className="cd-btn-solid cd-btn-action cd-clip-btn px-6 py-2.5 text-sm font-bold cd-head tracking-wider cursor-pointer disabled:cursor-not-allowed"
            >
              {collecting ? 'Collecting...' : 'Collect'}
            </button>
            {collectNotif && (
              <div
                className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-cyan)]/30 text-xs font-bold cd-num flex items-center gap-2"
                style={{ animation: 's5-notif-float 2.5s ease-out forwards' }}
              >
                {collectNotif.passion > 0 && (
                  <span style={{ color: '#f8c56a' }}>+{collectNotif.passion} <img src={passionCoin} alt="" className="w-3 h-3 inline" /></span>
                )}
                {collectNotif.cores > 0 && (
                  <span className="text-[var(--cd-cyan)]">+{collectNotif.cores} <img src={emberIcon} alt="" className="w-3 h-3 inline" /></span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-[10px] text-white/20">
          {STARTING_FIVE_CAP_DAYS}-day cap — collect before your income maxes out
        </div>
      </div>

      {/* 5 Role Slots */}
      <div className="grid grid-cols-5 gap-4">
        {ROLES.map(role => {
          const card = slottedCards[role.key]
          const Icon = role.icon
          const isAnimating = slotAnimation?.role === role.key

          return (
            <div key={role.key} className="flex flex-col items-center gap-2">
              {/* Role label */}
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={14} className="text-white/40" />
                <span className="text-xs font-bold text-white/40 cd-head tracking-wider">{role.label}</span>
              </div>

              {/* Slot container */}
              <div className="relative">
                {card ? (
                  <FilledSlot
                    card={card}
                    role={role}
                    isAnimating={isAnimating}
                    animConfig={isAnimating ? getAnimationConfig(slotAnimation.rarity) : null}
                    onSwap={() => setPickerRole(role.key)}
                    onRemove={() => handleUnslot(role.key)}
                    onZoom={() => { setOptionsRole(null); setZoomedCard(card) }}
                    optionsOpen={optionsRole === role.key}
                    onToggleOptions={() => setOptionsRole(optionsRole === role.key ? null : role.key)}
                  />
                ) : (
                  <EmptySlot role={role} onClick={() => setPickerRole(role.key)} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Card Picker Modal */}
      {pickerRole && (
        <CardPicker
          role={pickerRole}
          collection={collection}
          slottedCards={slottedCards}
          onSelect={handleSlot}
          onClose={() => setPickerRole(null)}
          slotting={slotting}
        />
      )}

      {/* Card Zoom Modal */}
      {zoomedCard && (
        <CardZoomModal
          onClose={() => setZoomedCard(null)}
          playerCard={getCardType(zoomedCard) === 'player' ? toPlayerCardProps(zoomedCard) : undefined}
          gameCard={getCardType(zoomedCard) !== 'player' ? { type: getCardType(zoomedCard), rarity: zoomedCard.rarity, data: toGameCardData(zoomedCard) } : undefined}
        />
      )}

      <style>{`
        @keyframes s5-ring-expand {
          0% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.3); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(3); }
        }
        @keyframes s5-ring-expand-2 {
          0% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(3.5); }
        }
        @keyframes s5-particle {
          0% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          70% { opacity: 0.6; }
          100% { transform: translate(calc(-50% + var(--p-tx)), calc(-50% + var(--p-ty))) scale(0); opacity: 0; }
        }
        @keyframes s5-flash {
          0% { opacity: 0.6; }
          100% { opacity: 0; }
        }
        @keyframes s5-banner-slam {
          0% { opacity: 0; transform: scale(1.8) translateY(10px); filter: blur(8px); }
          40% { opacity: 1; transform: scale(0.95) translateY(0); filter: blur(0); }
          60% { transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes s5-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px 5px var(--glow-color); }
          50% { box-shadow: 0 0 40px 12px var(--glow-color); }
        }
        @keyframes s5-fade-in {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes s5-rays {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
          30% { opacity: 0.4; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2) rotate(45deg); }
        }
        @keyframes s5-notif-float {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
        @keyframes s5-card-enter {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}


function EmptySlot({ role, onClick }) {
  const Icon = role.icon
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] hover:border-[var(--cd-cyan)]/30 hover:bg-[var(--cd-cyan)]/[0.03] transition-all cursor-pointer"
      style={{ width: 170, aspectRatio: '63/88' }}
    >
      <Icon size={28} className="text-white/[0.08] group-hover:text-[var(--cd-cyan)]/30 transition-colors mb-2" />
      <div className="flex items-center gap-1 text-[11px] text-white/20 group-hover:text-[var(--cd-cyan)]/60 font-bold cd-head tracking-wider transition-colors">
        <Plus size={12} />
        Slot Card
      </div>
    </button>
  )
}


function FilledSlot({ card, role, isAnimating, animConfig, onSwap, onRemove, onZoom, optionsOpen, onToggleOptions }) {
  const color = RARITIES[card.rarity]?.color || '#9ca3af'
  const income = getIncomeRate(card)
  const type = getCardType(card)
  const isPlayer = type === 'player'

  return (
    <div className="relative">
      {/* Animation overlays */}
      {isAnimating && animConfig && (
        <SlotAnimationOverlay config={animConfig} rarity={card.rarity} />
      )}

      {/* Card display */}
      <div
        className="relative cursor-pointer transition-all"
        style={{
          ...(isAnimating ? { '--glow-color': `${color}66`, animation: 's5-glow-pulse 0.8s ease-in-out 2' } : {}),
          ...(!isAnimating ? { animation: 's5-card-enter 0.3s ease-out' } : {}),
        }}
        onClick={onToggleOptions}
      >
        <TradingCardHolo rarity={getHoloEffect(card.rarity)} role={(card.role || card.cardData?.role || 'adc').toUpperCase()} holoType={card.holoType || 'reverse'} size={170}>
          {isPlayer ? (
            <TradingCard
              {...toPlayerCardProps(card)}
              variant="player"
              rarity={card.rarity}
              size={170}
            />
          ) : (
            <GameCard type={type} rarity={card.rarity} data={toGameCardData(card)} size={170} />
          )}
        </TradingCardHolo>
      </div>

      {/* Card info below */}
      <div className="mt-2 text-center">
        <div className="text-[11px] font-bold text-white/70 truncate cd-head" style={{ maxWidth: 170 }}>
          {card.godName}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold cd-head" style={{ color }}>{RARITIES[card.rarity]?.name}</span>
          <HoloTypeIcon holoType={card.holoType} size={11} />
        </div>
        <div className="flex items-center justify-center gap-2 mt-1 text-[10px] cd-num text-white/40">
          {income.passion > 0 && (
            <span className="flex items-center gap-0.5">
              <Flame size={10} className="text-amber-400" />
              {income.passion}/d
            </span>
          )}
          {income.cores > 0 && (
            <span className="flex items-center gap-0.5">
              <Hexagon size={10} className="text-[var(--cd-cyan)]" />
              {income.cores}/d
            </span>
          )}
        </div>
      </div>

      {/* Options dropdown */}
      {optionsOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg overflow-hidden shadow-xl" style={{ minWidth: 130 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onZoom() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/60 hover:bg-[var(--cd-cyan)]/10 hover:text-[var(--cd-cyan)] transition-colors cursor-pointer cd-head tracking-wider"
          >
            <ZoomIn size={12} /> Zoom
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSwap() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/60 hover:bg-[var(--cd-cyan)]/10 hover:text-[var(--cd-cyan)] transition-colors cursor-pointer cd-head tracking-wider"
          >
            <ArrowRightLeft size={12} /> Swap
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer cd-head tracking-wider"
          >
            <Trash2 size={12} /> Remove
          </button>
        </div>
      )}
    </div>
  )
}


function SlotAnimationOverlay({ config, rarity }) {
  const { flash, ring, doubleRing, particles, rays, banner, color, duration } = config

  return (
    <>
      {/* Screen flash */}
      {flash && (
        <div
          className="fixed inset-0 pointer-events-none z-30"
          style={{
            background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
            animation: `s5-flash ${duration * 0.3}ms ease-out forwards`,
          }}
        />
      )}

      {/* Ring burst(s) */}
      {ring && (
        <div
          className="absolute top-1/2 left-1/2 pointer-events-none z-20"
          style={{
            width: 170,
            height: 170,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            boxShadow: `0 0 20px ${color}88`,
            animation: `s5-ring-expand 0.8s ease-out forwards`,
          }}
        />
      )}
      {doubleRing && (
        <div
          className="absolute top-1/2 left-1/2 pointer-events-none z-20"
          style={{
            width: 170,
            height: 170,
            borderRadius: '50%',
            border: `2px solid ${color}88`,
            boxShadow: `0 0 15px ${color}66`,
            animation: `s5-ring-expand-2 1s ease-out 0.15s forwards`,
            opacity: 0,
          }}
        />
      )}

      {/* Radial glow rays */}
      {rays && (
        <div
          className="absolute top-1/2 left-1/2 pointer-events-none z-10"
          style={{
            width: 300,
            height: 300,
            background: `conic-gradient(from 0deg, transparent, ${color}15, transparent, ${color}15, transparent, ${color}15, transparent, ${color}15, transparent)`,
            animation: `s5-rays ${duration * 0.6}ms ease-out forwards`,
          }}
        />
      )}

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute top-1/2 left-1/2 pointer-events-none z-20 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            '--p-tx': p.tx,
            '--p-ty': p.ty,
            animation: `s5-particle ${p.dur} ease-out ${p.delay} forwards`,
          }}
        />
      ))}

      {/* Rarity banner text slam */}
      {banner && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 whitespace-nowrap"
          style={{
            animation: `s5-banner-slam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both`,
          }}
        >
          <span
            className="cd-rarity-neon text-lg"
            style={{ '--cd-rarity-color': color }}
          >
            {RARITIES[rarity]?.name}
          </span>
        </div>
      )}
    </>
  )
}


function CardPicker({ role, collection, slottedCards, onSelect, onClose, slotting }) {
  const roleInfo = ROLES.find(r => r.key === role)
  const Icon = roleInfo?.icon || Shield

  // Filter eligible cards
  const eligibleCards = useMemo(() => {
    const slottedIds = new Set(
      Object.values(slottedCards)
        .filter(c => c.slotRole !== role) // exclude the card currently in THIS slot (swap case)
        .map(c => c.id)
    )

    return collection
      .filter(card => {
        const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
        if (cardRole !== role) return false
        if (card.rarity === 'common') return false
        if (!card.holoType) return false
        const type = getCardType(card)
        if (type !== 'player') return false
        if (slottedIds.has(card.id)) return false
        return true
      })
      .sort((a, b) => {
        // Best rarity first
        const rDiff = (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
        if (rDiff !== 0) return rDiff
        // Then by income
        const aIncome = getIncomeRate(a)
        const bIncome = getIncomeRate(b)
        const aTotal = aIncome.passion + aIncome.cores
        const bTotal = bIncome.passion + bIncome.cores
        return bTotal - aTotal
      })
  }, [collection, slottedCards, role])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'cd-fade-in 0.2s ease-out' }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-[var(--cd-cyan)]" />
            <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">
              Select {roleInfo?.label} Card
            </h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Card grid */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {eligibleCards.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Icon size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm cd-head tracking-wider">No eligible cards</p>
              <p className="text-xs text-white/20 mt-1">Need a holo/reverse/full card of uncommon+ rarity with the {roleInfo?.label} role</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {eligibleCards.map(card => (
                <PickerCard
                  key={card.id}
                  card={card}
                  onSelect={() => onSelect(card.id, role)}
                  disabled={slotting}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function PickerCard({ card, onSelect, disabled }) {
  const color = RARITIES[card.rarity]?.color || '#9ca3af'
  const income = getIncomeRate(card)
  const type = getCardType(card)
  const isPlayer = type === 'player'

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="group flex flex-col items-center rounded-xl p-2 transition-all hover:bg-white/[0.04] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="transition-all group-hover:scale-[1.03]">
        <TradingCardHolo rarity={getHoloEffect(card.rarity)} role={(card.role || card.cardData?.role || 'adc').toUpperCase()} holoType={card.holoType || 'reverse'} size={120}>
          {isPlayer ? (
            <TradingCard
              {...toPlayerCardProps(card)}
              variant="player"
              rarity={card.rarity}
              size={120}
            />
          ) : (
            <GameCard type={type} rarity={card.rarity} data={toGameCardData(card)} size={120} />
          )}
        </TradingCardHolo>
      </div>

      <div className="mt-1.5 text-center" style={{ maxWidth: 120 }}>
        <div className="text-[10px] font-bold text-white/60 truncate cd-head">{card.godName}</div>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[9px] font-bold cd-head" style={{ color }}>{RARITIES[card.rarity]?.name}</span>
          <HoloTypeIcon holoType={card.holoType} size={10} />
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[9px] cd-num text-white/35">
          {income.passion > 0 && (
            <span className="flex items-center gap-0.5">
              <Flame size={9} className="text-amber-400" />
              {income.passion}/d
            </span>
          )}
          {income.cores > 0 && (
            <span className="flex items-center gap-0.5">
              <Hexagon size={9} className="text-[var(--cd-cyan)]" />
              {income.cores}/d
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
