import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { cardclashService, emberService } from '../../services/database'

const CardClashContext = createContext(null)

export function CardClashProvider({ children }) {
  const { user } = useAuth()
  const passionCtx = usePassion()

  const [collection, setCollection] = useState([])
  const [stats, setStats] = useState({ packsOpened: 0, embers: 0 })
  const [packTypes, setPackTypes] = useState([])
  const [salePacks, setSalePacks] = useState([])
  const [pendingTradeCount, setPendingTradeCount] = useState(0)
  const [inventory, setInventory] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [giftData, setGiftData] = useState({ sent: [], received: [], giftsRemaining: 5, giftInventory: [], unseenCount: 0 })
  const [startingFive, setStartingFive] = useState(null)
  const [defOverrides, setDefOverrides] = useState({})

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      cardclashService.load(),
      cardclashService.getDefinitionOverrides().catch(() => ({ overrides: {} })),
    ]).then(([ccData, overridesData]) => {
      if (cancelled) return
      setCollection(ccData.collection || [])
      setStats(ccData.stats || { packsOpened: 0, embers: 0 })
      setPackTypes(ccData.packTypes || [])
      setSalePacks(ccData.salePacks || [])
      setPendingTradeCount(ccData.pendingTradeCount || 0)
      setInventory(ccData.inventory || [])
      setDefOverrides(overridesData.overrides || {})
      setLoaded(true)
      setLoading(false)
    }).catch(err => {
      if (cancelled) return
      console.error('Failed to load Card Clash state:', err)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user?.id])

  const passion = passionCtx?.balance ?? 0
  const ember = passionCtx?.ember ?? { balance: 0 }

  const packTypesMap = useMemo(() => {
    const map = {}
    for (const p of packTypes) map[p.id] = p
    return map
  }, [packTypes])

  const getDefOverride = useCallback((card) => {
    const type = card.cardType || 'god'
    if (type === 'player') return null
    const id = type === 'god' ? card.godId : (card.godId || '').replace(/^(item|consumable|minion|buff)-/, '')
    return defOverrides[`${type}:${id}`] || null
  }, [defOverrides])

  const refreshCollection = useCallback(async () => {
    try {
      const ccData = await cardclashService.load()
      setCollection(ccData.collection || [])
    } catch (err) {
      console.error('Failed to refresh collection:', err)
    }
  }, [])

  const refreshGifts = useCallback(async () => {
    try {
      const data = await cardclashService.loadGifts()
      setGiftData(data)
    } catch (err) {
      console.error('Failed to load gifts:', err)
    }
  }, [])

  useEffect(() => {
    if (loaded) refreshGifts()
  }, [loaded, refreshGifts])

  const sendGift = useCallback(async (recipientId, message, packType = 'gift') => {
    const result = await cardclashService.sendGift(recipientId, message, packType)
    await refreshGifts()
    return result
  }, [refreshGifts])

  const openGift = useCallback(async (giftId) => {
    const result = await cardclashService.openGift(giftId)
    setCollection(prev => [...prev, ...result.cards])
    setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
    await refreshGifts()
    return result
  }, [refreshGifts])

  const markGiftsSeen = useCallback(async () => {
    await cardclashService.markGiftsSeen()
    setGiftData(prev => ({ ...prev, unseenCount: 0, received: prev.received.map(g => ({ ...g, seen: true })) }))
  }, [])

  const buyGiftPack = useCallback(async (packType) => {
    const result = await cardclashService.buyGiftPack(packType)
    setGiftData(prev => ({ ...prev, giftInventory: result.giftInventory }))
    passionCtx?.refreshBalance?.()
    return result
  }, [passionCtx])

  const loadStartingFive = useCallback(async () => {
    try {
      const data = await cardclashService.loadStartingFive()
      setStartingFive(data)
    } catch (err) {
      console.error('Failed to load Starting 5:', err)
    }
  }, [])

  const slotS5Card = useCallback(async (cardId, role, slotType = 'player') => {
    const data = await cardclashService.slotCard(cardId, role, slotType)
    setStartingFive(data)
    return data
  }, [])

  const unslotS5Card = useCallback(async (role) => {
    const data = await cardclashService.unslotCard(role)
    setStartingFive(data)
    return data
  }, [])

  const unslotS5Attachment = useCallback(async (role, slotType) => {
    const data = await cardclashService.unslotAttachment(role, slotType)
    setStartingFive(data)
    return data
  }, [])

  const collectS5Income = useCallback(async () => {
    const data = await cardclashService.collectIncome()
    setStartingFive(data)
    await passionCtx?.refreshBalance?.()
    return data
  }, [passionCtx])

  const boostS5WithConsumable = useCallback(async (cardId) => {
    const data = await cardclashService.useConsumable(cardId)
    setStartingFive(data)
    setCollection(prev => prev.filter(c => c.id !== data.consumedCardId))
    return data
  }, [])

  useEffect(() => {
    if (loaded) loadStartingFive()
  }, [loaded, loadStartingFive])

  const dismantleCards = useCallback(async (cardIds) => {
    const result = await cardclashService.dismantleCards(cardIds)
    setCollection(prev => prev.filter(c => !cardIds.includes(c.id)))
    passionCtx?.refreshBalance?.()
    return result
  }, [passionCtx])

  const convertPassionToEmber = useCallback(async () => {
    try {
      const result = await emberService.convert()
      passionCtx?.updateEmber?.({
        balance: result.emberBalance,
        conversionsToday: result.conversionsToday,
        nextConversionCost: result.nextConversionCost,
      })
      passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to convert passion to ember:', err)
      throw err
    }
  }, [passionCtx])

  const buyPack = useCallback(async (packType) => {
    try {
      const result = await cardclashService.openPack(packType)
      setCollection(prev => [...prev, ...result.cards])
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to open pack:', err)
      throw err
    }
  }, [passionCtx])

  const openInventoryPack = useCallback(async (inventoryId) => {
    try {
      const result = await cardclashService.openInventoryPack(inventoryId)
      setCollection(prev => [...prev, ...result.cards])
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      setInventory(prev => prev.filter(i => i.id !== inventoryId))
      passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to open inventory pack:', err)
      throw err
    }
  }, [passionCtx])

  const buySalePack = useCallback(async (saleId) => {
    try {
      const sale = salePacks.find(s => s.id === saleId)
      if (!sale) throw new Error('Sale not found')
      const result = await cardclashService.openSalePack(saleId, sale.packTypeId)
      setCollection(prev => [...prev, ...result.cards])
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      setSalePacks(prev => prev.map(s =>
        s.id === saleId ? { ...s, stock: result.stock ?? s.stock } : s
      ))
      passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to open sale pack:', err)
      throw err
    }
  }, [salePacks, passionCtx])

  return (
    <CardClashContext.Provider value={{
      collection, passion, ember, stats, packTypes, packTypesMap, salePacks,
      loaded, loading, getDefOverride,
      buyPack, buySalePack, convertPassionToEmber, dismantleCards, refreshCollection,
      claimEmberDaily: passionCtx?.claimEmberDaily,
      giftData, sendGift, openGift, markGiftsSeen, refreshGifts, buyGiftPack,
      startingFive, loadStartingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, boostS5WithConsumable,
      pendingTradeCount, setPendingTradeCount,
      inventory, openInventoryPack,
    }}>
      {children}
    </CardClashContext.Provider>
  )
}

export function useCardClash() {
  const ctx = useContext(CardClashContext)
  if (!ctx) throw new Error('useCardClash must be used within CardClashProvider')
  return ctx
}
