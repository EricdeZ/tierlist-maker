// src/utils/divisionImages.js — Centralized division image lookup
// League-specific images override generic tier-based rank icons.
// Convention: src/assets/ranks/{leagueSlug}/{divisionSlug}.{ext}

// Eagerly import every image under assets/ranks/
const allImages = import.meta.glob('../assets/ranks/**/*.{png,webp,jpg}', { eager: true, import: 'default' })

// Generic tier images keyed by filename (e.g. "deity" → url)
const genericByName = {}
// League-specific images keyed by "leagueSlug/divisionSlug" (e.g. "bsl/enkidu" → url)
const leagueSpecific = {}

for (const [path, url] of Object.entries(allImages)) {
    // path looks like "../assets/ranks/deity.png" or "../assets/ranks/bsl/enkidu.webp"
    const rel = path.replace('../assets/ranks/', '')
    const parts = rel.split('/')

    if (parts.length === 1) {
        // Root-level generic image
        const name = parts[0].replace(/\.\w+$/, '') // strip extension
        genericByName[name] = url
    } else if (parts.length === 2) {
        // League-specific: folder/file
        const leagueSlug = parts[0]
        const divisionSlug = parts[1].replace(/\.\w+$/, '')
        leagueSpecific[`${leagueSlug}/${divisionSlug}`] = url
    }
}

// Tier → generic rank image (same mapping as before)
const TIER_TO_NAME = { 1: 'deity', 2: 'demigod', 3: 'master', 4: 'obsidian', 5: 'diamond', 6: 'platinum', 7: 'gold' }
const RANK_IMAGES = {}
for (const [tier, name] of Object.entries(TIER_TO_NAME)) {
    if (genericByName[name]) RANK_IMAGES[tier] = genericByName[name]
}

export const RANK_LABELS = { 1: 'Deity', 2: 'Demigod', 3: 'Master', 4: 'Obsidian', 5: 'Diamond', 6: 'Platinum', 7: 'Gold' }

/**
 * Get the best image for a division.
 * Prefers league-specific image, falls back to generic tier image.
 * @param {string} leagueSlug
 * @param {string} divisionSlug
 * @param {number} tier - numeric tier (1-5)
 * @returns {string|null} image URL or null
 */
export function getDivisionImage(leagueSlug, divisionSlug, tier) {
    if (leagueSlug && divisionSlug) {
        const specific = leagueSpecific[`${leagueSlug}/${divisionSlug}`]
        if (specific) return specific
    }
    return RANK_IMAGES[tier] || null
}

/** All generic rank images as an array (for decorative use) */
export const ALL_RANK_IMAGES = [1, 2, 3, 4, 5, 6, 7].map(t => RANK_IMAGES[t]).filter(Boolean)
