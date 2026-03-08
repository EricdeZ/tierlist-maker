// functions/lib/advancement.js
// Auto-populate downstream bracket matches when a match completes

/**
 * After a match is completed with a winner, check if any scheduled_matches
 * reference this match via team1_source or team2_source and populate the
 * resolved team_id.
 *
 * Source types:
 *   {"type":"match_result","scheduled_match_id":17,"result":"winner"}
 *   {"type":"match_result","scheduled_match_id":17,"result":"loser"}
 *   {"type":"group_standing","group_id":5,"position":1}
 *   {"type":"seed","group_id":5,"seed":3}
 *   {"type":"team","team_id":42}
 */
export async function advanceFromMatch(sql, scheduledMatchId) {
    // Get the completed match info
    const [completed] = await sql`
        SELECT sm.id, sm.team1_id, sm.team2_id, sm.match_id,
               m.winner_team_id
        FROM scheduled_matches sm
        LEFT JOIN matches m ON sm.match_id = m.id
        WHERE sm.id = ${scheduledMatchId}
    `
    if (!completed || !completed.winner_team_id) return

    const winnerId = completed.winner_team_id
    const loserId = completed.team1_id === winnerId ? completed.team2_id : completed.team1_id

    // Find all scheduled matches that reference this one
    const downstream = await sql`
        SELECT id, team1_source, team2_source
        FROM scheduled_matches
        WHERE (
            team1_source->>'type' = 'match_result'
            AND (team1_source->>'scheduled_match_id')::int = ${scheduledMatchId}
        ) OR (
            team2_source->>'type' = 'match_result'
            AND (team2_source->>'scheduled_match_id')::int = ${scheduledMatchId}
        )
    `

    for (const match of downstream) {
        const updates = {}

        if (match.team1_source?.type === 'match_result'
            && match.team1_source.scheduled_match_id === scheduledMatchId) {
            updates.team1_id = match.team1_source.result === 'winner' ? winnerId : loserId
        }

        if (match.team2_source?.type === 'match_result'
            && match.team2_source.scheduled_match_id === scheduledMatchId) {
            updates.team2_id = match.team2_source.result === 'winner' ? winnerId : loserId
        }

        if (updates.team1_id !== undefined && updates.team2_id !== undefined) {
            await sql`
                UPDATE scheduled_matches
                SET team1_id = ${updates.team1_id}, team2_id = ${updates.team2_id}, updated_at = NOW()
                WHERE id = ${match.id}
            `
        } else if (updates.team1_id !== undefined) {
            await sql`
                UPDATE scheduled_matches SET team1_id = ${updates.team1_id}, updated_at = NOW()
                WHERE id = ${match.id}
            `
        } else if (updates.team2_id !== undefined) {
            await sql`
                UPDATE scheduled_matches SET team2_id = ${updates.team2_id}, updated_at = NOW()
                WHERE id = ${match.id}
            `
        }
    }
}

/**
 * Resolve group standings and populate downstream bracket matches
 * that reference group_standing or seed sources.
 * Call this when a stage is marked as completed.
 */
export async function advanceFromGroupStandings(sql, stageId) {
    // Get all groups in this stage
    const groups = await sql`
        SELECT id FROM stage_groups WHERE stage_id = ${stageId}
    `
    if (!groups.length) return

    const groupIds = groups.map(g => g.id)

    // Find all scheduled matches that reference standings from these groups
    const downstream = await sql`
        SELECT id, team1_source, team2_source
        FROM scheduled_matches
        WHERE (
            team1_source->>'type' IN ('group_standing', 'seed')
            AND (team1_source->>'group_id')::int = ANY(${groupIds})
        ) OR (
            team2_source->>'type' IN ('group_standing', 'seed')
            AND (team2_source->>'group_id')::int = ANY(${groupIds})
        )
    `

    for (const match of downstream) {
        const updates = {}

        if (match.team1_source?.type === 'group_standing' || match.team1_source?.type === 'seed') {
            const teamId = await resolveGroupSource(sql, match.team1_source)
            if (teamId) updates.team1_id = teamId
        }

        if (match.team2_source?.type === 'group_standing' || match.team2_source?.type === 'seed') {
            const teamId = await resolveGroupSource(sql, match.team2_source)
            if (teamId) updates.team2_id = teamId
        }

        if (updates.team1_id !== undefined && updates.team2_id !== undefined) {
            await sql`
                UPDATE scheduled_matches
                SET team1_id = ${updates.team1_id}, team2_id = ${updates.team2_id}, updated_at = NOW()
                WHERE id = ${match.id}
            `
        } else if (updates.team1_id !== undefined) {
            await sql`UPDATE scheduled_matches SET team1_id = ${updates.team1_id}, updated_at = NOW() WHERE id = ${match.id}`
        } else if (updates.team2_id !== undefined) {
            await sql`UPDATE scheduled_matches SET team2_id = ${updates.team2_id}, updated_at = NOW() WHERE id = ${match.id}`
        }
    }
}

/**
 * Resolve a group_standing or seed source to a team_id.
 */
async function resolveGroupSource(sql, source) {
    if (source.type === 'seed') {
        const [row] = await sql`
            SELECT team_id FROM stage_group_teams
            WHERE group_id = ${source.group_id} AND seed = ${source.seed}
        `
        return row?.team_id || null
    }

    if (source.type === 'group_standing') {
        // Compute standings: W-L record from completed matches in this group
        const standings = await sql`
            SELECT t.team_id,
                   COUNT(*) FILTER (WHERE m.winner_team_id = t.team_id) as wins,
                   COUNT(*) FILTER (WHERE m.winner_team_id IS NOT NULL AND m.winner_team_id <> t.team_id) as losses
            FROM stage_group_teams t
            JOIN matches m ON m.group_id = ${source.group_id}
                AND (m.team1_id = t.team_id OR m.team2_id = t.team_id)
                AND m.is_completed = true
            WHERE t.group_id = ${source.group_id}
            GROUP BY t.team_id
            ORDER BY wins DESC, losses ASC
        `
        const pos = source.position - 1 // 1-indexed to 0-indexed
        return standings[pos]?.team_id || null
    }

    return null
}
