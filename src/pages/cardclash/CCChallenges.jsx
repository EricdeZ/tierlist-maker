import { useState, useEffect, useCallback, useMemo } from 'react'
import { challengeService } from '../../services/database'
import { usePassion } from '../../context/PassionContext'
import { useAuth } from '../../context/AuthContext'
import { getTierColor } from '../../config/challengeTiers'
import passionCoin from '../../assets/passion/passion.png'
import emberIcon from '../../assets/ember.png'

export default function CCChallenges() {
  const { user } = useAuth()
  const { updateFromClaim, challengeNotifications } = usePassion()
  const [challengeData, setChallengeData] = useState({})
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [justClaimed, setJustClaimed] = useState({})

  const loadChallenges = useCallback(() => {
    return challengeService.getAll()
      .then(data => setChallengeData(data.challenges || {}))
      .catch(err => console.error('Failed to load challenges:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadChallenges() }, [loadChallenges])

  useEffect(() => {
    if (challengeNotifications.length > 0) loadChallenges()
  }, [challengeNotifications.length, loadChallenges])

  // Filter to vault category only, sorted by progress
  const vaultChallenges = useMemo(() => {
    const all = Object.values(challengeData).flat()
    return all
      .filter(ch => ch.category === 'vault')
      .sort((a, b) => {
        if (a.claimable && !b.claimable) return -1
        if (!a.claimable && b.claimable) return 1
        if (a.completed && !b.completed) return 1
        if (!a.completed && b.completed) return -1
        if (a.progress !== b.progress) return b.progress - a.progress
        return a.targetValue - b.targetValue
      })
  }, [challengeData])

  const handleClaim = async (challengeId, buttonEl) => {
    setClaimingId(challengeId)
    try {
      const result = await challengeService.claim(challengeId)
      if (result.success) {
        spawnFlyingEmber(buttonEl)
        setTimeout(() => updateFromClaim(result), 700)
        setJustClaimed(prev => ({ ...prev, [challengeId]: { passion: result.earned, ember: result.emberEarned } }))
        setTimeout(() => {
          const scrollY = window.scrollY
          loadChallenges().then(() => {
            requestAnimationFrame(() => window.scrollTo(0, scrollY))
          })
        }, 900)
      }
    } catch (err) {
      console.error('Failed to claim challenge:', err)
    } finally {
      setClaimingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="cd-spinner w-8 h-8" />
      </div>
    )
  }

  if (vaultChallenges.length === 0) {
    return (
      <div className="text-center py-16 text-white/30 cd-head tracking-wider text-sm">
        No vault challenges available yet.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="cd-head text-lg font-bold text-[var(--cd-cyan)] cd-text-glow tracking-wider">Core Challenges</h2>
        <p className="text-xs text-white/40 mt-1">Complete challenges to earn bonus Cores</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {vaultChallenges.map((ch, i) => (
          <VaultChallengeCard
            key={ch.id}
            challenge={ch}
            index={i}
            claimingId={claimingId}
            justClaimed={justClaimed[ch.id]}
            onClaim={handleClaim}
            isLoggedIn={!!user}
          />
        ))}
      </div>

      <style>{`
        @keyframes vault-card-enter {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes vault-shimmer {
          0%, 100% { transform: translateX(-100%) skewX(-15deg); }
          50% { transform: translateX(250%) skewX(-15deg); }
        }
        @keyframes vault-claim-glow {
          0% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
          30% { box-shadow: 0 0 20px 3px rgba(0, 229, 255, 0.3); }
          100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
        }
        @keyframes vault-progress-fill {
          0% { width: 0%; }
        }
      `}</style>
    </div>
  )
}


function VaultChallengeCard({ challenge: ch, index, claimingId, justClaimed, onClaim, isLoggedIn }) {
  const pct = Math.round(ch.progress * 100)
  const tierColor = getTierColor(ch.tier)
  const isClaiming = claimingId === ch.id
  const isClaimable = isLoggedIn && ch.claimable && !justClaimed && !ch.completed

  return (
    <div
      className={`
        relative cd-panel cd-corners rounded-xl overflow-hidden transition-all duration-300
        ${ch.completed && !ch.claimable ? 'opacity-50' : ''}
      `}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: tierColor,
        animation: `vault-card-enter 0.4s ease-out ${index * 0.08}s both`,
        ...(justClaimed ? { animation: 'vault-claim-glow 1.2s ease-out' } : {}),
      }}
    >
      {isClaimable && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.06), transparent)',
              animation: 'vault-shimmer 4s ease-in-out infinite',
            }}
          />
        </div>
      )}

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h3 className="font-bold text-sm cd-head text-[var(--cd-text)] leading-tight">{ch.title}</h3>
            <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">{ch.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {ch.reward > 0 && (
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-bold" style={{ color: '#f8c56a' }}>+{ch.reward}</span>
                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
              </div>
            )}
            {ch.emberReward > 0 && (
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-bold text-[var(--cd-cyan)] cd-text-glow">+{ch.emberReward}</span>
                <img src={emberIcon} alt="" className="w-3.5 h-3.5 cd-icon-glow" />
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between items-baseline text-[10px] mb-1">
            <span className="text-white/40 tabular-nums">
              {ch.currentValue?.toLocaleString()} / {ch.targetValue?.toLocaleString()}
            </span>
            <span className={`font-bold tabular-nums ${pct >= 100 ? 'text-[var(--cd-cyan)]' : 'text-white/40'}`}>
              {pct}%
            </span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: ch.completed
                  ? 'rgba(74, 222, 128, 0.5)'
                  : `linear-gradient(90deg, ${tierColor}99, ${tierColor})`,
                animation: 'vault-progress-fill 0.8s ease-out',
              }}
            />
          </div>
        </div>

        {isClaimable && (
          <button
            onClick={(e) => onClaim(ch.id, e.currentTarget)}
            disabled={isClaiming}
            className="mt-3 w-full py-2 rounded-lg font-bold text-xs cd-head tracking-wider transition-all disabled:opacity-50 cursor-pointer cd-btn-solid cd-btn-action"
          >
            {isClaiming ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {justClaimed && (
          <div className="mt-3 flex items-center justify-center gap-3 py-2 rounded-lg bg-[var(--cd-cyan)]/[0.06] border border-[var(--cd-cyan)]/20">
            {justClaimed.passion > 0 && (
              <div className="flex items-center gap-1">
                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                <span className="text-xs font-bold" style={{ color: '#f8c56a' }}>+{justClaimed.passion}</span>
              </div>
            )}
            {justClaimed.ember > 0 && (
              <div className="flex items-center gap-1">
                <img src={emberIcon} alt="" className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-[var(--cd-cyan)]">+{justClaimed.ember}</span>
              </div>
            )}
            <span className="text-xs text-white/50">Claimed!</span>
          </div>
        )}

        {ch.completed && !justClaimed && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-400/60">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Claimed {ch.completedAt ? new Date(ch.completedAt).toLocaleDateString() : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}


function spawnFlyingEmber(sourceEl) {
  const target = document.getElementById('ember-balance-icon')
  if (!sourceEl || !target) return

  const sr = sourceEl.getBoundingClientRect()
  const tr = target.getBoundingClientRect()
  const sx = sr.left + sr.width / 2
  const sy = sr.top + sr.height / 2
  const tx = tr.left + tr.width / 2
  const ty = tr.top + tr.height / 2

  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('div')
    const size = 6 + Math.random() * 4
    dot.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;background:#00e5ff;box-shadow:0 0 6px #00e5ff;z-index:9999;pointer-events:none;will-change:transform;`
    document.body.appendChild(dot)

    const spreadX = (Math.random() - 0.5) * 80
    const spreadY = (Math.random() - 0.5) * 30
    const startX = sx + spreadX
    const startY = sy + spreadY
    const duration = 700 + Math.random() * 300
    const delay = i * 60
    const hs = size / 2

    const anim = dot.animate([
      { transform: `translate(${startX - hs}px, ${startY - hs}px) scale(1)`, opacity: 1 },
      { transform: `translate(${tx - hs}px, ${ty - hs}px) scale(0.3)`, opacity: 0.2 },
    ], { duration, delay, easing: 'ease-in', fill: 'forwards' })

    anim.onfinish = () => dot.remove()
  }
}
