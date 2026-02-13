// Challenge tier configuration — matches the rank ladder.
// Used by Challenges page, ChallengeManager, and ProfilePage badges.

export const CHALLENGE_TIERS = [
    { key: 'daily',    label: 'Daily',    color: '#94a3b8' },  // slate
    { key: 'clay',     label: 'Clay',     color: '#a8876c' },
    { key: 'amber',    label: 'Amber',    color: '#d4a04a' },
    { key: 'bronze',   label: 'Bronze',   color: '#cd7f32' },
    { key: 'silver',   label: 'Silver',   color: '#c0c0c0' },
    { key: 'gold',     label: 'Gold',     color: '#ffd700' },
    { key: 'platinum', label: 'Platinum', color: '#4dd0e1' },
    { key: 'diamond',  label: 'Diamond',  color: '#b9f2ff' },
    { key: 'obsidian', label: 'Obsidian', color: '#7b2dba' },
    { key: 'master',   label: 'Master',   color: '#c896ff' },
    { key: 'demigod',  label: 'Demigod',  color: '#b4ffb4' },
    { key: 'deity',    label: 'Deity',    color: '#ff64c8' },
]

export const TIER_MAP = Object.fromEntries(CHALLENGE_TIERS.map(t => [t.key, t]))

export function getTierColor(tier) {
    return TIER_MAP[tier]?.color || '#888'
}

export function getTierLabel(tier) {
    return TIER_MAP[tier]?.label || tier
}
