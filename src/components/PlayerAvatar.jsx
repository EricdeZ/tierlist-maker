import { useState, useEffect, useMemo } from 'react'
import passiontailsImg from '../assets/passion/passiontails.png'
import { getDiscordAvatarUrl, getGodCardUrl, getPlayerInitials } from '../utils/playerAvatar'

/**
 * PlayerAvatar — consistent fallback chain everywhere:
 * 1. Discord avatar (if has discord data + allowed)
 * 2. Passionless (if not connected to the site)
 * 3. Most played god card art
 * 4. Initials
 */
export default function PlayerAvatar({
    discordId,
    discordAvatar,
    isConnected,
    mostPlayedGod,
    godImageUrl,
    playerName,
    teamColor,
    size = 48,
    className = '',
    allowDiscordAvatar = true,
}) {
    const urlChain = useMemo(() => {
        const chain = []

        // 1. Discord avatar
        if (allowDiscordAvatar !== false) {
            const url = getDiscordAvatarUrl(discordId, discordAvatar)
            if (url) chain.push({ type: 'discord', url })
        }

        // 2. Passionless handled in render — no more URLs to try if not connected

        // 3. God card image (only for connected players)
        if (isConnected !== false) {
            const url = godImageUrl || getGodCardUrl(mostPlayedGod)
            if (url) chain.push({ type: 'god', url })
        }

        return chain
    }, [discordId, discordAvatar, isConnected, mostPlayedGod, godImageUrl, allowDiscordAvatar])

    const [currentIndex, setCurrentIndex] = useState(0)
    const [allFailed, setAllFailed] = useState(false)

    // Reset when data changes (different player)
    useEffect(() => {
        setCurrentIndex(0)
        setAllFailed(false)
    }, [urlChain])

    const handleError = () => {
        if (currentIndex < urlChain.length - 1) {
            setCurrentIndex(i => i + 1)
        } else {
            setAllFailed(true)
        }
    }

    const current = !allFailed && urlChain[currentIndex] ? urlChain[currentIndex] : null
    const initials = getPlayerInitials(playerName)
    const sizeStyle = { width: size, height: size }

    // Passionless: not connected and no working image
    if (isConnected === false && !current) {
        return (
            <div
                className={`relative flex items-center justify-center overflow-hidden rounded-full bg-black/30 flex-shrink-0 ${className}`}
                style={sizeStyle}
            >
                <img src={passiontailsImg} alt="Not Connected" className="w-full h-full opacity-50 object-contain" />
            </div>
        )
    }

    // Image available (Discord or God card)
    if (current) {
        return (
            <div className={`overflow-hidden rounded-full flex-shrink-0 ${className}`} style={sizeStyle}>
                <img
                    src={current.url}
                    alt={playerName || ''}
                    className="w-full h-full object-cover"
                    style={current.type === 'god' ? { objectPosition: 'center 20%' } : undefined}
                    onError={handleError}
                />
            </div>
        )
    }

    // Initials fallback
    return (
        <div
            className={`flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 ${className}`}
            style={{
                ...sizeStyle,
                background: teamColor
                    ? `linear-gradient(135deg, ${teamColor}80, ${teamColor})`
                    : 'rgba(255,255,255,0.1)',
                fontSize: size * 0.35,
            }}
        >
            {initials}
        </div>
    )
}
