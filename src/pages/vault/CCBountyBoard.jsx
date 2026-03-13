import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useVault } from './VaultContext'
import { bountyService } from '../../services/database'
import { Plus, Loader2 } from 'lucide-react'
import HeroPinboard from './bounty/HeroPinboard'
import BountyGrid from './bounty/BountyGrid'
import CreateBountyForm from './bounty/CreateBountyForm'

export default function CCBountyBoard() {
  const { user } = useAuth()
  const { collection, ember, refreshCollection } = useVault()

  const [heroBounties, setHeroBounties] = useState([])
  const [bounties, setBounties] = useState([])
  const [total, setTotal] = useState(0)
  const [myBountyIds, setMyBountyIds] = useState([])
  const [fulfillableIds, setFulfillableIds] = useState([])
  const [activeBountyCount, setActiveBountyCount] = useState(0)

  const [page, setPage] = useState(0)
  const [sort, setSort] = useState('newest')
  const [filters, setFilters] = useState({})
  const [showFulfillable, setShowFulfillable] = useState(false)
  const [showMine, setShowMine] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

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
  }

  const handleFulfill = async (bountyId) => {
    const bounty = [...heroBounties, ...bounties].find(b => b.id === bountyId)
    if (!bounty) return

    const match = collection.find(c =>
      c.cardType === bounty.card_type &&
      c.godName === bounty.card_name &&
      c.rarity === bounty.rarity &&
      (!bounty.holo_type || c.holoType === bounty.holo_type)
    )
    if (!match) {
      alert('No matching unlocked card found in your collection')
      return
    }

    if (!window.confirm(`Turn in your ${bounty.rarity} ${bounty.card_name} card for ${bounty.core_reward} Cores?`)) return

    try {
      const res = await bountyService.fulfill({ bountyId, cardId: match.id })
      if (res.error) throw new Error(res.error)
      await loadAll()
      refreshCollection?.()
    } catch (e) {
      alert(e.message || 'Failed to fulfill bounty — card may be locked in a trade, lineup, binder, or listing')
    }
  }

  const handleCancel = async (bountyId) => {
    if (!window.confirm('Cancel this bounty? You will lose 25% of the escrowed Cores.')) return
    try {
      const res = await bountyService.cancel(bountyId)
      if (res.error) throw new Error(res.error)
      await loadAll()
      refreshCollection?.()
    } catch (e) {
      alert(e.message || 'Failed to cancel bounty')
    }
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
    </div>
  )
}
