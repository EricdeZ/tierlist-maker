import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import GameCard from './GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { cardclashService, marketplaceService } from '../../../services/database'
import { RARITIES, getHoloEffect, MARKETPLACE } from '../../../data/vault/economy'
import { CLASS_ROLE } from '../../../data/vault/gods'
import { useVault } from '../VaultContext'
import { X, Tag } from 'lucide-react'

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, winRate: 0, kda: 0,
  avgDamage: 0, avgMitigated: 0,
  totalKills: 0, totalDeaths: 0, totalAssists: 0,
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

function calculateFee(price) {
  const raw = Math.floor(price * MARKETPLACE.feePercent)
  return Math.max(raw, MARKETPLACE.minFee)
}

export default function CardZoomModal({ onClose, gameCard, playerCard, canSell, holoType: holoTypeProp }) {
  const { collection } = useVault()
  const [stats, setStats] = useState(null)
  const [bestGod, setBestGod] = useState(null)
  const [bestGodName, setBestGodName] = useState(playerCard?.bestGodName || null)
  const [seasonName, setSeasonName] = useState(playerCard?.seasonName || null)
  const [isConnected, setIsConnected] = useState(playerCard?.isConnected)
  const [loadingStats, setLoadingStats] = useState(!!playerCard?.defId)
  const [closing, setClosing] = useState(false)

  // Rarity switcher
  const ownedRarities = gameCard?.ownedRarities || playerCard?.ownedRarities || []
  const sortedOwned = useMemo(
    () => RARITY_ORDER.filter(r => ownedRarities.includes(r)),
    [ownedRarities]
  )
  const [displayRarity, setDisplayRarity] = useState(gameCard?.rarity || playerCard?.rarity || 'common')

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

  useEffect(() => {
    if (!playerCard?.defId) return
    setLoadingStats(true)
    cardclashService.getCardDetail(playerCard.defId).then(data => {
      if (data.stats) setStats(data.stats)
      if (data.bestGod) setBestGod(data.bestGod)
      if (data.bestGodName) setBestGodName(data.bestGodName)
      if (data.seasonName) setSeasonName(data.seasonName)
      if (data.isConnected !== undefined) setIsConnected(data.isConnected)
    }).catch(err => {
      console.error('Failed to load card stats:', err)
    }).finally(() => setLoadingStats(false))
  }, [playerCard?.defId])

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

  // Use explicit prop (Starting Five), or look up from owned instances (collection), or fall back
  const matchedInstance = ownedInstances.find(i => i.rarity === rarity)
  const holoType = holoTypeProp || matchedInstance?.holoType || 'reverse'

  // Determine role for holo effect
  const role = playerCard
    ? (playerCard.role || 'ADC')
    : (gameCard ? (CLASS_ROLE[gameCard.data?.class] || 'mid') : 'mid')

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

        {gameCard && (
          <TradingCardHolo rarity={holoEffect} role={role} holoType={holoType} size="min(340px, 85vw)">
            <GameCard
              type={gameCard.type}
              rarity={rarity}
              data={gameCard.data}
            />
          </TradingCardHolo>
        )}

        {playerCard && (
          <div className="relative">
            <div style={{ opacity: loadingStats ? 0 : 1, transition: 'opacity 0.2s ease' }}>
              <TradingCardHolo rarity={holoEffect} role={role} holoType={holoType}>
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
                  bestGod={bestGod || (bestGodName ? { name: bestGodName } : null)}
                  isConnected={isConnected}
                  isFirstEdition={playerCard.isFirstEdition}
                />
              </TradingCardHolo>
            </div>
            {loadingStats && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="cd-spinner w-8 h-8" />
              </div>
            )}
          </div>
        )}

        <div className="mt-3 text-center">
          <span
            className="text-xs font-bold uppercase tracking-widest cd-head"
            style={{ color: rarityInfo?.color || '#fff', textShadow: `0 0 12px ${rarityInfo?.color || '#fff'}44` }}
          >
            {rarityInfo?.name || 'Common'}
          </span>
        </div>

        {/* Rarity switcher */}
        {sortedOwned.length > 1 && (
          <div className="mt-2 flex gap-1.5 justify-center">
            {sortedOwned.map(r => {
              const ri = RARITIES[r]
              const active = displayRarity === r
              return (
                <button
                  key={r}
                  onClick={() => { setDisplayRarity(r); setSellRarity(null) }}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cd-head border transition-all cursor-pointer ${
                    active
                      ? 'border-current bg-current/10'
                      : 'border-white/10 text-white/30 hover:text-white/60'
                  }`}
                  style={active ? { color: ri?.color, borderColor: `${ri?.color}44` } : undefined}
                >
                  {ri?.name || r}
                </button>
              )
            })}
          </div>
        )}

        {/* Sell button / form */}
        {canSell && sellableInstances.length > 0 && !sellMode && !sellSuccess && (
          <button
            onClick={() => setSellMode(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--cd-cyan)]/[0.08] border border-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-xs font-bold uppercase tracking-wider cd-head hover:bg-[var(--cd-cyan)]/[0.15] transition-all cursor-pointer"
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
      </div>
    </div>,
    document.body
  )
}
