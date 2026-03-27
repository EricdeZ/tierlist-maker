import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import lazyRetry from '../../../utils/lazyRetry'
import { createPortal } from 'react-dom'
import GameCard from './GameCard'
import VaultCard from './VaultCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { marketplaceService, vaultService } from '../../../services/database'
import { RARITIES, getHoloEffect, MARKETPLACE } from '../../../data/vault/economy'
import { CLASS_ROLE } from '../../../data/vault/gods'
import { useVault } from '../VaultContext'
import { useAuth } from '../../../context/AuthContext'
import { X, Tag, PenLine } from 'lucide-react'

const DirectSignModal = lazyRetry(() => import('./DirectSignModal'))

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

function calculateFee(price) {
  const raw = Math.floor(price * MARKETPLACE.feePercent)
  return Math.max(raw, MARKETPLACE.minFee)
}

export default function CardZoomModal({ onClose, gameCard, playerCard, collectionCard, canSell, holoType: holoTypeProp }) {
  const { collection, refreshCollection, getBlueprint } = useVault()
  const { linkedPlayer } = useAuth()
  const [closing, setClosing] = useState(false)
  const [requestingSignature, setRequestingSignature] = useState(false)
  const [signatureRequested, setSignatureRequested] = useState(false)
  const [signError, setSignError] = useState(null)
  const [directSignMode, setDirectSignMode] = useState(false)

  // Rarity switcher
  const ownedRarities = gameCard?.ownedRarities || playerCard?.ownedRarities || collectionCard?.ownedRarities || []
  const sortedOwned = useMemo(
    () => RARITY_ORDER.filter(r => ownedRarities.includes(r)),
    [ownedRarities]
  )
  const rarityCounts = useMemo(() => {
    const counts = {}
    for (const r of ownedRarities) counts[r] = (counts[r] || 0) + 1
    return counts
  }, [ownedRarities])
  const [displayRarity, setDisplayRarity] = useState(gameCard?.rarity || playerCard?.rarity || collectionCard?.rarity || 'common')

  // Sell form state
  const [sellMode, setSellMode] = useState(false)
  const [sellRarity, setSellRarity] = useState(null)
  const [sellPrice, setSellPrice] = useState('')
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState(null)
  const [sellSuccess, setSellSuccess] = useState(false)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleClose])

  // Find owned instances of this card (used for sell + holoType lookup)
  const ownedInstances = useMemo(() => {
    if (!collection) return []
    let matches
    if (gameCard) {
      matches = collection.filter(c => c.cardType === gameCard.type && c.godId === gameCard.identifier)
    } else if (playerCard) {
      matches = collection.filter(c => String(c.defId) === String(playerCard.defId))
    } else {
      return []
    }
    // Group by rarity, pick best holoType per rarity (full > reverse > holo)
    const byRarity = new Map()
    const HOLO_PRIORITY = { full: 0, reverse: 1, holo: 2 }
    for (const card of matches) {
      const existing = byRarity.get(card.rarity)
      if (!existing || (HOLO_PRIORITY[card.holoType] ?? 3) < (HOLO_PRIORITY[existing.holoType] ?? 3)) {
        byRarity.set(card.rarity, card)
      }
    }
    return RARITY_ORDER
      .filter(r => byRarity.has(r))
      .map(r => byRarity.get(r))
  }, [collection, gameCard, playerCard])

  const sellableInstances = canSell ? ownedInstances : []

  // Default sell rarity to the displayed rarity
  useEffect(() => {
    if (sellMode && sellableInstances.length > 0 && !sellRarity) {
      const match = sellableInstances.find(i => i.rarity === displayRarity)
      setSellRarity(match ? displayRarity : sellableInstances[0].rarity)
    }
  }, [sellMode, sellableInstances, sellRarity, displayRarity])

  const selectedInstance = sellableInstances.find(i => i.rarity === sellRarity)
  const priceNum = parseInt(sellPrice, 10)
  const fee = priceNum > 0 ? calculateFee(priceNum) : 0

  const handleSell = async () => {
    if (!selectedInstance || !priceNum || priceNum < 1) return
    setSellLoading(true)
    setSellError(null)
    try {
      await marketplaceService.create({ cardId: selectedInstance.id, price: priceNum })
      setSellSuccess(true)
    } catch (err) {
      setSellError(err.message || 'Failed to create listing')
    } finally {
      setSellLoading(false)
    }
  }

  const rarity = displayRarity
  const rarityInfo = RARITIES[rarity]
  const holoEffect = getHoloEffect(rarity)
  const tradeLocked = gameCard?.tradeLocked || playerCard?.tradeLocked || collectionCard?.tradeLocked || false

  // Use explicit prop (Starting Five), or look up from owned instances (collection), or fall back
  const matchedInstance = ownedInstances.find(i => i.rarity === rarity)
  const holoType = holoTypeProp || matchedInstance?.holoType || 'reverse'

  // Merge signature URL from the owned instance into the card display data
  const gameCardData = useMemo(() => {
    if (!gameCard?.data) return null
    const sigUrl = matchedInstance?.signatureUrl
    return sigUrl ? { ...gameCard.data, signatureUrl: sigUrl } : gameCard.data
  }, [gameCard?.data, matchedInstance?.signatureUrl])

  // Owner of unique player card, not already signed
  const cardPlayerId = matchedInstance?.defPlayerId || matchedInstance?.cardData?._testPlayerId
  const isUniqueOwner = canSell && rarity === 'unique' && matchedInstance
    && !matchedInstance.signatureUrl && cardPlayerId

  // Can direct-sign: owner IS the depicted player
  const canDirectSign = isUniqueOwner && linkedPlayer && linkedPlayer.id === cardPlayerId

  // Can request signature from someone else
  const canRequestSignature = isUniqueOwner && !canDirectSign

  const handleRequestSignature = async () => {
    if (!matchedInstance) return
    setRequestingSignature(true)
    setSignError(null)
    try {
      await vaultService.requestSignature(matchedInstance.id)
      setSignatureRequested(true)
    } catch (err) {
      setSignError(err.message || 'Failed to request signature')
    } finally {
      setRequestingSignature(false)
    }
  }

  // Determine role for holo effect
  const role = playerCard
    ? (playerCard.role || 'ADC')
    : (gameCard ? (gameCard.data?.role || CLASS_ROLE[gameCard.data?.class] || 'mid') : 'mid')

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

        {collectionCard && (
          <VaultCard card={{ ...collectionCard, rarity }} getBlueprint={getBlueprint} size={280} holo />
        )}

        {gameCard && !collectionCard && (
          <TradingCardHolo rarity={holoEffect} role={role} holoType={holoType} size={280}>
            <GameCard
              type={gameCard.type}
              rarity={rarity}
              data={gameCardData}
            />
          </TradingCardHolo>
        )}

        {playerCard && (
          <TradingCard
            playerName={playerCard.playerName}
            teamName={playerCard.teamName}
            teamColor={playerCard.teamColor}
            role={playerCard.role}
            avatarUrl={playerCard.avatarUrl}
            rarity={rarity}
            leagueName={playerCard.leagueName}
            divisionName={playerCard.divisionName}
            seasonName={playerCard.seasonName}
            bestGod={playerCard.bestGod}
            isConnected={playerCard.isConnected}
            isFirstEdition={matchedInstance?.isFirstEdition ?? playerCard?.isFirstEdition}
            loadStats={playerCard.defId}
            size={280}
            holo={{ rarity: holoEffect, holoType }}
            signatureUrl={matchedInstance?.signatureUrl}
          />
        )}

        <div className="mt-3 text-center">
          <span
            className="text-xs font-bold uppercase tracking-widest cd-head"
            style={{ color: rarityInfo?.color || '#fff', textShadow: `0 0 12px ${rarityInfo?.color || '#fff'}44` }}
          >
            {rarityInfo?.name || 'Common'}
          </span>
        </div>

        {tradeLocked && (
          <div className="mt-1.5 flex justify-center">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-xs text-red-400 font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Trade Locked
            </div>
          </div>
        )}

        {/* Rarity switcher */}
        {ownedRarities.length > 1 && (
          <div className="mt-2 flex gap-1.5 justify-center flex-wrap">
            {sortedOwned.map(r => {
              const ri = RARITIES[r]
              const active = displayRarity === r
              const count = rarityCounts[r] || 1
              return (
                <button
                  key={r}
                  onClick={() => { setDisplayRarity(r); setSellRarity(null) }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cd-head border transition-all cursor-pointer ${
                    active
                      ? 'border-current bg-current/10'
                      : 'border-white/10 text-white/30 hover:text-white/60'
                  }`}
                  style={active ? { color: ri?.color, borderColor: `${ri?.color}44` } : undefined}
                >
                  {ri?.name || r}
                  {count > 1 && (
                    <span
                      className="cd-num text-[9px] rounded-full px-1 py-px leading-none"
                      style={active
                        ? { backgroundColor: `${ri?.color}25`, color: ri?.color }
                        : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'inherit' }
                      }
                    >
                      x{count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Sell button / form */}
        {canSell && sellableInstances.length > 0 && !sellMode && !sellSuccess && (
          <button
            onClick={() => setSellMode(true)}
            disabled={tradeLocked}
            title={tradeLocked ? 'This card is trade-locked' : ''}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--cd-cyan)]/[0.08] border border-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-xs font-bold uppercase tracking-wider cd-head hover:bg-[var(--cd-cyan)]/[0.15] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Tag className="w-3.5 h-3.5" />
            Sell on Market
          </button>
        )}

        {sellMode && !sellSuccess && (
          <div className="mt-3 w-full space-y-3">
            {/* Price input */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10000"
                value={sellPrice}
                onChange={e => { setSellPrice(Math.min(10000, e.target.value)); setSellError(null) }}
                placeholder="Price in Core"
                className="flex-1 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg px-3 py-2 text-sm text-[var(--cd-text)] cd-num focus:outline-none focus:border-[var(--cd-cyan)]/40 placeholder:text-[var(--cd-text-dim)]"
              />
            </div>

            {/* Fee display */}
            {priceNum > 0 && (
              <div className="text-[11px] text-[var(--cd-text-dim)] cd-num text-center">
                Buyer pays <span className="text-[var(--cd-text)]">{priceNum + fee}</span> Core
                <span className="mx-1.5">·</span>
                You receive <span className="text-[var(--cd-cyan)]">{priceNum - fee}</span> Core
                <span className="mx-1.5">·</span>
                Fee: {fee} each side
              </div>
            )}

            {sellError && (
              <div className="text-[11px] text-red-400 text-center cd-mono">{sellError}</div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setSellMode(false); setSellError(null); setSellPrice('') }}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--cd-border)] text-[var(--cd-text-dim)] text-xs font-bold uppercase tracking-wider cd-head hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSell}
                disabled={!priceNum || priceNum < 1 || sellLoading}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--cd-cyan)]/[0.12] border border-[var(--cd-cyan)]/30 text-[var(--cd-cyan)] text-xs font-bold uppercase tracking-wider cd-head hover:bg-[var(--cd-cyan)]/[0.2] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {sellLoading ? 'Listing...' : 'List for Sale'}
              </button>
            </div>
          </div>
        )}

        {sellSuccess && (
          <div className="mt-3 w-full text-center py-3 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
            <div className="text-xs font-bold text-emerald-400 cd-head uppercase tracking-wider">Listed on Market!</div>
            <div className="text-[11px] text-[var(--cd-text-dim)] mt-1 cd-num">{priceNum} Core</div>
          </div>
        )}

        {/* Direct sign button (owner IS the depicted player) */}
        {canDirectSign && !directSignMode && !sellMode && !sellSuccess && (
          <button
            onClick={() => setDirectSignMode(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#e8e8ff]/[0.08] border border-[#e8e8ff]/20 text-[#e8e8ff] text-xs font-bold uppercase tracking-wider cd-head hover:bg-[#e8e8ff]/[0.15] transition-all cursor-pointer"
          >
            <PenLine className="w-3.5 h-3.5" />
            Sign Your Card
          </button>
        )}

        {directSignMode && (
          <Suspense fallback={null}>
            <DirectSignModal
              cardId={matchedInstance.id}
              playerCard={playerCard}
              gameCard={gameCard}
              onClose={() => setDirectSignMode(false)}
            />
          </Suspense>
        )}

        {/* Request signature button (owner is NOT the depicted player) */}
        {canRequestSignature && !signatureRequested && !sellMode && !sellSuccess && (
          <button
            onClick={handleRequestSignature}
            disabled={requestingSignature}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#e8e8ff]/[0.08] border border-[#e8e8ff]/20 text-[#e8e8ff] text-xs font-bold uppercase tracking-wider cd-head hover:bg-[#e8e8ff]/[0.15] transition-all cursor-pointer disabled:opacity-30"
          >
            <PenLine className="w-3.5 h-3.5" />
            {requestingSignature ? 'Requesting...' : 'Request Signature'}
          </button>
        )}

        {signatureRequested && (
          <div className="mt-2 w-full text-center py-3 rounded-lg bg-[#e8e8ff]/[0.06] border border-[#e8e8ff]/15">
            <div className="text-xs font-bold text-[#e8e8ff] cd-head uppercase tracking-wider">Signature Requested</div>
            <div className="text-[11px] text-[var(--cd-text-dim)] mt-1">The player will be notified</div>
          </div>
        )}

        {signError && (
          <div className="text-[11px] text-red-400 text-center cd-mono mt-1">{signError}</div>
        )}

        {matchedInstance?.signatureUrl && (
          <div className="mt-2 text-center">
            <span className="text-[10px] text-[#e8e8ff]/50 cd-head uppercase tracking-wider">
              Signed
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
