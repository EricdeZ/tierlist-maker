// src/components/TeamLogo.jsx
const teamImages = import.meta.glob('../assets/teams/*.webp', { eager: true })

const TeamLogo = ({ slug, name, size = 24, className = '', logoUrl }) => {
    if (!slug && !logoUrl) return null

    // Prefer R2-uploaded logo, fall back to bundled static asset
    const src = logoUrl || (slug ? teamImages[`../assets/teams/${slug}.webp`]?.default : null)
    if (!src) return null

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

export default TeamLogo
