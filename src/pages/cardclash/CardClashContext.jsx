import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { cardclashService, emberService } from '../../services/database'

const CardClashContext = createContext(null)

export function CardClashProvider({ children }) {
  const { user } = useAuth()
  const passionCtx = usePassion()

  const [collection, setCollection] = useState([])
  const [stats, setStats] = useState({ packsOpened: 0, embers: 0 })
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testMode, setTestMode] = useState(true)

  // Conversion-specific state (not in PassionContext)
  const [conversionInfo, setConversionInfo] = useState({
    conversionsToday: 0, nextConversionCost: 50, conversionEmberAmount: 10,
  })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      cardclashService.load(),
      emberService.getBalance(),
    ]).then(([ccData, emberData]) => {
      if (cancelled) return
      setCollection(ccData.collection || [])
      setStats(ccData.stats || { packsOpened: 0, embers: 0 })
      setConversionInfo({
        conversionsToday: emberData.conversionsToday || 0,
        nextConversionCost: emberData.nextConversionCost || 50,
        conversionEmberAmount: emberData.conversionEmberAmount || 10,
      })
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

  const convertPassionToEmber = useCallback(async () => {
    try {
      const result = await emberService.convert()
      setConversionInfo({
        conversionsToday: result.conversionsToday,
        nextConversionCost: result.nextConversionCost,
        conversionEmberAmount: 10,
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

  return (
    <CardClashContext.Provider value={{
      collection, passion, ember: { ...ember, ...conversionInfo }, stats,
      loaded, loading, testMode, setTestMode,
      buyPack, convertPassionToEmber,
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
