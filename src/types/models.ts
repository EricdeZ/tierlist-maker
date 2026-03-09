// src/types/models.ts
// Shared domain types inferred from context providers and backend usage.

export interface User {
    id: number
    role: string
    discord_id: string
    discord_avatar: string | null
    username: string
    global_name: string | null
}

export interface League {
    id: number
    name: string
    slug: string
    divisions?: Division[]
}

export interface Division {
    id: number
    name: string
    slug: string
    league_id: number
    seasons?: Season[]
}

export interface Season {
    id: number
    name: string
    is_active: boolean
    division_id?: number
    division_name?: string
    division_slug?: string
}

export interface Team {
    id: number
    name: string
    season_id: number
    logo_url?: string | null
    color?: string | null
}

export interface Player {
    id: number
    name: string
    team_id: number | null
    season_id: number
    is_captain?: boolean
}

export interface Rank {
    minPassion: number
    name: string
    division: string | null
    image: string | null
}

export interface NextRank extends Rank {
    passionNeeded: number
}

/** All RBAC permission keys used across the application. */
export type PermissionKey =
    | 'match_report'
    | 'match_schedule'
    | 'roster_manage'
    | 'league_manage'
    | 'team_manage'
    | 'player_manage'
    | 'user_manage'
    | 'codex_edit'
    | 'permission_manage'
    | 'audit_log_view'
    | 'feedback_manage'
    | 'claim_manage'
    | 'cardclash_manage'
    | 'league_preview'
    | 'league_staff_manage'

export interface Permissions {
    global: PermissionKey[]
    byLeague: Record<string, PermissionKey[]>
}
