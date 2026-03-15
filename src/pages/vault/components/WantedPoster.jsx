import { useMemo } from 'react'
import { RARITIES } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'

const GOD_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75'

function getGodCardUrl(imageKey) {
  return `${GOD_CDN}/Gods/${imageKey}/Default/t_GodCard_${imageKey}.png`
}

function getDaysRemaining(expiresAt) {
  if (!expiresAt) return null
  const now = Date.now()
  const exp = new Date(expiresAt).getTime()
  const diff = exp - now
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatHoloType(holoType) {
  if (!holoType || holoType === 'none') return null
  if (holoType === 'any_holo') return 'Any Holo'
  return holoType.charAt(0).toUpperCase() + holoType.slice(1)
}

function formatCardType(cardType) {
  if (!cardType) return 'Card'
  const map = { god: 'God Card', item: 'Item Card', player: 'Player Card', consumable: 'Consumable' }
  return map[cardType] || cardType.charAt(0).toUpperCase() + cardType.slice(1)
}

const STATUS_STAMPS = {
  completed: { label: 'CLAIMED', color: '#22c55e', angle: -8 },
  expired: { label: 'EXPIRED', color: '#ef4444', angle: 6 },
  cancelled: { label: 'CANCELLED', color: '#f97316', angle: -5 },
}

export default function WantedPoster({ bounty, size = 'sm', canFulfill, onFulfill, isMine, onCancel }) {
  const isLg = size === 'lg'
  const w = isLg ? 200 : 160
  const isDone = bounty.status && bounty.status !== 'active'
  const stamp = STATUS_STAMPS[bounty.status]

  const rotation = useMemo(() => {
    // Deterministic rotation from bounty id
    const seed = ((bounty.id * 2654435761) >>> 0) % 1000
    return ((seed / 1000) * 4 - 2).toFixed(2)
  }, [bounty.id])

  const rarity = RARITIES[bounty.rarity] || RARITIES.common
  const holoLabel = formatHoloType(bounty.holo_type)
  const typeLabel = formatCardType(bounty.card_type)
  const subtitleParts = [holoLabel, typeLabel].filter(Boolean).join(' \u00b7 ')
  const daysLeft = getDaysRemaining(bounty.expires_at)

  // Resolve mugshot image
  const mugshot = useMemo(() => {
    if (bounty.card_type === 'god') {
      const god = bounty.target_god_id
        ? GODS.find(g => g.slug === bounty.target_god_id)
        : GODS.find(g => g.name === bounty.card_name)
      if (god) return { url: getGodCardUrl(god.imageKey), isPlayer: false }
    }
    if (bounty.card_type === 'player' && bounty.avatar_url) {
      return { url: bounty.avatar_url, isPlayer: true }
    }
    return null
  }, [bounty.card_type, bounty.card_name, bounty.target_god_id, bounty.avatar_url])

  const pinSize = isLg ? 10 : 8
  const mugshotH = isLg ? 120 : 96

  return (
    <div
      className="relative flex flex-col items-center shrink-0"
      style={{
        width: w,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Outer container */}
      <div
        className="relative flex flex-col items-center w-full"
        style={{
          background: 'rgba(20, 15, 8, 0.92)',
          border: `1px solid ${isDone ? 'rgba(255,255,255,0.08)' : 'rgba(255, 140, 0, 0.27)'}`,
          boxShadow: isDone ? 'none' : '0 0 24px rgba(255,140,0,0.1), inset 0 0 40px rgba(255,140,0,0.04)',
          borderRadius: 4,
          padding: isLg ? '20px 14px 16px' : '16px 10px 12px',
          filter: isDone ? 'saturate(0.3) brightness(0.7)' : 'none',
        }}
      >
        {/* Status stamp */}
        {stamp && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <div
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: isLg ? 22 : 18,
                fontWeight: 'bold',
                color: stamp.color,
                border: `2px solid ${stamp.color}`,
                borderRadius: 4,
                padding: '2px 10px',
                transform: `rotate(${stamp.angle}deg)`,
                letterSpacing: '0.15em',
                textShadow: `0 0 12px ${stamp.color}80`,
                boxShadow: `0 0 12px ${stamp.color}30`,
                background: 'rgba(10, 8, 6, 0.85)',
                filter: 'saturate(2) brightness(1.5)',
              }}
            >
              {stamp.label}
            </div>
          </div>
        )}
        {/* Orange neon pin */}
        <div
          className="absolute"
          style={{
            top: -(pinSize / 2),
            left: '50%',
            transform: 'translateX(-50%)',
            width: pinSize,
            height: pinSize,
            borderRadius: '50%',
            background: '#ff8c00',
            boxShadow: '0 0 8px #ff8c00, 0 0 16px rgba(255,140,0,0.5)',
          }}
        />

        {/* WANTED header */}
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: isLg ? 18 : 14,
            fontWeight: 'bold',
            color: '#ff8c00',
            letterSpacing: isLg ? '0.25em' : '0.2em',
            textShadow: '0 0 10px rgba(255,140,0,0.6), 0 0 20px rgba(255,140,0,0.3)',
            marginBottom: isLg ? 10 : 8,
            textTransform: 'uppercase',
          }}
        >
          WANTED
        </div>

        {/* Mugshot */}
        <div
          className="relative overflow-hidden"
          style={{
            width: '85%',
            height: mugshotH,
            border: '2px solid #1a150e',
            borderRadius: 2,
            background: '#0a0806',
            marginBottom: isLg ? 10 : 8,
          }}
        >
          {mugshot ? (
            <img
              src={mugshot.url}
              alt={bounty.card_name}
              className={`absolute inset-0 w-full h-full object-cover ${mugshot.isPlayer ? 'object-center' : 'object-top'}`}
              style={{
                filter: mugshot.isPlayer
                  ? 'sepia(0.5) contrast(1.3) saturate(0.6) brightness(0.85)'
                  : 'contrast(1.1) saturate(0.8)',
              }}
              draggable={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span style={{ color: 'rgba(255,140,0,0.3)', fontSize: isLg ? 32 : 24 }}>?</span>
            </div>
          )}

          {/* Warm orange tint overlay for player mugshots */}
          {mugshot?.isPlayer && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'rgba(255, 140, 0, 0.08)', mixBlendMode: 'overlay' }}
            />
          )}

          {/* Dark vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,8,6,0.7) 100%)',
            }}
          />

          {/* Tape strip — top left */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: -2,
              left: -4,
              width: isLg ? 28 : 22,
              height: isLg ? 12 : 10,
              background: 'rgba(210, 190, 150, 0.25)',
              transform: 'rotate(-18deg)',
              borderRadius: 1,
            }}
          />

          {/* Tape strip — top right */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: -2,
              right: -4,
              width: isLg ? 28 : 22,
              height: isLg ? 12 : 10,
              background: 'rgba(210, 190, 150, 0.25)',
              transform: 'rotate(18deg)',
              borderRadius: 1,
            }}
          />
        </div>

        {/* Card name */}
        <div
          className="text-center font-bold uppercase truncate w-full"
          style={{
            color: '#fff',
            fontSize: isLg ? 13 : 11,
            letterSpacing: '0.04em',
            marginBottom: 4,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          {bounty.card_name}
        </div>

        {/* Rarity badge */}
        <div
          className="text-center"
          style={{
            fontSize: isLg ? 10 : 9,
            fontWeight: 600,
            color: rarity.color,
            border: `1px solid ${rarity.color}`,
            background: `${rarity.color}18`,
            borderRadius: 9999,
            padding: '1px 8px',
            marginBottom: 4,
          }}
        >
          {rarity.name}
        </div>

        {/* Holo + card type */}
        {subtitleParts && (
          <div
            className="text-center"
            style={{
              fontSize: isLg ? 10 : 9,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: isLg ? 8 : 6,
            }}
          >
            {subtitleParts}
          </div>
        )}

        {/* Reward section */}
        <div
          className="text-center"
          style={{ marginBottom: isLg ? 8 : 6 }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: isLg ? 9 : 8,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            REWARD
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: isLg ? 20 : 16,
              fontWeight: 'bold',
              color: '#ff8c00',
              textShadow: '0 0 8px rgba(255,140,0,0.5)',
              lineHeight: 1,
            }}
          >
            {bounty.core_reward} <span style={{ fontSize: isLg ? 10 : 9, opacity: 0.7 }}>Core</span>
          </div>
        </div>

        {/* Days remaining — only for active bounties */}
        {!isDone && daysLeft !== null && (
          <div
            className="text-center"
            style={{
              fontSize: isLg ? 10 : 9,
              color: daysLeft <= 2 ? '#ef4444' : 'rgba(255,255,255,0.4)',
              fontWeight: daysLeft <= 2 ? 600 : 400,
              marginBottom: (canFulfill || isMine) ? (isLg ? 8 : 6) : 0,
            }}
          >
            {daysLeft === 0 ? 'Expires today' : `${daysLeft}d remaining`}
          </div>
        )}

        {/* Action buttons */}
        {canFulfill && onFulfill && (
          <button
            onClick={(e) => onFulfill(bounty.id, e.currentTarget)}
            className="w-full cursor-pointer"
            style={{
              background: 'rgba(0, 210, 255, 0.12)',
              border: '1px solid rgba(0, 210, 255, 0.4)',
              color: '#00d2ff',
              borderRadius: 4,
              padding: isLg ? '5px 0' : '4px 0',
              fontSize: isLg ? 11 : 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 210, 255, 0.22)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0,210,255,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0, 210, 255, 0.12)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            TURN IN
          </button>
        )}

        {isMine && onCancel && (
          <button
            onClick={() => onCancel(bounty.id)}
            className="w-full cursor-pointer"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#ef4444',
              borderRadius: 4,
              padding: isLg ? '5px 0' : '4px 0',
              fontSize: isLg ? 10 : 9,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(239,68,68,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            CANCEL (25% fee)
          </button>
        )}
      </div>
    </div>
  )
}
