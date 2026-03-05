// Fire-and-forget roster transaction logging.

export async function logRosterTransaction(sql, {
    seasonId, playerId, playerName, type,
    fromTeamId = null, fromTeamName = null,
    toTeamId = null, toTeamName = null,
    fromStatus = null, toStatus = null,
    source = 'manual', admin, details = null,
}) {
    try {
        await sql`
            INSERT INTO roster_transactions
                (season_id, player_id, player_name, type,
                 from_team_id, from_team_name, to_team_id, to_team_name,
                 from_status, to_status, source,
                 admin_user_id, admin_username, details)
            VALUES
                (${seasonId}, ${playerId}, ${playerName}, ${type},
                 ${fromTeamId}, ${fromTeamName}, ${toTeamId}, ${toTeamName},
                 ${fromStatus}, ${toStatus}, ${source},
                 ${admin.id}, ${admin.discord_username},
                 ${details ? JSON.stringify(details) : null})
        `
    } catch (err) {
        console.error('roster-tx log error:', err.message)
    }
}
