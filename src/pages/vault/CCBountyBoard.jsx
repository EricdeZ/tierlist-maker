import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useVault } from './VaultContext'
import { bountyService } from '../../services/database'
import { Plus, Loader2 } from 'lucide-react'
import HeroPinboard from './bounty/HeroPinboard'
import BountyGrid from './bounty/BountyGrid'
import CreateBountyForm from './bounty/CreateBountyForm'
import BountyConfirmModal from './bounty/BountyConfirmModal'

export default function CCBountyBoard() {
  const { user } = useAuth()
  const { collection, ember, refreshCollection, refreshBalance } = useVault()

  const [heroBounties, setHeroBounties] = useState([])
  const [bounties, setBounties] = useState([])
  const [total, setTotal] = useState(0)
  const [myBountyIds, setMyBountyIds] = useState([])
  const [myBountyHistory, setMyBountyHistory] = useState([])
  const [fulfillableIds, setFulfillableIds] = useState([])
  const [activeBountyCount, setActiveBountyCount] = useState(0)

  const [page, setPage] = useState(0)
  const [sort, setSort] = useState('newest')
  const [filters, setFilters] = useState({})
  const [showFulfillable, setShowFulfillable] = useState(false)
  const [showMine, setShowMine] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null)
  const lastClickRef = useRef(null)

  const loadHero = useCallback(async () => {
    try {
      const res = await bountyService.hero()
      setHeroBounties(res.bounties || [])
    } catch (e) { console.error('hero load error:', e) }
  }, [])

  const loadBounties = useCallback(async () => {
    try {
      const params = { page: String(page), sort, ...filters }
      const res = await bountyService.list(params)
      setBounties(res.bounties || [])
      setTotal(res.total || 0)
    } catch (e) { console.error('bounty list error:', e) }
  }, [page, sort, filters])

  const loadFulfillable = useCallback(async () => {
    if (!user) return
    try {
      const res = await bountyService.fulfillable()
      setFulfillableIds(res.fulfillableIds || [])
    } catch (e) { console.error('fulfillable error:', e) }
  }, [user])

  const loadMyBounties = useCallback(async () => {
    if (!user) return
    try {
      const res = await bountyService.myBounties()
      const mine = res.bounties || []
      setMyBountyIds(mine.filter(b => b.status === 'active').map(b => b.id))
      setActiveBountyCount(mine.filter(b => b.status === 'active').length)
      setMyBountyHistory(mine.filter(b => b.status !== 'active').map(b => ({
        id: b.id,
        card_type: b.cardType,
        card_name: b.cardName,
        rarity: b.rarity,
        holo_type: b.holoType,
        core_reward: b.coreReward,
        target_god_id: b.targetGodId,
        status: b.status,
        created_at: b.createdAt,
        expires_at: b.expiresAt,
        completed_at: b.completedAt,
        cancelled_at: b.cancelledAt,
        fulfiller_name: b.fulfillerName,
      })))
    } catch (e) { console.error('my bounties error:', e) }
  }, [user])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadHero(), loadBounties(), loadFulfillable(), loadMyBounties()])
    setLoading(false)
  }, [loadHero, loadBounties, loadFulfillable, loadMyBounties])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadBounties() }, [loadBounties])

  const handleCreate = async (data) => {
    const res = await bountyService.create(data)
    if (res.error) throw new Error(res.error)
    await loadAll()
    refreshCollection?.()
    refreshBalance?.()
  }

  const handleFulfill = async (bountyId, sourceEl) => {
    const bounty = [...heroBounties, ...bounties].find(b => b.id === bountyId)
    if (!bounty) return

    const match = collection.find(c => {
      if (c.cardType !== bounty.card_type || c.rarity !== bounty.rarity) return false
      // Match on specific variant via god_id
      if (bounty.target_god_id) {
        if (c.godId !== bounty.target_god_id) return false
      } else {
        if (c.godName !== bounty.card_name) return false
      }
      // Holo matching
      if (bounty.holo_type === 'none' && c.holoType) return false
      if (bounty.holo_type === 'any_holo' && !c.holoType) return false
      if (bounty.holo_type && bounty.holo_type !== 'none' && bounty.holo_type !== 'any_holo' && c.holoType !== bounty.holo_type) return false
      return true
    })
    if (!match) {
      setConfirmModal({
        type: 'error',
        title: 'No Match Found',
        message: 'No matching unlocked card found in your collection.',
      })
      return
    }

    lastClickRef.current = sourceEl || null
    setConfirmModal({
      type: 'fulfill',
      title: 'Turn In Card',
      message: `Turn in your ${bounty.rarity} ${bounty.card_name} card?`,
      reward: bounty.core_reward,
      onConfirm: async () => {
        try {
          const res = await bountyService.fulfill({ bountyId, cardId: match.id })
          if (res.error) throw new Error(res.error)
          spawnFlyingCores(lastClickRef.current, res.reward || bounty.core_reward)
          setConfirmModal(null)
          await loadAll()
          refreshCollection?.()
          refreshBalance?.()
        } catch (e) {
          setConfirmModal({
            type: 'error',
            title: 'Turn In Failed',
            message: e.message || 'Card may be locked in a trade, lineup, binder, or listing.',
          })
        }
      },
    })
  }

  const handleCancel = async (bountyId) => {
    const bounty = [...heroBounties, ...bounties].find(b => b.id === bountyId)
    const fee = bounty ? Math.max(Math.floor(bounty.core_reward * 0.25), 1) : '25%'
    const refund = bounty ? bounty.core_reward - fee : null

    setConfirmModal({
      type: 'cancel',
      title: 'Cancel Bounty',
      message: `You will lose ${fee} Core (25% fee)${refund ? ` and get ${refund} Core refunded.` : '.'}`,
      onConfirm: async () => {
        try {
          const res = await bountyService.cancel(bountyId)
          if (res.error) throw new Error(res.error)
          setConfirmModal(null)
          await loadAll()
          refreshCollection?.()
          refreshBalance?.()
        } catch (e) {
          setConfirmModal({
            type: 'error',
            title: 'Cancel Failed',
            message: e.message || 'Failed to cancel bounty.',
          })
        }
      },
    })
  }

  let displayBounties = bounties
  if (showFulfillable) {
    displayBounties = displayBounties.filter(b => fulfillableIds.includes(b.id))
  }
  if (showMine) {
    displayBounties = displayBounties.filter(b => myBountyIds.includes(b.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: '#ff8c00' }} />
      </div>
    )
  }

  return (
    <div className="pb-12">
      {user && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowCreate(true)}
            disabled={activeBountyCount >= 3}
            className="flex items-center gap-1.5 text-xs font-bold tracking-wide px-4 py-2 rounded disabled:opacity-30"
            style={{ background: 'rgba(255,140,0,0.15)', color: '#ff8c00', border: '1px solid rgba(255,140,0,0.3)' }}
          >
            <Plus size={14} />
            POST BOUNTY ({activeBountyCount}/3)
          </button>
        </div>
      )}

      <HeroPinboard
        bounties={heroBounties}
        fulfillableIds={fulfillableIds}
        onFulfill={handleFulfill}
      />

      {heroBounties.length > 0 && (
        <div className="border-t my-6" style={{ borderColor: 'rgba(255,140,0,0.1)' }} />
      )}

      <BountyGrid
        bounties={displayBounties}
        total={showFulfillable || showMine ? displayBounties.length : total}
        page={page}
        setPage={setPage}
        filters={filters}
        setFilters={setFilters}
        sort={sort}
        setSort={setSort}
        fulfillableIds={fulfillableIds}
        myBountyIds={myBountyIds}
        myBountyHistory={myBountyHistory}
        onFulfill={handleFulfill}
        onCancel={handleCancel}
        showFulfillable={showFulfillable}
        setShowFulfillable={setShowFulfillable}
        showMine={showMine}
        setShowMine={setShowMine}
      />

      {showCreate && (
        <CreateBountyForm
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          emberBalance={ember?.balance ?? 0}
          activeBountyCount={activeBountyCount}
        />
      )}

      {confirmModal && (
        <BountyConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}

function spawnFlyingCores(sourceEl, amount) {
  const target = document.getElementById('ember-balance-icon')
  if (!target) return

  const sr = sourceEl
    ? sourceEl.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }
  const tr = target.getBoundingClientRect()
  const sx = sr.left + sr.width / 2
  const sy = sr.top + sr.height / 2
  const tx = tr.left + tr.width / 2
  const ty = tr.top + tr.height / 2

  const count = Math.min(Math.max(Math.ceil(amount / 20), 4), 12)

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div')
    const size = 5 + Math.random() * 5
    dot.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;background:#ff8c00;box-shadow:0 0 8px #ff8c00,0 0 16px rgba(255,140,0,0.4);z-index:9999;pointer-events:none;will-change:transform;`
    document.body.appendChild(dot)

    const spreadX = (Math.random() - 0.5) * 100
    const spreadY = (Math.random() - 0.5) * 40
    const startX = sx + spreadX
    const startY = sy + spreadY
    const duration = 600 + Math.random() * 400
    const delay = i * 50
    const hs = size / 2

    const anim = dot.animate([
      { transform: `translate(${startX - hs}px, ${startY - hs}px) scale(1)`, opacity: 1 },
      { transform: `translate(${tx - hs}px, ${ty - hs}px) scale(0.2)`, opacity: 0.3 },
    ], { duration, delay, easing: 'ease-in', fill: 'forwards' })

    anim.onfinish = () => dot.remove()
  }
}
