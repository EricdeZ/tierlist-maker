// src/utils/leagueImages.js — Centralized league logo lookup
// Convention: src/assets/leagues/{leagueSlug}.{ext}

const allImages = import.meta.glob('../assets/leagues/*.{png,webp,jpg}', { eager: true, import: 'default' })

const logosBySlug = {}

for (const [path, url] of Object.entries(allImages)) {
    const name = path.replace('../assets/leagues/', '').replace(/\.\w+$/, '')
    logosBySlug[name] = url
}

// Map DB slugs to filenames when they differ
const ALIASES = {
    'bsl': 'babylon',
    'albion-giants-league': 'agl',
    'babylon-smite-league': 'babylon',
    'oceanic-smite-league': 'osl',
}

/**
 * Get the logo image for a league by slug.
 * @param {string} slug
 * @returns {string|null} image URL or null
 */
export function getLeagueLogo(slug) {
    if (!slug) return null
    return logosBySlug[slug] || logosBySlug[ALIASES[slug]] || null
}
