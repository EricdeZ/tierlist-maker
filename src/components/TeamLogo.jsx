// src/components/TeamLogo.jsx
// 3-tier fallback: R2 logoUrl → bundled static asset → colored circle
const teamImages = import.meta.glob('../assets/teams/*.webp', { eager: true })

const TeamLogo = ({ slug, name, size = 24, className = '', logoUrl, color }) => {
    // Tier 1: R2-uploaded logo, Tier 2: bundled static asset
    const src = logoUrl || (slug ? teamImages[`../assets/teams/${slug}.webp`]?.default : null)

    if (src) {
        return (
            <img
                src={src}
                alt={name || slug}
                className={`object-contain flex-shrink-0 ${className}`}
                style={{ width: size, height: size }}
                loading={logoUrl ? 'lazy' : undefined}
            />
        )
    }

    // Tier 3: colored circle with initial
    if (color || name) {
        const initial = (name || slug || '?')[0].toUpperCase()
        return (
            <div
                className={`flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white/90 ${className}`}
                style={{
                    width: size,
                    height: size,
                    fontSize: size * 0.45,
                    backgroundColor: color || '#6b7280',
                }}
                title={name || slug}
            >
                {initial}
            </div>
        )
    }

    return null
}

export default TeamLogo
