// Challenge tier configuration — matches the rank ladder.
// Used by Challenges page, ChallengeManager, and ProfilePage badges.

const rankImages = import.meta.glob('../assets/ranks/*.png', { eager: true, import: 'default' })
function img(name) {
    const key = `../assets/ranks/${name}.png`
    return rankImages[key] || null
}

export const CHALLENGE_TIERS = [
    { key: 'daily',    label: 'Daily',    color: '#94a3b8', image: null },
    { key: 'unique',   label: 'Unique',   color: '#d4a539', image: img('unique') },
    { key: 'clay',     label: 'Clay',     color: '#a8876c', image: img('clay') },
    { key: 'amber',    label: 'Amber',    color: '#d4a04a', image: img('amber') },
    { key: 'bronze',   label: 'Bronze',   color: '#cd7f32', image: img('bronze') },
    { key: 'silver',   label: 'Silver',   color: '#c0c0c0', image: img('silver') },
    { key: 'gold',     label: 'Gold',     color: '#ffd700', image: img('gold') },
    { key: 'platinum', label: 'Platinum', color: '#4dd0e1', image: img('platinum') },
    { key: 'diamond',  label: 'Diamond',  color: '#b9f2ff', image: img('diamond') },
    { key: 'obsidian', label: 'Obsidian', color: '#7b2dba', image: img('obsidian') },
    { key: 'master',   label: 'Master',   color: '#c896ff', image: img('master') },
    { key: 'demigod',  label: 'Demigod',  color: '#b4ffb4', image: img('demigod') },
    { key: 'deity',    label: 'Deity',    color: '#ff64c8', image: img('deity') },
]

export const TIER_MAP = Object.fromEntries(CHALLENGE_TIERS.map(t => [t.key, t]))

export function getTierColor(tier) {
    return TIER_MAP[tier]?.color || '#888'
}

export function getTierLabel(tier) {
    return TIER_MAP[tier]?.label || tier
}
