import { useState, useCallback } from 'react'
import { PassiveIcon, getPassiveInfo, PASSIVE_COLORS } from '../../../data/vault/passives'
import { vaultService } from '../../../services/database'
import { Zap, Clock, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import MiniPackFlip from '../components/MiniPackFlip'
import cardBackImg from '../../../assets/card_backsite.png'

const RARITY_LABEL = {
  uncommon: 'Minor', rare: 'Moderate', epic: 'Notable',
  legendary: 'Strong', mythic: 'Major', unique: 'Major',
}

const RARITY_GLOW = {
  common: 'rgba(156,163,175,0.3)', uncommon: 'rgba(34,197,94,0.3)', rare: 'rgba(59,130,246,0.3)',
  epic: 'rgba(168,85,247,0.3)', legendary: 'rgba(255,140,0,0.3)', mythic: 'rgba(239,68,68,0.3)',
  unique: 'rgba(232,232,255,0.3)',
}

export default function PassivePanel({ passiveState, onUpdate }) {
  if (!passiveState) return null

  const { name, staffRarity, charges, maxCharges, chargeProgressPct, nextChargeIn, enabled, holoChoice, generatedCards } = passiveState
  const info = getPassiveInfo(name)
  if (!info) return null

  const label = RARITY_LABEL[staffRarity] || ''
  const color = PASSIVE_COLORS[name] || PASSIVE_COLORS.collector_boost

  return (
    <div className="cd-panel cd-corners rounded-xl p-4 mt-4">
      <div className="text-[10px] font-bold cd-head tracking-widest text-white/30 uppercase mb-3">Active Passive</div>
      <div className="flex items-center gap-2.5 mb-3">
        <div style={{ color: color.primary }}>
          <PassiveIcon passive={name} size={20} />
        </div>
        <div>
          <div className="text-sm font-bold text-white/90">{info.name}</div>
          <div className="text-xs text-white/40 mt-0.5">{info.description} <span style={{ color: color.primary, opacity: 0.6 }}>({label.toLowerCase()})</span></div>
        </div>
      </div>

      {maxCharges > 0 && (
        <ChargePips charges={charges} maxCharges={maxCharges} progressPct={chargeProgressPct} nextChargeIn={nextChargeIn} />
      )}

      {name === 'holo_boost' && (
        <HoloSelector current={holoChoice} onSelect={onUpdate} />
      )}

      {name === 'unique_hunter' && (
        <UniqueHunterToggle enabled={enabled} onToggle={onUpdate} />
      )}

      {name === 'card_generator' && (
        <GeneratedCards cards={generatedCards} onClaim={onUpdate} />
      )}
    </div>
  )
}

function ChargePips({ charges, maxCharges, nextChargeIn }) {
  return (
    <div className="flex items-center gap-3 mt-2 px-3 py-2 rounded-lg bg-white/[0.03]">
      <div className="flex items-center gap-1.5">
        <Zap size={12} className="text-cyan-400" />
        <span className="text-sm font-bold text-white/90">{charges}</span>
        <span className="text-xs text-white/30">/ {maxCharges}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: maxCharges }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i < charges ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      {nextChargeIn && charges < maxCharges && (
        <span className="text-[10px] text-white/40 flex items-center gap-1 ml-auto">
          <Clock size={10} /> Next in {nextChargeIn}
        </span>
      )}
    </div>
  )
}

function HoloSelector({ current, onSelect }) {
  const [loading, setLoading] = useState(false)
  const types = ['holo', 'reverse', 'full']
  const labels = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }

  const handleSelect = useCallback(async (type) => {
    if (type === current || loading) return
    setLoading(true)
    try {
      await vaultService.setHoloChoice(type)
      onSelect?.()
    } finally {
      setLoading(false)
    }
  }, [current, loading, onSelect])

  return (
    <div className="flex gap-2 mt-3">
      {types.map(t => (
        <button
          key={t}
          onClick={() => handleSelect(t)}
          disabled={loading}
          className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
            t === current
              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
              : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
          }`}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  )
}

function UniqueHunterToggle({ enabled, onToggle }) {
  const [loading, setLoading] = useState(false)

  const handleToggle = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      await vaultService.toggleUniqueHunter(!enabled)
      onToggle?.()
    } finally {
      setLoading(false)
    }
  }, [enabled, loading, onToggle])

  const Icon = enabled ? ToggleRight : ToggleLeft

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="flex items-center gap-2 mt-3 cursor-pointer"
    >
      <Icon size={24} className={enabled ? 'text-cyan-400' : 'text-white/20'} />
      <span className={`text-xs ${enabled ? 'text-cyan-300' : 'text-white/40'}`}>
        {loading ? 'Updating...' : enabled ? 'Active' : 'Inactive'}
      </span>
    </button>
  )
}

function GeneratedCards({ cards, onClaim }) {
  const [claiming, setClaiming] = useState(false)
  const [claimedCards, setClaimedCards] = useState(null)

  const handleClaimAll = useCallback(async () => {
    if (claiming) return
    setClaiming(true)
    try {
      const result = await vaultService.claimAllGeneratedCards()
      if (result.cards?.length > 0) setClaimedCards(result.cards)
      else setClaiming(false)
    } catch {
      setClaiming(false)
    }
  }, [claiming])

  if (!cards?.length) {
    return (
      <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.02] text-center">
        <span className="text-[11px] text-white/20">No cards ready</span>
      </div>
    )
  }

  return (
    <>
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] text-white/30 font-bold tracking-wider uppercase">
            Ready to claim ({cards.length})
          </div>
          <button
            onClick={handleClaimAll}
            disabled={claiming}
            className="px-3 py-1 text-xs rounded-lg bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {claiming ? <Loader2 size={12} className="animate-spin" /> : `Claim ${cards.length > 1 ? 'All' : ''}`}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {cards.map(c => (
            <div
              key={c.id}
              className="relative"
              style={{ width: 42, aspectRatio: '63 / 88' }}
            >
              <img
                src={cardBackImg}
                alt=""
                draggable={false}
                className="w-full h-full object-fill rounded-sm"
                style={{ boxShadow: `0 0 8px ${RARITY_GLOW[c.rarity] || RARITY_GLOW.common}` }}
              />
            </div>
          ))}
        </div>
      </div>
      {claimedCards && (
        <MiniPackFlip cards={claimedCards} onClose={() => { setClaimedCards(null); setClaiming(false); onClaim?.() }} />
      )}
    </>
  )
}
