import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import TradingCard from '../../components/TradingCard'
import { vaultService } from '../../services/database'
import PageTitle from '../../components/PageTitle'

const CARD_W = 340
const CARD_H = CARD_W * (88 / 63)
const MAX_SCALE = 1.8

export default function CardSharePage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const wrapperRef = useRef(null)

  const updateScale = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const available = el.clientWidth
    const scale = Math.min(MAX_SCALE, available / CARD_W)
    el.style.setProperty('--share-scale', scale)
    el.style.height = `${CARD_H * scale}px`
  }, [])

  useEffect(() => {
    if (!token) return
    vaultService.getSharedCard(token)
      .then(setData)
      .catch(() => setError('This share link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateScale, data])

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

  const { card, holoEffect, rarity, holoType } = data

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] px-4 py-12">
      <PageTitle title={`${card.playerName} - The Vault`} />

      <div ref={wrapperRef} className="card-share-wrapper">
        <TradingCard {...card} rarity={rarity} holo={{ rarity: holoEffect, holoType: holoType || 'reverse' }} />
      </div>

      <div className="text-center space-y-2 mt-6">
        <div className="text-gray-700 text-[10px] tracking-wider uppercase">
          SMITE 2 The Vault
        </div>
      </div>
    </div>
  )
}
