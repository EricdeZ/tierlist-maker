import { useState, useEffect, useCallback, useMemo } from 'react'
import { challengeService } from '../../services/database'
import { usePassion } from '../../context/PassionContext'
import { useAuth } from '../../context/AuthContext'
import { getTierColor } from '../../config/challengeTiers'
import passionCoin from '../../assets/passion/passion.png'
import emberIcon from '../../assets/ember.png'

const VAULT_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'packs', label: 'Packs', statKeys: ['packs_opened'] },
  { key: 'collection', label: 'Collection', statKeys: ['total_cards_owned', 'unique_gods_owned', 'unique_cards_owned', 'legendary_cards_owned', 'epic_cards_owned'] },
  { key: 'marketplace', label: 'Marketplace', statKeys: ['marketplace_sold', 'marketplace_bought', 'best_marketplace_sale', 'marketplace_volume'] },
  { key: 'trading', label: 'Trading', statKeys: ['trades_completed'] },
  { key: 'starting_five', label: 'Starting Five', statKeys: ['starting_five_filled', 'starting_five_rare_count', 'starting_five_epic_count', 'income_collected'] },
  { key: 'currency', label: 'Currency', statKeys: ['cores_converted', 'daily_cores_claimed', 'max_conversions_day', 'total_cores_earned', 'total_cores_spent'] },
  { key: 'social', label: 'Social', statKeys: ['gifts_sent', 'gifts_opened'] },
  { key: 'dismantling', label: 'Dismantling', statKeys: ['cards_dismantled', 'legendary_cards_dismantled'] },
]

function getCategoryForStatKey(statKey) {
  for (const cat of VAULT_CATEGORIES) {
    if (cat.statKeys?.includes(statKey)) return cat.key
  }
  return 'all'
}

export default function CCChallenges() {
  const { user } = useAuth()
  const { updateFromClaim, challengeNotifications, updateEmber } = usePassion()
  const [challengeData, setChallengeData] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [claimingId, setClaimingId] = useState(null)
  const [justClaimed, setJustClaimed] = useState({})
  const [activeCategory, setActiveCategory] = useState('all')
  const [rotatingData, setRotatingData] = useState(null)
  const [rotatingLoading, setRotatingLoading] = useState(true)
  const [rotatingClaimingId, setRotatingClaimingId] = useState(null)
  const [rotatingJustClaimed, setRotatingJustClaimed] = useState({})

  const loadChallenges = useCallback(() => {
    return challengeService.getAll()
      .then(data => setChallengeData(data.challenges || {}))
      .catch(err => console.error('Failed to load challenges:', err))
      .finally(() => setLoading(false))
  }, [])

  const loadRotating = useCallback(() => {
    if (!user) {
      setRotatingLoading(false)
      return Promise.resolve()
    }
    return challengeService.getRotating()
      .then(data => setRotatingData(data))
      .catch(err => console.error('Failed to load rotating challenges:', err))
      .finally(() => setRotatingLoading(false))
  }, [user])

  useEffect(() => { loadChallenges(); loadRotating() }, [loadChallenges, loadRotating])

  // Poll every 60s while visible
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') { loadChallenges(); loadRotating() }
    }, 60_000)
    return () => clearInterval(id)
  }, [loadChallenges, loadRotating])

  const handleRefresh = () => {
    setRefreshing(true)
    Promise.all([loadChallenges(), loadRotating()]).finally(() => setRefreshing(false))
  }

  useEffect(() => {
    if (challengeNotifications.length > 0) { loadChallenges(); loadRotating() }
  }, [challengeNotifications.length, loadChallenges, loadRotating])

  // Filter to vault category only, sorted by progress
  const vaultChallenges = useMemo(() => {
    const all = Object.values(challengeData).flat()
    return all
      .filter(ch => ch.category === 'vault')
      .filter(ch => activeCategory === 'all' || getCategoryForStatKey(ch.statKey) === activeCategory)
      .sort((a, b) => {
        if (a.claimable && !b.claimable) return -1
        if (!a.claimable && b.claimable) return 1
        if (a.completed && !b.completed) return 1
        if (!a.completed && b.completed) return -1
        if (a.progress !== b.progress) return b.progress - a.progress
        return a.targetValue - b.targetValue
      })
  }, [challengeData, activeCategory])

  // Count challenges per category for badges
  const categoryCounts = useMemo(() => {
    const all = Object.values(challengeData).flat().filter(ch => ch.category === 'vault')
    const counts = {}
    for (const cat of VAULT_CATEGORIES) {
      if (cat.key === 'all') {
        counts.all = all.filter(ch => ch.claimable).length
      } else {
        counts[cat.key] = all.filter(ch => cat.statKeys.includes(ch.statKey) && ch.claimable).length
      }
    }
    return counts
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

  const handleClaimRotating = async (assignmentId, buttonEl) => {
    setRotatingClaimingId(assignmentId)
    try {
      const result = await challengeService.claimRotating(assignmentId)
      if (result.success) {
        spawnFlyingEmber(buttonEl)
        if (result.coresEarned > 0) {
          setTimeout(() => updateEmber({ balance: result.emberBalance }), 700)
        }
        setRotatingJustClaimed(prev => ({
          ...prev,
          [assignmentId]: { cores: result.coresEarned, packs: result.packsEarned }
        }))
        setTimeout(() => {
          const scrollY = window.scrollY
          loadRotating().then(() => {
            requestAnimationFrame(() => window.scrollTo(0, scrollY))
          })
        }, 900)
      }
    } catch (err) {
      console.error('Failed to claim rotating challenge:', err)
    } finally {
      setRotatingClaimingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="cd-spinner w-8 h-8" />
      </div>
    )
  }

  const allVaultEmpty = Object.values(challengeData).flat().filter(ch => ch.category === 'vault').length === 0

  if (allVaultEmpty) {
    return (
      <div className="text-center py-16 text-white/30 cd-head tracking-wider text-sm">
        No vault challenges available yet.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {user && (
        <RotatingSection
          data={rotatingData}
          claimingId={rotatingClaimingId}
          justClaimed={rotatingJustClaimed}
          onClaim={handleClaimRotating}
          isLoggedIn={!!user}
        />
      )}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="cd-head text-lg font-bold text-[var(--cd-cyan)] cd-text-glow tracking-wider">Core Challenges</h2>
          <p className="text-xs text-white/40 mt-1">Complete challenges to earn bonus Cores</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg text-white/40 hover:text-[var(--cd-cyan)] hover:bg-white/[0.05] transition-all disabled:opacity-50 cursor-pointer"
          title="Refresh progress"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {VAULT_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key
          const count = categoryCounts[cat.key] || 0
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer
                ${isActive
                  ? 'bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/40'
                  : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]'
                }
              `}
            >
              {cat.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-[var(--cd-cyan)]/30' : 'bg-white/10'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {vaultChallenges.length === 0 && (
        <div className="text-center py-12 text-white/30 cd-head tracking-wider text-sm">
          No challenges in this category.
        </div>
      )}

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


function useCountdown(targetIso) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = new Date(targetIso) - Date.now()
      if (diff <= 0) { setTimeLeft('Resetting...'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      if (h >= 24) {
        const d = Math.floor(h / 24)
        setTimeLeft(`${d}d ${h % 24}h`)
      } else {
        setTimeLeft(`${h}h ${m}m`)
      }
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [targetIso])
  return timeLeft
}


function RotatingSection({ data, claimingId, justClaimed, onClaim, isLoggedIn }) {
  const [activeTab, setActiveTab] = useState('daily')
  if (!data) return null

  const tabs = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ]

  const current = data[activeTab]
  if (!current) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="cd-head text-lg font-bold text-[var(--cd-gold)] tracking-wider">
          Rotating Challenges
        </h2>
      </div>

      {/* Cadence tabs */}
      <div className="flex gap-1.5 mb-4">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key
          const tabData = data[tab.key]
          const claimableCount = tabData?.challenges?.filter(c => c.completed && !c.claimed && !c.expired).length || 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer
                ${isActive
                  ? 'bg-[var(--cd-gold)]/20 text-[var(--cd-gold)] border border-[var(--cd-gold)]/40'
                  : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]'
                }
              `}
            >
              {tab.label}
              {claimableCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-[var(--cd-gold)]/30' : 'bg-white/10'}`}>
                  {claimableCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Timer */}
      <RotatingTimer resetsAt={current.resetsAt} />

      {/* Challenge cards */}
      {current.challenges.length === 0 ? (
        <div className="text-center py-8 text-white/30 cd-head tracking-wider text-sm">
          No rotating challenges available yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {current.challenges.map((ch, i) => (
            <RotatingChallengeCard
              key={ch.assignmentId}
              challenge={ch}
              index={i}
              claimingId={claimingId}
              justClaimed={justClaimed[ch.assignmentId]}
              onClaim={onClaim}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </div>
      )}
    </div>
  )
}


function RotatingTimer({ resetsAt }) {
  const timeLeft = useCountdown(resetsAt)
  return (
    <div className="flex items-center gap-1.5 mb-3 text-[11px] text-white/40">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Resets in {timeLeft}</span>
    </div>
  )
}


function RotatingChallengeCard({ challenge: ch, index, claimingId, justClaimed, onClaim, isLoggedIn }) {
  const pct = Math.round(ch.progress * 100)
  const isClaiming = claimingId === ch.assignmentId
  const isClaimable = isLoggedIn && ch.completed && !ch.claimed && !ch.expired && !justClaimed

  // Color based on reward type
  const accentColor = ch.rewardType === 'cores' ? 'var(--cd-cyan)'
    : ch.rewardType === 'pack' ? 'var(--cd-gold)'
    : '#a78bfa' // purple for mixed

  return (
    <div
      className={`
        relative cd-panel cd-corners rounded-xl overflow-hidden transition-all duration-300
        ${ch.claimed ? 'opacity-50' : ''}
        ${ch.expired && !ch.claimed ? 'opacity-40' : ''}
      `}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
        animation: `vault-card-enter 0.4s ease-out ${index * 0.08}s both`,
        ...(justClaimed ? { animation: 'vault-claim-glow 1.2s ease-out' } : {}),
      }}
    >
      {isClaimable && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 w-1/3"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}10, transparent)`,
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
            <RotatingRewardDisplay challenge={ch} />
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
                background: ch.claimed
                  ? 'rgba(74, 222, 128, 0.5)'
                  : `linear-gradient(90deg, ${accentColor}99, ${accentColor})`,
                animation: 'vault-progress-fill 0.8s ease-out',
              }}
            />
          </div>
        </div>

        {isClaimable && (
          <button
            onClick={(e) => onClaim(ch.assignmentId, e.currentTarget)}
            disabled={isClaiming}
            className="mt-3 w-full py-2 rounded-lg font-bold text-xs cd-head tracking-wider transition-all disabled:opacity-50 cursor-pointer cd-btn-solid cd-btn-action"
          >
            {isClaiming ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {justClaimed && (
          <div className="mt-3 flex items-center justify-center gap-3 py-2 rounded-lg bg-[var(--cd-cyan)]/[0.06] border border-[var(--cd-cyan)]/20">
            {justClaimed.cores > 0 && (
              <div className="flex items-center gap-1">
                <img src={emberIcon} alt="" className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-[var(--cd-cyan)]">+{justClaimed.cores}</span>
              </div>
            )}
            {justClaimed.packs > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs">📦</span>
                <span className="text-xs font-bold text-[var(--cd-gold)]">+{justClaimed.packs} pack{justClaimed.packs > 1 ? 's' : ''}</span>
              </div>
            )}
            <span className="text-xs text-white/50">Claimed!</span>
          </div>
        )}

        {ch.claimed && !justClaimed && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-400/60">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Claimed</span>
          </div>
        )}

        {ch.expired && !ch.claimed && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400/60">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>Expired</span>
          </div>
        )}
      </div>
    </div>
  )
}


function RotatingRewardDisplay({ challenge: ch }) {
  return (
    <>
      {ch.rewardCores > 0 && (
        <div className="flex items-center gap-0.5">
          <span className="text-xs font-bold text-[var(--cd-cyan)] cd-text-glow">+{ch.rewardCores}</span>
          <img src={emberIcon} alt="" className="w-3.5 h-3.5 cd-icon-glow" />
        </div>
      )}
      {ch.rewardPacks > 0 && (
        <div className="flex items-center gap-0.5">
          <span className="text-xs font-bold text-[var(--cd-gold)]">+{ch.rewardPacks}</span>
          <span className="text-xs">📦</span>
        </div>
      )}
    </>
  )
}
