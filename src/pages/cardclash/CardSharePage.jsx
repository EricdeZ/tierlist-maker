import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { cardclashService } from '../../services/database'
import PageTitle from '../../components/PageTitle'

export default function CardSharePage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    cardclashService.getSharedCard(token)
      .then(setData)
      .catch(() => setError('This share link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-gray-500 text-sm">Loading card...</div>
      </div>
    )
  }

  if (error || !data?.card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center space-y-3">
          <div className="text-red-400 text-lg font-bold">Card Not Found</div>
          <p className="text-gray-500 text-sm">{error || 'This card does not exist.'}</p>
        </div>
      </div>
    )
  }

  const { card, holoEffect, rarity } = data

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] px-4 py-12">
      <PageTitle title={`${card.playerName} - Card Clash`} />

      <div className="transform scale-[1.4] sm:scale-[1.8] origin-center mb-40 sm:mb-52">
        <TradingCardHolo rarity={holoEffect} role={card.role} holoType="reverse">
          <TradingCard {...card} variant="player" rarity={rarity} />
        </TradingCardHolo>
      </div>

      <div className="text-center space-y-2">
        <div className="text-gray-700 text-[10px] tracking-wider uppercase">
          SMITE 2 Card Clash
        </div>
      </div>
    </div>
  )
}
