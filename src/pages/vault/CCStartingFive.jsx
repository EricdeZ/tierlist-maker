import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useVault } from './VaultContext'
import { RARITIES, S5_FLAT_CORES, S5_FLAT_PASSION, S5_REVERSE_MULT, S5_FULL_RATIO,
  S5_FLAT_SCALE, S5_MULT_SCALE,
  S5_ATT_FLAT, S5_ATT_MULT, S5_FULL_ATT_RATIO, S5_ALLSTAR_MODIFIER,
  STARTING_FIVE_CAP_DAYS, CONSUMABLE_EFFECTS, getHoloEffect,
  S5_STAFF_FLAT_CORES, S5_STAFF_MULT } from '../../data/vault/economy'
import GameCard from './components/GameCard'
import VaultCard from './components/VaultCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import CardZoomModal from './components/CardZoomModal'
import { getTeamCounts, getTeamSynergyPreview, isGodSynergy } from './starting-five/synergyHelpers'
import SynergyPlanner from './starting-five/SynergyPlanner'
import PassivesGuide from './starting-five/PassivesGuide'
import PassivePanel from './starting-five/PassivePanel'
import soloIcon from '../../assets/roles/solo.webp'
import jungleIcon from '../../assets/roles/jungle.webp'
import midIcon from '../../assets/roles/mid.webp'
import suppIcon from '../../assets/roles/supp.webp'
import adcIcon from '../../assets/roles/adc.webp'
import { Plus, X, ArrowRightLeft, Trash2, ZoomIn, HelpCircle, Zap, Trophy, AlertTriangle, ChevronLeft } from 'lucide-react'
import { CONSUMABLES } from '../../data/vault/buffs'
import { useAuth } from '../../context/AuthContext'
import { vaultService } from '../../services/database'
import { FEATURE_FLAGS } from '../../config/featureFlags'

const ROLES = [
  { key: 'solo', label: 'SOLO', icon: soloIcon },
  { key: 'jungle', label: 'JUNGLE', icon: jungleIcon },
  { key: 'mid', label: 'MID', icon: midIcon },
  { key: 'support', label: 'SUPPORT', icon: suppIcon },
  { key: 'adc', label: 'ADC', icon: adcIcon },
]

const STAFF_SLOTS = [
  { key: 'cheerleader', label: 'CHEERLEADER' },
  { key: 'staff', label: 'STAFF' },
]

const RARITY_ORDER = ['unique', 'mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']
const RARITY_TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }

function getCardType(card) {
  return card.cardType || 'god'
}

function isHoloMatch(playerHoloType, attachmentHoloType) {
  if (playerHoloType === 'full') return true
  if (attachmentHoloType === 'full') return true
  return playerHoloType === attachmentHoloType
}

function toGameCardData(card, override) {
  const type = getCardType(card)
  const cd = card.cardData || {}
  const base = {
    name: card.godName, class: card.godClass, imageUrl: override?.custom_image_url || card.imageUrl,
    id: card.godId, serialNumber: card.serialNumber, metadata: override || undefined,
    signatureUrl: card.signatureUrl || undefined,
    passiveName: card.passiveName || undefined,
  }
  if (type === 'god') return { ...base, role: card.role, ability: card.ability || cd.ability, imageKey: cd?.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.godClass, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd?.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

function toPlayerCardProps(card) {
  const cd = card.cardData || {}
  return {
    playerName: card.godName, teamName: cd.teamName || '', teamColor: cd.teamColor || '#6366f1',
    role: card.role || cd.role || 'ADC', avatarUrl: card.imageUrl || '',
    leagueName: cd.leagueName || '', divisionName: cd.divisionName || '',
    seasonName: cd.seasonName || '',
    bestGod: card.bestGodFull || (card.bestGodName ? { name: card.bestGodName } : null),
    stats: cd.stats || null,
    isFirstEdition: card.isFirstEdition || false,
    isConnected: card.isConnected,
    defId: card.defId,
    rarity: card.rarity,
    signatureUrl: card.signatureUrl || undefined,
  }
}

// Estimate base contribution for a card (flat income + multiplier)
function getBaseIncomeEstimate(card) {
  if (!card) return { flatCores: 0, multiplier: 0, type: 'none', sortValue: 0 }
  // Staff cards: use staff-specific constants
  if (getCardType(card) === 'staff') {
    const cores = S5_STAFF_FLAT_CORES[card.rarity] || 0
    const mult = S5_STAFF_MULT[card.rarity] || 1
    return { flatCores: cores, multiplier: mult, type: 'staff', sortValue: cores + (mult - 1) * 10 }
  }
  const ht = card.holoType
  const r = card.rarity
  const flatC = (S5_FLAT_CORES[r] || 0) * S5_FLAT_SCALE
  const mult = S5_REVERSE_MULT[r] || 1
  const multScaled = 1 + (mult - 1) * S5_MULT_SCALE
  if (ht === 'holo') return { flatCores: flatC, multiplier: 0, type: 'flat', sortValue: flatC }
  if (ht === 'reverse') return { flatCores: 0, multiplier: multScaled, type: 'mult', sortValue: multScaled * 10 }
  if (ht === 'full') return { flatCores: flatC * S5_FULL_RATIO, multiplier: 1 + (mult - 1) * S5_MULT_SCALE * S5_FULL_RATIO, type: 'full', sortValue: flatC * S5_FULL_RATIO + multScaled }
  return { flatCores: 0, multiplier: 0, type: 'none', sortValue: 0 }
}

// Effective slot contribution: base player card + attachment bonuses
function getSlotContribution(slot) {
  if (!slot?.contribution) return { passion: 0, cores: 0, multiplier: 0, type: 'none' }
  const c = slot.contribution
  const playerHasFlat = c.type === 'flat' || c.type === 'full'
  const playerHasMult = c.type === 'mult' || c.type === 'full'

  let cores = c.cores || 0, passion = c.passion || 0, multiplier = c.multiplier || 0

  if (playerHasFlat) {
    const godFlatMult = 1 + (slot.godBonus?.flatBoost || 0)
    const itemFlatMult = 1 + (slot.itemBonus?.flatBoost || 0)
    cores = cores * godFlatMult * itemFlatMult
    passion = passion * godFlatMult * itemFlatMult
  }
  if (playerHasMult) {
    const effectiveness = slot.isBench ? 0.5 : 1.0
    multiplier = multiplier + (slot.godBonus?.multAdd || 0) * effectiveness + (slot.itemBonus?.multAdd || 0) * effectiveness
  }

  return {
    passion,
    cores,
    multiplier,
    type: c.type || 'none',
  }
}

function HoloTypeIcon() {
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


function useSlotSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return 170
    if (window.innerWidth < 640) return 130
    if (window.innerWidth < 1024) return 150
    return 170
  })
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setSize(130)
      else if (window.innerWidth < 1024) setSize(150)
      else setSize(170)
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

export default function CCStartingFive() {
  const { collection, startingFive, loadStartingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, useS5Consumable: applyS5Consumable, getDefOverride } = useVault()
  const [activeLineup, setActiveLineup] = useState('current')
  const [pickerRole, setPickerRole] = useState(null)
  const [optionsRole, setOptionsRole] = useState(null)
  const [slotAnimation, setSlotAnimation] = useState(null)
  const [collecting, setCollecting] = useState(false)
  const [collectNotif, setCollectNotif] = useState(null)
  const [slotting, setSlotting] = useState(false)
  const [zoomedCard, setZoomedCard] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showConsumablePicker, setShowConsumablePicker] = useState(false)
  const [slottingConsumable, setSlottingConsumable] = useState(false)
  const [consumableResult, setConsumableResult] = useState(null)
  const [pendingLineupAction, setPendingLineupAction] = useState(null)
  const [error, setError] = useState(null)
  const [s5Leaderboard, setS5Leaderboard] = useState(null)
  const [s5LbLoading, setS5LbLoading] = useState(false)
  const { user, isAdmin } = useAuth()
  const showStaffSlots = FEATURE_FLAGS.STAFF_CARDS_RELEASED || isAdmin
  const slotSize = useSlotSize()

  const showError = useCallback((msg) => {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }, [])

  // Live-ticking income counter
  const [displayPassion, setDisplayPassion] = useState(0)
  const [displayCores, setDisplayCores] = useState(0)

  // Derive lineup-specific and combined data from new response shape
  const lineupData = activeLineup === 'current'
    ? startingFive?.currentSeason
    : startingFive?.allStar
  const slots = useMemo(() => lineupData?.slots || {}, [lineupData?.slots])
  const combinedOutput = startingFive?.combined || { coresPerDay: 0, passionPerDay: 0 }

  // Compute flat total and mult total from active lineup's slots (team bonus per-card)
  const lineupBreakdown = useMemo(() => {
    let flatCores = 0, flatCoresBase = 0, totalMult = 1, totalMultBase = 1
    for (const slotData of Object.values(slots)) {
      if (!slotData?.contribution) continue
      if (slotData.roleMismatch) continue
      const c = slotData.contribution
      const hasFlat = c.type === 'flat' || c.type === 'full'
      const hasMult = c.type === 'mult' || c.type === 'full'
      const cardTeamBonus = 1 + (slotData.teamSynergyBonus || 0)
      if (hasFlat) {
        const godFlatMult = 1 + (slotData.godBonus?.flatBoost || 0)
        const itemFlatMult = 1 + (slotData.itemBonus?.flatBoost || 0)
        const base = (c.cores || 0) * godFlatMult * itemFlatMult
        flatCoresBase += base
        flatCores += base * cardTeamBonus
      }
      if (hasMult) {
        const eff = slotData.isBench ? 0.5 : 1.0
        const slotMult = (c.multiplier || 1) + (slotData.godBonus?.multAdd || 0) * eff + (slotData.itemBonus?.multAdd || 0) * eff
        totalMultBase += (slotMult - 1)
        totalMult += (slotMult - 1) * cardTeamBonus
      }
    }
    const withBonus = flatCores * totalMult
    const withoutBonus = flatCoresBase * totalMultBase
    const teamSynergyPct = withoutBonus > 0 ? (withBonus / withoutBonus - 1) : 0
    return { flatCores, flatCoresBase, totalMult, totalMultBase, teamSynergyPct }
  }, [slots])
  const boostedCoresPerDay = startingFive?.boostedCoresPerDay || combinedOutput.coresPerDay
  const boostedPassionPerDay = startingFive?.boostedPassionPerDay || combinedOutput.passionPerDay
  const activeBuffs = startingFive?.activeBuffs || []
  const consumableSlotsUsed = startingFive?.consumableSlotsUsed || 0
  const consumablesUsedToday = startingFive?.consumablesUsedToday || 0
  const consumableDailyCap = startingFive?.consumableDailyCap || 10
  const effectiveRateBoost = startingFive?.effectiveRateBoost || 0
  const effectiveCollectMult = startingFive?.effectiveCollectMult || 1
  const dismantleBoostMult = startingFive?.dismantleBoostMult || 1
  const dismantleBoostActive = startingFive?.dismantleBoostActive || false

  useEffect(() => {
    if (!startingFive) return
    setDisplayPassion(startingFive.passionPending || 0)
    setDisplayCores(startingFive.coresPending || 0)
  }, [startingFive?.passionPending, startingFive?.coresPending])

  useEffect(() => {
    if (!startingFive) return
    const ppd = boostedPassionPerDay
    const cpd = boostedCoresPerDay
    if (ppd === 0 && cpd === 0) return

    const interval = setInterval(() => {
      setDisplayPassion(prev => {
        const cap = startingFive.passionCap || Infinity
        return Math.min(prev + ppd / 86400, cap)
      })
      setDisplayCores(prev => {
        const cap = startingFive.coresCap || Infinity
        return Math.min(prev + cpd / 86400, cap)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [boostedPassionPerDay, boostedCoresPerDay, startingFive?.passionCap, startingFive?.coresCap])

  useEffect(() => {
    setS5LbLoading(true)
    vaultService.loadS5Leaderboard()
      .then(data => setS5Leaderboard(data))
      .catch(() => {})
      .finally(() => setS5LbLoading(false))
  }, [])

  // Build slotted cards map from the active lineup's slots
  const slottedCards = useMemo(() => {
    const map = {}
    if (!slots) return map
    for (const [role, slotData] of Object.entries(slots)) {
      if (slotData?.card) {
        map[role] = {
          ...slotData.card,
          godCard: slotData.godCard ? { ...slotData.godCard, bonus: slotData.godBonus } : null,
          itemCard: slotData.itemCard ? { ...slotData.itemCard, bonus: slotData.itemBonus } : null,
          synergy: slotData.synergy,
          isBench: slotData.isBench,
          contribution: slotData.contribution,
          godBonus: slotData.godBonus,
          itemBonus: slotData.itemBonus,
          teamSynergyBonus: slotData.teamSynergyBonus || 0,
          roleMismatch: slotData.roleMismatch || false,
        }
      }
    }
    return map
  }, [slots])

  // Collect IDs from BOTH lineups so excluded cards span both
  const allSlottedIds = useMemo(() => {
    const ids = new Set()
    const collectFromSlots = (lineupSlots) => {
      if (!lineupSlots) return
      for (const slotData of Object.values(lineupSlots)) {
        if (slotData?.card) ids.add(slotData.card.id)
        if (slotData?.godCard) ids.add(slotData.godCard.id)
        if (slotData?.itemCard) ids.add(slotData.itemCard.id)
      }
    }
    collectFromSlots(startingFive?.currentSeason?.slots)
    collectFromSlots(startingFive?.allStar?.slots)
    return ids
  }, [startingFive?.currentSeason?.slots, startingFive?.allStar?.slots])

  const executeSlot = useCallback(async (cardId, role) => {
    setSlotting(true)
    try {
      await slotS5Card(cardId, role, 'player', activeLineup)
      const card = collection.find(c => c.id === cardId)
      if (card) {
        setSlotAnimation({ role, rarity: card.rarity, color: RARITIES[card.rarity]?.color || '#9ca3af' })
        const config = getAnimationConfig(card.rarity)
        setTimeout(() => setSlotAnimation(null), config.duration)
      }
      setPickerRole(null)
    } catch (err) {
      showError(err.message || 'Failed to slot card')
    } finally {
      setSlotting(false)
    }
  }, [slotS5Card, collection, showError, activeLineup])

  const executeUnslot = useCallback(async (role) => {
    try {
      await unslotS5Card(role, activeLineup)
      setOptionsRole(null)
    } catch (err) {
      showError(err.message || 'Failed to remove card')
    }
  }, [unslotS5Card, showError, activeLineup])

  const [attachPickerState, setAttachPickerState] = useState(null)

  const executeAttachSlot = useCallback(async (cardId, role, slotType) => {
    setSlotting(true)
    try {
      await slotS5Card(cardId, role, slotType, activeLineup)
      const card = collection.find(c => c.id === cardId)
      if (card) {
        setSlotAnimation({ role, rarity: card.rarity, color: RARITIES[card.rarity]?.color || '#9ca3af' })
        setTimeout(() => setSlotAnimation(null), 800)
      }
      setAttachPickerState(null)
    } catch (err) {
      showError(err.message || 'Failed to attach card')
    } finally {
      setSlotting(false)
    }
  }, [slotS5Card, collection, showError, activeLineup])

  const executeAttachUnslot = useCallback(async (role, slotType) => {
    try {
      await unslotS5Attachment(role, slotType, activeLineup)
    } catch (err) {
      showError(err.message || 'Failed to remove attachment')
    }
  }, [unslotS5Attachment, showError, activeLineup])

  const hasActiveBuffs = activeBuffs.length > 0
  const handleSlot = useCallback((cardId, role) => {
    if (hasActiveBuffs) { setPendingLineupAction(() => () => executeSlot(cardId, role)); return }
    executeSlot(cardId, role)
  }, [hasActiveBuffs, executeSlot])
  const handleUnslot = useCallback((role) => {
    if (hasActiveBuffs) { setPendingLineupAction(() => () => executeUnslot(role)); return }
    executeUnslot(role)
  }, [hasActiveBuffs, executeUnslot])
  const handleAttachSlot = useCallback((cardId, role, slotType) => {
    if (hasActiveBuffs) { setPendingLineupAction(() => () => executeAttachSlot(cardId, role, slotType)); return }
    executeAttachSlot(cardId, role, slotType)
  }, [hasActiveBuffs, executeAttachSlot])
  const handleAttachUnslot = useCallback((role, slotType) => {
    if (hasActiveBuffs) { setPendingLineupAction(() => () => executeAttachUnslot(role, slotType)); return }
    executeAttachUnslot(role, slotType)
  }, [hasActiveBuffs, executeAttachUnslot])

  const handleCollect = useCallback(async () => {
    if (collecting) return
    setCollecting(true)
    try {
      const prev = { passion: displayPassion, cores: displayCores }
      await collectS5Income()
      setCollectNotif({ passion: Math.floor(prev.passion), cores: Math.floor(prev.cores) })
      setTimeout(() => setCollectNotif(null), 3000)
    } catch (err) {
      showError(err.message || 'Failed to collect income')
    } finally {
      setCollecting(false)
    }
  }, [collecting, collectS5Income, displayPassion, displayCores, showError])

  const handleUseConsumable = useCallback(async (cardId) => {
    if (slottingConsumable) return
    setSlottingConsumable(true)
    setShowConsumablePicker(false)
    setConsumableResult({ loading: true })
    try {
      const res = await applyS5Consumable(cardId)
      if (res.consumableResult) {
        setConsumableResult(res.consumableResult)
        setTimeout(() => setConsumableResult(null), 3000)
      } else {
        setConsumableResult(null)
      }
    } catch (err) {
      setConsumableResult(null)
      showError(err.message || 'Failed to use consumable')
    } finally {
      setSlottingConsumable(false)
    }
  }, [slottingConsumable, applyS5Consumable, showError])

  const passionCap = startingFive?.passionCap || 0
  const coresCap = startingFive?.coresCap || 0
  const passionPct = passionCap > 0 ? Math.min((displayPassion / passionCap) * 100, 100) : 0
  const coresPct = coresCap > 0 ? Math.min((displayCores / coresCap) * 100, 100) : 0
  const canCollect = displayPassion >= 1 || displayCores >= 1
  const basePph = combinedOutput.passionPerDay / 24
  const baseCph = combinedOutput.coresPerDay / 24

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
      <div className="mb-6 cd-section-accent pb-3 flex items-start justify-between flex-nowrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cd-text)] cd-head">Starting 5</h1>
          <p className="text-xs text-white/40 mt-1">Slot your best holo cards to earn passive income</p>
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white/40 hover:text-[var(--cd-cyan)] hover:bg-[var(--cd-cyan)]/[0.06] rounded-lg transition-colors cursor-pointer cd-head tracking-wider"
        >
          <HelpCircle size={14} />
          How It Works
        </button>
      </div>

      {/* Income Dashboard */}
      <div className="cd-panel cd-corners rounded-xl p-4 sm:p-5 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex flex-col gap-1">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Passion income */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40 cd-head tracking-wider">PASSION</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold cd-num" style={{ color: '#f8c56a' }}>
                  {displayPassion.toFixed(1)}
                </span>
                <span className="text-xs text-white/20 cd-num">/ {passionCap > 0 ? (passionCap % 1 === 0 ? passionCap : passionCap.toFixed(1)) : '0'}</span>
              </div>
              <div className="w-24 sm:w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${passionPct}%`,
                    background: 'linear-gradient(90deg, #f8c56a88, #f8c56a)',
                    boxShadow: passionPct > 0 ? '0 0 6px #f8c56a66' : 'none',
                  }}
                />
              </div>
              <span className="text-xs text-white/30 cd-num">
                +{basePph.toFixed(2)}/hr
              </span>
            </div>

            {/* Cores income */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40 cd-head tracking-wider">CORES</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold cd-num text-[var(--cd-cyan)]">
                  {displayCores.toFixed(1)}
                </span>
                <span className="text-xs text-white/20 cd-num">/ {coresCap > 0 ? (coresCap % 1 === 0 ? coresCap : coresCap.toFixed(1)) : '0'}</span>
              </div>
              <div className="w-24 sm:w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${coresPct}%`,
                    background: 'linear-gradient(90deg, var(--cd-cyan-dim), var(--cd-cyan))',
                    boxShadow: coresPct > 0 ? '0 0 6px rgba(0,229,255,0.4)' : 'none',
                  }}
                />
              </div>
              <span className="text-xs text-white/30 cd-num">
                +{baseCph.toFixed(2)}/hr
                {effectiveRateBoost > 0 && (
                  <span className="text-purple-400/60"> +{(effectiveRateBoost * 100).toFixed(0)}% rate buff</span>
                )}
                {effectiveCollectMult > 1 && (
                  <span className="text-orange-400/60"> {effectiveCollectMult.toFixed(2)}x next collect</span>
                )}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-white/20">
            {STARTING_FIVE_CAP_DAYS}-day cap — collect before your income maxes out
          </div>
          </div>

          {/* Boost + Collect */}
          <div className="relative flex items-center gap-3 shrink-0 flex-nowrap">
            <button
              onClick={() => setShowConsumablePicker(true)}
              disabled={consumableSlotsUsed >= 3 || consumablesUsedToday >= consumableDailyCap}
              className="cd-btn-solid cd-btn-action cd-clip-btn px-6 py-2.5 text-sm font-bold cd-head tracking-wider cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 relative flex items-center gap-1.5"
              title="Use a consumable to boost income"
            >
              <Zap size={14} className="shrink-0" />
              Boost
            </button>
            <button
              onClick={handleCollect}
              disabled={!canCollect || collecting}
              className="cd-btn-solid cd-btn-action cd-clip-btn px-6 py-2.5 ml-2 text-sm font-bold cd-head tracking-wider cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {collecting ? 'Collecting...' : 'Collect'}
            </button>
            {collectNotif && (
              <div
                className="absolute -top-10 right-0 whitespace-nowrap px-3 py-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-cyan)]/30 text-xs font-bold cd-num flex items-center gap-2"
                style={{ animation: 's5-notif-float 2.5s ease-out forwards' }}
              >
                {collectNotif.passion > 0 && (
                  <span style={{ color: '#f8c56a' }}>+{collectNotif.passion}</span>
                )}
                {collectNotif.cores > 0 && (
                  <span className="text-[var(--cd-cyan)]">+{collectNotif.cores}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Consumable Status Panel */}
        {(consumableSlotsUsed > 0 || activeBuffs.length > 0 || (dismantleBoostActive && dismantleBoostMult > 1)) && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold cd-head text-white/40 tracking-wider">CONSUMABLES</span>
              <span className="text-[10px] font-bold cd-num text-white/30">{consumableSlotsUsed}/3 until claim &middot; {consumablesUsedToday}/{consumableDailyCap} today</span>
            </div>

            {(activeBuffs.length > 0 || (dismantleBoostActive && dismantleBoostMult > 1)) && (
              <div>
                <div className="text-[9px] font-bold cd-head text-white/30 tracking-wider mb-1">ACTIVE BOOSTS</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeBuffs.map((buff, i) => {
                    const def = CONSUMABLES.find(c => c.id === buff.type)
                    return (
                      <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-bold cd-num border border-white/10 bg-white/[0.03] flex items-center gap-1.5"
                        style={{ color: RARITIES[buff.rarity]?.color }}>
                        {def && <img src={def.imageUrl} alt="" className="w-4 h-4 rounded" />}
                        {buff.rateBoost && buff.capDays ? `+${(buff.rateBoost * 100).toFixed(0)}% rate +${buff.capDays}d cap` :
                         buff.rateBoost ? `+${(buff.rateBoost * 100).toFixed(0)}% rate` :
                         buff.capDays ? `+${buff.capDays}d cap` :
                         buff.collectMult ? `${buff.collectMult}x collect` : buff.type}
                      </span>
                    )
                  })}
                  {dismantleBoostActive && dismantleBoostMult > 1 && (() => {
                    const def = CONSUMABLES.find(c => c.id === 'elixir-int')
                    return (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold cd-num border border-white/10 bg-white/[0.03] flex items-center gap-1.5 text-violet-400">
                        {def && <img src={def.imageUrl} alt="" className="w-4 h-4 rounded" />}
                        &times;{dismantleBoostMult.toFixed(1)} dismantle (daily)
                      </span>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {consumableResult && (
          <div className="text-center text-sm font-bold cd-num" style={{ animation: 's5-fade-in 0.3s ease-out' }}>
            {consumableResult.loading ? (
              <span className="text-white/40"><span className="cd-spinner inline-block w-3 h-3 mr-1.5 align-middle" />Applying...</span>
            ) : consumableResult.effect === 'jackpot' ? (
              <span className="text-amber-400">Jackpot! +{consumableResult.value} Cores</span>
            ) : consumableResult.effect === 'cap-fill' ? (
              <span className="text-red-400">+{typeof consumableResult.value === 'number' ? consumableResult.value.toFixed(1) : consumableResult.value} Cores filled</span>
            ) : ['rate-boost', 'rate-cap-boost', 'collect-mult', 'cap-increase', 'dismantle-boost'].includes(consumableResult.effect) ? (
              <span className="text-purple-400">Buff active!</span>
            ) : null}
          </div>
        )}

      </div>

      {/* Lineup Tabs */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setActiveLineup('current')}
          className={`px-5 py-2.5 font-bold tracking-wider uppercase text-sm cursor-pointer transition-all duration-250 ${
            activeLineup === 'current'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          style={{
            fontFamily: "'Teko', sans-serif",
            letterSpacing: '0.12em',
            clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            ...(activeLineup === 'current'
              ? {
                  background: 'linear-gradient(135deg, #e86520, #c44a10)',
                  boxShadow: '0 2px 12px rgba(232,101,32,0.35), 0 0 30px rgba(232,101,32,0.12)',
                }
              : {
                  background: 'rgba(14,14,14,0.6)',
                  border: '1px solid #222',
                }),
          }}
        >
          Current Season
        </button>
        <button
          onClick={() => setActiveLineup('allstar')}
          className={`px-5 py-2.5 font-bold tracking-wider uppercase text-sm cursor-pointer transition-all duration-250 ${
            activeLineup === 'allstar'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          style={{
            fontFamily: "'Teko', sans-serif",
            letterSpacing: '0.12em',
            clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            ...(activeLineup === 'allstar'
              ? {
                  background: 'linear-gradient(135deg, #9333ea, #6b21a8)',
                  boxShadow: '0 2px 12px rgba(147,51,234,0.35), 0 0 30px rgba(147,51,234,0.12)',
                }
              : {
                  background: 'rgba(14,14,14,0.6)',
                  border: '1px solid #222',
                }),
          }}
        >
          All-Star
        </button>
      </div>

      {/* Lineup Flat × Mult Breakdown (scoped to active lineup) */}
      {(lineupBreakdown.flatCoresBase > 0 || lineupBreakdown.totalMultBase > 1) && (() => {
        const baseOutput = lineupBreakdown.flatCoresBase * lineupBreakdown.totalMultBase
        const output = lineupBreakdown.flatCores * lineupBreakdown.totalMult
        const isAllStar = activeLineup === 'allstar'
        const lineupContribution = isAllStar ? output * S5_ALLSTAR_MODIFIER : output
        const otherLineupOutput = isAllStar
          ? (startingFive?.currentSeason?.output?.coresPerDay || 0)
          : (startingFive?.allStar?.output?.coresPerDay || 0) * S5_ALLSTAR_MODIFIER
        const combinedRate = lineupContribution + otherLineupOutput
        return (
        <div className="cd-panel rounded-xl p-3 sm:p-4 mb-4 cd-num">
          {/* Hero numbers — base values (before team synergy) so card values add up */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 leading-none">
                {lineupBreakdown.flatCoresBase < 1 ? lineupBreakdown.flatCoresBase.toFixed(2) : lineupBreakdown.flatCoresBase.toFixed(1)}
              </div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-1 uppercase tracking-wider">Flat/day</div>
            </div>
            <span className="text-xl sm:text-2xl text-white/20 font-light select-none pb-3">×</span>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 leading-none">
                {lineupBreakdown.totalMultBase.toFixed(2)}x
              </div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-1 uppercase tracking-wider">Multiplier</div>
            </div>
            <span className="text-xl sm:text-2xl text-white/20 font-light select-none pb-3">=</span>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-black text-[var(--cd-cyan)] leading-none">
                {baseOutput.toFixed(1)}
              </div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-1 uppercase tracking-wider">Cores/day</div>
            </div>
          </div>
          {/* Modifiers + combined breakdown */}
          <div className="flex items-center justify-center gap-2 flex-wrap mt-2 pt-2 border-t border-white/[0.06] text-xs">
            {lineupBreakdown.teamSynergyPct > 0.005 && (
              <>
                <span className="text-sky-400">+{Math.round(lineupBreakdown.teamSynergyPct * 100)}% team</span>
                <span className="text-white/20">→</span>
                <span className="text-white/50">{output.toFixed(1)}/day</span>
              </>
            )}
            {isAllStar && (
              <>
                {lineupBreakdown.teamSynergyPct > 0.005 && <span className="text-white/20">·</span>}
                <span className="text-purple-400">×0.615 all-star</span>
                <span className="text-white/20">→</span>
                <span className="text-white/50">{lineupContribution.toFixed(1)}/day</span>
              </>
            )}
          </div>
          {/* Combined total from both lineups */}
          {otherLineupOutput > 0 && (
            <div className="flex items-center justify-center gap-2 mt-1.5 text-[10px] text-white/30">
              <span>{isAllStar ? 'Current Season' : 'All-Star'}: +{otherLineupOutput.toFixed(1)}/day</span>
              <span className="text-white/15">→</span>
              <span className="text-white/50 font-bold">Combined: {combinedRate.toFixed(1)} Cores/day</span>
            </div>
          )}
        </div>
        )
      })()}

      <SynergyPlanner collection={collection} startingFive={startingFive} />

      {/* 5 Role Slots */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {ROLES.map(role => {
          const card = slottedCards[role.key]
          const slotData = slots[role.key]
          const isAnimating = slotAnimation?.role === role.key

          return (
            <div key={role.key} className="flex flex-col items-center gap-2">
              {/* Role label */}
              <div className="flex items-center gap-1.5 mb-1">
                <img src={role.icon} alt={role.label} className="w-4 h-4 opacity-60" />
                <span className="text-xs font-bold text-white/40 cd-head tracking-wider">{role.label}</span>
              </div>

              {/* Slot container */}
              <div className="relative">
                {card ? (
                  <FilledSlot
                    card={card}
                    role={role}
                    slotData={slotData}
                    isAnimating={isAnimating}
                    animConfig={isAnimating ? getAnimationConfig(slotAnimation.rarity) : null}
                    onSwap={() => setPickerRole(role.key)}
                    onRemove={() => handleUnslot(role.key)}
                    onZoom={() => { setOptionsRole(null); setZoomedCard(card) }}
                    optionsOpen={optionsRole === role.key}
                    onToggleOptions={() => setOptionsRole(optionsRole === role.key ? null : role.key)}
                    size={slotSize}
                    override={getDefOverride(card)}
                    onAttachPicker={(r, st) => setAttachPickerState({ role: r, slotType: st })}
                    onAttachRemove={(r, st) => handleAttachUnslot(r, st)}
                    getDefOverride={getDefOverride}
                  />
                ) : (
                  <EmptySlot role={role} onClick={() => setPickerRole(role.key)} size={slotSize} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bench + Staff Slots */}
      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider cd-head text-center">{showStaffSlots ? 'Bench & Staff' : 'Bench (50%)'}</div>
        <div className="flex justify-center items-start gap-3 sm:gap-4">
          {/* Bench */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-white/40 cd-head tracking-wider">BENCH</span>
              <span className="text-[10px] text-white/20 cd-num">(50%)</span>
            </div>
            <div className="relative">
              {slottedCards.bench ? (
                <FilledSlot
                  card={slottedCards.bench}
                  role={{ key: 'bench', label: 'BENCH', icon: null }}
                  slotData={slots.bench}
                  isAnimating={slotAnimation?.role === 'bench'}
                  animConfig={slotAnimation?.role === 'bench' ? getAnimationConfig(slotAnimation.rarity) : null}
                  onSwap={() => setPickerRole('bench')}
                  onRemove={() => handleUnslot('bench')}
                  onZoom={() => { setOptionsRole(null); setZoomedCard(slottedCards.bench) }}
                  optionsOpen={optionsRole === 'bench'}
                  onToggleOptions={() => setOptionsRole(optionsRole === 'bench' ? null : 'bench')}
                  size={slotSize}
                  override={getDefOverride(slottedCards.bench)}
                  onAttachPicker={(r, st) => setAttachPickerState({ role: r, slotType: st })}
                  onAttachRemove={(r, st) => handleAttachUnslot(r, st)}
                  getDefOverride={getDefOverride}
                />
              ) : (
                <button
                  onClick={() => setPickerRole('bench')}
                  className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] hover:border-[var(--cd-cyan)]/30 hover:bg-[var(--cd-cyan)]/[0.03] transition-all cursor-pointer"
                  style={{ width: slotSize, aspectRatio: '63/88' }}
                >
                  <Plus size={slotSize < 150 ? 22 : 28} className="opacity-[0.08] group-hover:opacity-30 transition-opacity mb-2 text-white" />
                  <div className="flex items-center gap-1 text-[11px] text-white/20 group-hover:text-[var(--cd-cyan)]/60 font-bold cd-head tracking-wider transition-colors">
                    <Plus size={12} />
                    BENCH
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Staff Slots — current season only, feature-flagged */}
          {activeLineup === 'current' && showStaffSlots && STAFF_SLOTS.map(staffSlot => {
            const card = slottedCards[staffSlot.key]
            const slotData = slots[staffSlot.key]
            const isAnimating = slotAnimation?.role === staffSlot.key

            return (
              <div key={staffSlot.key} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-white/40 cd-head tracking-wider">{staffSlot.label}</span>
                </div>
                <div className="relative">
                  {card ? (
                    <StaffFilledSlot
                      card={card}
                      role={staffSlot}
                      slotData={slotData}
                      isAnimating={isAnimating}
                      animConfig={isAnimating ? getAnimationConfig(slotAnimation.rarity) : null}
                      onSwap={() => setPickerRole(staffSlot.key)}
                      onRemove={() => handleUnslot(staffSlot.key)}
                      onZoom={() => { setOptionsRole(null); setZoomedCard(card) }}
                      optionsOpen={optionsRole === staffSlot.key}
                      onToggleOptions={() => setOptionsRole(optionsRole === staffSlot.key ? null : staffSlot.key)}
                      size={slotSize}
                      override={getDefOverride(card)}
                    />
                  ) : (
                    <button
                      onClick={() => setPickerRole(staffSlot.key)}
                      className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] hover:border-[var(--cd-cyan)]/30 hover:bg-[var(--cd-cyan)]/[0.03] transition-all cursor-pointer"
                      style={{ width: slotSize, aspectRatio: '63/88' }}
                    >
                      <Plus size={slotSize < 150 ? 22 : 28} className="opacity-[0.08] group-hover:opacity-30 transition-opacity mb-2 text-white" />
                      <div className="flex items-center gap-1 text-[11px] text-white/20 group-hover:text-[var(--cd-cyan)]/60 font-bold cd-head tracking-wider transition-colors">
                        <Plus size={12} />
                        {staffSlot.label}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <PassivePanel
          passiveState={startingFive?.passiveState}
          onUpdate={() => loadStartingFive()}
        />
        <PassivesGuide />
      </div>

      {/* Leaderboard */}
      <S5Leaderboard data={s5Leaderboard} loading={s5LbLoading} currentUserId={user?.id} />

      {/* Card Picker Modal */}
      {pickerRole && (
        <CardPicker
          role={pickerRole}
          collection={collection}
          slottedCards={slottedCards}
          allSlottedIds={allSlottedIds}
          activeSlots={slots}
          onSelect={handleSlot}
          onClose={() => setPickerRole(null)}
          slotting={slotting}
          getDefOverride={getDefOverride}
          isBench={pickerRole === 'bench'}
        />
      )}

      {attachPickerState && (
        <AttachmentPicker
          role={attachPickerState.role}
          slotType={attachPickerState.slotType}
          collection={collection}
          allSlottedIds={allSlottedIds}
          playerRarity={slottedCards[attachPickerState.role]?.rarity}
          playerHoloType={slottedCards[attachPickerState.role]?.holoType}
          bestGodName={slottedCards[attachPickerState.role]?.bestGodName}
          onSelect={handleAttachSlot}
          onClose={() => setAttachPickerState(null)}
          slotting={slotting}
          getDefOverride={getDefOverride}
        />
      )}

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} showStaffSlots={showStaffSlots} />}

      {pendingLineupAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPendingLineupAction(null)}>
          <div className="relative w-full max-w-sm bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl overflow-hidden sm:mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
              <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">Active Boosts</h3>
              <button onClick={() => setPendingLineupAction(null)} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-white/60">Changing your lineup will collect your pending income and <span className="text-amber-400 font-bold">clear all active boosts</span>.</p>
              <div className="flex flex-wrap gap-1.5">
                {activeBuffs.map((buff, i) => {
                  const def = CONSUMABLES.find(c => c.id === buff.type)
                  return (
                    <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-bold cd-num border border-white/10 bg-white/[0.03] flex items-center gap-1.5"
                      style={{ color: RARITIES[buff.rarity]?.color }}>
                      {def && <img src={def.imageUrl} alt="" className="w-4 h-4 rounded" />}
                      {buff.rateBoost && buff.capDays ? `+${(buff.rateBoost * 100).toFixed(0)}% rate +${buff.capDays}d cap` :
                       buff.rateBoost ? `+${(buff.rateBoost * 100).toFixed(0)}% rate` :
                       buff.capDays ? `+${buff.capDays}d cap` :
                       buff.collectMult ? `${buff.collectMult}x collect` : buff.type}
                    </span>
                  )
                })}
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <button onClick={() => setPendingLineupAction(null)}
                  className="cd-btn-solid cd-btn-action cd-clip-btn px-4 py-2 text-xs font-bold cd-head cursor-pointer text-red-400">
                  Cancel
                </button>
                <button onClick={() => { const action = pendingLineupAction; setPendingLineupAction(null); action(); }}
                  className="cd-btn-solid cd-btn-action cd-clip-btn px-4 py-2 text-xs font-bold cd-head cursor-pointer">
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConsumablePicker && (
        <BoostModal
          onClose={() => setShowConsumablePicker(false)}
          onUse={handleUseConsumable}
          cards={collection}
          slotsUsed={consumableSlotsUsed}
          usedToday={consumablesUsedToday}
          dailyCap={consumableDailyCap}
        />
      )}

      {/* Card Zoom Modal */}
      {zoomedCard && (
        <CardZoomModal
          onClose={() => setZoomedCard(null)}
          collectionCard={zoomedCard.blueprintId ? zoomedCard : undefined}
          playerCard={getCardType(zoomedCard) === 'player' ? toPlayerCardProps(zoomedCard) : undefined}
          gameCard={getCardType(zoomedCard) !== 'player' && !zoomedCard.blueprintId ? { type: getCardType(zoomedCard), rarity: zoomedCard.rarity, data: toGameCardData(zoomedCard, getDefOverride(zoomedCard)) } : undefined}
          holoType={zoomedCard.holoType}
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

      {error && (
        <div className="fixed top-20 right-4 z-50 px-4 py-3 rounded-lg border bg-red-500/10 border-red-500/20 text-red-400 text-sm font-bold cd-head">
          {error}
        </div>
      )}
    </div>
  )
}


function BoostModal({ onClose, onUse, cards, slotsUsed, usedToday = 0, dailyCap = 10 }) {
  const [selectedType, setSelectedType] = useState(null)
  const [confirmCard, setConfirmCard] = useState(null)

  const consumableCards = useMemo(() =>
    (cards || []).filter(c => c.cardType === 'consumable' || c.card_type === 'consumable'),
    [cards]
  )

  const cardsByType = useMemo(() => {
    const groups = {}
    for (const card of consumableCards) {
      const cId = card.cardData?.consumableId || card.card_data?.consumableId
      if (!cId) continue
      if (!groups[cId]) groups[cId] = []
      groups[cId].push(card)
    }
    const rarityOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (rarityOrder[a.rarity] || 9) - (rarityOrder[b.rarity] || 9))
    }
    return groups
  }, [consumableCards])

  if (confirmCard) {
    const cId = confirmCard.cardData?.consumableId || confirmCard.card_data?.consumableId
    const def = CONSUMABLES.find(c => c.id === cId)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <div className="relative w-full max-w-sm bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl overflow-hidden sm:mx-4"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
            <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">Confirm Use</h3>
            <button onClick={() => setConfirmCard(null)} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>
          <div className="p-5 text-center space-y-3">
            <div className="text-sm font-bold cd-head" style={{ color: RARITIES[confirmCard.rarity]?.color }}>
              {RARITIES[confirmCard.rarity]?.name} {def?.name}
            </div>
            <p className="text-xs text-white/50">{def?.description}</p>
            <p className="text-xs text-amber-400/80 font-bold">This card will be consumed.</p>
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={() => setConfirmCard(null)}
                className="cd-btn-solid cd-btn-action cd-clip-btn px-4 py-2 text-xs font-bold cd-head cursor-pointer text-red-400">
                Cancel
              </button>
              <button onClick={() => { onUse(confirmCard.id); setConfirmCard(null); }}
                className="cd-btn-solid cd-btn-action cd-clip-btn px-4 py-2 text-xs font-bold cd-head cursor-pointer">
                Use
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (selectedType) {
    const typeCards = cardsByType[selectedType] || []
    const def = CONSUMABLES.find(c => c.id === selectedType)
    const effect = CONSUMABLE_EFFECTS[selectedType]
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <div className="relative w-full max-w-md max-h-[90dvh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl overflow-hidden sm:mx-4 flex flex-col"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)] shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedType(null)} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                <ChevronLeft size={20} />
              </button>
              <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">{def?.name}</h3>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>
          <div className="p-4 overflow-y-auto space-y-2 flex-1">
            <p className="text-sm text-white/40 mb-3">{def?.description}</p>
            {typeCards.map(card => {
              const effectVal = effect?.values?.[card.rarity] || effect?.rateValues?.[card.rarity] || 0
              let valueLabel = ''
              if (effect?.effect === 'cap-fill') valueLabel = `Fill ${(effectVal * 100).toFixed(0)}% cap`
              else if (effect?.effect === 'rate-boost') valueLabel = `+${(effectVal * 100).toFixed(0)}% rate`
              else if (effect?.effect === 'rate-cap-boost') valueLabel = `+${((effect.rateValues?.[card.rarity] || 0) * 100).toFixed(0)}% rate, +${effect.capValues?.[card.rarity] || 0}d cap`
              else if (effect?.effect === 'collect-mult') valueLabel = `${effectVal}x collect`
              else if (effect?.effect === 'dismantle-boost') valueLabel = `\u00d7${effectVal} thresholds`
              else if (effect?.effect === 'cap-increase') valueLabel = `+${effectVal}d cap`
              else if (effect?.effect === 'jackpot') valueLabel = `1\u2013${effectVal} Cores`

              return (
                <button key={card.id} onClick={() => setConfirmCard(card)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold cd-head" style={{ color: RARITIES[card.rarity]?.color }}>
                      {RARITIES[card.rarity]?.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold cd-num text-emerald-400">{valueLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md max-h-[90dvh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl overflow-hidden sm:mx-4 flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)] shrink-0">
          <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">
            Boost <span className="text-white/30 text-sm ml-1">{slotsUsed}/3 &middot; {usedToday}/{dailyCap} today</span>
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {usedToday >= dailyCap ? (
          <div className="p-6 text-center text-sm text-white/40">
            Daily limit reached ({dailyCap} consumables per day).
          </div>
        ) : slotsUsed >= 3 ? (
          <div className="p-6 text-center text-sm text-white/40">
            All 3 slots used. Collect income to reset.
          </div>
        ) : (
          <div className="p-4 overflow-y-auto space-y-1.5 flex-1">
            {CONSUMABLES.map(cons => {
              const count = (cardsByType[cons.id] || []).length
              const hasCards = count > 0
              return (
                <button
                  key={cons.id}
                  onClick={() => hasCards && setSelectedType(cons.id)}
                  disabled={!hasCards}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-all ${
                    hasCards
                      ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 cursor-pointer'
                      : 'border-white/[0.03] bg-white/[0.01] opacity-40 cursor-not-allowed'
                  }`}
                >
                  <img src={cons.imageUrl} alt={cons.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-xs font-bold cd-head text-white/80">{cons.name}</div>
                    <div className="text-[10px] text-white/40">{cons.description}</div>
                  </div>
                  {hasCards && (
                    <span className="text-[10px] font-bold cd-num px-1.5 py-0.5 rounded bg-white/[0.05] text-white/50">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


function TutorialModal({ onClose, showStaffSlots }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'cd-fade-in 0.2s ease-out' }}
    >
      <div
        className="relative w-full max-w-lg max-h-[100dvh] sm:max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-none overflow-hidden sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">How Starting 5 Works</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm text-white/60" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">PASSIVE INCOME</h4>
            <p>Slot holo player cards into 5 role-based slots plus a bench slot to earn passive Passion and Cores over time. Higher rarity cards generate more income.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">TWO LINEUPS</h4>
            <p>Build two lineups: <span className="text-blue-400">Current Season</span> runs at full rate, while <span className="text-purple-400">All-Star</span> runs at 61.5% rate. Both lineups generate income simultaneously.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">HOLO TYPES</h4>
            <p>
              <span style={{ color: '#f8c56a' }}>Holo</span> cards provide flat Cores + small Passion income.{' '}
              <span className="text-[var(--cd-cyan)]">Reverse holo</span> cards multiply ALL flat income.{' '}
              <span className="text-purple-400">Full holo</span> cards contribute both at 44% effectiveness.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">ATTACHMENTS</h4>
            <p>Each player slot has two attachment slots: one for a god card and one for an item card. Attachments boost the player's income with a percentage multiplier based on their rarity. God cards give larger bonuses than items.</p>
            <p className="mt-1 text-white/40">Attachments must be at least the same rarity as the player (unique players can use mythic attachments). The attachment's holo type must match the player's — mismatched holos provide no bonus. Full holo attachments always fit but apply their bonus at 60%.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">GOD SYNERGY</h4>
            <p>When an attached god card matches the player's most played god, the god bonus is increased by 40%. Look for the <span className="text-emerald-400 font-bold">SYNERGY</span> indicator on the attachment.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">TEAM SYNERGY</h4>
            <p>Slot multiple players from the same team (including bench) for a stacking bonus that only buffs same-team players: <span className="text-white/80">+20%</span> at 2 teammates, up to <span className="text-white/80">+60%</span> with 5.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">CONSUMABLES</h4>
            <p>Use consumable cards for instant effects or temporary buffs. You can use up to 3 before your next claim. Each consumable is destroyed on use.</p>
            <ul className="mt-2 space-y-1 text-white/50">
              <li><span className="text-red-400">Health Potion</span> — Fill a percentage of your Cores cap instantly</li>
              <li><span className="text-blue-400">Mana Potion</span> — Boost your income rate until next collect</li>
              <li><span className="text-purple-400">Multi Potion</span> — Boost rate and extend cap until next collect</li>
              <li><span className="text-orange-400">Elixir of Strength</span> — Multiply your next collect payout</li>
              <li><span className="text-violet-400">Elixir of Intelligence</span> — Expand dismantle thresholds until daily reset</li>
              <li><span className="text-green-400">Vision Ward</span> — Add extra days to your cap until next collect</li>
              <li><span className="text-amber-400">Sentry Ward</span> — Jackpot! Receive a random amount of Cores</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">INCOME CAP</h4>
            <p>Passion and Cores each accumulate up to a 2-day cap based on your unboosted rates. Collect regularly to avoid wasting earnings.</p>
          </div>

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">BENCH SLOT</h4>
            <p>Each lineup has a 6th bench slot that accepts any player role. Bench cards contribute at 50% effectiveness — still worth filling if you have spare holos.</p>
          </div>

          {showStaffSlots && (
            <div>
              <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">STAFF SLOTS</h4>
              <p>Two staff slots (Cheerleader and Staff) are available in the current season lineup only. Slot staff-type cards to get a small Cores income bonus and multiplier boost. Staff cards cannot have attachments and don't count toward team synergy.</p>
            </div>
          )}

          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">ROLE MATCHING</h4>
            <p>Player and god cards must match the slot's role (Solo, Jungle, Mid, Support, ADC). Fill-role cards can go in any slot. Item cards can be attached to any slot regardless of role. The bench slot accepts any role. A mismatched role earns zero income.</p>
          </div>
        </div>
      </div>
    </div>
  )
}


function S5Leaderboard({ data, loading, currentUserId }) {
  if (loading) {
    return (
      <div className="mt-8 cd-panel cd-corners rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-amber-400" />
          <h2 className="text-sm font-bold cd-head tracking-wider text-white/60">LEADERBOARD</h2>
        </div>
        <div className="flex justify-center py-8">
          <div className="cd-spinner w-6 h-6" />
        </div>
      </div>
    )
  }

  if (!data?.leaderboard?.length) return null

  const entries = data.leaderboard
  const myEntry = data.myEntry

  return (
    <div className="mt-8 cd-panel cd-corners rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-amber-400" />
        <h2 className="text-sm font-bold cd-head tracking-wider text-white/60">TOP 20 — TOTAL INCOME</h2>
      </div>
      <div className="space-y-[2px]">
        {entries.map(entry => {
          const isMe = entry.userId === currentUserId
          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg ${
                isMe ? 'bg-[var(--cd-cyan)]/[0.06] border border-[var(--cd-cyan)]/20' : 'bg-white/[0.02]'
              }`}
            >
              <div className={`w-7 sm:w-9 text-center cd-num text-sm sm:text-base font-bold ${
                entry.position === 1 ? 'text-yellow-400' :
                entry.position === 2 ? 'text-gray-300' :
                entry.position === 3 ? 'text-amber-600' : 'text-white/25'
              }`}>
                #{entry.position}
              </div>
              {entry.avatar && entry.discordId ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=32`}
                  alt=""
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/30">
                  {(entry.username || '?')[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold cd-head truncate text-white/80">
                  {entry.username || 'Unknown'}
                  {isMe && <span className="text-[var(--cd-cyan)] text-xs ml-1">(you)</span>}
                </div>
                <div className="text-[10px] text-white/25 cd-num">
                  {entry.cardCount} card{entry.cardCount !== 1 ? 's' : ''} slotted
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-bold cd-num text-white/70">{(entry.coresPerDay + entry.passionPerDay).toFixed(1)}</span>
                  <span className="text-[10px] text-white/25 cd-num">/day</span>
                </div>
                <div className="flex items-center justify-end gap-2 text-[10px] cd-num">
                  {entry.passionPerDay > 0 && (
                    <span className="flex items-center gap-0.5" style={{ color: '#f8c56a88' }}>
                      {entry.passionPerDay} P
                    </span>
                  )}
                  {entry.coresPerDay > 0 && (
                    <span className="flex items-center gap-0.5 text-[var(--cd-cyan)]/50">
                      {entry.coresPerDay} C
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {myEntry && (
          <>
            <div className="text-center text-white/15 text-xs py-1">...</div>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg bg-[var(--cd-cyan)]/[0.06] border border-[var(--cd-cyan)]/20">
              <div className="w-7 sm:w-9 text-center cd-num text-sm sm:text-base font-bold text-white/25">
                #{myEntry.position}
              </div>
              {myEntry.avatar && myEntry.discordId ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${myEntry.discordId}/${myEntry.avatar}.png?size=32`}
                  alt=""
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/30">
                  {(myEntry.username || '?')[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold cd-head truncate text-white/80">
                  {myEntry.username || 'Unknown'}
                  <span className="text-[var(--cd-cyan)] text-xs ml-1">(you)</span>
                </div>
                <div className="text-[10px] text-white/25 cd-num">
                  {myEntry.cardCount} card{myEntry.cardCount !== 1 ? 's' : ''} slotted
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-bold cd-num text-white/70">{(myEntry.coresPerDay + myEntry.passionPerDay).toFixed(1)}</span>
                  <span className="text-[10px] text-white/25 cd-num">/day</span>
                </div>
                <div className="flex items-center justify-end gap-2 text-[10px] cd-num">
                  {myEntry.passionPerDay > 0 && (
                    <span className="flex items-center gap-0.5" style={{ color: '#f8c56a88' }}>
                      {myEntry.passionPerDay} P
                    </span>
                  )}
                  {myEntry.coresCap > 0 && (
                    <span className="flex items-center gap-0.5 text-[var(--cd-cyan)]/50">
                      {myEntry.coresPerDay} C
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EmptySlot({ role, onClick, size = 170 }) {
  const iconSize = size < 150 ? 22 : 28
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] hover:border-[var(--cd-cyan)]/30 hover:bg-[var(--cd-cyan)]/[0.03] transition-all cursor-pointer"
      style={{ width: size, aspectRatio: '63/88' }}
    >
      <img src={role.icon} alt={role.label} style={{ width: iconSize, height: iconSize }} className="opacity-[0.08] group-hover:opacity-30 transition-opacity mb-2" />
      <div className="flex items-center gap-1 text-[11px] text-white/20 group-hover:text-[var(--cd-cyan)]/60 font-bold cd-head tracking-wider transition-colors">
        <Plus size={12} />
        Slot Card
      </div>
    </button>
  )
}


function StaffFilledSlot({ card, role, slotData, isAnimating, animConfig, onSwap, onRemove, onZoom, optionsOpen, onToggleOptions, size = 170, override }) {
  const { getBlueprint } = useVault()
  const color = RARITIES[card.rarity]?.color || '#9ca3af'
  const type = getCardType(card)
  const slotRef = useRef(null)

  useEffect(() => {
    if (!optionsOpen) return
    const handler = (e) => {
      if (slotRef.current && !slotRef.current.contains(e.target)) {
        onToggleOptions()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [optionsOpen, onToggleOptions])

  const cores = S5_STAFF_FLAT_CORES[card.rarity] || 0
  const mult = S5_STAFF_MULT[card.rarity] || 1

  return (
    <div className="relative" ref={slotRef}>
      {isAnimating && animConfig && (
        <SlotAnimationOverlay config={animConfig} rarity={card.rarity} />
      )}

      <div
        className="relative cursor-pointer transition-all"
        style={{
          ...(isAnimating ? { '--glow-color': `${color}66`, animation: 's5-glow-pulse 0.8s ease-in-out 2' } : {}),
          ...(!isAnimating ? { animation: 's5-card-enter 0.3s ease-out' } : {}),
        }}
        onClick={onToggleOptions}
      >
        {card.blueprintId ? (
          <VaultCard card={card} getBlueprint={getBlueprint} size={size} holo />
        ) : (
          <TradingCardHolo rarity={getHoloEffect(card.rarity)} role="STAFF" holoType={card.holoType || 'reverse'} size={size}>
            <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={size} />
          </TradingCardHolo>
        )}

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

      <div className="mt-2 text-center">
        <div className="text-[11px] font-bold text-white/70 truncate cd-head" style={{ maxWidth: size }}>
          {card.godName}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold cd-head" style={{ color }}>{RARITIES[card.rarity]?.name}</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-1 text-[10px] cd-num text-white/40">
          {cores > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              {cores < 1 ? cores.toFixed(2) : cores.toFixed(1)}/d
            </span>
          )}
          {mult > 1 && (
            <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
              +{Math.round((mult - 1) * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function FilledSlot({ card, role, slotData, isAnimating, animConfig, onSwap, onRemove, onZoom, optionsOpen, onToggleOptions, size = 170, override, onAttachPicker, onAttachRemove, getDefOverride }) {
  const { getBlueprint } = useVault()
  const color = RARITIES[card.rarity]?.color || '#9ca3af'
  const income = getSlotContribution(slotData)
  const type = getCardType(card)
  const isPlayer = type === 'player'
  const slotRef = useRef(null)

  useEffect(() => {
    if (!optionsOpen) return
    const handler = (e) => {
      if (slotRef.current && !slotRef.current.contains(e.target)) {
        onToggleOptions()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [optionsOpen, onToggleOptions])

  return (
    <div className="relative" ref={slotRef}>
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
        <div style={card.roleMismatch ? { opacity: 0.5, filter: 'grayscale(0.6)' } : undefined}>
          {card.blueprintId ? (
            <VaultCard card={card} getBlueprint={getBlueprint} size={size} holo />
          ) : isPlayer ? (
            <TradingCard
              {...toPlayerCardProps(card)}
              rarity={card.rarity}
              size={size}
              holo={{ rarity: getHoloEffect(card.rarity), holoType: card.holoType || 'reverse' }}
            />
          ) : (
            <TradingCardHolo rarity={getHoloEffect(card.rarity)} role={(card.role || card.cardData?.role || 'adc').toUpperCase()} holoType={card.holoType || 'reverse'} size={size}>
              <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={size} />
            </TradingCardHolo>
          )}
        </div>

        {/* Options dropdown - positioned right under the card */}
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

      {/* Card info below */}
      <div className="mt-2 text-center">
        <div className="text-[11px] font-bold text-white/70 truncate cd-head" style={{ maxWidth: size }}>
          {card.godName}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold cd-head" style={{ color }}>{RARITIES[card.rarity]?.name}</span>
          <HoloTypeIcon holoType={card.holoType} size={11} />
        </div>
        {card.roleMismatch ? (
          <div className="flex items-center justify-center gap-1 mt-1">
            <AlertTriangle size={10} className="text-red-400" />
            <span className="text-[9px] font-bold cd-head text-red-400 tracking-wider">WRONG ROLE</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mt-1 text-[10px] cd-num text-white/40">
              {(income.type === 'flat' || income.type === 'full') && income.cores > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400">
                  {income.cores < 1 ? income.cores.toFixed(2) : income.cores.toFixed(1)}/d
                </span>
              )}
              {(income.type === 'mult' || income.type === 'full') && income.multiplier > 1 && (
                <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                  {income.multiplier.toFixed(2)}x
                </span>
              )}
            </div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              {card.teamSynergyBonus > 0 ? (
                <span className="text-[9px] font-bold cd-head text-emerald-400">
                  +{Math.round(card.teamSynergyBonus * 100)}% Team
                </span>
              ) : (
                <span className="text-[9px] invisible">placeholder</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Attachment slots */}
      <div className="flex items-start justify-center gap-2 mt-2">
        <AttachmentSlot
          attachment={card.godCard}
          slotType="god"
          onAttach={() => onAttachPicker(role.key, 'god')}
          onRemove={() => onAttachRemove(role.key, 'god')}
          size={size}
          getDefOverride={getDefOverride}
          synergy={card.synergy}
          playerHoloType={card.holoType}
        />
        <AttachmentSlot
          attachment={card.itemCard}
          slotType="item"
          onAttach={() => onAttachPicker(role.key, 'item')}
          onRemove={() => onAttachRemove(role.key, 'item')}
          size={size}
          getDefOverride={getDefOverride}
          playerHoloType={card.holoType}
        />
      </div>

    </div>
  )
}


function AttachmentSlot({ attachment, slotType, onAttach, onRemove, onSwap, size = 170, getDefOverride, synergy, playerHoloType }) {
  const attachSize = Math.round(size * 0.4)

  if (!attachment) {
    return (
      <button
        onClick={onAttach}
        className="group flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01] hover:border-[var(--cd-cyan)]/20 hover:bg-[var(--cd-cyan)]/[0.02] transition-all cursor-pointer"
        style={{ width: attachSize, height: Math.round(attachSize * 88 / 63) }}
        title={`Attach ${slotType}`}
      >
        <Plus size={10} className="text-white/15 group-hover:text-[var(--cd-cyan)]/40 transition-colors" />
        <span className="text-[7px] text-white/15 group-hover:text-[var(--cd-cyan)]/40 font-bold cd-head tracking-wider mt-0.5 transition-colors">
          {slotType === 'god' ? 'GOD' : 'ITEM'}
        </span>
      </button>
    )
  }

  const color = RARITIES[attachment.rarity]?.color || '#9ca3af'
  const type = getCardType(attachment)
  const cardOverride = getDefOverride?.(attachment)
  const renderSize = 150
  const scale = attachSize / renderSize
  const holoMismatch = playerHoloType && !isHoloMatch(playerHoloType, attachment.holoType)

  return (
    <div className="relative group">
      <div
        style={{ width: attachSize, height: Math.round(attachSize * 88 / 63), overflow: 'hidden' }}
        className="relative cursor-pointer"
        onClick={onSwap || onAttach}
        title={`Swap ${slotType}`}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: renderSize, filter: holoMismatch ? 'grayscale(0.7) brightness(0.5)' : undefined }}>
          <TradingCardHolo rarity={getHoloEffect(attachment.rarity)} role={(attachment.role || attachment.cardData?.role || 'adc').toUpperCase()} holoType={attachment.holoType || 'reverse'} size={renderSize}>
            <GameCard type={type} rarity={attachment.rarity} data={toGameCardData(attachment, cardOverride)} />
          </TradingCardHolo>
        </div>
        {holoMismatch && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <X size={14} className="text-red-500/80" strokeWidth={3} />
            <span className="text-[5px] font-bold text-red-400/80 cd-head tracking-wider leading-none">WRONG HOLO</span>
          </div>
        )}
      </div>
      <div className="text-center mt-0.5">
        <div className={`text-[9px] font-bold truncate cd-head ${holoMismatch ? 'text-white/25' : 'text-white/50'}`} style={{ maxWidth: attachSize }}>{attachment.godName}</div>
        <div className="text-[9px] font-bold cd-head" style={{ color: holoMismatch ? `${color}66` : color }}>{RARITIES[attachment.rarity]?.name}</div>
        {!holoMismatch && attachment.bonus && (attachment.bonus.flatBoost > 0 || attachment.bonus.multAdd > 0) && (
          <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] font-bold cd-num">
            {attachment.bonus.flatBoost > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400">
                +{Math.round(attachment.bonus.flatBoost * 100)}%
              </span>
            )}
            {attachment.bonus.multAdd > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-400">
                +{Math.round(attachment.bonus.multAdd * 100)}%
              </span>
            )}
          </div>
        )}
        {synergy && !holoMismatch && (
          <div className="text-[8px] font-bold cd-head text-emerald-400 tracking-wider">SYNERGY +40%</div>
        )}
        {holoMismatch && (
          <div className="text-[7px] font-bold cd-head text-red-400/60 tracking-wider">NO BONUS</div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
        title="Remove"
      >
        <X size={8} className="text-white" />
      </button>
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


function CardPicker({ role, collection, slottedCards, allSlottedIds, activeSlots, onSelect, onClose, slotting, getDefOverride, isBench }) {
  const roleInfo = ROLES.find(r => r.key === role) || STAFF_SLOTS.find(r => r.key === role)
  const roleIcon = roleInfo?.icon
  const [teamFilter, setTeamFilter] = useState(null)
  const isStaffSlot = role === 'cheerleader' || role === 'staff'

  // Filter eligible cards — bench slot accepts any player role, staff slots accept staff cards only
  const eligibleCards = useMemo(() => {
    const currentPlayerInSlot = slottedCards[role]?.id
    return collection
      .filter(card => {
        const type = getCardType(card)
        if (isStaffSlot) {
          if (type !== 'staff') return false
        } else {
          if (type !== 'player') return false
          if (!isBench) {
            const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
            if (cardRole !== role && cardRole !== 'fill') return false
          }
          if (!card.holoType && card.rarity !== 'common') return false
        }
        if (card.id !== currentPlayerInSlot && allSlottedIds.has(card.id)) return false
        return true
      })
      .sort((a, b) => {
        const rDiff = (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
        if (rDiff !== 0) return rDiff
        const aIncome = getBaseIncomeEstimate(a)
        const bIncome = getBaseIncomeEstimate(b)
        return bIncome.sortValue - aIncome.sortValue
      })
  }, [collection, slottedCards, allSlottedIds, role, isBench, isStaffSlot])

  // Build team options from eligible cards
  const teamOptions = useMemo(() => {
    const teams = new Map()
    for (const card of eligibleCards) {
      const tid = card.teamId || card.cardData?.teamId
      const name = card.cardData?.teamName || ''
      const color = card.cardData?.teamColor || '#6366f1'
      if (!tid || !name) continue
      if (!teams.has(tid)) teams.set(tid, { teamId: tid, teamName: name, teamColor: color, count: 0 })
      teams.get(tid).count++
    }
    return [...teams.values()].sort((a, b) => b.count - a.count)
  }, [eligibleCards])

  // Filter by selected team
  const displayCards = useMemo(() => {
    if (!teamFilter) return eligibleCards
    return eligibleCards.filter(c => (c.teamId || c.cardData?.teamId) === teamFilter)
  }, [eligibleCards, teamFilter])

  // Team counts in active lineup for synergy preview
  const activeTeamCounts = useMemo(() => {
    return getTeamCounts(activeSlots)
  }, [activeSlots])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'cd-fade-in 0.2s ease-out' }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[100dvh] sm:max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-none overflow-hidden sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <div className="flex items-center gap-2">
            {roleIcon && <img src={roleIcon} alt="" className="w-[18px] h-[18px] object-contain" />}
            <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">
              {isBench ? 'Select Bench Card' : `Select ${roleInfo?.label} Card`}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Team filter bar */}
        {teamOptions.length > 1 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--cd-border)] overflow-x-auto">
            <button
              onClick={() => setTeamFilter(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold cd-head tracking-wider transition-colors cursor-pointer ${
                !teamFilter ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
              }`}
            >
              All ({eligibleCards.length})
            </button>
            {teamOptions.map(t => (
              <button
                key={t.teamId}
                onClick={() => setTeamFilter(teamFilter === t.teamId ? null : t.teamId)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cd-head tracking-wider transition-colors cursor-pointer ${
                  teamFilter === t.teamId ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.teamColor }} />
                {t.teamName} ({t.count})
              </button>
            ))}
          </div>
        )}

        {/* Card grid */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {displayCards.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              {roleIcon && <img src={roleIcon} alt="" className="w-10 h-10 mx-auto mb-3 opacity-20 object-contain" />}
              <p className="text-sm cd-head tracking-wider">No eligible cards</p>
              <p className="text-xs text-white/20 mt-1">{isBench ? 'Need a player card (any role)' : `Need a player card with the ${roleInfo?.label} role`}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {displayCards.map(card => (
                <PickerCard
                  key={card.id}
                  card={card}
                  onSelect={() => onSelect(card.id, role)}
                  disabled={slotting}
                  override={getDefOverride(card)}
                  teamSynergyPreview={getTeamSynergyPreview(
                    card.teamId || card.cardData?.teamId,
                    activeTeamCounts
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function AttachmentPicker({ role, slotType, collection, allSlottedIds, playerRarity, playerHoloType, bestGodName, onSelect, onClose, slotting, getDefOverride }) {
  const roleInfo = ROLES.find(r => r.key === role)
  const roleIcon = roleInfo?.icon
  const playerTier = RARITY_TIER[playerRarity] || 0

  const { synergyCards, otherCards } = useMemo(() => {
    const eligible = collection
      .filter(card => {
        const type = getCardType(card)
        if (type !== slotType) return false
        if (!card.holoType) return false
        if ((RARITY_TIER[card.rarity] || 0) < playerTier && !(playerRarity === 'unique' && card.rarity === 'mythic')) return false
        if (slotType === 'god' && role !== 'bench') {
          const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
          if (cardRole !== role && cardRole !== 'fill') return false
        }
        if (allSlottedIds.has(card.id)) return false
        return true
      })
      .map(card => ({
        ...card,
        _holoMismatch: !isHoloMatch(playerHoloType, card.holoType),
        _isSynergy: slotType === 'god' && isGodSynergy(card.godName, bestGodName),
      }))

    const sortFn = (a, b) => {
      if (a._holoMismatch !== b._holoMismatch) return a._holoMismatch ? 1 : -1
      const rDiff = (RARITY_TIER[b.rarity] || 0) - (RARITY_TIER[a.rarity] || 0)
      if (rDiff !== 0) return rDiff
      return (a.godName || '').localeCompare(b.godName || '')
    }

    if (slotType !== 'god' || !bestGodName) {
      return { synergyCards: [], otherCards: eligible.sort(sortFn) }
    }
    return {
      synergyCards: eligible.filter(c => c._isSynergy).sort(sortFn),
      otherCards: eligible.filter(c => !c._isSynergy).sort(sortFn),
    }
  }, [collection, allSlottedIds, role, slotType, playerTier, playerRarity, playerHoloType, bestGodName])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'cd-fade-in 0.2s ease-out' }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[100dvh] sm:max-h-[80vh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl rounded-none overflow-hidden sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cd-border)]">
          <div className="flex items-center gap-2">
            {roleIcon && <img src={roleIcon} alt="" className="w-[18px] h-[18px] object-contain" />}
            <h3 className="text-base font-bold cd-head text-[var(--cd-text)] tracking-wider">
              Attach {slotType === 'god' ? 'God' : 'Item'}{slotType === 'god' && roleInfo?.label ? ` \u2014 ${roleInfo.label}` : ''}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {synergyCards.length === 0 && otherCards.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              {roleIcon && <img src={roleIcon} alt="" className="w-10 h-10 mx-auto mb-3 opacity-20 object-contain" />}
              <p className="text-sm cd-head tracking-wider">No eligible {slotType} cards</p>
              <p className="text-xs text-white/20 mt-1">
                {slotType === 'god'
                  ? `Need a holo god card with ${roleInfo?.label} role, ${playerRarity}+ rarity`
                  : `Need a holo item card, ${playerRarity}+ rarity`
                }
              </p>
            </div>
          ) : (
            <>
              {synergyCards.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-bold cd-head text-emerald-400 tracking-wider">SYNERGY MATCHES</span>
                    <span className="text-[10px] text-emerald-400/50 cd-head">+40% bonus</span>
                    <div className="flex-1 h-px bg-emerald-400/10" />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-5">
                    {synergyCards.map(card => (
                      <PickerCard
                        key={card.id}
                        card={card}
                        onSelect={() => onSelect(card.id, role, slotType)}
                        disabled={slotting}
                        override={getDefOverride(card)}
                        holoMismatch={card._holoMismatch}
                        isSynergy
                      />
                    ))}
                  </div>
                </>
              )}
              {otherCards.length > 0 && (
                <>
                  {synergyCards.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-bold cd-head text-white/30 tracking-wider">OTHER GODS</span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {otherCards.map(card => (
                      <PickerCard
                        key={card.id}
                        card={card}
                        onSelect={() => onSelect(card.id, role, slotType)}
                        disabled={slotting}
                        override={getDefOverride(card)}
                        holoMismatch={card._holoMismatch}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


function PickerCard({ card, onSelect, disabled, override, holoMismatch, teamSynergyPreview, isSynergy }) {
  const { getBlueprint } = useVault()
  const color = RARITIES[card.rarity]?.color || '#9ca3af'
  const income = getBaseIncomeEstimate(card)
  const type = getCardType(card)
  const isPlayer = type === 'player'
  const isAttachment = type === 'god' || type === 'item'

  // Compute attachment bonus percentages for god/item cards using new constants
  const attachBonus = useMemo(() => {
    if (!isAttachment || holoMismatch) return null
    const flatBonuses = S5_ATT_FLAT[type]
    const multBonuses = S5_ATT_MULT[type]
    if (!flatBonuses && !multBonuses) return null
    const flatVal = flatBonuses?.[card.rarity] || 0
    const multVal = multBonuses?.[card.rarity] || 0
    let flatPct = 0, multPct = 0
    if (card.holoType === 'holo') flatPct = Math.round(flatVal * 100)
    else if (card.holoType === 'reverse') multPct = Math.round(multVal * 100)
    else if (card.holoType === 'full') {
      flatPct = Math.round(flatVal * S5_FULL_ATT_RATIO * 100)
      multPct = Math.round(multVal * S5_FULL_ATT_RATIO * 100)
    }
    return { flatPct, multPct }
  }, [isAttachment, holoMismatch, type, card.rarity, card.holoType])

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="group flex flex-col items-center rounded-xl p-2 transition-all hover:bg-white/[0.04] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="relative transition-all group-hover:scale-[1.03]">
        {card.blueprintId ? (
          <VaultCard card={card} getBlueprint={getBlueprint} size={120} holo />
        ) : isPlayer ? (
          <TradingCard
            {...toPlayerCardProps(card)}
            rarity={card.rarity}
            size={120}
          />
        ) : (
          <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={120} />
        )}
        {holoMismatch && (
          <div className="absolute inset-0 rounded-lg bg-black/60 flex flex-col items-center justify-center pointer-events-none">
            <X size={28} className="text-red-500/80" strokeWidth={3} />
            <span className="text-[7px] font-bold text-red-400/90 cd-head tracking-wider mt-0.5">WRONG HOLO</span>
          </div>
        )}
      </div>

      <div className="mt-1.5 text-center" style={{ maxWidth: 120 }}>
        <div className={`text-[10px] font-bold truncate cd-head ${holoMismatch ? 'text-white/30' : 'text-white/60'}`}>{card.godName}</div>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[9px] font-bold cd-head" style={{ color: holoMismatch ? `${color}66` : color }}>{RARITIES[card.rarity]?.name}</span>
          <HoloTypeIcon holoType={card.holoType} size={10} />
        </div>
        {isAttachment && attachBonus && (attachBonus.flatPct > 0 || attachBonus.multPct > 0) ? (
          <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[9px] font-bold cd-num">
            {attachBonus.flatPct > 0 && (
              <span className="text-amber-400">+{attachBonus.flatPct}% flat</span>
            )}
            {attachBonus.multPct > 0 && (
              <span className="text-[var(--cd-cyan)]">+{attachBonus.multPct}% mult</span>
            )}
          </div>
        ) : !isAttachment ? (
          <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[9px] cd-num text-white/35">
            {(income.type === 'flat' || income.type === 'full') && income.flatCores > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400">
                {income.flatCores < 1 ? income.flatCores.toFixed(2) : income.flatCores.toFixed(1)}/d
              </span>
            )}
            {(income.type === 'mult' || income.type === 'full') && income.multiplier > 1 && (
              <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                {income.multiplier.toFixed(2)}x
              </span>
            )}
          </div>
        ) : null}
        {teamSynergyPreview && !holoMismatch && (
          <div className="text-[9px] font-bold cd-head text-sky-400 mt-0.5">
            {teamSynergyPreview.label}
          </div>
        )}
        {isSynergy && !holoMismatch && (
          <div className="text-[8px] font-bold cd-head text-emerald-400 tracking-wider mt-0.5">SYNERGY</div>
        )}
      </div>
    </button>
  )
}
