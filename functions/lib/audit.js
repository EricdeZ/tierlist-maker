// Fire-and-forget audit logging for admin actions.

/**
 * Log an admin action to the audit_log table.
 * @param {object} sql - postgres connection
 * @param {object} user - user row (must have .id and .discord_username)
 * @param {object} opts
 * @param {string} opts.action - e.g. 'submit-match', 'delete-team'
 * @param {string} opts.endpoint - e.g. 'admin-write', 'league-manage'
 * @param {number|null} opts.leagueId - affected league (null = global)
 * @param {string|null} opts.targetType - e.g. 'match', 'team', 'role'
 * @param {number|null} opts.targetId - ID of affected entity
 * @param {object|null} opts.details - flexible payload
 */
export async function logAudit(sql, user, { action, endpoint, leagueId = null, targetType = null, targetId = null, details = null }) {
    try {
        await sql`
            INSERT INTO audit_log (user_id, username, action, endpoint, league_id, target_type, target_id, details)
            VALUES (
                ${user.id},
                ${user.discord_username},
                ${action},
                ${endpoint},
                ${leagueId},
                ${targetType},
                ${targetId},
                ${details ? JSON.stringify(details) : null}
            )
        `
    } catch (err) {
        // Don't let audit failures break the actual operation
        console.error('Audit log error:', err.message)
    }
}
