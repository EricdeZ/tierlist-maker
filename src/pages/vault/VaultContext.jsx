import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { vaultService, emberService } from '../../services/database'

const VaultContext = createContext(null)
const EMPTY_EMBER = { balance: 0 }

export function VaultProvider({ children }) {
  const { user } = useAuth()
  const passionCtx = usePassion()

  const [collection, setCollection] = useState([])
  const [stats, setStats] = useState({ packsOpened: 0, embers: 0 })
  const [packTypes, setPackTypes] = useState([])
  const [salePacks, setSalePacks] = useState([])
  const [pendingTradeCount, setPendingTradeCount] = useState(0)
  const [pendingSignatureCount, setPendingSignatureCount] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [inventory, setInventory] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [giftData, setGiftData] = useState({ sent: [], received: [], giftsRemaining: 5, giftInventory: [], unseenCount: 0 })
  const [startingFive, setStartingFive] = useState(null)
  const [defOverrides, setDefOverrides] = useState({})
  const [binder, setBinder] = useState(null)
  const [binderCards, setBinderCards] = useState([])
  const [templateCache, setTemplateCache] = useState({})
  const [vaultBanned, setVaultBanned] = useState(false)
  const [accountTooNew, setAccountTooNew] = useState(null)
  const [vendingCooldownEnd, setVendingCooldownEndRaw] = useState(() => {
    try {
      const saved = localStorage.getItem('vendingCooldownEnd')
      if (saved) {
        const end = Number(saved)
        if (end > Date.now()) return end
        localStorage.removeItem('vendingCooldownEnd')
      }
    } catch {}
    return null
  })
  const setVendingCooldownEnd = useCallback((val) => {
    try {
      if (val) localStorage.setItem('vendingCooldownEnd', String(val))
      else localStorage.removeItem('vendingCooldownEnd')
    } catch {}
    setVendingCooldownEndRaw(val)
  }, [])
  const [lockedCardIds, setLockedCardIds] = useState([])

  // Refs for stable callbacks — avoids recreating callbacks when passionCtx/startingFive change
  const passionCtxRef = useRef(passionCtx)
  passionCtxRef.current = passionCtx
  const startingFiveRef = useRef(startingFive)
  startingFiveRef.current = startingFive
  const delayedRefreshTimer = useRef(null)

  // Refresh balance now + again after 3s to catch fire-and-forget challenge progress on the backend
  const refreshBalanceWithRetry = useCallback(() => {
    passionCtxRef.current?.refreshBalance?.()
    clearTimeout(delayedRefreshTimer.current)
    delayedRefreshTimer.current = setTimeout(() => passionCtxRef.current?.refreshBalance?.(), 3000)
  }, [])
  useEffect(() => () => clearTimeout(delayedRefreshTimer.current), [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      vaultService.load(),
      vaultService.getDefinitionOverrides().catch(() => ({ overrides: {} })),
    ]).then(([ccData, overridesData]) => {
      if (cancelled) return
      if (ccData.vault_banned) { setVaultBanned(true); setLoading(false); return }
      if (ccData.account_too_new) { setAccountTooNew(ccData.days_left); setLoading(false); return }
      setCollection(ccData.collection || [])
      setTemplateCache(ccData.templateCache || {})
      setStats(ccData.stats || { packsOpened: 0, embers: 0 })
      setPackTypes(ccData.packTypes || [])
      setSalePacks(ccData.salePacks || [])
      setPendingTradeCount(ccData.pendingTradeCount || 0)
      setPendingSignatureCount(ccData.pendingSignatureCount || 0)
      setPendingApprovalCount(ccData.pendingApprovalCount || 0)
      setInventory(ccData.inventory || [])
      setLockedCardIds(ccData.lockedCardIds || [])
      if (ccData.vendingCooldown > 0) {
        setVendingCooldownEnd(Date.now() + ccData.vendingCooldown * 1000)
      }
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
  const ember = passionCtx?.ember || EMPTY_EMBER

  const packTypesMap = useMemo(() => {
    const map = {}
    for (const p of packTypes) map[p.id] = p
    return map
  }, [packTypes])

  const getDefOverride = useCallback((card) => {
    const type = card.cardType || 'god'
    if (type === 'player') return null
    const id = type === 'god' ? card.godId : (card.godId || '').replace(/^(item|consumable|minion|buff)-/, '')
    let override = defOverrides[`${type}:${id}`]
    if (!override && type === 'god') {
      const baseSlug = id.replace(/-(solo|jungle|mid|support|adc)$/, '')
      if (baseSlug !== id) override = defOverrides[`god:${baseSlug}`]
    }
    return override || null
  }, [defOverrides])

  const getTemplate = useCallback((templateId) => {
    return templateCache[templateId] || null
  }, [templateCache])

  const refreshCollection = useCallback(async () => {
    try {
      const ccData = await vaultService.load()
      setCollection(ccData.collection || [])
    } catch (err) {
      console.error('Failed to refresh collection:', err)
    }
  }, [])

  const refreshSalePacks = useCallback(async () => {
    try {
      const ccData = await vaultService.load()
      setSalePacks(ccData.salePacks || [])
    } catch (err) {
      console.error('Failed to refresh sale packs:', err)
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
    refreshBalanceWithRetry()
    return result
  }, [refreshGifts, refreshBalanceWithRetry])

  const mergeInlineTemplates = useCallback((cards) => {
    const newTemplates = {}
    for (const card of cards) {
      if (card._templateData && card.templateId) {
        newTemplates[card.templateId] = card._templateData
      }
    }
    if (Object.keys(newTemplates).length > 0) {
      setTemplateCache(prev => ({ ...prev, ...newTemplates }))
    }
  }, [])

  const openGift = useCallback(async (giftId) => {
    const result = await vaultService.openGift(giftId)
    setCollection(prev => [...prev, ...result.cards])
    mergeInlineTemplates(result.cards)
    setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
    await refreshGifts()
    refreshBalanceWithRetry()
    return result
  }, [refreshGifts, refreshBalanceWithRetry, mergeInlineTemplates])

  const markGiftsSeen = useCallback(async () => {
    await vaultService.markGiftsSeen()
    setGiftData(prev => ({ ...prev, unseenCount: 0, received: prev.received.map(g => ({ ...g, seen: true })) }))
  }, [])

  const buyGiftPack = useCallback(async (packType) => {
    const result = await vaultService.buyGiftPack(packType)
    setGiftData(prev => ({ ...prev, giftInventory: result.giftInventory }))
    refreshBalanceWithRetry()
    return result
  }, [refreshBalanceWithRetry])

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

  // Sync card roles from S5 data back to collection (S5 data is fresh from DB)
  const syncS5RolesToCollection = useCallback((s5Data) => {
    const roleUpdates = new Map()
    const extractFromSlots = (slots) => {
      if (!slots) return
      for (const slotData of Object.values(slots)) {
        if (slotData?.card?.id && slotData.card.role) {
          roleUpdates.set(slotData.card.id, slotData.card.role)
        }
      }
    }
    extractFromSlots(s5Data?.currentSeason?.slots)
    extractFromSlots(s5Data?.allStar?.slots)
    if (roleUpdates.size === 0) return
    setCollection(prev => {
      let changed = false
      const next = prev.map(c => {
        const freshRole = roleUpdates.get(c.id)
        if (freshRole && freshRole !== c.role) {
          changed = true
          return { ...c, role: freshRole }
        }
        return c
      })
      return changed ? next : prev
    })
  }, [])

  const loadStartingFive = useCallback(async () => {
    try {
      const data = await vaultService.loadStartingFive()
      setStartingFive(data)
      syncS5RolesToCollection(data)
    } catch (err) {
      console.error('Failed to load Starting 5:', err)
    }
  }, [syncS5RolesToCollection])

  const slotS5Card = useCallback(async (cardId, role, slotType = 'player', lineupType = 'current') => {
    const data = await vaultService.slotCard(cardId, role, slotType, lineupType)
    setStartingFive(data)
    refreshBalanceWithRetry()
    return data
  }, [refreshBalanceWithRetry])

  const unslotS5Card = useCallback(async (role, lineupType = 'current') => {
    const data = await vaultService.unslotCard(role, lineupType)
    setStartingFive(data)
    refreshBalanceWithRetry()
    return data
  }, [refreshBalanceWithRetry])

  const unslotS5Attachment = useCallback(async (role, slotType, lineupType = 'current') => {
    const data = await vaultService.unslotAttachment(role, slotType, lineupType)
    setStartingFive(data)
    refreshBalanceWithRetry()
    return data
  }, [refreshBalanceWithRetry])

  const collectS5Income = useCallback(async () => {
    const data = await vaultService.collectIncome()
    setStartingFive(data)
    refreshBalanceWithRetry()
    return data
  }, [refreshBalanceWithRetry])

  const slotS5Consumable = useCallback(async (cardId) => {
    const prevConsumableId = startingFiveRef.current?.consumableCard?.id
    const data = await vaultService.slotConsumable(cardId)
    setStartingFive(data)
    setCollection(prev => prev.filter(c => c.id !== cardId && c.id !== prevConsumableId))
    refreshBalanceWithRetry()
    return data
  }, [refreshBalanceWithRetry])

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
      setStats(prev => ({ ...prev, dismantledToday: result.dismantledToday, dismantledValueToday: result.dismantledValueToday ?? prev.dismantledValueToday }))
    }
    refreshBalanceWithRetry()
    return result
  }, [refreshBalanceWithRetry])

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
      passionCtxRef.current?.updateEmber?.({
        balance: result.emberBalance,
        conversionsToday: result.conversionsToday,
        nextConversionCost: result.nextConversionCost,
      })
      refreshBalanceWithRetry()
      return result
    } catch (err) {
      console.error('Failed to convert passion to ember:', err)
      throw err
    }
  }, [refreshBalanceWithRetry])

  const buyPacksToInventory = useCallback(async (packType, quantity) => {
    try {
      const result = await vaultService.buyPacksToInventory(packType, quantity)
      setInventory(prev => [...prev, ...result.inventory])
      refreshBalanceWithRetry()
      return result
    } catch (err) {
      console.error('Failed to buy packs to inventory:', err)
      throw err
    }
  }, [refreshBalanceWithRetry])

  const buyPack = useCallback(async (packType) => {
    try {
      const result = await vaultService.openPack(packType)
      setCollection(prev => [...prev, ...result.cards])
      mergeInlineTemplates(result.cards)
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      refreshBalanceWithRetry()
      return result
    } catch (err) {
      console.error('Failed to open pack:', err)
      throw err
    }
  }, [refreshBalanceWithRetry, mergeInlineTemplates])

  const openInventoryPack = useCallback(async (inventoryId) => {
    try {
      const result = await vaultService.openInventoryPack(inventoryId)
      setCollection(prev => [...prev, ...result.cards])
      mergeInlineTemplates(result.cards)
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      setInventory(prev => prev.filter(i => i.id !== inventoryId))
      refreshBalanceWithRetry()
      return result
    } catch (err) {
      console.error('Failed to open inventory pack:', err)
      throw err
    }
  }, [refreshBalanceWithRetry, mergeInlineTemplates])

  const buySalePack = useCallback(async (saleId) => {
    try {
      const sale = salePacks.find(s => s.id === saleId)
      if (!sale) throw new Error('Sale not found')
      const result = await vaultService.openSalePack(saleId, sale.packTypeId)
      setCollection(prev => [...prev, ...result.cards])
      mergeInlineTemplates(result.cards)
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      setSalePacks(prev => prev.map(s =>
        s.id === saleId ? { ...s, stock: result.stock ?? s.stock } : s
      ))
      setVendingCooldownEnd(Date.now() + 45000)
      refreshBalanceWithRetry()
      return result
    } catch (err) {
      console.error('Failed to open sale pack:', err)
      throw err
    }
  }, [salePacks, refreshBalanceWithRetry, mergeInlineTemplates])

  // Stable wrappers for passionCtx methods — avoids context value changing when PassionContext updates
  const refreshBalance = refreshBalanceWithRetry
  const claimEmberDaily = useCallback(() => passionCtxRef.current?.claimEmberDaily?.(), [])

  const value = useMemo(() => ({
    collection, passion, ember, stats, packTypes, packTypesMap, salePacks,
    loaded, loading, vaultBanned, accountTooNew, getDefOverride, templateCache, getTemplate,
    buyPack, buyPacksToInventory, buySalePack, convertPassionToEmber, dismantleCards, blackMarketTurnIn, blackMarketClaimMythic, refreshCollection, refreshSalePacks, refreshBalance, claimEmberDaily,
    giftData, sendGift, openGift, markGiftsSeen, refreshGifts, buyGiftPack,
    startingFive, loadStartingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, slotS5Consumable,
    binder, binderCards, loadBinder, saveBinder, binderSlotCard, binderUnslotCard, binderGenerateShare,
    pendingTradeCount, setPendingTradeCount,
    pendingSignatureCount, setPendingSignatureCount,
    pendingApprovalCount, setPendingApprovalCount,
    inventory, openInventoryPack,
    vendingCooldownEnd, setVendingCooldownEnd,
    lockedCardIds,
  }), [
    collection, passion, ember, stats, packTypes, packTypesMap, salePacks,
    loaded, loading, vaultBanned, accountTooNew, getDefOverride, templateCache, getTemplate,
    buyPack, buyPacksToInventory, buySalePack, convertPassionToEmber, dismantleCards, blackMarketTurnIn, blackMarketClaimMythic, refreshCollection, refreshSalePacks, refreshBalance, claimEmberDaily,
    giftData, sendGift, openGift, markGiftsSeen, refreshGifts, buyGiftPack,
    startingFive, loadStartingFive, slotS5Card, unslotS5Card, unslotS5Attachment, collectS5Income, slotS5Consumable,
    binder, binderCards, loadBinder, saveBinder, binderSlotCard, binderUnslotCard, binderGenerateShare,
    pendingTradeCount, pendingSignatureCount, pendingApprovalCount, inventory, openInventoryPack,
    vendingCooldownEnd, lockedCardIds,
  ])

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}
