import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import SignatureCanvas from './SignatureCanvas'
import GameCard from './GameCard'
import VaultCard from './VaultCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { vaultService } from '../../../services/database'
import { getHoloEffect } from '../../../data/vault/economy'
import { CLASS_ROLE } from '../../../data/vault/gods'
import { useVault } from '../VaultContext'
import { X } from 'lucide-react'

function CardBg({ card, playerCard, gameCard, getBlueprint }) {
  if (card?.blueprintId) {
    return <VaultCard card={card} getBlueprint={getBlueprint} holo={false} />
  }
  if (playerCard) {
    return (
      <TradingCard
        {...playerCard}
        rarity="unique"
      />
    )
  }
  if (gameCard) {
    return (
      <GameCard
        type={gameCard.type}
        rarity="unique"
        data={gameCard.data}
      />
    )
  }
  return null
}

function CardPreview({ card, playerCard, gameCard, signatureUrl, getBlueprint }) {
  if (card?.blueprintId) {
    return (
      <VaultCard
        card={{ ...card, signatureUrl, holoType: card.holoType || 'reverse' }}
        getBlueprint={getBlueprint}
        holo
        size={240}
      />
    )
  }
  if (playerCard) {
    return (
      <TradingCard
        {...playerCard}
        rarity="unique"
        size={240}
        holo={{ rarity: getHoloEffect('unique'), holoType: 'reverse' }}
        signatureUrl={signatureUrl}
      />
    )
  }
  if (gameCard) {
    const role = gameCard.data?.role || CLASS_ROLE[gameCard.data?.class] || 'mid'
    return (
      <TradingCardHolo rarity={getHoloEffect('unique')} role={role} holoType="reverse" size={240}>
        <GameCard
          type={gameCard.type}
          rarity="unique"
          data={{ ...gameCard.data, signatureUrl }}
          size={240}
        />
      </TradingCardHolo>
    )
  }
  return null
}

export default function DirectSignModal({ cardId, card, getBlueprint, playerCard, gameCard, onClose }) {
  const { refreshCollection } = useVault()
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState(null)
  const [liveSignatureUrl, setLiveSignatureUrl] = useState(null)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleClose])

  const handleConfirm = async (blob) => {
    setError(null)
    try {
      await vaultService.directSignCard(cardId, blob)
      await refreshCollection()
      handleClose()
    } catch (err) {
      setError(err.message || 'Failed to sign card')
    }
  }

  return createPortal(
    <div
      className={`card-zoom-backdrop ${closing ? 'card-zoom-out' : 'card-zoom-in'}`}
      style={{ zIndex: 1000 }}
      onClick={handleClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-3xl sm:mx-4 sm:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 sm:-top-10 sm:right-0 text-white/40 hover:text-white/80 transition-colors cursor-pointer z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-[var(--cd-surface)] sm:border sm:border-[#e8e8ff]/15 sm:rounded-xl p-4 sm:p-5 min-h-full sm:min-h-0">
          <div className="text-xs font-bold text-[#e8e8ff] cd-head uppercase tracking-widest mb-4 text-center">
            Sign Your Card
          </div>

          {error && (
            <div className="text-[11px] text-red-400 text-center cd-mono mb-3 py-1 rounded bg-red-400/[0.06]">{error}</div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-4">
            <SignatureCanvas
              onConfirm={handleConfirm}
              onCancel={handleClose}
              onStrokeChange={setLiveSignatureUrl}
              cardBackground={<CardBg card={card} playerCard={playerCard} gameCard={gameCard} getBlueprint={getBlueprint} />}
            />

            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] text-[#e8e8ff]/40 uppercase tracking-wider cd-head">
                Live Preview
              </div>
              <CardPreview card={card} playerCard={playerCard} gameCard={gameCard} signatureUrl={liveSignatureUrl} getBlueprint={getBlueprint} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
