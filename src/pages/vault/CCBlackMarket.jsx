import { useState, useMemo, useCallback, useEffect, Fragment } from 'react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'
import { GODS, CLASS_ROLE } from '../../data/vault/gods'
import { ITEMS } from '../../data/vault/items'
import { CONSUMABLES } from '../../data/vault/buffs'
import { MINIONS } from '../../data/vault/minions'
import TradingCard from '../../components/TradingCard'
import PackArt from './components/PackArt'
import './CCBlackMarket.css'

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#ff8c00',
  mythic: '#ef4444',
}

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

const REWARD_TIERS = {
  common: 3,
  uncommon: 5,
  rare: 7,
  epic: 10,
  legendary: 15,
  mythic: 'choose',
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))


// ─── SVG Hand Component ───────────────────────────────────

function ShadowyHand({ phase }) {
  const isOpen = phase === 'idle' || phase === 'dragging' || phase === 'return'

  return (
    <svg viewBox="0 0 240 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="bm-hand-svg">
      <defs>
        {/* Multi-layered ambient glow */}
        <radialGradient id="bm-glow-outer" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="rgba(180,0,0,0.25)" />
          <stop offset="50%" stopColor="rgba(100,0,0,0.1)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="bm-glow-inner" cx="50%" cy="40%" r="35%">
          <stop offset="0%" stopColor="rgba(255,30,30,0.12)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* Skin fill — dark with subtle warm undertone */}
        <linearGradient id="bm-skin" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#1a0a12" />
          <stop offset="40%" stopColor="#140810" />
          <stop offset="100%" stopColor="#0c0408" />
        </linearGradient>
        <linearGradient id="bm-skin-hi" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#2a1018" />
          <stop offset="100%" stopColor="#140810" />
        </linearGradient>

        {/* Edge highlight for depth */}
        <linearGradient id="bm-edge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(200,40,40,0.15)" />
          <stop offset="50%" stopColor="rgba(200,40,40,0.04)" />
          <stop offset="100%" stopColor="rgba(200,40,40,0.12)" />
        </linearGradient>

        {/* Nail gradient */}
        <linearGradient id="bm-nail" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#2a1520" />
          <stop offset="100%" stopColor="#0c0408" />
        </linearGradient>

        {/* Bottom fog */}
        <linearGradient id="bm-fog" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="40%" stopColor="rgba(10,2,6,0.7)" />
          <stop offset="100%" stopColor="rgba(10,2,6,0.98)" />
        </linearGradient>

        <filter id="bm-glow-filter">
          <feGaussianBlur stdDeviation="4" />
          <feComposite in="SourceGraphic" />
        </filter>
        <filter id="bm-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="8" floodColor="rgba(120,0,0,0.5)" />
        </filter>

        {/* Vein pattern */}
        <filter id="bm-vein-blur">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Background glow layers */}
      <ellipse cx="120" cy="130" rx="110" ry="120" fill="url(#bm-glow-outer)" />
      <ellipse cx="120" cy="120" rx="60" ry="70" fill="url(#bm-glow-inner)" />

      {isOpen ? (
        <g filter="url(#bm-shadow)">
          {/* === OPEN HAND — sinister, clawed, beckoning === */}

          {/* Wrist + forearm emerging from below */}
          <path d="M78 280 C76 260, 74 240, 76 220 L76 195 C78 180, 82 170, 88 165 L152 165 C158 170, 162 180, 164 195 L164 220 C166 240, 164 260, 162 280 L162 360 L78 360 Z"
            fill="url(#bm-skin)" stroke="url(#bm-edge)" strokeWidth="0.8" />

          {/* Forearm veins */}
          <g filter="url(#bm-vein-blur)" opacity="0.35">
            <path d="M98 260 C96 240, 100 220, 95 200" stroke="rgba(120,20,30,0.4)" strokeWidth="1.5" fill="none" />
            <path d="M130 255 C132 235, 128 218, 133 195" stroke="rgba(120,20,30,0.3)" strokeWidth="1" fill="none" />
            <path d="M142 270 C144 248, 140 230, 145 208" stroke="rgba(120,20,30,0.25)" strokeWidth="1" fill="none" />
          </g>

          {/* Palm */}
          <path d="M80 195 C80 178, 84 168, 90 162 L92 158 C95 152, 102 148, 110 147 L130 147 C138 148, 145 152, 148 158 L150 162 C156 168, 160 178, 160 195 L160 210 C160 218, 156 222, 150 222 L90 222 C84 222, 80 218, 80 210 Z"
            fill="url(#bm-skin-hi)" stroke="url(#bm-edge)" strokeWidth="0.8" />

          {/* Palm crease lines */}
          <path d="M92 180 C100 175, 115 172, 148 178" stroke="rgba(180,30,30,0.12)" strokeWidth="0.7" fill="none" />
          <path d="M88 192 C100 186, 120 184, 155 190" stroke="rgba(180,30,30,0.1)" strokeWidth="0.6" fill="none" />
          <path d="M95 200 C110 195, 130 194, 150 198" stroke="rgba(180,30,30,0.08)" strokeWidth="0.5" fill="none" />

          {/* Thumb — thick, angled outward, slightly curled */}
          <path d="M82 190 C76 182, 62 168, 52 148 C47 138, 44 126, 48 118 C52 110, 60 108, 66 114 C72 120, 74 132, 74 142 L76 160 L80 178"
            fill="url(#bm-skin-hi)" stroke="url(#bm-edge)" strokeWidth="0.8" />
          {/* Thumb nail */}
          <ellipse cx="50" cy="124" rx="5" ry="7" fill="url(#bm-nail)" stroke="rgba(200,40,40,0.15)" strokeWidth="0.5" transform="rotate(-20 50 124)" />
          {/* Thumb joint */}
          <path d="M66 142 C62 142, 58 140, 56 136" stroke="rgba(150,20,20,0.15)" strokeWidth="0.6" fill="none" />

          {/* Index finger — long, slightly curled inward like beckoning */}
          <path d="M96 148 C94 128, 90 100, 86 72 C84 56, 80 40, 78 28 C76 16, 82 6, 90 8 C98 10, 100 22, 100 36 L98 60 L96 90 L95 120 L95 148"
            fill="url(#bm-skin)" stroke="url(#bm-edge)" strokeWidth="0.8" />
          <ellipse cx="80" cy="18" rx="4.5" ry="8" fill="url(#bm-nail)" stroke="rgba(200,40,40,0.2)" strokeWidth="0.5" transform="rotate(-8 80 18)" />
          <path d="M90 72 C87 72, 85 70, 84 66" stroke="rgba(150,20,20,0.12)" strokeWidth="0.5" fill="none" />
          <path d="M92 100 C89 100, 87 98, 86 94" stroke="rgba(150,20,20,0.1)" strokeWidth="0.5" fill="none" />

          {/* Middle finger — tallest, straight, menacing */}
          <path d="M113 147 C112 120, 110 85, 108 52 C107 35, 106 18, 106 6 C106 -8, 114 -14, 121 -12 C128 -10, 130 0, 129 14 L127 50 L125 90 L122 130 L120 147"
            fill="url(#bm-skin)" stroke="url(#bm-edge)" strokeWidth="0.8" />
          <ellipse cx="107" cy="-4" rx="5" ry="9" fill="url(#bm-nail)" stroke="rgba(200,40,40,0.2)" strokeWidth="0.5" transform="rotate(-2 107 -4)" />
          <path d="M117 52 C114 52, 112 50, 111 46" stroke="rgba(150,20,20,0.12)" strokeWidth="0.5" fill="none" />
          <path d="M119 85 C116 85, 114 83, 113 80" stroke="rgba(150,20,20,0.1)" strokeWidth="0.5" fill="none" />

          {/* Ring finger — slightly shorter, slight curl */}
          <path d="M133 148 C134 124, 136 95, 138 65 C139 48, 140 32, 141 22 C142 10, 148 4, 155 7 C162 10, 162 22, 160 35 L157 65 L153 100 L148 135 L145 148"
            fill="url(#bm-skin)" stroke="url(#bm-edge)" strokeWidth="0.8" />
          <ellipse cx="141" cy="12" rx="4.5" ry="8" fill="url(#bm-nail)" stroke="rgba(200,40,40,0.2)" strokeWidth="0.5" transform="rotate(6 141 12)" />
          <path d="M152 65 C149 65, 147 63, 146 60" stroke="rgba(150,20,20,0.12)" strokeWidth="0.5" fill="none" />

          {/* Pinky — short, curled slightly */}
          <path d="M152 158 C156 140, 160 118, 164 94 C165 80, 168 68, 170 58 C172 46, 178 42, 184 46 C189 50, 188 62, 185 74 L180 98 L174 126 L168 155 L160 170"
            fill="url(#bm-skin)" stroke="url(#bm-edge)" strokeWidth="0.8" />
          <ellipse cx="171" cy="50" rx="4" ry="7" fill="url(#bm-nail)" stroke="rgba(200,40,40,0.2)" strokeWidth="0.5" transform="rotate(12 171 50)" />

          {/* Knuckle highlights — bone pushing through */}
          <ellipse cx="96" cy="148" rx="7" ry="4" fill="rgba(200,30,30,0.06)" />
          <ellipse cx="116" cy="145" rx="7" ry="4" fill="rgba(200,30,30,0.06)" />
          <ellipse cx="138" cy="148" rx="7" ry="4" fill="rgba(200,30,30,0.06)" />

          {/* Tendons on back of hand */}
          <g opacity="0.2">
            <path d="M96 148 L92 170" stroke="rgba(140,20,20,0.3)" strokeWidth="0.8" fill="none" />
            <path d="M116 145 L114 170" stroke="rgba(140,20,20,0.3)" strokeWidth="0.8" fill="none" />
            <path d="M138 148 L140 170" stroke="rgba(140,20,20,0.3)" strokeWidth="0.8" fill="none" />
          </g>
        </g>
      ) : (
        <g filter="url(#bm-shadow)">
          {/* === CLOSED FIST — crushing, powerful === */}

          {/* Wrist + forearm */}
          <path d="M78 260 C76 240, 74 220, 76 200 L78 180 C80 168, 86 160, 92 156 L148 156 C154 160, 160 168, 162 180 L164 200 C166 220, 164 240, 162 260 L162 360 L78 360 Z"
            fill="url(#bm-skin)" stroke="url(#bm-edge)" strokeWidth="0.8" />

          {/* Forearm veins */}
          <g filter="url(#bm-vein-blur)" opacity="0.4">
            <path d="M98 250 C94 228, 100 210, 94 188" stroke="rgba(120,20,30,0.5)" strokeWidth="1.8" fill="none" />
            <path d="M130 245 C134 225, 128 208, 134 185" stroke="rgba(120,20,30,0.35)" strokeWidth="1.2" fill="none" />
            <path d="M145 258 C148 238, 142 222, 148 200" stroke="rgba(120,20,30,0.3)" strokeWidth="1" fill="none" />
          </g>

          {/* Main fist mass */}
          <path d="M68 148 C66 130, 72 108, 82 98 L88 92 C95 86, 108 82, 120 82 L138 84 C150 87, 160 96, 166 110 L170 125 C174 142, 172 162, 168 178 L164 200 C162 210, 156 218, 148 222 L92 222 C84 218, 78 210, 76 200 L72 178 C68 162, 66 152, 68 148 Z"
            fill="url(#bm-skin-hi)" stroke="url(#bm-edge)" strokeWidth="0.8" />

          {/* Thumb wrapped across front — the "lock" */}
          <path d="M70 155 C60 148, 48 136, 44 122 C40 108, 44 96, 54 94 C64 92, 72 100, 76 112 L78 128 C80 138, 78 148, 74 155"
            fill="url(#bm-skin-hi)" stroke="url(#bm-edge)" strokeWidth="0.8" />
          <ellipse cx="46" cy="106" rx="5" ry="6" fill="url(#bm-nail)" stroke="rgba(200,40,40,0.15)" strokeWidth="0.5" transform="rotate(-25 46 106)" />

          {/* Curled finger segments across top — 3 rows of knuckle ridges */}
          <path d="M78 105 C90 94, 115 88, 142 94 C154 98, 162 106, 166 118"
            fill="none" stroke="rgba(200,30,30,0.18)" strokeWidth="1.2" />
          <path d="M74 122 C86 114, 115 108, 145 114 C155 118, 164 124, 168 134"
            fill="none" stroke="rgba(200,30,30,0.14)" strokeWidth="1" />
          <path d="M72 140 C84 133, 115 128, 148 134 C158 137, 166 142, 170 150"
            fill="none" stroke="rgba(200,30,30,0.1)" strokeWidth="0.8" />

          {/* Knuckle bumps — prominent on a clenched fist */}
          <ellipse cx="92" cy="96" rx="8" ry="5" fill="rgba(200,30,30,0.08)" />
          <ellipse cx="116" cy="92" rx="8" ry="5" fill="rgba(200,30,30,0.08)" />
          <ellipse cx="140" cy="96" rx="8" ry="5" fill="rgba(200,30,30,0.08)" />
          {/* Knuckle bone highlights */}
          <ellipse cx="92" cy="94" rx="3" ry="2" fill="rgba(255,60,60,0.06)" />
          <ellipse cx="116" cy="90" rx="3" ry="2" fill="rgba(255,60,60,0.06)" />
          <ellipse cx="140" cy="94" rx="3" ry="2" fill="rgba(255,60,60,0.06)" />

          {/* Tendons strained on back of hand */}
          <g opacity="0.3">
            <path d="M92 98 L90 160" stroke="rgba(140,20,20,0.4)" strokeWidth="1" fill="none" />
            <path d="M116 94 L114 160" stroke="rgba(140,20,20,0.4)" strokeWidth="1" fill="none" />
            <path d="M140 98 L142 160" stroke="rgba(140,20,20,0.4)" strokeWidth="1" fill="none" />
          </g>
        </g>
      )}

      {/* Bottom fog — hand emerges from darkness */}
      <rect x="0" y="260" width="240" height="100" fill="url(#bm-fog)" />
      <ellipse cx="120" cy="300" rx="100" ry="30" fill="rgba(10,2,6,0.95)" />
      {/* Subtle red glow at fog line */}
      <ellipse cx="120" cy="280" rx="60" ry="15" fill="rgba(139,0,0,0.08)" />
    </svg>
  )
}


// ─── Hand Drop Zone ──────────────────────────────────────

function HandDropZone({
  phase, selectedCard, reward, onDrop, onDragOver, onDragLeave, onCollect, isDragOver, isMobile, onMobileTurnIn,
}) {
  const isActive = isDragOver || (isMobile && selectedCard && phase === 'idle')
  const rewardPacks = reward?.type === 'packs' ? reward.count : 0
  const isMythicReward = reward?.type === 'mythic_choice'

  return (
    <div
      className={`bm-drop-zone rounded-xl relative ${isActive ? 'bm-drop-zone-active' : ''} ${phase === 'grab' ? 'bm-phase-grab' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Shadow particles */}
      <div className="bm-particles">
        {[...Array(8)].map((_, i) => <div key={i} className="bm-particle" />)}
      </div>

      {/* Phase: idle / dragging */}
      {(phase === 'idle' || phase === 'dragging') && (
        <div className="flex flex-col items-center gap-2 z-10 relative">
          <div className={`bm-hand-svg ${phase === 'idle' ? 'bm-hand-idle' : 'bm-hand-dragging'}`}>
            <ShadowyHand phase={phase} />
          </div>
          {!selectedCard && (
            <p className="text-xs text-white/25 cd-head tracking-widest mt-1">
              {isMobile ? 'Select a card below' : 'Drag a card here'}
            </p>
          )}
          {isMobile && selectedCard && phase === 'idle' && (
            <button
              onClick={onMobileTurnIn}
              className="mt-2 px-5 py-2 rounded-lg text-sm font-bold cd-head uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all cursor-pointer z-10"
            >
              Turn In
            </button>
          )}
        </div>
      )}

      {/* Reward preview during drag-over or mobile selection */}
      {(phase === 'dragging' || (phase === 'idle' && selectedCard)) && selectedCard && (
        <div className="absolute bottom-3 left-3 right-3 p-2 rounded-md bg-red-900/10 border border-red-900/20 z-10">
          <div className="text-[8px] text-white/25 tracking-widest uppercase">Reward</div>
          <div className="text-[10px] text-red-400 mt-0.5">
            {selectedCard.rarity === 'mythic'
              ? 'Mythic card of your choice'
              : `${REWARD_TIERS[selectedCard.rarity]} ${(selectedCard.cardData?.leagueName || '').toUpperCase()} Packs`}
          </div>
        </div>
      )}

      {/* Phase: grab */}
      {phase === 'grab' && (
        <div className="flex flex-col items-center z-10 relative">
          <div className="bm-hand-svg bm-hand-grab">
            <ShadowyHand phase={phase} />
          </div>
        </div>
      )}

      {/* Red flash on grab */}
      {phase === 'grab' && (
        <div className="absolute inset-0 bg-red-500/10 rounded-xl pointer-events-none bm-flash" />
      )}

      {/* Phase: devour */}
      {phase === 'devour' && (
        <div className="flex flex-col items-center z-10 relative">
          <div className="bm-hand-svg bm-hand-devour">
            <ShadowyHand phase={phase} />
          </div>
        </div>
      )}

      {/* Phase: return */}
      {phase === 'return' && (
        <div className="flex flex-col items-center gap-3 z-10 relative bm-reward-fade-in">
          <div className="bm-hand-svg bm-hand-return">
            <ShadowyHand phase={phase} />
          </div>
          {rewardPacks > 0 && (
            <div className="bm-reward-packs">
              {[...Array(Math.min(rewardPacks, 5))].map((_, i) => (
                <div key={i} className="bm-reward-pack-card" style={{ transform: `rotate(${(i - 2) * 6}deg) translateY(${Math.abs(i - 2) * 4}px)` }}>
                  <PackArt
                    tier={reward.packType || 'mixed'}
                    name=""
                    subtitle=""
                    cardCount={6}
                    seed={i}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
          {isMythicReward && (
            <div className="bm-mythic-reward-glow">
              <div className="text-4xl">&#9733;</div>
            </div>
          )}
        </div>
      )}

      {/* Phase: collect */}
      {phase === 'collect' && (
        <div className="flex flex-col items-center gap-4 z-10 relative bm-reward-fade-in">
          {rewardPacks > 0 && (
            <div className="text-center">
              <div className="bm-reward-packs mb-3">
                {[...Array(Math.min(rewardPacks, 5))].map((_, i) => (
                  <div key={i} className="bm-reward-pack-card" style={{ transform: `rotate(${(i - 2) * 8}deg) translateY(${Math.abs(i - 2) * 3}px)` }}>
                    <PackArt
                      tier={reward.packType || 'mixed'}
                      name=""
                      subtitle=""
                      cardCount={6}
                      seed={i}
                      compact
                    />
                  </div>
                ))}
              </div>
              <div className="text-2xl font-bold cd-num text-red-400 mb-1">+{rewardPacks}</div>
              <div className="text-xs text-white/40 cd-head tracking-wider">
                {reward.packType?.replace('-mixed', '').toUpperCase()} Packs
              </div>
            </div>
          )}

          {isMythicReward && (
            <div className="text-center">
              <div className="bm-mythic-reward-glow mb-2">
                <div className="text-5xl">&#9733;</div>
              </div>
              <div className="text-lg font-bold cd-head text-red-400 tracking-wider">Mythic Choice</div>
              <div className="text-xs text-white/30 mt-1">Choose any mythic card from the catalog</div>
            </div>
          )}

          <button
            onClick={onCollect}
            className="px-6 py-2.5 rounded-lg text-sm font-bold cd-head uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_20px_rgba(200,0,0,0.2)] transition-all cursor-pointer"
          >
            {isMythicReward
              ? 'Choose Your Mythic'
              : 'Collect'}
          </button>
        </div>
      )}
    </div>
  )
}


// ─── Brudih Card Item ────────────────────────────────────

function BrudihCardItem({ card, isSelected, onSelect, onDragStart, onDragEnd, dragging, compact }) {
  const cardData = card.cardData || {}
  const reward = REWARD_TIERS[card.rarity]
  const sz = compact ? 80 : 105

  return (
    <div
      className={`bm-card-item shrink-0 ${
        isSelected ? 'bm-card-item-selected' : ''
      } ${dragging ? 'bm-card-dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <TradingCard
        playerName={cardData.playerName || card.godName}
        teamName={cardData.teamName || ''}
        teamColor={cardData.teamColor || '#6366f1'}
        role={cardData.role || card.role || 'ADC'}
        avatarUrl={cardData.avatarUrl || card.imageUrl || ''}
        rarity={card.rarity}
        leagueName={cardData.leagueName || ''}
        divisionName={cardData.divisionName || ''}
        bestGod={card.bestGodName ? { name: card.bestGodName } : null}
        isConnected={card.isConnected}
        isFirstEdition={cardData.isFirstEdition}
        size={sz}
      />
      <div className="text-center mt-1">
        <div className="text-[9px] text-white/25 cd-head tracking-wider">
          {reward === 'choose' ? 'Mythic pick' : `${reward} packs`}
        </div>
      </div>
    </div>
  )
}


// ─── Brudih Card Grid ────────────────────────────────────

function BrudihCardGrid({ cards, selectedCard, onSelect, onDragStart, onDragEnd, draggingId, isMobile, leagues, leagueFilter, setLeagueFilter }) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-white/15 text-4xl mb-3">&#9760;</div>
        <p className="text-sm font-bold cd-head text-white/25 tracking-wider">No Brudih Cards</p>
        <p className="text-xs text-white/15 mt-1">Find Brudih player cards in packs to trade here.</p>
      </div>
    )
  }

  const filterButtons = leagues && leagues.length > 2 && (
    <div className="flex gap-1.5 mb-3 flex-wrap">
      {leagues.map(league => (
        <button
          key={league}
          onClick={() => setLeagueFilter(league)}
          className={`px-2.5 py-1 rounded text-[10px] font-bold cd-head tracking-wider uppercase transition-all cursor-pointer ${
            leagueFilter === league
              ? 'bg-red-500/15 border border-red-500/30 text-red-400'
              : 'border border-transparent text-white/25 hover:text-white/40'
          }`}
        >
          {league === 'all' ? 'All' : league}
        </button>
      ))}
    </div>
  )

  if (isMobile) {
    return (
      <>
        {filterButtons}
        <div className="bm-mobile-scroll">
          {cards.map(card => (
            <BrudihCardItem
              key={card.id}
              card={card}
              isSelected={selectedCard?.id === card.id}
              onSelect={() => onSelect(card)}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              dragging={false}
              compact
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      {filterButtons}
      <div className="grid grid-cols-2 gap-3 justify-items-center">
        {cards.map(card => (
          <BrudihCardItem
            key={card.id}
            card={card}
            isSelected={selectedCard?.id === card.id}
            onSelect={() => onSelect(card)}
            onDragStart={(e) => onDragStart(e, card)}
            onDragEnd={onDragEnd}
            dragging={draggingId === card.id}
          />
        ))}
      </div>
    </>
  )
}


// ─── Exchange Rates ──────────────────────────────────────

function ExchangeRates() {
  return (
    <div className="bm-panel rounded-lg p-4">
      <div className="text-xs font-bold cd-head text-white/30 tracking-widest mb-3 uppercase">Exchange Rates</div>
      <div className="bm-rates-grid">
        {Object.entries(REWARD_TIERS).map(([rarity, reward]) => (
          <Fragment key={rarity}>
            <div className="bm-rate-cell">
              <div className="text-[11px] font-bold cd-head" style={{ color: RARITY_COLORS[rarity] }}>
                {RARITY_LABELS[rarity]}
              </div>
              <div className="text-sm font-bold cd-num text-white/70 mt-1">
                {reward === 'choose' ? (
                  <span className="text-red-400">Mythic Pick</span>
                ) : (
                  <>{reward} packs</>
                )}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}


// ─── Mythic Selection Modal ──────────────────────────────

function MythicSelectionModal({ onSelect, onClose }) {
  const [tab, setTab] = useState('gods')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [claiming, setClaiming] = useState(false)

  const catalog = useMemo(() => {
    const gods = GODS.map(g => ({
      cardType: 'god',
      godId: g.slug,
      godName: g.name,
      godClass: g.class,
      role: CLASS_ROLE[g.class] || 'mid',
      label: g.name,
      sublabel: g.class,
    }))
    const items = ITEMS.map(it => ({
      cardType: 'item',
      godId: 'item-' + it.id,
      godName: it.name,
      label: it.name,
      sublabel: it.type || 'Item',
    }))
    const consumables = CONSUMABLES.map(c => ({
      cardType: 'consumable',
      godId: 'consumable-' + c.id,
      godName: c.name,
      label: c.name,
      sublabel: 'Consumable',
    }))
    const minions = MINIONS.map(m => ({
      cardType: 'minion',
      godId: 'minion-' + m.type,
      godName: m.name,
      label: m.name,
      sublabel: m.type.charAt(0).toUpperCase() + m.type.slice(1) + ' Minion',
    }))
    return { gods, items, consumables, minions }
  }, [])

  const filtered = useMemo(() => {
    const list = catalog[tab] || []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(item => item.label.toLowerCase().includes(q))
  }, [catalog, tab, search])

  const tabs = [
    { key: 'gods', label: 'Gods' },
    { key: 'items', label: 'Items' },
    { key: 'consumables', label: 'Consumables' },
    { key: 'minions', label: 'Minions' },
  ]

  const handleConfirm = async () => {
    if (!selected || claiming) return
    setClaiming(true)
    try {
      await onSelect(selected)
    } catch {
      setClaiming(false)
    }
  }

  return (
    <div className="bm-mythic-modal">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="text-lg font-bold cd-head text-red-400 tracking-wider">Choose Your Mythic</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Select any card to receive as a Mythic</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 text-2xl leading-none transition-colors cursor-pointer px-2"
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                : 'border border-transparent text-white/30 hover:text-white/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 rounded-lg text-sm bg-[rgba(10,0,8,0.8)] border border-[rgba(139,0,0,0.2)] text-white/80 placeholder-white/20 focus:border-[rgba(200,0,0,0.4)] focus:outline-none transition-colors"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-sm">No results</div>
        ) : (
          <div className="bm-mythic-grid">
            {filtered.map(item => (
              <button
                key={item.godId}
                onClick={() => setSelected(item)}
                className={`bm-mythic-item ${selected?.godId === item.godId ? 'bm-mythic-item-selected' : ''}`}
              >
                <div className="text-sm font-bold text-white/80 truncate">{item.label}</div>
                <div className="text-[11px] text-white/30 mt-0.5">{item.sublabel}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirm bar */}
      {selected && (
        <div className="px-4 py-3 border-t border-[rgba(139,0,0,0.2)] bg-[rgba(10,0,8,0.95)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white/80 truncate">{selected.label}</div>
            <div className="text-[11px] text-white/30">{selected.sublabel} — Mythic</div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={claiming}
            className="px-5 py-2 rounded-lg text-sm font-bold cd-head uppercase tracking-wider bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {claiming ? <div className="cd-spinner w-4 h-4" /> : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}


// ─── Main Component ──────────────────────────────────────

export default function CCBlackMarket() {
  const { collection, blackMarketTurnIn, blackMarketClaimMythic, stats } = useVault()
  const { user, hasPermission } = useAuth()
  const isOwner = hasPermission('permission_manage')

  const [phase, setPhase] = useState('idle')
  const [selectedCard, setSelectedCard] = useState(null)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState(null)
  const [showMythicModal, setShowMythicModal] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [leagueFilter, setLeagueFilter] = useState('all')

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const brudihCards = useMemo(() =>
    collection.filter(c => c.cardType === 'player' && c.godName === 'Brudih'),
  [collection])

  const leagues = useMemo(() => {
    const set = new Set(brudihCards.map(c => c.cardData?.leagueName).filter(Boolean))
    return ['all', ...set]
  }, [brudihCards])

  const filteredCards = leagueFilter === 'all'
    ? brudihCards
    : brudihCards.filter(c => c.cardData?.leagueName === leagueFilter)

  const brudihsTurnedIn = stats?.brudihsTurnedIn || 0
  const pendingMythicClaim = stats?.pendingMythicClaim || 0

  // ── Animation handler ──

  const handleTurnIn = useCallback(async (card) => {
    if (phase !== 'idle') return
    setSelectedCard(card)
    setError(null)
    setPhase('grab')
    await sleep(400)
    setPhase('devour')
    try {
      const result = await blackMarketTurnIn(card.id)
      await sleep(600)
      setReward(result.reward)
      setPhase('return')
      await sleep(800)
      setPhase('collect')
    } catch (err) {
      setError(err.message || 'Turn-in failed')
      setPhase('idle')
      setSelectedCard(null)
    }
  }, [phase, blackMarketTurnIn])

  // ── Collect handler ──

  const handleCollect = useCallback(() => {
    if (reward?.type === 'mythic_choice') {
      setShowMythicModal(true)
    } else {
      setPhase('idle')
      setSelectedCard(null)
      setReward(null)
    }
  }, [reward])

  // ── Mythic claim ──

  const handleMythicSelect = useCallback(async (catalogItem) => {
    try {
      await blackMarketClaimMythic({
        cardType: catalogItem.cardType,
        godId: catalogItem.godId,
        godName: catalogItem.godName,
        godClass: catalogItem.godClass,
        role: catalogItem.role,
      })
      setShowMythicModal(false)
      setPhase('idle')
      setSelectedCard(null)
      setReward(null)
    } catch (err) {
      setError(err.message || 'Mythic claim failed')
      throw err
    }
  }, [blackMarketClaimMythic])

  // ── Drag and drop ──

  const handleDragStart = useCallback((e, card) => {
    if (phase !== 'idle') return
    setDraggingId(card.id)
    setSelectedCard(card)
    setPhase('dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', card.id)
  }, [phase])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setIsDragOver(false)
    if (phase === 'dragging') {
      setPhase('idle')
    }
  }, [phase])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    setDraggingId(null)
    if (selectedCard) {
      handleTurnIn(selectedCard)
    }
  }, [selectedCard, handleTurnIn])

  // ── Mobile tap select ──

  const handleCardSelect = useCallback((card) => {
    if (phase !== 'idle') return
    setError(null)
    if (isMobile) {
      setSelectedCard(prev => prev?.id === card.id ? null : card)
    } else {
      setSelectedCard(card)
    }
  }, [phase, isMobile])

  const handleMobileTurnIn = useCallback(() => {
    if (selectedCard && phase === 'idle') {
      handleTurnIn(selectedCard)
    }
  }, [selectedCard, phase, handleTurnIn])

  // ── Render ──

  if (!user) {
    return (
      <div className="text-center py-20 text-white/25">
        <p className="text-lg font-bold cd-head">Sign in to access the Black Market</p>
      </div>
    )
  }

  return (
    <div className="bm-container pb-32 relative">
      <div className="bm-vignette" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-bold cd-head text-red-400 flex items-center gap-2 tracking-wider">
            <span className="text-2xl opacity-60">&#9760;</span>
            Black Market
          </h2>
          <p className="text-[11px] sm:text-xs text-white/25 mt-1">
            Turn in Brudih player cards for league packs. The shadier the card, the better the payout.
          </p>
        </div>

        {/* Counter banner */}
        <div className="bm-counter-banner rounded-lg px-4 py-2.5 mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/25 cd-head tracking-wider uppercase">Held</span>
            <span className="text-lg font-bold cd-num text-red-400">{brudihCards.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/25 cd-head tracking-wider uppercase">Turned In</span>
            <span className="text-lg font-bold cd-num text-white/50">{brudihsTurnedIn}</span>
          </div>
        </div>

        {/* Pending mythic claim banner */}
        {pendingMythicClaim > 0 && phase === 'idle' && (
          <div className="mb-4 mx-auto max-w-md text-center">
            <button
              onClick={() => setShowMythicModal(true)}
              className="px-6 py-2 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 cd-head tracking-wider text-sm font-bold hover:bg-red-900/40 transition-colors cursor-pointer animate-pulse"
            >
              Claim Your Mythic Card
            </button>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm font-bold cd-head">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-white/30 hover:text-white/60 cursor-pointer">&times;</button>
          </div>
        )}

        {/* Owner debug panel */}
        {isOwner && (
          <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <div className="text-[10px] text-yellow-500/60 cd-head tracking-widest uppercase mb-2">Debug Controls</div>
            <div className="flex flex-wrap gap-1.5">
              {['idle', 'dragging', 'grab', 'devour', 'return', 'collect'].map(p => (
                <button
                  key={p}
                  onClick={() => {
                    if (p === 'dragging' || p === 'grab' || p === 'devour' || p === 'return' || p === 'collect') {
                      setSelectedCard({ id: 'debug', rarity: 'rare', godName: 'Brudih', cardData: { leagueName: 'bsl' } })
                    }
                    if (p === 'return' || p === 'collect') {
                      setReward({ type: 'packs', packType: 'bsl-mixed', count: 7 })
                    }
                    setPhase(p)
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border cursor-pointer transition-all ${
                    phase === p
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                      : 'border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60'
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="w-px h-5 bg-yellow-500/10 self-center mx-1" />
              {['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r => (
                <button
                  key={r}
                  onClick={async () => {
                    const fakeCard = { id: 'debug', rarity: r, godName: 'Brudih', cardData: { leagueName: 'bsl' } }
                    setSelectedCard(fakeCard)
                    setError(null)
                    setPhase('grab')
                    await sleep(400)
                    setPhase('devour')
                    await sleep(600)
                    setReward({ type: 'packs', packType: 'bsl-mixed', count: REWARD_TIERS[r] })
                    setPhase('return')
                    await sleep(800)
                    setPhase('collect')
                  }}
                  className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60 cursor-pointer transition-all"
                  style={{ color: RARITY_COLORS[r] }}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={async () => {
                  const fakeCard = { id: 'debug', rarity: 'mythic', godName: 'Brudih', cardData: { leagueName: 'bsl' } }
                  setSelectedCard(fakeCard)
                  setError(null)
                  setPhase('grab')
                  await sleep(400)
                  setPhase('devour')
                  await sleep(600)
                  setReward({ type: 'mythic_choice' })
                  setPhase('return')
                  await sleep(800)
                  setPhase('collect')
                }}
                className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 cursor-pointer transition-all"
                style={{ color: RARITY_COLORS.mythic }}
              >
                mythic
              </button>
              <span className="w-px h-5 bg-yellow-500/10 self-center mx-1" />
              <button
                onClick={() => setShowMythicModal(true)}
                className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60 cursor-pointer transition-all"
              >
                modal
              </button>
              <button
                onClick={() => { setPhase('idle'); setSelectedCard(null); setReward(null); setError(null); setShowMythicModal(false) }}
                className="px-2 py-1 rounded text-[10px] font-bold cd-head tracking-wider border border-yellow-500/10 text-yellow-500/40 hover:text-yellow-500/60 cursor-pointer transition-all"
              >
                reset
              </button>
            </div>
            <div className="text-[10px] text-yellow-500/30 mt-1.5">Phase: <span className="text-yellow-500/50">{phase}</span></div>
          </div>
        )}

        {/* Desktop: side-by-side */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_1.2fr] gap-4">
          {/* Left: cards */}
          <div className="bm-panel rounded-xl p-4">
            <div className="text-xs font-bold cd-head text-white/30 tracking-widest mb-3 uppercase">Your Brudih Cards</div>
            <BrudihCardGrid
              cards={filteredCards}
              selectedCard={selectedCard}
              onSelect={handleCardSelect}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggingId={draggingId}
              isMobile={false}
              leagues={leagues}
              leagueFilter={leagueFilter}
              setLeagueFilter={setLeagueFilter}
            />
          </div>

          {/* Right: drop zone */}
          <HandDropZone
            phase={phase}
            selectedCard={selectedCard}
            reward={reward}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onCollect={handleCollect}
            isDragOver={isDragOver}
            isMobile={false}
          />
        </div>

        {/* Mobile: stacked */}
        <div className="sm:hidden flex flex-col gap-4">
          {/* Hand on top */}
          <HandDropZone
            phase={phase}
            selectedCard={selectedCard}
            reward={reward}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onCollect={handleCollect}
            isDragOver={isDragOver}
            isMobile={true}
            onMobileTurnIn={handleMobileTurnIn}
          />

          {/* Cards below */}
          <div className="bm-panel rounded-xl p-4">
            <div className="text-xs font-bold cd-head text-white/30 tracking-widest mb-3 uppercase">Your Brudih Cards</div>
            <BrudihCardGrid
              cards={filteredCards}
              selectedCard={selectedCard}
              onSelect={handleCardSelect}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              draggingId={null}
              isMobile={true}
              leagues={leagues}
              leagueFilter={leagueFilter}
              setLeagueFilter={setLeagueFilter}
            />
          </div>

          {/* Rates on mobile below cards */}
          <ExchangeRates />
        </div>

        {/* Desktop: rates below grid */}
        <div className="hidden sm:block mt-4">
          <ExchangeRates />
        </div>
      </div>

      {/* Mythic modal */}
      {showMythicModal && (
        <MythicSelectionModal
          onSelect={handleMythicSelect}
          onClose={() => {
            setShowMythicModal(false)
            setPhase('idle')
            setSelectedCard(null)
            setReward(null)
          }}
        />
      )}
    </div>
  )
}
