// functions/lib/inhouse.js — Business logic for inhouse lobbies

const SNAKE_ORDER = ['left', 'right', 'right', 'left', 'left', 'right', 'right', 'left']

// ═══════════════════════════════════════════════════
// Formatter: DB row → API response shape
// ═══════════════════════════════════════════════════
export function formatLobby(row) {
    return {
        id: row.id,
        creatorId: row.creator_id,
        creatorName: row.creator_name,
        creatorAvatar: row.creator_avatar,
        creatorDiscordId: row.creator_discord_id,
        title: row.title,
        mode: row.mode,
        accessScope: row.access_scope,
        divisionId: row.division_id,
        divisionName: row.division_name || null,
        leagueId: row.league_id,
        leagueName: row.league_name || null,
        scheduledAt: row.scheduled_at,
        pickTimer: row.pick_timer,
        maxPlayers: row.max_players,
        maxSubs: row.max_subs,
        status: row.status,
        captainLeftId: row.captain_left_id,
        captainRightId: row.captain_right_id,
        draftStartedAt: row.draft_started_at,
        draftData: row.draft_data,
        draftTurnDeadline: row.draft_turn_deadline,
        winningSide: row.winning_side,
        resultResolvedAt: row.result_resolved_at,
        playerCount: row.player_count != null ? Number(row.player_count) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export function formatParticipant(row) {
    return {
        userId: row.user_id,
        username: row.discord_username,
        avatar: row.discord_avatar,
        discordId: row.discord_id,
        preferredRoles: row.preferred_roles ? row.preferred_roles.split(',') : [],
        isSub: row.is_sub,
        teamSide: row.team_side,
        pickNumber: row.pick_number,
        joinedAt: row.joined_at,
    }
}


// ═══════════════════════════════════════════════════
// List lobbies with player counts
// ═══════════════════════════════════════════════════
export async function listLobbies(sql, params) {
    const { status, accessScope, leagueId, divisionId } = params

    const statusFilter = status
        ? sql`AND l.status = ${status}`
        : sql`AND l.status IN ('open', 'ready', 'drafting', 'active', 'voting')`
    const scopeFilter = accessScope ? sql`AND l.access_scope = ${accessScope}` : sql``
    const leagueFilter = leagueId ? sql`AND l.league_id = ${Number(leagueId)}` : sql``
    const divisionFilter = divisionId ? sql`AND l.division_id = ${Number(divisionId)}` : sql``

    const rows = await sql`
        SELECT l.*,
            u.discord_username as creator_name,
            u.discord_avatar as creator_avatar,
            u.discord_id as creator_discord_id,
            d.name as division_name,
            lg.name as league_name,
            (SELECT COUNT(*)::integer FROM inhouse_participants ip WHERE ip.lobby_id = l.id AND NOT ip.is_sub) as player_count
        FROM inhouse_lobbies l
        JOIN users u ON l.creator_id = u.id
        LEFT JOIN divisions d ON l.division_id = d.id
        LEFT JOIN leagues lg ON l.league_id = lg.id
        WHERE 1=1
            ${statusFilter}
            ${scopeFilter}
            ${leagueFilter}
            ${divisionFilter}
        ORDER BY
            CASE l.status
                WHEN 'drafting' THEN 1
                WHEN 'ready' THEN 2
                WHEN 'open' THEN 3
                WHEN 'active' THEN 4
                WHEN 'voting' THEN 5
                ELSE 6
            END,
            l.created_at DESC
        LIMIT 50
    `

    return rows.map(formatLobby)
}


// ═══════════════════════════════════════════════════
// Get full lobby detail with participants
// ═══════════════════════════════════════════════════
export async function getLobbyDetail(sql, lobbyId, userId) {
    const [lobby] = await sql`
        SELECT l.*,
            u.discord_username as creator_name,
            u.discord_avatar as creator_avatar,
            u.discord_id as creator_discord_id,
            d.name as division_name,
            lg.name as league_name
        FROM inhouse_lobbies l
        JOIN users u ON l.creator_id = u.id
        LEFT JOIN divisions d ON l.division_id = d.id
        LEFT JOIN leagues lg ON l.league_id = lg.id
        WHERE l.id = ${lobbyId}
    `
    if (!lobby) return null

    const participants = await sql`
        SELECT ip.*, u.discord_username, u.discord_avatar, u.discord_id
        FROM inhouse_participants ip
        JOIN users u ON ip.user_id = u.id
        WHERE ip.lobby_id = ${lobbyId}
        ORDER BY ip.joined_at ASC
    `

    // Get vote tallies if in voting or completed state
    let votes = null
    if (lobby.status === 'voting' || lobby.status === 'completed') {
        const voteTallies = await sql`
            SELECT vote_side, SUM(weight)::integer as total
            FROM inhouse_votes
            WHERE lobby_id = ${lobbyId}
            GROUP BY vote_side
        `
        const leftTotal = voteTallies.find(v => v.vote_side === 'left')?.total || 0
        const rightTotal = voteTallies.find(v => v.vote_side === 'right')?.total || 0

        // Compute majority needed
        const participantCount = participants.filter(p => !p.is_sub).length
        const totalWeight = 3 + 2 + 2 + Math.max(0, participantCount - 3)
        const majorityNeeded = Math.floor(totalWeight / 2) + 1

        // Get user's vote if logged in
        let userVote = null
        if (userId) {
            const [uv] = await sql`
                SELECT vote_side FROM inhouse_votes
                WHERE lobby_id = ${lobbyId} AND user_id = ${userId}
            `
            userVote = uv?.vote_side || null
        }

        votes = { leftTotal, rightTotal, majorityNeeded, totalWeight, userVote }
    }

    return {
        lobby: formatLobby(lobby),
        participants: participants.map(formatParticipant),
        votes,
    }
}


// ═══════════════════════════════════════════════════
// Create a new lobby
// ═══════════════════════════════════════════════════
export async function createLobby(sql, user, data) {
    const { title, mode, accessScope, divisionId, leagueId, scheduledAt, pickTimer } = data

    if (!title || !mode || !accessScope) {
        throw new Error('title, mode, and accessScope are required')
    }
    if (!['scheduled', 'live'].includes(mode)) {
        throw new Error('mode must be scheduled or live')
    }
    if (!['division', 'league', 'open'].includes(accessScope)) {
        throw new Error('accessScope must be division, league, or open')
    }
    if (mode === 'scheduled' && !scheduledAt) {
        throw new Error('scheduledAt is required for scheduled lobbies')
    }
    if (accessScope === 'division' && !divisionId) {
        throw new Error('divisionId is required for division-scoped lobbies')
    }
    if (accessScope === 'league' && !leagueId) {
        throw new Error('leagueId is required for league-scoped lobbies')
    }

    const timer = Math.min(Math.max(Number(pickTimer) || 30, 10), 120)

    const [lobby] = await sql`
        INSERT INTO inhouse_lobbies (creator_id, title, mode, access_scope, division_id, league_id, scheduled_at, pick_timer)
        VALUES (
            ${user.id},
            ${title.trim().slice(0, 255)},
            ${mode},
            ${accessScope},
            ${divisionId || null},
            ${leagueId || null},
            ${scheduledAt || null},
            ${timer}
        )
        RETURNING *
    `

    // Auto-join the creator
    await sql`
        INSERT INTO inhouse_participants (lobby_id, user_id)
        VALUES (${lobby.id}, ${user.id})
    `

    return lobby
}


// ═══════════════════════════════════════════════════
// Join a lobby
// ═══════════════════════════════════════════════════
export async function joinLobby(sql, user, data) {
    const { lobbyId, preferredRoles, isSub } = data
    if (!lobbyId) throw new Error('lobbyId is required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (!['open', 'ready'].includes(lobby.status)) {
        throw new Error('Lobby is not accepting players')
    }

    // Check capacity
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND is_sub = ${!!isSub}
    `
    const limit = isSub ? lobby.max_subs : lobby.max_players
    if (count >= limit) {
        throw new Error(isSub ? 'Substitute slots are full' : 'Lobby is full')
    }

    // Validate roles
    const validRoles = ['carry', 'support', 'mid', 'jungle', 'solo']
    let rolesStr = null
    if (preferredRoles && preferredRoles.length > 0) {
        const filtered = preferredRoles.filter(r => validRoles.includes(r))
        rolesStr = filtered.join(',')
    }

    await sql`
        INSERT INTO inhouse_participants (lobby_id, user_id, preferred_roles, is_sub)
        VALUES (${lobbyId}, ${user.id}, ${rolesStr}, ${!!isSub})
        ON CONFLICT (lobby_id, user_id) DO UPDATE SET
            preferred_roles = ${rolesStr},
            is_sub = ${!!isSub}
    `

    // For live lobbies, check if we hit max_players and auto-transition to ready
    if (lobby.mode === 'live' && !isSub) {
        const [{ total }] = await sql`
            SELECT COUNT(*)::integer as total FROM inhouse_participants
            WHERE lobby_id = ${lobbyId} AND NOT is_sub
        `
        if (total >= lobby.max_players && lobby.status === 'open') {
            await sql`
                UPDATE inhouse_lobbies SET status = 'ready', updated_at = NOW()
                WHERE id = ${lobbyId} AND status = 'open'
            `
        }
    }

    return { success: true }
}


// ═══════════════════════════════════════════════════
// Leave a lobby (before draft)
// ═══════════════════════════════════════════════════
export async function leaveLobby(sql, user, data) {
    const { lobbyId } = data
    if (!lobbyId) throw new Error('lobbyId is required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (!['open', 'ready'].includes(lobby.status)) {
        throw new Error('Cannot leave after draft has started')
    }
    if (lobby.creator_id === user.id) {
        throw new Error('Creator cannot leave — cancel the lobby instead')
    }

    await sql`
        DELETE FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND user_id = ${user.id}
    `

    // If we dropped below max_players, revert to open
    if (lobby.status === 'ready') {
        const [{ total }] = await sql`
            SELECT COUNT(*)::integer as total FROM inhouse_participants
            WHERE lobby_id = ${lobbyId} AND NOT is_sub
        `
        if (total < lobby.max_players) {
            await sql`
                UPDATE inhouse_lobbies SET status = 'open', updated_at = NOW()
                WHERE id = ${lobbyId} AND status = 'ready'
            `
        }
    }

    // Clear captain assignment if this player was a captain
    if (lobby.captain_left_id === user.id) {
        await sql`UPDATE inhouse_lobbies SET captain_left_id = NULL, updated_at = NOW() WHERE id = ${lobbyId}`
    } else if (lobby.captain_right_id === user.id) {
        await sql`UPDATE inhouse_lobbies SET captain_right_id = NULL, updated_at = NOW() WHERE id = ${lobbyId}`
    }

    return { success: true }
}


// ═══════════════════════════════════════════════════
// Kick a participant (creator only, before draft)
// ═══════════════════════════════════════════════════
export async function kickPlayer(sql, user, data) {
    const { lobbyId, userId } = data
    if (!lobbyId || !userId) throw new Error('lobbyId and userId are required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.creator_id !== user.id) throw new Error('Only the lobby creator can kick players')
    if (!['open', 'ready'].includes(lobby.status)) throw new Error('Cannot kick after draft has started')
    if (userId === user.id) throw new Error('Cannot kick yourself')

    await sql`
        DELETE FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND user_id = ${userId}
    `

    // Clear captain assignment if kicked player was captain
    if (lobby.captain_left_id === userId) {
        await sql`UPDATE inhouse_lobbies SET captain_left_id = NULL, updated_at = NOW() WHERE id = ${lobbyId}`
    } else if (lobby.captain_right_id === userId) {
        await sql`UPDATE inhouse_lobbies SET captain_right_id = NULL, updated_at = NOW() WHERE id = ${lobbyId}`
    }

    // Revert to open if below capacity
    if (lobby.status === 'ready') {
        const [{ total }] = await sql`
            SELECT COUNT(*)::integer as total FROM inhouse_participants
            WHERE lobby_id = ${lobbyId} AND NOT is_sub
        `
        if (total < lobby.max_players) {
            await sql`UPDATE inhouse_lobbies SET status = 'open', updated_at = NOW() WHERE id = ${lobbyId}`
        }
    }

    return { success: true }
}


// ═══════════════════════════════════════════════════
// Cancel a lobby (creator only)
// ═══════════════════════════════════════════════════
export async function cancelLobby(sql, user, data) {
    const { lobbyId } = data
    if (!lobbyId) throw new Error('lobbyId is required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.creator_id !== user.id) throw new Error('Only the lobby creator can cancel')
    if (['completed', 'cancelled', 'expired'].includes(lobby.status)) {
        throw new Error('Lobby is already finished')
    }

    await sql`
        UPDATE inhouse_lobbies SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${lobbyId}
    `

    return { success: true }
}


// ═══════════════════════════════════════════════════
// Set captains (creator only)
// ═══════════════════════════════════════════════════
export async function setCaptains(sql, user, data) {
    const { lobbyId, captainLeftId, captainRightId } = data
    if (!lobbyId || !captainLeftId || !captainRightId) {
        throw new Error('lobbyId, captainLeftId, and captainRightId are required')
    }
    if (captainLeftId === captainRightId) {
        throw new Error('Captains must be different players')
    }

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.creator_id !== user.id) throw new Error('Only the lobby creator can set captains')
    if (!['open', 'ready'].includes(lobby.status)) throw new Error('Cannot set captains at this stage')

    // Verify both are participants and not subs
    const captains = await sql`
        SELECT user_id FROM inhouse_participants
        WHERE lobby_id = ${lobbyId}
          AND user_id IN (${captainLeftId}, ${captainRightId})
          AND NOT is_sub
    `
    if (captains.length !== 2) {
        throw new Error('Both captains must be non-sub participants in the lobby')
    }

    await sql`
        UPDATE inhouse_lobbies
        SET captain_left_id = ${captainLeftId},
            captain_right_id = ${captainRightId},
            updated_at = NOW()
        WHERE id = ${lobbyId}
    `

    return { success: true }
}


// ═══════════════════════════════════════════════════
// Start draft (creator only)
// ═══════════════════════════════════════════════════
export async function startDraft(sql, user, data) {
    const { lobbyId } = data
    if (!lobbyId) throw new Error('lobbyId is required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.creator_id !== user.id) throw new Error('Only the lobby creator can start the draft')
    if (!['open', 'ready'].includes(lobby.status)) throw new Error('Cannot start draft at this stage')
    if (!lobby.captain_left_id || !lobby.captain_right_id) {
        throw new Error('Both captains must be assigned before starting draft')
    }

    const [{ total }] = await sql`
        SELECT COUNT(*)::integer as total FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND NOT is_sub
    `
    if (total < lobby.max_players) {
        throw new Error(`Need ${lobby.max_players} players to start draft (have ${total})`)
    }

    // Assign captains to their teams
    await sql`
        UPDATE inhouse_participants SET team_side = 'left'
        WHERE lobby_id = ${lobbyId} AND user_id = ${lobby.captain_left_id}
    `
    await sql`
        UPDATE inhouse_participants SET team_side = 'right'
        WHERE lobby_id = ${lobbyId} AND user_id = ${lobby.captain_right_id}
    `

    const now = new Date()
    const deadline = new Date(now.getTime() + lobby.pick_timer * 1000)

    const draftData = {
        pickOrder: SNAKE_ORDER,
        picks: [],
        currentPick: 0,
        updatedAt: now.toISOString(),
    }

    await sql`
        UPDATE inhouse_lobbies SET
            status = 'drafting',
            draft_started_at = ${now.toISOString()},
            draft_data = ${JSON.stringify(draftData)},
            draft_turn_deadline = ${deadline.toISOString()},
            updated_at = NOW()
        WHERE id = ${lobbyId}
    `

    return { success: true, draftData }
}


// ═══════════════════════════════════════════════════
// Get lightweight draft state (for polling)
// ═══════════════════════════════════════════════════
export async function getDraftState(sql, lobbyId) {
    const [lobby] = await sql`
        SELECT id, status, draft_data, draft_turn_deadline, captain_left_id, captain_right_id, pick_timer
        FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) return null

    // Auto-advance on timeout (lazy evaluation)
    if (lobby.status === 'drafting' && lobby.draft_turn_deadline) {
        const now = new Date()
        const deadline = new Date(lobby.draft_turn_deadline)
        if (now > deadline) {
            await autoPickOnTimeout(sql, lobby)
            // Re-fetch after auto-pick
            const [updated] = await sql`
                SELECT id, status, draft_data, draft_turn_deadline, captain_left_id, captain_right_id
                FROM inhouse_lobbies WHERE id = ${lobbyId}
            `
            return formatDraftState(updated)
        }
    }

    return formatDraftState(lobby)
}

function formatDraftState(lobby) {
    const draft = lobby.draft_data || {}
    const currentPick = draft.currentPick ?? 0
    const pickOrder = draft.pickOrder || SNAKE_ORDER
    const currentCaptainSide = currentPick < pickOrder.length ? pickOrder[currentPick] : null

    return {
        status: lobby.status,
        currentPick,
        picks: draft.picks || [],
        pickOrder,
        turnDeadline: lobby.draft_turn_deadline,
        currentCaptainSide,
        captainLeftId: lobby.captain_left_id,
        captainRightId: lobby.captain_right_id,
        updatedAt: draft.updatedAt || null,
    }
}


// ═══════════════════════════════════════════════════
// Captain makes a draft pick
// ═══════════════════════════════════════════════════
export async function draftPick(sql, user, data) {
    const { lobbyId, userId: pickedUserId } = data
    if (!lobbyId || !pickedUserId) throw new Error('lobbyId and userId are required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.status !== 'drafting') throw new Error('Lobby is not in draft phase')

    const draft = lobby.draft_data
    const currentPick = draft.currentPick
    if (currentPick >= SNAKE_ORDER.length) throw new Error('Draft is already complete')

    // Check for expired timer and auto-pick first
    const now = new Date()
    if (lobby.draft_turn_deadline && now > new Date(lobby.draft_turn_deadline)) {
        await autoPickOnTimeout(sql, lobby)
        // Re-fetch
        const [updated] = await sql`SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}`
        if (updated.status !== 'drafting') throw new Error('Draft has completed')
        // Allow this pick attempt to continue if draft is still going
        return draftPick(sql, user, data)
    }

    // Validate it's this captain's turn
    const currentSide = SNAKE_ORDER[currentPick]
    const expectedCaptainId = currentSide === 'left' ? lobby.captain_left_id : lobby.captain_right_id
    if (user.id !== expectedCaptainId) {
        throw new Error('It is not your turn to pick')
    }

    // Validate picked player is available
    const [picked] = await sql`
        SELECT * FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND user_id = ${pickedUserId}
          AND team_side IS NULL AND NOT is_sub
    `
    if (!picked) throw new Error('Player is not available for picking')

    // Make the pick
    await sql`
        UPDATE inhouse_participants
        SET team_side = ${currentSide}, pick_number = ${currentPick + 1}
        WHERE lobby_id = ${lobbyId} AND user_id = ${pickedUserId}
    `

    draft.picks.push({ side: currentSide, userId: pickedUserId, pickNumber: currentPick + 1 })
    draft.currentPick = currentPick + 1
    draft.updatedAt = now.toISOString()

    // Check if draft is complete
    if (draft.currentPick >= SNAKE_ORDER.length) {
        await sql`
            UPDATE inhouse_lobbies SET
                status = 'active',
                draft_data = ${JSON.stringify(draft)},
                draft_turn_deadline = NULL,
                updated_at = NOW()
            WHERE id = ${lobbyId}
        `
        return { success: true, draftComplete: true }
    }

    // Set next pick timer
    const nextDeadline = new Date(now.getTime() + lobby.pick_timer * 1000)
    await sql`
        UPDATE inhouse_lobbies SET
            draft_data = ${JSON.stringify(draft)},
            draft_turn_deadline = ${nextDeadline.toISOString()},
            updated_at = NOW()
        WHERE id = ${lobbyId}
    `

    return { success: true, draftComplete: false }
}


// ═══════════════════════════════════════════════════
// Auto-pick on timer expiry (lazy evaluation)
// ═══════════════════════════════════════════════════
async function autoPickOnTimeout(sql, lobby) {
    const draft = lobby.draft_data
    if (!draft || draft.currentPick >= SNAKE_ORDER.length) return

    // Get unpicked non-sub players
    const available = await sql`
        SELECT user_id FROM inhouse_participants
        WHERE lobby_id = ${lobby.id} AND team_side IS NULL AND NOT is_sub
        ORDER BY RANDOM()
        LIMIT 1
    `
    if (available.length === 0) return

    const pickedUserId = available[0].user_id
    const currentPick = draft.currentPick
    const currentSide = SNAKE_ORDER[currentPick]

    await sql`
        UPDATE inhouse_participants
        SET team_side = ${currentSide}, pick_number = ${currentPick + 1}
        WHERE lobby_id = ${lobby.id} AND user_id = ${pickedUserId}
    `

    draft.picks.push({ side: currentSide, userId: pickedUserId, pickNumber: currentPick + 1, auto: true })
    draft.currentPick = currentPick + 1
    draft.updatedAt = new Date().toISOString()

    if (draft.currentPick >= SNAKE_ORDER.length) {
        await sql`
            UPDATE inhouse_lobbies SET
                status = 'active',
                draft_data = ${JSON.stringify(draft)},
                draft_turn_deadline = NULL,
                updated_at = NOW()
            WHERE id = ${lobby.id}
        `
        return
    }

    const nextDeadline = new Date(Date.now() + lobby.pick_timer * 1000)
    await sql`
        UPDATE inhouse_lobbies SET
            draft_data = ${JSON.stringify(draft)},
            draft_turn_deadline = ${nextDeadline.toISOString()},
            updated_at = NOW()
        WHERE id = ${lobby.id}
    `

    // Recursively auto-pick if still expired (handles multiple missed picks)
    if (new Date() > nextDeadline) {
        lobby.draft_data = draft
        lobby.draft_turn_deadline = nextDeadline
        await autoPickOnTimeout(sql, lobby)
    }
}


// ═══════════════════════════════════════════════════
// Start voting phase (creator only)
// ═══════════════════════════════════════════════════
export async function startVoting(sql, user, data) {
    const { lobbyId } = data
    if (!lobbyId) throw new Error('lobbyId is required')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.creator_id !== user.id) throw new Error('Only the lobby creator can start voting')
    if (lobby.status !== 'active') throw new Error('Game must be active to start voting')

    await sql`
        UPDATE inhouse_lobbies SET status = 'voting', updated_at = NOW()
        WHERE id = ${lobbyId}
    `

    return { success: true }
}


// ═══════════════════════════════════════════════════
// Cast a vote (weighted)
// ═══════════════════════════════════════════════════
export async function castVote(sql, user, data) {
    const { lobbyId, side } = data
    if (!lobbyId || !side) throw new Error('lobbyId and side are required')
    if (!['left', 'right'].includes(side)) throw new Error('side must be left or right')

    const [lobby] = await sql`
        SELECT * FROM inhouse_lobbies WHERE id = ${lobbyId}
    `
    if (!lobby) throw new Error('Lobby not found')
    if (lobby.status !== 'voting') throw new Error('Lobby is not in voting phase')

    // Must be a participant
    const [participant] = await sql`
        SELECT * FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND user_id = ${user.id} AND NOT is_sub
    `
    if (!participant) throw new Error('You must be a participant to vote')

    // Determine weight
    let weight = 1
    if (user.id === lobby.creator_id) weight = 3
    else if (user.id === lobby.captain_left_id || user.id === lobby.captain_right_id) weight = 2

    // Upsert vote
    await sql`
        INSERT INTO inhouse_votes (lobby_id, user_id, vote_side, weight)
        VALUES (${lobbyId}, ${user.id}, ${side}, ${weight})
        ON CONFLICT (lobby_id, user_id) DO UPDATE SET
            vote_side = ${side},
            weight = ${weight}
    `

    // Check for majority
    const tallies = await sql`
        SELECT vote_side, SUM(weight)::integer as total
        FROM inhouse_votes WHERE lobby_id = ${lobbyId}
        GROUP BY vote_side
    `

    const participantCount = await sql`
        SELECT COUNT(*)::integer as count FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND NOT is_sub
    `
    const totalWeight = 3 + 2 + 2 + Math.max(0, participantCount[0].count - 3)
    const majorityNeeded = Math.floor(totalWeight / 2) + 1

    const leftTotal = tallies.find(v => v.vote_side === 'left')?.total || 0
    const rightTotal = tallies.find(v => v.vote_side === 'right')?.total || 0

    let resolved = false
    let winningSide = null

    if (leftTotal >= majorityNeeded) {
        winningSide = 'left'
        resolved = true
    } else if (rightTotal >= majorityNeeded) {
        winningSide = 'right'
        resolved = true
    }

    if (resolved) {
        await sql`
            UPDATE inhouse_lobbies SET
                status = 'completed',
                winning_side = ${winningSide},
                result_resolved_at = NOW(),
                updated_at = NOW()
            WHERE id = ${lobbyId}
        `
        await updateStats(sql, lobbyId, winningSide)
    }

    return { success: true, resolved, winningSide, leftTotal, rightTotal, majorityNeeded }
}


// ═══════════════════════════════════════════════════
// Update stats after result resolution
// ═══════════════════════════════════════════════════
async function updateStats(sql, lobbyId, winningSide) {
    const participants = await sql`
        SELECT user_id, team_side FROM inhouse_participants
        WHERE lobby_id = ${lobbyId} AND team_side IS NOT NULL AND NOT is_sub
    `

    for (const p of participants) {
        const won = p.team_side === winningSide

        // Upsert stats row
        await sql`
            INSERT INTO inhouse_stats (user_id, wins, losses, games, streak, best_streak)
            VALUES (
                ${p.user_id},
                ${won ? 1 : 0},
                ${won ? 0 : 1},
                1,
                ${won ? 1 : -1},
                ${won ? 1 : 0}
            )
            ON CONFLICT (user_id) DO UPDATE SET
                wins = inhouse_stats.wins + ${won ? 1 : 0},
                losses = inhouse_stats.losses + ${won ? 0 : 1},
                games = inhouse_stats.games + 1,
                streak = CASE
                    WHEN ${won} AND inhouse_stats.streak > 0 THEN inhouse_stats.streak + 1
                    WHEN ${won} THEN 1
                    WHEN NOT ${won} AND inhouse_stats.streak < 0 THEN inhouse_stats.streak - 1
                    ELSE -1
                END,
                best_streak = GREATEST(
                    inhouse_stats.best_streak,
                    CASE
                        WHEN ${won} AND inhouse_stats.streak > 0 THEN inhouse_stats.streak + 1
                        WHEN ${won} THEN 1
                        ELSE inhouse_stats.best_streak
                    END
                ),
                updated_at = NOW()
        `
    }
}


// ═══════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════
export async function getLeaderboard(sql, params) {
    const { sort } = params
    let orderBy
    switch (sort) {
        case 'games': orderBy = sql`s.games DESC, s.wins DESC`; break
        case 'winrate': orderBy = sql`CASE WHEN s.games > 0 THEN s.wins::float / s.games ELSE 0 END DESC, s.games DESC`; break
        case 'streak': orderBy = sql`s.best_streak DESC, s.wins DESC`; break
        default: orderBy = sql`s.wins DESC, s.games ASC`
    }

    const rows = await sql`
        SELECT s.*,
            u.discord_username, u.discord_avatar, u.discord_id,
            p.slug as player_slug
        FROM inhouse_stats s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN players p ON u.linked_player_id = p.id
        WHERE s.games > 0
        ORDER BY ${orderBy}
        LIMIT 50
    `

    return rows.map((r, i) => ({
        position: i + 1,
        userId: r.user_id,
        username: r.discord_username,
        avatar: r.discord_avatar,
        discordId: r.discord_id,
        playerSlug: r.player_slug,
        wins: r.wins,
        losses: r.losses,
        games: r.games,
        winrate: r.games > 0 ? Math.round(r.wins / r.games * 100) : 0,
        streak: r.streak,
        bestStreak: r.best_streak,
    }))
}


// ═══════════════════════════════════════════════════
// Player stats (for profiles)
// ═══════════════════════════════════════════════════
export async function getPlayerStats(sql, userId) {
    const [stats] = await sql`
        SELECT s.*, u.discord_username, u.discord_avatar, u.discord_id
        FROM inhouse_stats s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ${userId}
    `
    if (!stats) return null

    // Recent games
    const recentGames = await sql`
        SELECT l.id, l.title, l.winning_side, l.result_resolved_at,
            ip.team_side
        FROM inhouse_participants ip
        JOIN inhouse_lobbies l ON ip.lobby_id = l.id
        WHERE ip.user_id = ${userId}
          AND l.status = 'completed'
          AND l.winning_side IS NOT NULL
        ORDER BY l.result_resolved_at DESC
        LIMIT 10
    `

    return {
        userId: stats.user_id,
        username: stats.discord_username,
        avatar: stats.discord_avatar,
        discordId: stats.discord_id,
        wins: stats.wins,
        losses: stats.losses,
        games: stats.games,
        winrate: stats.games > 0 ? Math.round(stats.wins / stats.games * 100) : 0,
        streak: stats.streak,
        bestStreak: stats.best_streak,
        recentGames: recentGames.map(g => ({
            lobbyId: g.id,
            title: g.title,
            won: g.team_side === g.winning_side,
            resolvedAt: g.result_resolved_at,
        })),
    }
}


// ═══════════════════════════════════════════════════
// My active lobbies
// ═══════════════════════════════════════════════════
export async function getMyLobbies(sql, userId) {
    const rows = await sql`
        SELECT l.*,
            u.discord_username as creator_name,
            u.discord_avatar as creator_avatar,
            u.discord_id as creator_discord_id,
            d.name as division_name,
            lg.name as league_name,
            (SELECT COUNT(*)::integer FROM inhouse_participants ip2 WHERE ip2.lobby_id = l.id AND NOT ip2.is_sub) as player_count
        FROM inhouse_lobbies l
        JOIN inhouse_participants ip ON ip.lobby_id = l.id AND ip.user_id = ${userId}
        JOIN users u ON l.creator_id = u.id
        LEFT JOIN divisions d ON l.division_id = d.id
        LEFT JOIN leagues lg ON l.league_id = lg.id
        WHERE l.status IN ('open', 'ready', 'drafting', 'active', 'voting')
        ORDER BY l.updated_at DESC
    `

    return rows.map(formatLobby)
}
