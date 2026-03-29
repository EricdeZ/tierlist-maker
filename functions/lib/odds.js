// Dynamic odds engine — composable OddsContext for rarity, holo, and card pool rolls

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']

const BASE_RARITY_WEIGHTS = {
  common: 0.60, uncommon: 0.30, rare: 0.06, epic: 0.035,
  legendary: 0.0065, mythic: 0.00075, unique: 0.00035,
}

const BASE_HOLO_WEIGHTS = { holo: 1, reverse: 1, full: 1 }

export { RARITY_ORDER }

// ════════════════════════════════════════════
// Context creation
// ════════════════════════════════════════════

export function createOddsContext(overrides = {}) {
  return {
    rarity: { ...BASE_RARITY_WEIGHTS },
    minRarity: 'common',
    maxRarity: null,
    blockedRarities: [],
    holoType: { ...BASE_HOLO_WEIGHTS },
    cardType: { god: null, item: null, consumable: null, player: null, collection: null },
    ownedDefIds: null,
    collectorBoost: 0,
    ...overrides,
  }
}

// ════════════════════════════════════════════
// Pack-level overrides
// ════════════════════════════════════════════

export function applyPackOverrides(ctx, oddsConfig) {
  if (!oddsConfig) return ctx
  const next = { ...ctx }

  if (oddsConfig.rarity) {
    next.rarity = { ...ctx.rarity }
    for (const [k, v] of Object.entries(oddsConfig.rarity)) {
      if (next.rarity[k] !== undefined && typeof v === 'number' && v >= 0) {
        next.rarity[k] = v
      }
    }
  }

  if (oddsConfig.holoType) {
    next.holoType = { ...ctx.holoType }
    for (const [k, v] of Object.entries(oddsConfig.holoType)) {
      if (next.holoType[k] !== undefined && typeof v === 'number' && v >= 0) {
        next.holoType[k] = v
      }
    }
  }

  if (oddsConfig.cardType) {
    next.cardType = { ...ctx.cardType }
    for (const [k, v] of Object.entries(oddsConfig.cardType)) {
      if (next.cardType[k] !== undefined) {
        next.cardType[k] = typeof v === 'number' && v >= 0 ? v : null
      }
    }
  }

  if (oddsConfig.minRarity && RARITY_ORDER.includes(oddsConfig.minRarity)) {
    next.minRarity = oddsConfig.minRarity
  }
  if (oddsConfig.maxRarity && RARITY_ORDER.includes(oddsConfig.maxRarity)) {
    next.maxRarity = oddsConfig.maxRarity
  }

  if (oddsConfig.typeOdds && typeof oddsConfig.typeOdds === 'object') {
    next.typeOdds = {}
    for (const [type, overrides] of Object.entries(oddsConfig.typeOdds)) {
      if (overrides?.rarity && typeof overrides.rarity === 'object') {
        next.typeOdds[type] = { rarity: {} }
        for (const [k, v] of Object.entries(overrides.rarity)) {
          if (BASE_RARITY_WEIGHTS[k] !== undefined && typeof v === 'number' && v >= 0) {
            next.typeOdds[type].rarity[k] = v
          }
        }
      }
    }
  }

  return next
}

export function getContextForType(ctx, type) {
  if (!ctx.typeOdds || !ctx.typeOdds[type]) return ctx
  const next = { ...ctx, rarity: { ...ctx.rarity } }
  for (const [k, v] of Object.entries(ctx.typeOdds[type].rarity)) {
    next.rarity[k] = v
  }
  return next
}

// ════════════════════════════════════════════
// Rarity rolling
// ════════════════════════════════════════════

export function rollRarityFromContext(ctx, minRarityOverride = null, maxRarityOverride = null) {
  const minR = minRarityOverride || ctx.minRarity || 'common'
  const maxR = maxRarityOverride || ctx.maxRarity || null
  const minIdx = RARITY_ORDER.indexOf(minR)
  const maxIdx = maxR ? RARITY_ORDER.indexOf(maxR) : RARITY_ORDER.length - 1

  const eligible = RARITY_ORDER.slice(minIdx, maxIdx + 1)
    .filter(r => !ctx.blockedRarities.includes(r))

  if (eligible.length === 0) return minR

  // Redistribute blocked weight
  let redistributed = 0
  let uniqueRedirectPct = 0
  if (ctx.blockedRarities.length > 0 && ctx._uniqueRedirectPct) {
    for (const blocked of ctx.blockedRarities) {
      redistributed += ctx.rarity[blocked] || 0
    }
    uniqueRedirectPct = ctx._uniqueRedirectPct
  }

  const weights = {}
  for (const r of eligible) {
    weights[r] = ctx.rarity[r] || 0
  }

  // Apply Unique Hunter redistribution
  if (redistributed > 0) {
    const toUnique = redistributed * uniqueRedirectPct
    const toLower = redistributed - toUnique
    if (eligible.includes('unique')) {
      weights['unique'] = (weights['unique'] || 0) + toUnique
    }
    // Spread toLower proportionally across non-unique eligible
    const lowerRarities = eligible.filter(r => r !== 'unique')
    const lowerTotal = lowerRarities.reduce((sum, r) => sum + (weights[r] || 0), 0)
    if (lowerTotal > 0) {
      for (const r of lowerRarities) {
        weights[r] += toLower * ((weights[r] || 0) / lowerTotal)
      }
    }
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return eligible[0]

  let roll = Math.random() * totalWeight
  for (const r of eligible) {
    roll -= weights[r]
    if (roll <= 0) return r
  }
  return eligible[eligible.length - 1]
}

// ════════════════════════════════════════════
// Holo type rolling
// ════════════════════════════════════════════

export function rollHoloTypeFromContext(ctx, rarity) {
  if (rarity === 'common') return null
  const types = Object.keys(ctx.holoType)
  const weights = types.map(t => ctx.holoType[t] || 0)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return types[0]

  let roll = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return types[i]
  }
  return types[types.length - 1]
}

// ════════════════════════════════════════════
// Card pool selection with Collector Boost
// ════════════════════════════════════════════

export function selectFromPool(ctx, pool, defIdField = 'id') {
  if (!pool || pool.length === 0) return null
  if (!ctx.ownedDefIds || ctx.collectorBoost <= 0) {
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // Weight un-owned higher
  const weights = pool.map(item => {
    const defId = item[defIdField]
    return ctx.ownedDefIds.has(defId) ? 1 : ctx.collectorBoost
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

// ════════════════════════════════════════════
// Card type selection from context
// ════════════════════════════════════════════

export function pickWeightedTypeFromContext(ctx, types, fallbackPoolSizes) {
  const weights = types.map(t => {
    if (ctx.cardType[t] != null) return ctx.cardType[t]
    return fallbackPoolSizes[t] || 10
  })
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return types[0]

  let roll = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return types[i]
  }
  return types[types.length - 1]
}
