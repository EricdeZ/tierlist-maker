import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { cardclashService } from '../../services/database'

const CardClashContext = createContext(null)

export function CardClashProvider({ children }) {
  const { user } = useAuth()
  const passionCtx = usePassion()

  const [collection, setCollection] = useState([])
  const [lineup, setLineup] = useState({ solo: null, jungle: null, mid: null, support: null, adc: null })
  const [stats, setStats] = useState({ elo: 1000, wins: 0, losses: 0, streak: 0, bestStreak: 0, packsOpened: 0, embers: 0 })
  const [decks, setDecks] = useState([])
  const [lastCollected, setLastCollected] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testMode, setTestMode] = useState(true)

  // Load state from API when user is available
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    cardclashService.load().then(data => {
      if (cancelled) return
      setCollection(data.collection || [])
      setLineup(data.lineup || { solo: null, jungle: null, mid: null, support: null, adc: null })
      setStats(data.stats || { elo: 1000, wins: 0, losses: 0, streak: 0, bestStreak: 0, packsOpened: 0, embers: 0 })
      setDecks(data.decks || [])
      setLastCollected(data.stats?.lastCollected || null)
      setLoaded(true)
      setLoading(false)
    }).catch(err => {
      if (cancelled) return
      console.error('Failed to load Card Clash state:', err)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Derived values
  const passion = passionCtx?.balance ?? 0
  const embers = stats.embers || 0
  const elo = stats.elo || 1000

  // ═══ Actions ═══

  const generateStarterCollection = useCallback(async () => {
    if (collection.length > 0) return
    try {
      const data = await cardclashService.init()
      if (data.cards) setCollection(data.cards)
      return data.cards
    } catch (err) {
      console.error('Failed to generate starter:', err)
    }
  }, [collection.length])

  const buyPack = useCallback(async (packType) => {
    try {
      const result = await cardclashService.openPack(packType, testMode)
      setCollection(prev => [...prev, ...result.cards])
      setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
      if (!testMode) passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to open pack:', err)
      throw err
    }
  }, [testMode, passionCtx])

  const setLineupCard = useCallback(async (role, cardId) => {
    // Optimistic update
    const card = cardId ? collection.find(c => c.id === cardId) : null
    setLineup(prev => ({ ...prev, [role]: card }))
    try {
      await cardclashService.setLineup(role, cardId)
    } catch (err) {
      console.error('Failed to set lineup:', err)
    }
  }, [collection])

  const reportBattle = useCallback(async (mode, isWinner) => {
    try {
      const result = await cardclashService.reportBattle(mode, isWinner, testMode)
      setStats(result.stats)
      if (!testMode) passionCtx?.refreshBalance?.()
      return result
    } catch (err) {
      console.error('Failed to report battle:', err)
      throw err
    }
  }, [testMode, passionCtx])

  const collectIncome = useCallback(async () => {
    try {
      const result = await cardclashService.collectIncome(testMode)
      if (result.amount > 0) {
        setLastCollected(Date.now())
        if (!testMode) passionCtx?.refreshBalance?.()
      }
      return result.amount || 0
    } catch (err) {
      console.error('Failed to collect income:', err)
      return 0
    }
  }, [testMode, passionCtx])

  const disenchantCard = useCallback(async (cardId) => {
    try {
      const result = await cardclashService.disenchant(cardId)
      setCollection(prev => prev.filter(c => c.id !== cardId))
      setStats(prev => ({ ...prev, embers: prev.embers + result.embersGained }))
      // Clear from lineup if present
      setLineup(prev => {
        const updated = { ...prev }
        for (const role of Object.keys(updated)) {
          if (updated[role]?.id === cardId) updated[role] = null
        }
        return updated
      })
      return result.embersGained
    } catch (err) {
      console.error('Failed to disenchant:', err)
      return 0
    }
  }, [])

  const saveDeck = useCallback(async (deck) => {
    try {
      const result = await cardclashService.saveDeck(deck)
      setDecks(result.decks)
    } catch (err) {
      console.error('Failed to save deck:', err)
    }
  }, [])

  const deleteDeck = useCallback(async (deckId) => {
    try {
      const result = await cardclashService.deleteDeck(deckId)
      setDecks(result.decks)
    } catch (err) {
      console.error('Failed to delete deck:', err)
    }
  }, [])

  return (
    <CardClashContext.Provider value={{
      collection, lineup, embers, passion, elo, decks, stats, lastCollected,
      loaded, loading, testMode, setTestMode,
      buyPack, setLineupCard, collectIncome, disenchantCard,
      generateStarterCollection, saveDeck, deleteDeck,
      reportBattle,
      // Legacy: expose updateElo/updatePassion/updateStats as no-ops for any pages that still reference them
      updateElo: () => {}, updatePassion: () => {}, updateStats: () => {},
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
