import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import VaultCard from './VaultCard'

const ANTICIPATION_MS = { common: 0, uncommon: 300, rare: 600, epic: 1000, legendary: 1400, mythic: 1800, unique: 2000 }
const RARITY_COLORS = { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#ff8c00', mythic: '#ef4444', unique: '#e8e8ff' }

export default function MiniPackFlip({ card, onClose }) {
  const [flipped, setFlipped] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  const handleFlip = useCallback(() => {
    if (flipped || !ready) return
    const delay = ANTICIPATION_MS[card.rarity] || 0
    setTimeout(() => setFlipped(true), delay)
  }, [flipped, ready, card.rarity])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-8 -right-8 text-white/40 hover:text-white/70 cursor-pointer z-10">
          <X size={20} />
        </button>

        <div
          onClick={handleFlip}
          className="cursor-pointer"
        >
          {!flipped ? (
            <div className="w-48 h-64 rounded-xl bg-gradient-to-b from-cyan-400/30 to-cyan-400/5 border border-cyan-400/30 flex items-center justify-center animate-pulse">
              <span className="text-cyan-300 text-xs font-medium">Tap to reveal</span>
            </div>
          ) : (
            <div className="w-48">
              <VaultCard card={card} size="md" />
              <div className="text-center mt-3">
                <span className="text-xs font-bold" style={{ color: RARITY_COLORS[card.rarity] }}>
                  {card.rarity?.charAt(0).toUpperCase() + card.rarity?.slice(1)}
                </span>
                <div className="text-xs text-white/50 mt-1">{card.god_name}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
