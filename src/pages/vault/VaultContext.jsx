import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { vaultService, emberService } from '../../services/database'

const VaultContext = createContext(null)

export function VaultProvider({ children }) {
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
  const [binder, setBinder] = useState(null)
  const [binderCards, setBinderCards] = useState([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      vaultService.load(),
      vaultService.getDefinitionOverrides().catch(() => ({ overrides: {} })),
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
      const ccData = await vaultService.load()
      setCollection(ccData.collection || [])
    } catch (err) {
      console.error('Failed to refresh collection:', err)
    }
  }, [])

  const refreshGifts = useCallback(async () => {
    try {
      const data = await vaultService.loadGifts()
      setGiftData(data)
    } catch (err) {
      console.error('Failed to load gifts:', err)
    }
  }, [])

  useEffect(() => {
    if (loaded) refreshGifts()
  }, [loaded, refreshGifts])

  const sendGift = useCallback(async (recipientId, message, packType = 'gift') => {
    const result = await vaultService.sendGift(recipientId, message, packType)
    await refreshGifts()
    return result
  }, [refreshGifts])

  const openGift = useCallback(async (giftId) => {
    const result = await vaultService.openGift(giftId)
    setCollection(prev => [...prev, ...result.cards])
    setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
    await refreshGifts()
    return result
  }, [refreshGifts])

  const markGiftsSeen = useCallback(async () => {
    await vaultService.markGiftsSeen()
    setGiftData(prev => ({ ...prev, unseenCount: 0, received: prev.received.map(g => ({ ...g, seen: true })) }))
  }, [])

  const buyGiftPack = useCallback(async (packType) => {
    const result = await vaultService.buyGiftPack(packType)
    setGiftData(prev => ({ ...prev, giftInventory: result.giftInventory }))
    passionCtx?.refreshBalance?.()
    return result
  }, [passionCtx])

  const loadBinder = useCallback(async () => {
    try {
      const data = await vaultService.loadBinder()
      setBinder(data.binder)
      setBinderCards(data.cards || [])
    } catch (err) {
      console.error('Failed to load binder:', err)
    }
  }, [])

  const saveBinder = useCallback(async (name, color) => {
    await vaultService.saveBinder(name, color)
    setBinder(prev => ({ ...prev, name, color }))
  }, [])

  const binderSlotCard = useCallback(async (cardId, page, slot) => {
    await vaultService.binderSlot(cardId, page, slot)
    await loadBinder()
  }, [loadBinder])

  const binderUnslotCard = useCallback(async (page, slot) => {
    await vaultService.binderUnslot(page, slot)
    setBinderCards(prev => prev.filter(c => !(c.page === page && c.slot === slot)))
  }, [])

  const binderGenerateShare = useCallback(async () => {
    const data = await vaultService.binderGenerateShare()
    setBinder(prev => ({ ...prev, shareToken: data.shareToken }))
    return data.shareToken
  }, [])

  const loadStartingFive = useCallback(async () => {
    try {
      const data = await vaultService.loadStartingFive()
      setStartingFive(data)
    } catch (err) {
      console.error('Failed to load Starting 5:', err)
    }
  }, [])

  const slotS5Card = useCallback(async (cardId, role, slotType = 'player') => {
    const data = await vaultService.slotCard(cardId, role, slotType)
    setStartingFive(data)
    return data
  }, [])

  const unslotS5Card = useCallback(async (role) => {
    const data = await vaultService.unslotCard(role)
    setStartingFive(data)
    return data
  }, [])

  const unslotS5Attachment = useCallback(async (role, slotType) => {
    const data = await vaultService.unslotAttachment(role, slotType)
    setStartingFive(data)
    return data
  }, [])

  const collectS5Income = useCallback(async () => {
    const data = await vaultService.collectIncome()
    setStartingFive(data)
    await passionCtx?.refreshBalance?.()
    return data
  }, [passionCtx])

  const boostS5WithConsumable = useCallback(async (cardId) => {
    const data = await vaultService.useConsumable(cardId)
    setStartingFive(data)
    setCollection(prev => prev.filter(c => c.id !== data.consumedCardId))
    return data
  }, [])

  useEffect(() => {
    if (loaded) {
      loadStartingFive()
      loadBinder()
    }
  }, [loaded, loadStartingFive, loadBinder])

  const dismantleCards = useCallback(async (cardIds) => {
    const result = await vaultService.dismantleCards(cardIds)
    setCollection(prev => prev.filter(c => !cardIds.includes(c.id)))
    if (result.dismantledToday != null) {
      setStats(prev => ({ ...prev, dismantledToday: result.dismantledToday }))
    }
    passionCtx?.refreshBalance?.()
    return result
  }, [passionCtx])

  const blackMarketTurnIn = useCallback(async (cardId) => {
    const result = await vaultService.blackMarketTurnIn(cardId)
    setCollection(prev => prev.filter(c => c.id !== cardId))
    setStats(prev => ({
      ...prev,
      brudihsTurnedIn: (prev.brudihsTurnedIn || 0) + 1,
      pendingMythicClaim: result.reward?.type === 'mythic_choice'
        ? (prev.pendingMythicClaim || 0) + 1
        : prev.pendingMythicClaim,
    }))
    if (result.reward?.type === 'packs') {
      const loadResult = await vaultService.load()
      setInventory(loadResult.inventory || [])
    }
    return result
  }, [])

  const blackMarketClaimMythic = useCallback(async (data) => {
    const result = await vaultService.blackMarketClaimMythic(data)
    if (result.card) {
      setCollection(prev => [result.card, ...prev])
    }
    setStats(prev => ({
      ...prev,
      pendingMythicClaim: Math.max(0, (prev.pendingMythicClaim || 0) - 1),
    }))
    return result
  }, [])

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

  const buyPacksToInventory = useCallback(async (packType, quantity) => {
    try {
      const result = await vaultService.buyPacksToInventory(packType, quantity)
      setInventory(prev => [...prev, ...result.inventory])
      passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to buy packs to inventory:', err)
      throw err
    }
  }, [passionCtx])

  const buyPack = useCallback(async (packType) => {
    try {
      const result = await vaultService.openPack(packType)
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
      const result = await vaultService.openInventoryPack(inventoryId)
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
      const result = await vaultService.openSalePack(saleId, sale.packTypeId)
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
    <VaultContext.Provider value={{
      collection, passion, ember, stats, packTypes, packTypesMap, salePacks,
      loaded, loading, getDefOverride,
      buyPack, buyPacksToInventory, buySalePack, convertPassionToEmber, dismantleCards, blackMarketTurnIn, blackMarketClaimMythic, refreshCollection, refreshBalance: passionCtx?.refreshBalance,
      claimEmberDaily: passionCtx?.claimEmberDaily,
      giftData, sendGift, openGift, markGiftsSeen, refreshGifts, buyGiftPack,
      startingFive, loadStartingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, boostS5WithConsumable,
      binder, binderCards, loadBinder, saveBinder, binderSlotCard, binderUnslotCard, binderGenerateShare,
      pendingTradeCount, setPendingTradeCount,
      inventory, openInventoryPack,
    }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}
