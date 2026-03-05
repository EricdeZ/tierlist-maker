// Card Clash API — action-based endpoint
// GET: load state | POST: mutations (open-pack, set-lineup, battle, disenchant, etc.)

import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
  ensureStats, openPack, generateStarter, reportBattle,
  collectIncome, disenchantCard,
} from '../lib/cardclash.js'

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  const user = await requireAuth(event)
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
  }

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'load': return await handleLoad(sql, user)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'open-pack':       return await handleOpenPack(sql, user, body)
        case 'init':            return await handleInit(sql, user)
        case 'set-lineup':      return await handleSetLineup(sql, user, body)
        case 'report-battle':   return await handleReportBattle(sql, user, body)
        case 'collect-income':  return await handleCollectIncome(sql, user, body)
        case 'disenchant':      return await handleDisenchant(sql, user, body)
        case 'save-deck':       return await handleSaveDeck(sql, user, body)
        case 'delete-deck':     return await handleDeleteDeck(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('cardclash error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load full state ═══
async function handleLoad(sql, user) {
  await ensureStats(sql, user.id)

  const [collection, lineupRows, stats, decks] = await Promise.all([
    sql`SELECT * FROM cc_cards WHERE owner_id = ${user.id} ORDER BY created_at DESC`,
    sql`SELECT role, card_id FROM cc_lineups WHERE user_id = ${user.id}`,
    sql`SELECT * FROM cc_stats WHERE user_id = ${user.id}`,
    sql`SELECT * FROM cc_decks WHERE user_id = ${user.id} ORDER BY created_at DESC`,
  ])

  // Build lineup object { solo: card, jungle: card, ... }
  const lineup = { solo: null, jungle: null, mid: null, support: null, adc: null }
  for (const row of lineupRows) {
    if (row.card_id) {
      lineup[row.role] = collection.find(c => c.id === row.card_id) || null
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collection: collection.map(formatCard),
      lineup: Object.fromEntries(Object.entries(lineup).map(([k, v]) => [k, v ? formatCard(v) : null])),
      stats: formatStats(stats[0]),
      decks: decks.map(d => ({ id: d.id, name: d.name, cards: d.cards, createdAt: d.created_at })),
    }),
  }
}

// ═══ POST: Generate starter collection ═══
async function handleInit(sql, user) {
  const cards = await generateStarter(sql, user.id)
  if (!cards) return { statusCode: 200, headers, body: JSON.stringify({ cards: null, message: 'Already has cards' }) }
  return { statusCode: 200, headers, body: JSON.stringify({ cards: cards.map(formatCard) }) }
}

// ═══ POST: Open pack ═══
async function handleOpenPack(sql, user, body) {
  const { packType, testMode } = body
  const result = await openPack(sql, user.id, packType, !!testMode)
  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    cards: result.cards.map(formatCard),
  }) }
}

// ═══ POST: Set lineup card ═══
async function handleSetLineup(sql, user, body) {
  const { role, cardId } = body
  if (!['solo', 'jungle', 'mid', 'support', 'adc'].includes(role)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid role' }) }
  }

  if (cardId) {
    // Verify ownership
    const [card] = await sql`SELECT id FROM cc_cards WHERE id = ${cardId} AND owner_id = ${user.id}`
    if (!card) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card not found' }) }
  }

  await sql`
    INSERT INTO cc_lineups (user_id, role, card_id) VALUES (${user.id}, ${role}, ${cardId || null})
    ON CONFLICT (user_id, role) DO UPDATE SET card_id = ${cardId || null}
  `

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Report battle result ═══
async function handleReportBattle(sql, user, body) {
  const { mode, isWinner, testMode } = body
  const result = await reportBattle(sql, user.id, mode || 'quick', !!isWinner, !!testMode)
  return { statusCode: 200, headers, body: JSON.stringify({
    stats: formatStats(result.stats),
    eloChange: result.eloChange,
    passionChange: result.passionChange,
  }) }
}

// ═══ POST: Collect income ═══
async function handleCollectIncome(sql, user, body) {
  const { testMode } = body
  const result = await collectIncome(sql, user.id, !!testMode)
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

// ═══ POST: Disenchant card ═══
async function handleDisenchant(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  const result = await disenchantCard(sql, user.id, cardId)
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

// ═══ POST: Save deck ═══
async function handleSaveDeck(sql, user, body) {
  const { deck } = body
  if (!deck?.name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Deck name required' }) }

  if (deck.id) {
    // Update existing
    await sql`UPDATE cc_decks SET name = ${deck.name}, cards = ${JSON.stringify(deck.cards)} WHERE id = ${deck.id} AND user_id = ${user.id}`
  } else {
    // Create new
    await sql`INSERT INTO cc_decks (user_id, name, cards) VALUES (${user.id}, ${deck.name}, ${JSON.stringify(deck.cards)})`
  }

  const decks = await sql`SELECT * FROM cc_decks WHERE user_id = ${user.id} ORDER BY created_at DESC`
  return { statusCode: 200, headers, body: JSON.stringify({
    decks: decks.map(d => ({ id: d.id, name: d.name, cards: d.cards, createdAt: d.created_at })),
  }) }
}

// ═══ POST: Delete deck ═══
async function handleDeleteDeck(sql, user, body) {
  const { deckId } = body
  if (!deckId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'deckId required' }) }
  await sql`DELETE FROM cc_decks WHERE id = ${deckId} AND user_id = ${user.id}`
  const decks = await sql`SELECT * FROM cc_decks WHERE user_id = ${user.id} ORDER BY created_at DESC`
  return { statusCode: 200, headers, body: JSON.stringify({
    decks: decks.map(d => ({ id: d.id, name: d.name, cards: d.cards, createdAt: d.created_at })),
  }) }
}

// ═══ Formatters ═══
function formatCard(row) {
  return {
    id: row.id,
    godId: row.god_id,
    godName: row.god_name,
    godClass: row.god_class,
    role: row.role,
    rarity: row.rarity,
    power: row.power,
    level: row.level,
    xp: row.xp,
    serialNumber: row.serial_number,
    holoEffect: row.holo_effect,
    imageUrl: row.image_url,
    ability: row.ability,
    acquiredVia: row.acquired_via,
    acquiredAt: row.created_at,
  }
}

function formatStats(row) {
  if (!row) return { elo: 1000, wins: 0, losses: 0, streak: 0, bestStreak: 0, packsOpened: 0, embers: 0 }
  return {
    elo: row.elo,
    wins: row.wins,
    losses: row.losses,
    streak: row.streak,
    bestStreak: row.best_streak,
    packsOpened: row.packs_opened,
    embers: row.embers,
  }
}

export const onRequest = adapt(handler)
