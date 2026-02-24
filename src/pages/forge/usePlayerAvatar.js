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

export function usePlayerAvatar(player) {
    const discord = player?.discordAvatarUrl
    const god = player?.godImageUrl

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

    return avatarUrl
}
