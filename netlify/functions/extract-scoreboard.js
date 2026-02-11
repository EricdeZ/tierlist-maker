/* global process */
import { getDB, adminHeaders as headers } from './lib/db.js'
import { requirePermission } from './lib/auth.js'

// Netlify function config — Sonnet needs more time than the 10s default
export const config = {
    maxDuration: 60,
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are a data extraction bot that reads SMITE 2 post-game DETAILS tab screenshots.

CRITICAL RULE FOR GOD NAMES:
- Each player has an ALL-CAPS text label directly below their player name (e.g., "RA", "HOU YI", "BELLONA", "AGNI"). This text label IS the god name.
- The square images above each player are PLAYER PROFILE PICTURES (like Discord avatars). They are chosen by the player and have NOTHING to do with which god was played. These images are deliberately misleading — they often depict a completely different character. You MUST ignore them.
- The ONLY way to determine which god a player used is to read the ALL-CAPS TEXT LABEL. Read it character by character.
- A god name might be as short as 2-3 characters (e.g., "RA", "SOL", "NUT"). Do not skip or misread short names.
- You will be given a list of valid god names. You MUST return a name from that list. If the text you read is not an exact match, pick the closest name from the list.
- NEVER return a god name that is not on the provided list.
- DUPLICATE GODS ARE IMPOSSIBLE. If you find yourself writing the same god twice, you misread a text label — go back and re-read it.`

const EXTRACTION_PROMPT = `Extract ALL player stats from this DETAILS tab screenshot.

The DETAILS tab shows two teams side by side:
- LEFT side (blue tint) = 5 players
- RIGHT side (red tint) = 5 players
- Column labels are in the CENTER between the two sides

Each player has their name and god shown at the top. Below that are rows of stats.

The 12 stat rows (in order from top to bottom) are:
 Row 1:  PLAYER LEVEL
 Row 2:  KDA — shown as "K/D/A" format (e.g., "8/3/10")
 Row 3:  GPM (gold per minute)
 Row 4:  PLAYER DAMAGE
 Row 5:  MINION DAMAGE (ignore — do NOT use this)
 Row 6:  JUNGLE DAMAGE (ignore — do NOT use this)
 Row 7:  STRUCTURE DAMAGE
 Row 8:  DAMAGE TAKEN (ignore — do NOT use this)
 Row 9:  DAMAGE MITIGATED ← this is the "mitigated" field
 Row 10: SELF HEALING (ignore)
 Row 11: ALLY HEALING (ignore)
 Row 12: WARDS PLACED

CRITICAL FIELD MAPPING — read carefully:
- "player_damage" = Row 4 (PLAYER DAMAGE) — typically 5,000–40,000
- "mitigated"     = Row 9 (DAMAGE MITIGATED) — typically 4,000–25,000. This is NOT minion damage. Count down to row 9.
- "structure_damage" = Row 7 (STRUCTURE DAMAGE)

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "left_players": [
    {
      "player_name": "...",
      "god_text_read": "...",
      "god_played": "...",
      "level": 20,
      "kills": 0,
      "deaths": 0,
      "assists": 0,
      "gpm": 0,
      "player_damage": 0,
      "mitigated": 0,
      "structure_damage": 0
    }
  ],
  "right_players": [
    {
      "player_name": "...",
      "god_text_read": "...",
      "god_played": "...",
      "level": 20,
      "kills": 0,
      "deaths": 0,
      "assists": 0,
      "gpm": 0,
      "player_damage": 0,
      "mitigated": 0,
      "structure_damage": 0
    }
  ]
}

IMPORTANT:
- Players on the LEFT side are listed left-to-right (leftmost player first)
- Players on the RIGHT side are listed left-to-right (leftmost player first)
- Extract player names EXACTLY as displayed (preserve capitalization, special characters, dashes)
- For god_played: The square images are PLAYER PROFILE PICTURES, not gods — ignore them completely. Each player's column reads top-to-bottom: profile picture, player name, god name (ALL-CAPS TEXT LABEL), then stats. Read the god name text label character by character. First write the raw text you see in "god_text_read", then match it to the VALID GOD NAMES list for "god_played".
- DUPLICATE GODS ARE IMPOSSIBLE: Each god appears AT MOST ONCE across all 10 players.
- KDA is shown as a single string like "8/4/8" — split into kills=8, deaths=4, assists=8
- All number values are integers. Numbers may have commas (e.g., "33,137" = 33137). Remove commas.
- Some cells may have a star icon or be highlighted in yellow/gold — ignore styling, just read the number
- Wards Placed row may be partially cut off at bottom — extract what you can see
- DOUBLE CHECK: "mitigated" must come from Row 9 (DAMAGE MITIGATED), NOT Row 5 (MINION DAMAGE)`

const TEXT_PARSE_PROMPT = `Parse this match report text and extract the match metadata.

The text is from a Discord post about a SMITE 2 competitive match. Extract:
- team1_name: First team mentioned
- team2_name: Second team mentioned  
- winner_name: Which team won (look for phrases like "X wins", "X in 3", "X 2-1", team abbreviations, etc.)
- team1_wins: Number of games team1 won
- team2_wins: Number of games team2 won
- best_of: Total games in the series (usually 3)

Return ONLY valid JSON, no markdown:
{
  "team1_name": "...",
  "team2_name": "...",
  "winner_name": "...",
  "team1_wins": 0,
  "team2_wins": 0,
  "best_of": 3
}

If you can't determine a value, use null. Be flexible with team name formats — Discord posts may use abbreviations, @mentions, or shorthand.`

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'match_report')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) }
    }

    try {
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required' }) }
        }

        let parsed
        try {
            parsed = JSON.parse(event.body)
        } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body' }) }
        }

        const { images, match_text } = parsed

        if (!images || !Array.isArray(images) || images.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No images provided' }),
            }
        }

        // Payload limits
        const MAX_IMAGES = 10
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB per image (base64)
        if (images.length > MAX_IMAGES) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: `Too many images (max ${MAX_IMAGES})` }) }
        }
        for (let i = 0; i < images.length; i++) {
            if (images[i].data && images[i].data.length > MAX_IMAGE_SIZE) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Image ${i + 1} exceeds 5MB size limit` }) }
            }
        }

        // 0. Fetch valid god names from DB upfront
        const sql = getDB()
        const gods = await sql`SELECT id, name, slug, image_url FROM gods`
        const godNames = gods.map(g => g.name)

        // 1. Parse the match text to get team names and result
        let matchMeta = null
        if (match_text) {
            matchMeta = await parseMatchText(apiKey, match_text)
        }

        // 2. Extract stats from each DETAILS screenshot (parallel) — pass god names
        const extractedGames = await Promise.all(
            images.map(image => extractDetailsTab(apiKey, image, godNames))
        )

        // 3. Resolve god names against DB (lightweight validation pass)
        try {
            await resolveGodNames(extractedGames, gods)
        } catch (err) {
            console.error('God name resolution failed (non-fatal):', err.message)
        }

        // 4. Auto-match players against DB rosters
        let playerMatches = null
        try {
            playerMatches = await autoMatchPlayers(extractedGames, matchMeta)
        } catch (err) {
            console.error('Auto-match failed (non-fatal):', err.message)
        }

        // 5. Infer game winners using heuristics
        let gameWinners = null
        if (matchMeta && extractedGames.length > 0 && playerMatches) {
            gameWinners = inferGameWinners(matchMeta, extractedGames, playerMatches)
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                match_meta: matchMeta,
                games: extractedGames,
                player_matches: playerMatches,
                game_winners: gameWinners,
                total_images: images.length,
                successful: extractedGames.filter(g => g.success).length,
            }),
        }
    } catch (error) {
        console.error('Extract error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

async function extractDetailsTab(apiKey, image, godNames) {
    try {
        const godListStr = godNames.join(', ')

        // CRITICAL: god list text goes BEFORE the image so the model reads constraints first
        const response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 3000,
                system: SYSTEM_PROMPT,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `VALID GOD NAMES (you MUST pick from this list, no exceptions):\n${godListStr}\n\nNow extract the data from this screenshot:`,
                        },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: image.media_type || 'image/png',
                                data: image.data,
                            },
                        },
                        { type: 'text', text: EXTRACTION_PROMPT },
                    ],
                }],
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            return { success: false, error: `API error: ${response.status}`, raw: errText }
        }

        const result = await response.json()
        const text = result.content.filter(b => b.type === 'text').map(b => b.text).join('')
        const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(clean)

        if (!parsed.left_players || !parsed.right_players) {
            throw new Error('Missing left_players or right_players')
        }

        return { success: true, data: parsed }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

async function parseMatchText(apiKey, text) {
    try {
        const response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 500,
                messages: [{
                    role: 'user',
                    content: `${TEXT_PARSE_PROMPT}\n\nMatch text:\n${text}`,
                }],
            }),
        })

        if (!response.ok) return null

        const result = await response.json()
        const responseText = result.content.filter(b => b.type === 'text').map(b => b.text).join('')
        const clean = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        return JSON.parse(clean)
    } catch (err) {
        console.error('Text parse error:', err.message)
        return null
    }
}

/**
 * Resolve raw god name text against the gods table.
 * Validation/enrichment pass — adds god_id and god_image_url.
 */
async function resolveGodNames(extractedGames, gods) {
    const godLookup = {}
    for (const g of gods) {
        godLookup[g.name.toLowerCase()] = g
    }

    for (const game of extractedGames) {
        if (!game.success) continue

        const allPlayers = [...game.data.left_players, ...game.data.right_players]

        for (const player of allPlayers) {
            const raw = (player.god_played || '').trim()
            const rawText = (player.god_text_read || '').trim()
            if (!raw && !rawText) continue

            player.god_played_raw = raw

            // Try exact match on god_played first
            const exactKey = raw.toLowerCase()
            if (godLookup[exactKey]) {
                const god = godLookup[exactKey]
                player.god_played = god.name
                player.god_id = god.id
                player.god_image_url = god.image_url
                player.god_match_type = 'exact'

                // Cross-check: if god_text_read resolves to a DIFFERENT god, prefer the text reading
                if (rawText) {
                    const textKey = rawText.toLowerCase()
                    const textGod = godLookup[textKey] || fuzzyMatchGod(rawText, godLookup, 2)?.god
                    if (textGod && textGod.id !== god.id) {
                        console.log(`God cross-check mismatch for ${player.player_name}: god_played="${raw}" -> ${god.name}, god_text_read="${rawText}" -> ${textGod.name}. Using text reading.`)
                        player.god_played = textGod.name
                        player.god_id = textGod.id
                        player.god_image_url = textGod.image_url
                        player.god_match_type = 'text_corrected'
                    }
                }
                continue
            }

            // Try exact match on god_text_read
            if (rawText) {
                const textKey = rawText.toLowerCase()
                if (godLookup[textKey]) {
                    const god = godLookup[textKey]
                    player.god_played = god.name
                    player.god_id = god.id
                    player.god_image_url = god.image_url
                    player.god_match_type = 'text_exact'
                    continue
                }
            }

            // Fuzzy match — try god_text_read first (more likely to be correct), then god_played
            const textMatch = rawText ? fuzzyMatchGod(rawText, godLookup) : null
            const playedMatch = fuzzyMatchGod(raw, godLookup)
            const match = textMatch || playedMatch

            if (match) {
                player.god_played = match.god.name
                player.god_id = match.god.id
                player.god_image_url = match.god.image_url
                player.god_match_type = textMatch ? 'text_fuzzy' : 'fuzzy'
                player.god_match_distance = match.distance
            } else {
                player.god_match_type = 'unmatched'
            }
        }

        const allGodIds = allPlayers.map(p => p.god_id).filter(Boolean)
        const seen = new Set()
        const dupes = new Set()
        for (const id of allGodIds) {
            if (seen.has(id)) dupes.add(id)
            seen.add(id)
        }
        if (dupes.size > 0) {
            game.god_duplicates = [...dupes].map(id => {
                const god = gods.find(g => g.id === id)
                return { god_id: id, god_name: god?.name }
            })
        }
    }
}

function fuzzyMatchGod(rawName, godLookup, maxDistance = 3) {
    const target = rawName.toLowerCase()
    let best = null
    let bestDist = maxDistance + 1

    for (const [godName, god] of Object.entries(godLookup)) {
        const dist = levenshtein(target, godName)
        if (dist <= maxDistance && dist < bestDist) {
            bestDist = dist
            best = { god, matchedName: godName, distance: dist }
        }
    }

    return best
}

function inferGameWinners(matchMeta, games, playerMatches) {
    const results = []

    for (let i = 0; i < games.length; i++) {
        const game = games[i]
        const pm = playerMatches?.[i]

        if (!game.success || !pm?.success) {
            results.push({ game_index: i, winner: null, confidence: 'none' })
            continue
        }

        const left = game.data.left_players
        const right = game.data.right_players

        const leftKills = left.reduce((s, p) => s + (p.kills || 0), 0)
        const rightKills = right.reduce((s, p) => s + (p.kills || 0), 0)
        const leftDamage = left.reduce((s, p) => s + (p.player_damage || 0), 0)
        const rightDamage = right.reduce((s, p) => s + (p.player_damage || 0), 0)
        const leftGPM = left.reduce((s, p) => s + (p.gpm || 0), 0)
        const rightGPM = right.reduce((s, p) => s + (p.gpm || 0), 0)
        const leftStructure = left.reduce((s, p) => s + (p.structure_damage || 0), 0)
        const rightStructure = right.reduce((s, p) => s + (p.structure_damage || 0), 0)

        let leftScore = 0, rightScore = 0
        if (leftKills > rightKills) leftScore += 2; else if (rightKills > leftKills) rightScore += 2
        if (leftDamage > rightDamage) leftScore += 1; else if (rightDamage > leftDamage) rightScore += 1
        if (leftGPM > rightGPM) leftScore += 1; else if (rightGPM > leftGPM) rightScore += 1
        if (leftStructure > rightStructure) leftScore += 3; else if (rightStructure > leftStructure) rightScore += 3

        const winningSide = leftScore > rightScore ? 'left' : 'right'
        const confidence = Math.abs(leftScore - rightScore) >= 4 ? 'high' : 'medium'

        results.push({
            game_index: i,
            winning_side: winningSide,
            winning_team: winningSide === 'left' ? pm.inferred.left_team_name : pm.inferred.right_team_name,
            winning_team_id: winningSide === 'left' ? pm.inferred.left_team_id : pm.inferred.right_team_id,
            losing_team: winningSide === 'left' ? pm.inferred.right_team_name : pm.inferred.left_team_name,
            losing_team_id: winningSide === 'left' ? pm.inferred.right_team_id : pm.inferred.left_team_id,
            confidence,
            heuristics: { leftKills, rightKills, leftDamage, rightDamage, leftStructure, rightStructure, leftScore, rightScore },
        })
    }

    if (matchMeta?.team1_wins != null && matchMeta?.team2_wins != null && matchMeta?.team1_name && matchMeta?.team2_name) {
        const t1Lower = matchMeta.team1_name.toLowerCase()
        const t2Lower = matchMeta.team2_name.toLowerCase()

        let t1Wins = 0, t2Wins = 0
        for (const r of results) {
            if (!r.winning_team) continue
            const wLower = r.winning_team.toLowerCase()
            if (wLower.includes(t1Lower.substring(0, 5)) || t1Lower.includes(wLower.substring(0, 5))) t1Wins++
            else if (wLower.includes(t2Lower.substring(0, 5)) || t2Lower.includes(wLower.substring(0, 5))) t2Wins++
        }

        return {
            games: results,
            validation: {
                stated_result: `${matchMeta.team1_name} ${matchMeta.team1_wins} - ${matchMeta.team2_wins} ${matchMeta.team2_name}`,
                inferred_result: `${matchMeta.team1_name} ${t1Wins} - ${t2Wins} ${matchMeta.team2_name}`,
                matches_stated: t1Wins === matchMeta.team1_wins && t2Wins === matchMeta.team2_wins,
            },
        }
    }

    return { games: results, validation: null }
}

async function autoMatchPlayers(extractedGames) {
    const sql = getDB()

    const allPlayers = await sql`
        SELECT 
            p.id as player_id, p.name, p.slug,
            lp.id as league_player_id, lp.team_id, lp.season_id, lp.role,
            t.name as team_name, t.color as team_color, t.slug as team_slug,
            s.name as season_name, s.division_id,
            d.name as division_name, d.slug as division_slug,
            l.name as league_name, l.slug as league_slug
        FROM league_players lp
        JOIN players p ON lp.player_id = p.id
        JOIN teams t ON lp.team_id = t.id
        JOIN seasons s ON lp.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        WHERE lp.is_active = true AND s.is_active = true
    `

    const allGlobalPlayers = await sql`
        SELECT id as player_id, name, slug FROM players
    `

    const allAliases = await sql`
        SELECT pa.alias, pa.player_id FROM player_aliases pa
    `

    const nameLookup = {}
    for (const p of allPlayers) {
        const key = p.name.toLowerCase()
        if (!nameLookup[key]) nameLookup[key] = []
        nameLookup[key].push(p)
    }

    // Build alias → league player lookup (for active roster players)
    const aliasLookup = {}
    for (const a of allAliases) {
        const key = a.alias.toLowerCase()
        // Find this player's league entries in the active roster
        const entries = allPlayers.filter(p => String(p.player_id) === String(a.player_id))
        if (entries.length > 0) {
            aliasLookup[key] = entries
        }
    }

    const globalNameLookup = {}
    for (const p of allGlobalPlayers) {
        const key = p.name.toLowerCase()
        if (!globalNameLookup[key]) globalNameLookup[key] = []
        globalNameLookup[key].push(p)
    }

    // Build alias → global player lookup
    const globalAliasLookup = {}
    for (const a of allAliases) {
        const key = a.alias.toLowerCase()
        const player = allGlobalPlayers.find(p => String(p.player_id) === String(a.player_id))
        if (player) {
            if (!globalAliasLookup[key]) globalAliasLookup[key] = []
            globalAliasLookup[key].push(player)
        }
    }

    const results = []

    for (const game of extractedGames) {
        if (!game.success) { results.push({ success: false }); continue }

        const allExtracted = [
            ...game.data.left_players.map(p => ({ ...p, side: 'left' })),
            ...game.data.right_players.map(p => ({ ...p, side: 'right' })),
        ]

        const matched = []
        const unmatched = []

        for (const ep of allExtracted) {
            const key = ep.player_name.toLowerCase()
            const nameMatch = nameLookup[key]
            const aliasMatch = !nameMatch ? aliasLookup[key] : null
            const dbMatches = nameMatch || aliasMatch

            if (dbMatches?.length > 0) {
                matched.push({
                    extracted_name: ep.player_name,
                    side: ep.side,
                    db_player: dbMatches[0],
                    all_matches: dbMatches,
                    confidence: 'exact',
                    match_source: aliasMatch ? 'alias' : 'name',
                    matched_alias: aliasMatch ? ep.player_name : null,
                    is_sub: false,
                })
            } else {
                const fuzzy = fuzzyMatch(ep.player_name, nameLookup)
                if (fuzzy) {
                    matched.push({
                        extracted_name: ep.player_name,
                        side: ep.side,
                        db_player: fuzzy.matches[0],
                        all_matches: fuzzy.matches,
                        confidence: 'fuzzy',
                        fuzzy_matched_to: fuzzy.matchedName,
                        is_sub: false,
                    })
                } else {
                    const globalMatch = globalNameLookup[key] || globalAliasLookup[key]
                    const globalFuzzy = !globalMatch ? fuzzyMatch(ep.player_name, globalNameLookup) : null

                    if (globalMatch?.length > 0) {
                        unmatched.push({
                            extracted_name: ep.player_name,
                            side: ep.side,
                            sub_type: 'known',
                            player_id: globalMatch[0].player_id,
                            player_name: globalMatch[0].name,
                            player_slug: globalMatch[0].slug,
                            league_player_id: nameLookup[key]?.[0]?.league_player_id || null,
                        })
                    } else if (globalFuzzy) {
                        unmatched.push({
                            extracted_name: ep.player_name,
                            side: ep.side,
                            sub_type: 'known_fuzzy',
                            player_id: globalFuzzy.matches[0].player_id,
                            player_name: globalFuzzy.matches[0].name,
                            player_slug: globalFuzzy.matches[0].slug,
                            fuzzy_matched_to: globalFuzzy.matchedName,
                        })
                    } else {
                        unmatched.push({
                            extracted_name: ep.player_name,
                            side: ep.side,
                            sub_type: 'new',
                        })
                    }
                }
            }
        }

        const leftTeamIds = matched.filter(m => m.side === 'left').map(m => m.db_player.team_id)
        const rightTeamIds = matched.filter(m => m.side === 'right').map(m => m.db_player.team_id)
        const leftTeamId = mostCommon(leftTeamIds)
        const rightTeamId = mostCommon(rightTeamIds)

        const leftInfo = matched.find(m => m.side === 'left' && String(m.db_player.team_id) === String(leftTeamId))?.db_player
        const rightInfo = matched.find(m => m.side === 'right' && String(m.db_player.team_id) === String(rightTeamId))?.db_player

        const seasonIds = matched.map(m => m.db_player.season_id)
        const inferredSeasonId = mostCommon(seasonIds)
        const seasonInfo = matched.find(m => String(m.db_player.season_id) === String(inferredSeasonId))?.db_player

        // Re-select correct league_player for players with entries in multiple leagues
        if (inferredSeasonId) {
            for (const m of matched) {
                if (m.all_matches.length > 1 && String(m.db_player.season_id) !== String(inferredSeasonId)) {
                    const correctEntry = m.all_matches.find(am => String(am.season_id) === String(inferredSeasonId))
                    if (correctEntry) {
                        m.db_player = correctEntry
                    }
                }
            }
        }

        for (const um of unmatched) {
            um.inferred_team_id = um.side === 'left' ? (leftTeamId ? parseInt(leftTeamId) : null) : (rightTeamId ? parseInt(rightTeamId) : null)
            um.inferred_team_name = um.side === 'left' ? leftInfo?.team_name : rightInfo?.team_name
        }

        const leftRosterCount = matched.filter(m => m.side === 'left').length
        const rightRosterCount = matched.filter(m => m.side === 'right').length
        const subsCount = unmatched.length
        const allSubsAreIdentifiable = unmatched.every(u => u.sub_type !== 'new')

        let confidence = 'low'
        if (subsCount === 0) confidence = 'high'
        else if (leftRosterCount >= 3 && rightRosterCount >= 3 && allSubsAreIdentifiable) confidence = 'high'
        else if (leftRosterCount >= 3 && rightRosterCount >= 3) confidence = 'medium'

        results.push({
            success: true,
            matched_count: matched.length,
            unmatched_count: unmatched.length,
            subs_count: subsCount,
            total_players: 10,
            matched, unmatched,
            inferred: {
                left_team_id: leftTeamId ? parseInt(leftTeamId) : null,
                right_team_id: rightTeamId ? parseInt(rightTeamId) : null,
                left_team_name: leftInfo?.team_name,
                right_team_name: rightInfo?.team_name,
                season_id: inferredSeasonId ? parseInt(inferredSeasonId) : null,
                season_name: seasonInfo?.season_name,
                division_name: seasonInfo?.division_name,
                league_name: seasonInfo?.league_name,
            },
            confidence,
        })
    }

    return results
}

function fuzzyMatch(name, nameLookup, maxDistance = 2) {
    const target = name.toLowerCase()
    let best = null, bestDist = maxDistance + 1
    for (const [dbName, matches] of Object.entries(nameLookup)) {
        const dist = levenshtein(target, dbName)
        if (dist <= maxDistance && dist < bestDist) {
            bestDist = dist
            best = { matchedName: dbName, matches, distance: dist }
        }
    }
    return best
}

function levenshtein(a, b) {
    const m = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null))
    for (let i = 0; i <= a.length; i++) m[0][i] = i
    for (let j = 0; j <= b.length; j++) m[j][0] = j
    for (let j = 1; j <= b.length; j++)
        for (let i = 1; i <= a.length; i++)
            m[j][i] = Math.min(m[j][i-1]+1, m[j-1][i]+1, m[j-1][i-1]+(a[i-1]===b[j-1]?0:1))
    return m[b.length][a.length]
}

function mostCommon(arr) {
    if (!arr.length) return null
    const c = {}
    for (const i of arr) c[i] = (c[i]||0) + 1
    return Object.entries(c).sort((a,b) => b[1]-a[1])[0][0]
}