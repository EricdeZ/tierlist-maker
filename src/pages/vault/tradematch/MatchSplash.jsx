import { useMemo } from 'react'
import { Heart } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import { useVault } from '../VaultContext'

function feedCardToGameData(card, cd, override) {
  const type = card.card_type || cd.cardType || 'god'
  const base = {
    name: card.god_name || card.player_name,
    imageUrl: override?.custom_image_url || card.image_url,
    id: card.god_id,
    serialNumber: card.serial_number,
    metadata: override || undefined,
    signatureUrl: cd.signatureUrl,
  }
  if (type === 'god') return { ...base, role: cd.role, ability: cd.ability, class: cd.class, imageKey: cd.imageKey }
  if (type === 'item') return { ...base, category: cd.category || cd.class, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

function MatchCard({ card, direction }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data || {}
  const isPlayer = card.card_type === 'player' || cd.teamName || cd.role
  const type = card.card_type || cd.cardType || 'god'
  const override = type !== 'player' ? getDefOverride({ cardType: type, godId: card.god_id }) : null

  return (
    <div style={{ animation: `slide-in-${direction} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both 0.3s` }}>
      {isPlayer ? (
        <TradingCard
          playerName={card.god_name || card.player_name}
          teamName={cd.teamName || ''}
          teamColor={cd.teamColor || '#6366f1'}
          role={cd.role || 'ADC'}
          avatarUrl={card.image_url || ''}
          rarity={card.rarity}
          leagueName={cd.leagueName || ''}
          divisionName={cd.divisionName || ''}
          bestGod={cd.bestGodName ? { name: cd.bestGodName } : null}
          isConnected={cd.isConnected}
          isFirstEdition={card.serial_number === 1}
          signatureUrl={cd.signatureUrl}
          size={120}
        />
      ) : (
        <GameCard
          type={type}
          rarity={card.rarity}
          data={feedCardToGameData(card, cd, override)}
          size={120}
        />
      )}
    </div>
  )
}

export default function MatchSplash({ matchData, partnerName, onOpenTrade, onDismiss }) {
  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 8 + Math.random() * 16,
      emoji: i % 3 === 0 ? '✨' : '♥',
    })),
  [])

  return (
    <>
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes slide-in-left {
          0% { transform: translateX(-100px) scale(0.5); opacity: 0; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes slide-in-right {
          0% { transform: translateX(100px) scale(0.5); opacity: 0; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% {
            text-shadow: 0 0 20px rgba(236,72,153,0.5), 0 0 40px rgba(236,72,153,0.3);
            transform: scale(1);
          }
          50% {
            text-shadow: 0 0 30px rgba(236,72,153,0.8), 0 0 60px rgba(236,72,153,0.5);
            transform: scale(1.05);
          }
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes heart-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>

      <div
        className="fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      >
        {/* Floating particles */}
        {particles.map((p, i) => (
          <span
            key={i}
            className="pointer-events-none absolute select-none"
            style={{
              left: `${p.left}%`,
              bottom: '-20px',
              fontSize: `${p.size}px`,
              animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
              opacity: 0.8,
            }}
          >
            {p.emoji}
          </span>
        ))}

        {/* Match title */}
        <h1
          className="text-4xl font-black cd-head tracking-widest mb-8"
          style={{
            color: '#ec4899',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        >
          It&apos;s a Match!
        </h1>

        {/* Cards + heart */}
        <div className="flex items-center gap-4 mb-6">
          <MatchCard card={matchData.my_card} direction="left" />

          <div
            style={{
              animation: 'heart-pulse 1.2s ease-in-out infinite',
              filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.7))',
            }}
          >
            <Heart className="w-8 h-8" style={{ color: '#ec4899', fill: '#ec4899' }} />
          </div>

          <MatchCard card={matchData.their_card} direction="right" />
        </div>

        {/* Tagline */}
        <p
          className="text-base text-white/70 text-center max-w-xs mb-8"
          style={{ animation: 'fade-in-up 0.8s ease both 0.6s', opacity: 0 }}
        >
          You and <span className="text-pink-400 font-semibold">@{partnerName}</span> have a connection...
        </p>

        {/* Action buttons */}
        <div
          className="flex items-center gap-4"
          style={{ animation: 'fade-in-up 0.8s ease both 0.9s', opacity: 0 }}
        >
          <button
            onClick={() => onOpenTrade(matchData.trade_id)}
            className="px-6 py-3 rounded-xl font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #be185d)',
              boxShadow: '0 0 20px rgba(236,72,153,0.4)',
            }}
          >
            Open Trade
          </button>
          <button
            onClick={onDismiss}
            className="px-6 py-3 rounded-xl font-bold cd-head tracking-wider transition-all active:scale-95 cursor-pointer"
            style={{
              background: 'transparent',
              border: '2px solid rgba(236,72,153,0.4)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            Keep Swiping
          </button>
        </div>
      </div>
    </>
  )
}
