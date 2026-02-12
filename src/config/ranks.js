// Rank ladder matching SMITE 2 ranked tiers.
// Rank is derived from total_earned passion (lifetime, never decreases).
// Sub-divisions go III → II → I (III is entry, I is highest within a tier).

// Dynamically resolve rank images — gracefully handles missing files
const rankImages = import.meta.glob('../assets/ranks/*.png', { eager: true, import: 'default' })

function img(name) {
    const key = `../assets/ranks/${name}.png`
    return rankImages[key] || null
}

export const RANK_THRESHOLDS = [
    { minPassion: 0,    name: 'Clay',     division: null,  image: img('clay') },
    { minPassion: 200,  name: 'Amber',    division: 'III', image: img('amber') },
    { minPassion: 400,  name: 'Amber',    division: 'II',  image: img('amber') },
    { minPassion: 600,  name: 'Amber',    division: 'I',   image: img('amber') },
    { minPassion: 800,  name: 'Bronze',   division: 'III', image: img('bronze') },
    { minPassion: 1000, name: 'Bronze',   division: 'II',  image: img('bronze') },
    { minPassion: 1200, name: 'Bronze',   division: 'I',   image: img('bronze') },
    { minPassion: 1400, name: 'Silver',   division: 'III', image: img('silver') },
    { minPassion: 1600, name: 'Silver',   division: 'II',  image: img('silver') },
    { minPassion: 1800, name: 'Silver',   division: 'I',   image: img('silver') },
    { minPassion: 2000, name: 'Gold',     division: 'III', image: img('gold') },
    { minPassion: 2200, name: 'Gold',     division: 'II',  image: img('gold') },
    { minPassion: 2400, name: 'Gold',     division: 'I',   image: img('gold') },
    { minPassion: 2600, name: 'Platinum', division: 'III', image: img('platinum') },
    { minPassion: 2800, name: 'Platinum', division: 'II',  image: img('platinum') },
    { minPassion: 3000, name: 'Platinum', division: 'I',   image: img('platinum') },
    { minPassion: 3200, name: 'Diamond',  division: 'III', image: img('diamond') },
    { minPassion: 3400, name: 'Diamond',  division: 'II',  image: img('diamond') },
    { minPassion: 3600, name: 'Diamond',  division: 'I',   image: img('diamond') },
    { minPassion: 3800, name: 'Obsidian', division: 'III', image: img('obsidian') },
    { minPassion: 4000, name: 'Obsidian', division: 'II',  image: img('obsidian') },
    { minPassion: 4200, name: 'Obsidian', division: 'I',   image: img('obsidian') },
    { minPassion: 4400, name: 'Master',   division: 'III', image: img('master') },
    { minPassion: 4600, name: 'Master',   division: 'II',  image: img('master') },
    { minPassion: 4800, name: 'Master',   division: 'I',   image: img('master') },
    { minPassion: 5000, name: 'Demigod',  division: null,  image: img('demigod') },
    { minPassion: 5500, name: 'Deity',    division: null,  image: img('deity') },
]

/**
 * Get the rank for a given total passion earned.
 * Returns the highest rank whose threshold is <= totalEarned.
 */
export function getRank(totalEarned) {
    let rank = RANK_THRESHOLDS[0]
    for (const threshold of RANK_THRESHOLDS) {
        if (totalEarned >= threshold.minPassion) {
            rank = threshold
        } else {
            break
        }
    }
    return rank
}

/**
 * Get the next rank after the current one, plus how much passion is needed.
 * Returns null if already at max rank (Deity).
 */
export function getNextRank(totalEarned) {
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
        if (totalEarned < RANK_THRESHOLDS[i].minPassion) {
            return {
                ...RANK_THRESHOLDS[i],
                passionNeeded: RANK_THRESHOLDS[i].minPassion - totalEarned,
            }
        }
    }
    return null // Already at Deity
}

/**
 * Format a rank as a display string, e.g. "Diamond III" or "Demigod".
 */
export function formatRank(rank) {
    if (!rank) return 'Unranked'
    return rank.division ? `${rank.name} ${rank.division}` : rank.name
}
