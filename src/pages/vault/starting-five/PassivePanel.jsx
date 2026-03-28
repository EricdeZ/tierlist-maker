import { useState, useCallback } from 'react'
import { PassiveIcon, getPassiveInfo } from '../../../data/vault/passives'
import { vaultService } from '../../../services/database'
import { Zap, Clock, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import MiniPackFlip from '../components/MiniPackFlip'

const RARITY_LABEL = {
  uncommon: 'Minor', rare: 'Moderate', epic: 'Notable',
  legendary: 'Strong', mythic: 'Major', unique: 'Major',
}

export default function PassivePanel({ passiveState, onUpdate }) {
  if (!passiveState) return null

  const { name, staffRarity, charges, maxCharges, chargeProgressPct, nextChargeIn, enabled, holoChoice, generatedCards } = passiveState
  const info = getPassiveInfo(name)
  if (!info) return null

  const label = RARITY_LABEL[staffRarity] || ''

  return (
    <div className="cd-panel cd-corners rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="text-cyan-400">
          <PassiveIcon passive={name} size={20} />
        </div>
        <div>
          <div className="text-sm font-bold text-white/90">{info.name}</div>
          <div className="text-xs text-white/40">{label} boost</div>
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

      {name === 'card_generator' && generatedCards?.length > 0 && (
        <GeneratedCards cards={generatedCards} onClaim={onUpdate} />
      )}
    </div>
  )
}

function ChargePips({ charges, maxCharges, nextChargeIn }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex gap-1">
        {Array.from({ length: maxCharges }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < charges ? 'bg-cyan-400' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      {nextChargeIn && charges < maxCharges && (
        <span className="text-[10px] text-white/30 flex items-center gap-1">
          <Clock size={10} /> {nextChargeIn}
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
  const [claiming, setClaiming] = useState(null)
  const [claimedCard, setClaimedCard] = useState(null)

  const handleClaim = useCallback(async (id) => {
    if (claiming) return
    setClaiming(id)
    try {
      const result = await vaultService.claimGeneratedCard(id)
      setClaimedCard(result.card)
      setClaiming(null)
    } catch {
      setClaiming(null)
    }
  }, [claiming])

  return (
    <>
      <div className="flex gap-2 mt-3 flex-wrap">
        {cards.map(c => (
          <button
            key={c.id}
            onClick={() => handleClaim(c.id)}
            disabled={!!claiming}
            className="w-12 h-16 rounded-lg bg-gradient-to-b from-cyan-400/20 to-cyan-400/5 border border-cyan-400/20 animate-pulse hover:animate-none hover:border-cyan-400/50 transition-colors cursor-pointer flex items-center justify-center"
          >
            {claiming === c.id ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : <Zap size={14} className="text-cyan-400" />}
          </button>
        ))}
      </div>
      {claimedCard && (
        <MiniPackFlip card={claimedCard} onClose={() => { setClaimedCard(null); onClaim?.() }} />
      )}
    </>
  )
}
