import { apiCall, apiPost, API_BASE } from './core'

export const orgService = {
    async getBySlug(slug: string) {
        return apiCall('orgs', { slug })
    },
    async getAll() {
        return apiCall('orgs')
    },
    async adminGetAll() {
        return apiCall('org-manage')
    },
    async create(data: any) {
        return apiPost('org-manage', {}, { action: 'create', ...data })
    },
    async update(data: any) {
        return apiPost('org-manage', {}, { action: 'update', ...data })
    },
    async remove(id: number) {
        return apiPost('org-manage', {}, { action: 'delete', id })
    },
    async assignTeam(team_id: number, org_id: number) {
        return apiPost('org-manage', {}, { action: 'assign-team', team_id, org_id })
    },
    async unassignTeam(team_id: number) {
        return apiPost('org-manage', {}, { action: 'unassign-team', team_id })
    },
}

export const scrimService = {
    async list(filters: Record<string, any> = {}) {
        return apiCall('scrim', { action: 'list', ...filters })
    },
    async getMyScrims() {
        return apiCall('scrim', { action: 'my-scrims' })
    },
    async getIncoming() {
        return apiCall('scrim', { action: 'incoming' })
    },
    async getCaptainTeams() {
        return apiCall('scrim', { action: 'captain-teams' })
    },
    async getAllActiveTeams() {
        return apiCall('scrim', { action: 'all-teams' })
    },
    async create(data: any) {
        return apiPost('scrim', { action: 'create' }, data)
    },
    async update(data: any) {
        return apiPost('scrim', { action: 'update' }, data)
    },
    async accept(data: any) {
        return apiPost('scrim', { action: 'accept' }, data)
    },
    async cancel(scrimId: number) {
        return apiPost('scrim', { action: 'cancel' }, { scrim_id: scrimId })
    },
    async decline(scrimId: number) {
        return apiPost('scrim', { action: 'decline' }, { scrim_id: scrimId })
    },
    async reportOutcome(data: any) {
        return apiPost('scrim', { action: 'report-outcome' }, data)
    },
    async disputeOutcome(scrimId: number) {
        return apiPost('scrim', { action: 'dispute-outcome' }, { scrim_id: scrimId })
    },
    async getTeamReliability(teamIds: number[]) {
        return apiCall('scrim', { action: 'team-reliability', team_ids: teamIds.join(',') })
    },
    async getBlacklist() {
        return apiCall('scrim', { action: 'blacklist' })
    },
    async addToBlacklist(teamId: number, blockedTeamId: number) {
        return apiPost('scrim', { action: 'blacklist-add' }, { team_id: teamId, blocked_team_id: blockedTeamId })
    },
    async removeFromBlacklist(teamId: number, blockedTeamId: number) {
        return apiPost('scrim', { action: 'blacklist-remove' }, { team_id: teamId, blocked_team_id: blockedTeamId })
    },
    async searchUsers(query?: string) {
        return apiCall('scrim', { action: 'search-users', ...(query ? { q: query } : {}) })
    },
    async getActiveDivisions() {
        return apiCall('scrim', { action: 'active-divisions' })
    },
    async confirmAccept(scrimId: number, teamId: number) {
        return apiPost('scrim', { action: 'confirm-accept' }, { scrim_id: scrimId, team_id: teamId })
    },
    async denyAccept(scrimId: number, teamId: number) {
        return apiPost('scrim', { action: 'deny-accept' }, { scrim_id: scrimId, team_id: teamId })
    },
    async checkDMConfirmations() {
        return apiCall('scrim', { action: 'check-dm-confirmations' })
    },
}

export const inhouseService = {
    async list(filters: Record<string, any> = {}) {
        return apiCall('inhouse', { action: 'list', ...filters })
    },
    async getDetail(lobbyId: number) {
        return apiCall('inhouse', { action: 'detail', lobbyId })
    },
    async getDraftState(lobbyId: number) {
        return apiCall('inhouse', { action: 'draft-state', lobbyId })
    },
    async getLeaderboard(sort?: string) {
        return apiCall('inhouse', { action: 'leaderboard', sort })
    },
    async getMyStats() {
        return apiCall('inhouse', { action: 'my-stats' })
    },
    async getPlayerStats(userId: number) {
        return apiCall('inhouse', { action: 'player-stats', userId })
    },
    async getMyLobbies() {
        return apiCall('inhouse', { action: 'my-lobbies' })
    },
    async create(data: any) {
        return apiPost('inhouse', { action: 'create' }, data)
    },
    async join(data: any) {
        return apiPost('inhouse', { action: 'join' }, data)
    },
    async leave(lobbyId: number) {
        return apiPost('inhouse', { action: 'leave' }, { lobbyId })
    },
    async kick(data: any) {
        return apiPost('inhouse', { action: 'kick' }, data)
    },
    async cancel(lobbyId: number) {
        return apiPost('inhouse', { action: 'cancel' }, { lobbyId })
    },
    async setCaptains(data: any) {
        return apiPost('inhouse', { action: 'set-captains' }, data)
    },
    async startDraft(lobbyId: number) {
        return apiPost('inhouse', { action: 'start-draft' }, { lobbyId })
    },
    async draftPick(data: any) {
        return apiPost('inhouse', { action: 'draft-pick' }, data)
    },
    async startVoting(lobbyId: number) {
        return apiPost('inhouse', { action: 'start-voting' }, { lobbyId })
    },
    async vote(data: any) {
        return apiPost('inhouse', { action: 'vote' }, data)
    },
}

export const communityTeamService = {
    async getMyTeams() {
        return apiCall('community-teams', { action: 'my-teams' })
    },
    async getLeagueTeams() {
        return apiCall('community-teams', { action: 'league-teams' })
    },
    async getTeam(idOrSlug: string | number) {
        return apiCall('community-teams', { action: 'team', id: idOrSlug })
    },
    async browse(tier?: string) {
        return apiCall('community-teams', { action: 'browse', tier })
    },
    async create(data: any) {
        return apiPost('community-teams', { action: 'create' }, data)
    },
    async update(data: any) {
        return apiPost('community-teams', { action: 'update' }, data)
    },
    async invite(teamId: number, userId: number) {
        return apiPost('community-teams', { action: 'invite' }, { team_id: teamId, user_id: userId })
    },
    async generateLink(teamId: number) {
        return apiPost('community-teams', { action: 'generate-link' }, { team_id: teamId })
    },
    async joinLink(code: string) {
        return apiPost('community-teams', { action: 'join-link' }, { code })
    },
    async requestJoin(teamId: number) {
        return apiPost('community-teams', { action: 'request' }, { team_id: teamId })
    },
    async respond(invitationId: number, accept: boolean) {
        return apiPost('community-teams', { action: 'respond' }, { invitation_id: invitationId, accept })
    },
    async leave(teamId: number) {
        return apiPost('community-teams', { action: 'leave' }, { team_id: teamId })
    },
    async kick(teamId: number, userId: number) {
        return apiPost('community-teams', { action: 'kick' }, { team_id: teamId, user_id: userId })
    },
    async setCoCaptain(teamId: number, userId: number, remove = false) {
        return apiPost('community-teams', { action: 'set-co-captain' }, { team_id: teamId, user_id: userId, remove })
    },
    async disband(teamId: number) {
        return apiPost('community-teams', { action: 'disband' }, { team_id: teamId })
    },
    async searchUsers(query: string) {
        return apiCall('community-teams', { action: 'search-users', q: query })
    },
    async getPending() {
        return apiCall('community-teams', { action: 'pending' })
    },
    async getPendingCount() {
        return apiCall('community-teams', { action: 'pending-count' })
    },
    async previewLink(code: string) {
        return apiCall('community-teams', { action: 'preview-link', code })
    },
    async getDivisionsByTier(tier: string) {
        return apiCall('community-teams', { action: 'divisions-by-tier', tier })
    },
    async uploadLogo(teamId: number, file: File) {
        const formData = new FormData()
        formData.append('teamId', String(teamId))
        formData.append('file', file)
        const token = localStorage.getItem('auth_token')
        const hdrs: Record<string, string> = {}
        if (token) hdrs.Authorization = `Bearer ${token}`
        const res = await fetch(`${API_BASE}/community-team-upload`, {
            method: 'POST',
            headers: hdrs,
            body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        return data
    },
    async deleteLogo(teamId: number) {
        const token = localStorage.getItem('auth_token')
        const hdrs: Record<string, string> = {}
        if (token) hdrs.Authorization = `Bearer ${token}`
        const res = await fetch(`${API_BASE}/community-team-upload?teamId=${teamId}`, {
            method: 'DELETE',
            headers: hdrs,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        return data
    },
}

export const adminCommunityService = {
    async listTeams(params: Record<string, any> = {}) {
        return apiCall('admin-community', { action: 'teams', ...params })
    },
    async teamDetail(id: number) {
        return apiCall('admin-community', { action: 'team-detail', id })
    },
    async listScrims(params: Record<string, any> = {}) {
        return apiCall('admin-community', { action: 'scrims', ...params })
    },
    async scrimStats() {
        return apiCall('admin-community', { action: 'scrim-stats' })
    },
    async teamStats() {
        return apiCall('admin-community', { action: 'team-stats' })
    },
    async editTeam(data: any) {
        return apiPost('admin-community', { action: 'edit-team' }, data)
    },
    async deleteTeam(id: number) {
        return apiPost('admin-community', { action: 'delete-team' }, { id })
    },
    async cancelScrim(id: number) {
        return apiPost('admin-community', { action: 'cancel-scrim' }, { id })
    },
    async resolveDispute(id: number, outcome: string) {
        return apiPost('admin-community', { action: 'resolve-dispute' }, { id, outcome })
    },
}
