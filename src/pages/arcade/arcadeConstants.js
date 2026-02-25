export const TABS = [
    { key: 'cabinets', label: 'CABINETS' },
    { key: 'my-games', label: 'MY GAMES' },
    { key: 'high-scores', label: 'HIGH SCORES' },
]

export const ROLES = ['carry', 'support', 'mid', 'jungle', 'solo']

export const ROLE_LABELS = {
    carry: 'Carry',
    support: 'Support',
    mid: 'Mid',
    jungle: 'Jungle',
    solo: 'Solo',
}

export const ROLE_COLORS = {
    carry: '#ff4466',
    support: '#44bbff',
    mid: '#ffaa00',
    jungle: '#44ff88',
    solo: '#cc88ff',
}

export const STATUS_LABELS = {
    open: 'INSERT COIN',
    ready: 'PRESS START',
    drafting: 'PLAYER SELECT',
    active: 'NOW PLAYING',
    voting: 'GAME OVER',
    completed: 'GAME OVER',
    cancelled: 'CANCELLED',
    expired: 'EXPIRED',
}

export const STATUS_CSS = {
    open: 'arcade-status-open',
    ready: 'arcade-status-ready',
    drafting: 'arcade-status-drafting',
    active: 'arcade-status-active',
    voting: 'arcade-status-voting',
    completed: 'arcade-status-completed',
    cancelled: 'arcade-status-completed',
    expired: 'arcade-status-completed',
}

export const SIDE_LABELS = { left: 'LEFT SIDE', right: 'RIGHT SIDE' }
export const SIDE_COLORS = { left: '#00f0ff', right: '#ff00aa' }

export function avatarUrl(discordId, avatar) {
    if (!discordId || !avatar) return null
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
}
