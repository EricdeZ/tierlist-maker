// src/components/TeamLogo.jsx
const teamImages = import.meta.glob('../assets/teams/*.webp', { eager: true })

const TeamLogo = ({ slug, name, size = 24, className = '' }) => {
    if (!slug) return null
    const key = `../assets/teams/${slug}.webp`
    const src = teamImages[key]?.default
    if (!src) return null

    return (
        <img
            src={src}
            alt={name || slug}
            className={`object-contain flex-shrink-0 ${className}`}
            style={{ width: size, height: size }}
        />
    )
}

export default TeamLogo
