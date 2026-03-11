import { useState, useEffect } from 'react'

function testImage(url) {
    return new Promise((resolve) => {
        if (!url) return resolve(false)
        const img = new Image()
        const timer = setTimeout(() => { img.src = ''; resolve(false) }, 3000)
        img.onload = () => { clearTimeout(timer); resolve(true) }
        img.onerror = () => { clearTimeout(timer); resolve(false) }
        img.src = url
    })
}

/**
 * Hook for forge components that use CSS background-image (no onError available).
 * Pre-tests image URLs in order: Discord → God (skips god for unconnected players).
 * Returns { avatarUrl, isPassionless }.
 */
export function usePlayerAvatar(player) {
    const discord = player?.discordAvatarUrl
    // Don't try god image for unconnected players — they get passionless
    const god = player?.isConnected !== false ? player?.godImageUrl : null
    const isPassionless = player?.isConnected === false

    const [avatarUrl, setAvatarUrl] = useState(() => discord || god || null)

    useEffect(() => {
        const urls = [discord, god].filter(Boolean)
        if (urls.length === 0) { setAvatarUrl(null); return }

        // Optimistic: show first available immediately
        setAvatarUrl(urls[0])

        let cancelled = false
        ;(async () => {
            for (const url of urls) {
                if (cancelled) return
                if (await testImage(url)) {
                    if (!cancelled) setAvatarUrl(url)
                    return
                }
            }
            if (!cancelled) setAvatarUrl(null)
        })()

        return () => { cancelled = true }
    }, [discord, god])

    return { avatarUrl, isPassionless }
}
