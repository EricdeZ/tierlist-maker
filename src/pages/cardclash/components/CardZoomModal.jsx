import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import GameCard from './GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { cardclashService } from '../../../services/database'
import { RARITIES, getHoloEffect } from '../../../data/cardclash/economy'
import { CLASS_ROLE } from '../../../data/cardclash/gods'
import { X } from 'lucide-react'

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, winRate: 0, kda: 0,
  avgDamage: 0, avgMitigated: 0,
  totalKills: 0, totalDeaths: 0, totalAssists: 0,
}

export default function CardZoomModal({ onClose, gameCard, playerCard }) {
  const [stats, setStats] = useState(null)
  const [bestGod, setBestGod] = useState(null)
  const [seasonName, setSeasonName] = useState(playerCard?.seasonName || null)
  const [isConnected, setIsConnected] = useState(playerCard?.isConnected)
  const [loadingStats, setLoadingStats] = useState(!!playerCard?.defId)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleClose])

  useEffect(() => {
    if (!playerCard?.defId) return
    setLoadingStats(true)
    cardclashService.getCardDetail(playerCard.defId).then(data => {
      if (data.stats) setStats(data.stats)
      if (data.bestGod) setBestGod(data.bestGod)
      if (data.seasonName) setSeasonName(data.seasonName)
      if (data.isConnected !== undefined) setIsConnected(data.isConnected)
    }).catch(err => {
      console.error('Failed to load card stats:', err)
    }).finally(() => setLoadingStats(false))
  }, [playerCard?.defId])

  const rarity = gameCard?.rarity || playerCard?.rarity || 'common'
  const rarityInfo = RARITIES[rarity]
  const holoEffect = getHoloEffect(rarity)

  // Determine role for holo effect
  const role = playerCard
    ? (playerCard.role || 'ADC')
    : (gameCard ? (CLASS_ROLE[gameCard.data?.class] || 'mid') : 'mid')

  const showSpinner = playerCard && loadingStats

  return createPortal(
    <div
      className={`card-zoom-backdrop ${closing ? 'card-zoom-out' : 'card-zoom-in'}`}
      onClick={handleClose}
    >
      <div className="card-zoom-content" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute -top-10 right-0 text-white/40 hover:text-white/80 transition-colors cursor-pointer z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {showSpinner ? (
          <div className="flex items-center justify-center" style={{ width: 340, aspectRatio: '63/88' }}>
            <div className="cd-spinner w-8 h-8" />
          </div>
        ) : (
          <>
            {gameCard && (
              <TradingCardHolo rarity={holoEffect} role={role} holoType="reverse" size={340}>
                <GameCard
                  type={gameCard.type}
                  rarity={gameCard.rarity}
                  data={gameCard.data}
                />
              </TradingCardHolo>
            )}

            {playerCard && (
              <TradingCardHolo rarity={holoEffect} role={role} holoType="reverse">
                <TradingCard
                  playerName={playerCard.playerName}
                  teamName={playerCard.teamName}
                  teamColor={playerCard.teamColor}
                  role={playerCard.role}
                  avatarUrl={playerCard.avatarUrl}
                  variant="player"
                  rarity={rarity}
                  leagueName={playerCard.leagueName}
                  divisionName={playerCard.divisionName}
                  seasonName={seasonName}
                  stats={stats || EMPTY_STATS}
                  bestGod={bestGod}
                  isConnected={isConnected}
                />
              </TradingCardHolo>
            )}
          </>
        )}

        <div className="mt-3 text-center">
          <span
            className="text-xs font-bold uppercase tracking-widest cd-head"
            style={{ color: rarityInfo?.color || '#fff', textShadow: `0 0 12px ${rarityInfo?.color || '#fff'}44` }}
          >
            {rarityInfo?.name || 'Common'}
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
