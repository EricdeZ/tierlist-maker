import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import lazyRetry from '../../utils/lazyRetry'
import { useSearchParams } from 'react-router-dom'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'
import { vaultService } from '../../services/database'
import { getHoloEffect } from '../../data/vault/economy'
import GameCard from './components/GameCard'
import VaultCard from './components/VaultCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { STAFF_PASSIVES, PASSIVE_COLORS, PassiveIcon } from '../../data/vault/passives'
import { PenLine, Check, Clock, Loader2, User, RefreshCw } from 'lucide-react'

const DirectSignModal = lazyRetry(() => import('./components/DirectSignModal'))

const HOLO_TYPES = [
  { key: 'holo', label: 'Holo', desc: 'Flat Cores' },
  { key: 'reverse', label: 'Reverse', desc: 'Multiplier' },
  { key: 'full', label: 'Full', desc: 'Hybrid' },
]

function toGameCardData(card, override) {
  const cd = card.cardData || {}
  const base = {
    name: card.godName, class: card.godClass, imageUrl: override?.custom_image_url || card.imageUrl,
    id: card.godId, serialNumber: card.serialNumber, metadata: override || undefined,
    signatureUrl: card.signatureUrl || undefined,
    passiveName: card.passiveName || undefined,
  }
  const type = card.cardType || 'god'
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
    bestGod: card.bestGodName ? { name: card.bestGodName } : null,
    stats: cd.stats || null,
    isFirstEdition: card.isFirstEdition || false,
    isConnected: card.isConnected,
    defId: card.defId,
    rarity: card.rarity,
    signatureUrl: card.signatureUrl || undefined,
  }
}

function CooldownLabel({ cooldownEnd }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() >= cooldownEnd) clearInterval(id)
      setTick(t => t + 1)
    }, 60_000)
    return () => clearInterval(id)
  }, [cooldownEnd])

  const remaining = Math.max(0, cooldownEnd - Date.now())
  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.ceil((remaining % 3_600_000) / 60_000)
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return (
    <div className="flex items-center gap-1.5 text-white/30 text-[10px] cd-head">
      <Clock size={10} />
      Swap available in {label}
    </div>
  )
}

function UniqueCardEntry({ card, getDefOverride, getBlueprint, onHoloTypeChanged, onPassiveChanged, linkedPlayer }) {
  const [changingHolo, setChangingHolo] = useState(false)
  const [changingPassive, setChangingPassive] = useState(false)
  const [passivePickerOpen, setPassivePickerOpen] = useState(false)
  const [requestingSig, setRequestingSig] = useState(false)
  const [sigStatus, setSigStatus] = useState(null) // 'requested' after success
  const [directSignMode, setDirectSignMode] = useState(false)
  const [error, setError] = useState(null)
  const [localHoloType, setLocalHoloType] = useState(card.holoType)
  const [localPassive, setLocalPassive] = useState(card.passiveName)
  const [localChangedAt, setLocalChangedAt] = useState(card.passiveChangedAt)

  const override = getDefOverride(card)
  const holoEffect = card.rarity === 'unique' ? 'unique' : (card.holoEffect || getHoloEffect(card.rarity))
  const type = card.cardType || 'god'

  const cardPlayerId = card.defPlayerId || card.cardData?._testPlayerId
  const isUnsigned = !card.signatureUrl && sigStatus !== 'requested'
  const isDepictedUser = card.depictedUserId && user && card.depictedUserId === user.id
  const isLinkedPlayer = cardPlayerId && linkedPlayer && linkedPlayer.id === cardPlayerId
  const canDirectSign = isUnsigned && (isDepictedUser || isLinkedPlayer)
  const canRequestSignature = type === 'player' && card.defId && isUnsigned && !canDirectSign

  const COOLDOWN_MS = 48 * 60 * 60 * 1000
  const cooldownEnd = localChangedAt ? new Date(localChangedAt).getTime() + COOLDOWN_MS : 0
  const isOnCooldown = cooldownEnd > Date.now()

  const handleHoloChange = async (newType) => {
    if (newType === localHoloType || changingHolo) return
    setChangingHolo(true)
    setError(null)
    try {
      await vaultService.changeHoloType(card.id, newType)
      setLocalHoloType(newType)
      onHoloTypeChanged(card.id, newType)
    } catch (err) {
      setError(err.message || 'Failed to change holo type')
    } finally {
      setChangingHolo(false)
    }
  }

  const isStaff = (card.cardType || 'god') === 'staff'

  const handlePassiveChange = async (passiveKey) => {
    if (passiveKey === localPassive || changingPassive) return
    setChangingPassive(true)
    setError(null)
    try {
      const res = await vaultService.changePassive(card.id, passiveKey)
      setLocalPassive(passiveKey)
      setLocalChangedAt(res.passiveChangedAt)
      onPassiveChanged(card.id, passiveKey, res.passiveChangedAt)
      setPassivePickerOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to change passive')
    } finally {
      setChangingPassive(false)
    }
  }

  const handleRequestSignature = async () => {
    if (requestingSig) return
    setRequestingSig(true)
    setError(null)
    try {
      await vaultService.requestSignature(card.id)
      setSigStatus('requested')
    } catch (err) {
      setError(err.message || 'Failed to request signature')
    } finally {
      setRequestingSig(false)
    }
  }

  const renderCard = () => {
    if (card.blueprintId) {
      return <VaultCard card={{ ...card, holoType: localHoloType }} getBlueprint={getBlueprint} holo size={280} />
    }
    if (type === 'player') {
      return (
        <TradingCard
          {...toPlayerCardProps(card)}
          size={280}
          holo={{ rarity: holoEffect, holoType: localHoloType }}
        />
      )
    }
    return (
      <TradingCardHolo rarity={holoEffect} role={card.role || 'mid'} holoType={localHoloType} size={280}>
        <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={280} />
      </TradingCardHolo>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {renderCard()}

      {isStaff ? (
        /* Passive Picker for staff cards */
        <div className="flex flex-col items-center gap-2 w-full max-w-[280px]">
          <button
            onClick={() => !isOnCooldown && setPassivePickerOpen(!passivePickerOpen)}
            disabled={changingPassive || isOnCooldown}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all cd-head border ${
              isOnCooldown
                ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                : 'bg-[var(--cd-magenta)]/15 text-[var(--cd-magenta)] border-[var(--cd-magenta)]/30 hover:bg-[var(--cd-magenta)]/25 cursor-pointer'
            }`}
          >
            {changingPassive ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {localPassive ? STAFF_PASSIVES[localPassive]?.name || localPassive : 'Set Passive'}
          </button>
          {isOnCooldown && <CooldownLabel cooldownEnd={cooldownEnd} />}
          {passivePickerOpen && !isOnCooldown && (
            <div className="w-full rounded-lg border border-white/10 bg-[#0a0a12] overflow-hidden">
              {Object.entries(STAFF_PASSIVES).map(([key, info]) => {
                const color = PASSIVE_COLORS[key]
                const isActive = key === localPassive
                return (
                  <button
                    key={key}
                    onClick={() => handlePassiveChange(key)}
                    disabled={changingPassive || isActive}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'text-white/90'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                    }`}
                    style={isActive ? { backgroundColor: `${color?.primary}22` } : undefined}
                  >
                    <span className="shrink-0" style={{ color: color?.primary }}>
                      <PassiveIcon passive={key} size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold cd-head uppercase tracking-wider" style={isActive ? { color: color?.primary } : undefined}>{info.name}</div>
                      <div className="text-[10px] text-white/30 leading-tight mt-0.5">{info.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Holo Type Switcher for non-staff cards */
        <div className="flex items-center gap-1">
          {HOLO_TYPES.map(ht => (
            <button
              key={ht.key}
              onClick={() => handleHoloChange(ht.key)}
              disabled={changingHolo}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer cd-head ${
                localHoloType === ht.key
                  ? 'bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/40'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20'
              }`}
              title={ht.desc}
            >
              {ht.label}
            </button>
          ))}
        </div>
      )}

      {/* Signature Section */}
      {card.signatureUrl ? (
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold cd-head">
          <Check size={14} />
          Signed
        </div>
      ) : canDirectSign ? (
        <>
          <button
            onClick={() => setDirectSignMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30 hover:bg-[var(--cd-cyan)]/25 transition-all cursor-pointer cd-head"
          >
            <PenLine size={14} />
            Sign Your Card
          </button>
          {directSignMode && (
            <Suspense fallback={null}>
              <DirectSignModal
                cardId={card.id}
                playerCard={type === 'player' ? toPlayerCardProps(card) : null}
                gameCard={type !== 'player' ? { type, data: toGameCardData(card, override) } : null}
                onClose={() => setDirectSignMode(false)}
              />
            </Suspense>
          )}
        </>
      ) : sigStatus === 'requested' ? (
        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold cd-head">
          <Clock size={14} />
          Signature Requested
        </div>
      ) : canRequestSignature ? (
        <button
          onClick={handleRequestSignature}
          disabled={requestingSig}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-[var(--cd-magenta)]/15 text-[var(--cd-magenta)] border border-[var(--cd-magenta)]/30 hover:bg-[var(--cd-magenta)]/25 transition-all cursor-pointer cd-head"
        >
          {requestingSig ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
          Request Signature
        </button>
      ) : null}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

function GalleryCardEntry({ card }) {
  const holoEffect = card.rarity === 'unique' ? 'unique' : (card.holoEffect || getHoloEffect(card.rarity))
  const type = card.cardType || 'god'

  const renderCard = () => {
    if (card.blueprintId) {
      return <VaultCard card={card} getBlueprint={() => null} holo size={280} />
    }
    if (type === 'player') {
      return (
        <TradingCard
          {...toPlayerCardProps(card)}
          size={280}
          holo={{ rarity: holoEffect, holoType: card.holoType }}
        />
      )
    }
    return (
      <TradingCardHolo rarity={holoEffect} role={card.role || 'mid'} holoType={card.holoType} size={280}>
        <GameCard type={type} rarity={card.rarity} data={toGameCardData(card)} size={280} />
      </TradingCardHolo>
    )
  }

  const signedDate = card.signedAt
    ? new Date(card.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col items-center gap-3">
      {renderCard()}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold cd-head">
          <Check size={14} />
          Signed
        </div>
        {card.ownerName && (
          <div className="flex items-center gap-1.5 text-white/50 text-xs">
            <User size={12} />
            {card.ownerName}
          </div>
        )}
        {signedDate && (
          <div className="text-white/30 text-[10px]">
            {signedDate}
          </div>
        )}
      </div>
    </div>
  )
}

const VIEWS = [
  { key: 'mine', label: 'My Cards' },
  { key: 'gallery', label: 'Signed Gallery' },
]

export default function CCUniqueCards() {
  const { collection, loaded, getDefOverride, getBlueprint, updateCardHoloType, updateCardPassive } = useVault()
  const { linkedPlayer } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('subtab') || 'mine'
  const setView = useCallback((key) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === 'mine') next.delete('subtab'); else next.set('subtab', key)
      return next
    })
  }, [setSearchParams])
  const [galleryCards, setGalleryCards] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryLoaded, setGalleryLoaded] = useState(false)

  const uniqueCards = useMemo(
    () => collection.filter(c => c.rarity === 'unique'),
    [collection]
  )

  useEffect(() => {
    if (view !== 'gallery' || galleryLoaded) return
    setGalleryLoading(true)
    vaultService.getSignedUniqueGallery()
      .then(data => setGalleryCards(data.cards || []))
      .catch(() => {})
      .finally(() => { setGalleryLoading(false); setGalleryLoaded(true) })
  }, [view, galleryLoaded])

  const handleHoloTypeChanged = (cardId, newType) => {
    updateCardHoloType(cardId, newType)
  }

  const handlePassiveChanged = (cardId, newPassive, passiveChangedAt) => {
    updateCardPassive(cardId, newPassive, passiveChangedAt)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    )
  }

  return (
    <div>
      {/* View Toggle */}
      <div className="flex items-center gap-1 mb-6">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer cd-head ${
              view === v.key
                ? 'bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/40'
                : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'mine' ? (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-white cd-head">
              Unique Cards
            </h2>
            <p className="text-white/30 text-xs mt-1">
              {uniqueCards.length} unique card{uniqueCards.length !== 1 ? 's' : ''} in your collection
            </p>
          </div>

          {uniqueCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-white/40 text-sm">You don't own any unique cards yet.</p>
              <p className="text-white/20 text-xs mt-1">Unique cards are the rarest in the Vault — only one copy exists per card.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
              {uniqueCards.map(card => (
                <UniqueCardEntry
                  key={card.id}
                  card={card}
                  getDefOverride={getDefOverride}
                  getBlueprint={getBlueprint}
                  onHoloTypeChanged={handleHoloTypeChanged}
                  onPassiveChanged={handlePassiveChanged}
                  linkedPlayer={linkedPlayer}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-white cd-head">
              Signed Gallery
            </h2>
            <p className="text-white/30 text-xs mt-1">
              All signed unique cards across the Vault
            </p>
          </div>

          {galleryLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          ) : galleryCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-white/40 text-sm">No signed unique cards yet.</p>
              <p className="text-white/20 text-xs mt-1">When unique cards get signed by their depicted player, they'll appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
              {galleryCards.map(card => (
                <GalleryCardEntry key={card.id} card={card} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
