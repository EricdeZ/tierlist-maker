import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { featuredStreamerService } from '../services/database'
import { X, ChevronDown, ChevronUp, Tv, ExternalLink } from 'lucide-react'

const POLL_INTERVAL = 2 * 60 * 1000 // 2 minutes
const HEARTBEAT_INTERVAL = 60 * 1000 // 60 seconds
const STORAGE_KEY = 'stream_widget_collapsed'
const DISMISS_KEY = 'stream_widget_dismissed'
const TWITCH_EMBED_URL = 'https://player.twitch.tv/js/embed/v1.js'

function loadTwitchSDK() {
    return new Promise((resolve, reject) => {
        if (window.Twitch?.Player) {
            resolve()
            return
        }
        const existing = document.querySelector(`script[src="${TWITCH_EMBED_URL}"]`)
        if (existing) {
            existing.addEventListener('load', resolve)
            existing.addEventListener('error', reject)
            return
        }
        const script = document.createElement('script')
        script.src = TWITCH_EMBED_URL
        script.addEventListener('load', resolve)
        script.addEventListener('error', reject)
        document.head.appendChild(script)
    })
}

export default function StreamWidget() {
    const location = useLocation()
    const [streamer, setStreamer] = useState(null) // { active, streamerId, channel, displayName, ... }
    const [isLive, setIsLive] = useState(false)
    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem(STORAGE_KEY) === 'true'
    )
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(DISMISS_KEY) === 'true'
    )
    const pollRef = useRef(null)
    const heartbeatRef = useRef(null)
    const playerRef = useRef(null)
    const containerRef = useRef(null)
    const isLiveRef = useRef(false)

    const fetchCurrent = useCallback(async () => {
        try {
            const data = await featuredStreamerService.getCurrent()
            setStreamer(data)
        } catch {
            // Silently fail
        }
    }, [])

    // Initial fetch + polling for current streamer
    useEffect(() => {
        fetchCurrent()
        pollRef.current = setInterval(fetchCurrent, POLL_INTERVAL)
        return () => clearInterval(pollRef.current)
    }, [fetchCurrent])

    // Keep isLiveRef in sync for heartbeat callback
    useEffect(() => {
        isLiveRef.current = isLive
    }, [isLive])

    // Heartbeat: send every 60s while live
    useEffect(() => {
        if (!streamer?.active || !streamer?.streamerId) return

        const streamerId = streamer.streamerId
        heartbeatRef.current = setInterval(() => {
            if (isLiveRef.current) {
                featuredStreamerService.heartbeat(streamerId).catch(() => {})
            }
        }, HEARTBEAT_INTERVAL)

        return () => clearInterval(heartbeatRef.current)
    }, [streamer?.active, streamer?.streamerId])

    // Initialize Twitch Player whenever channel changes
    useEffect(() => {
        if (!streamer?.active || !streamer?.channel || dismissed || location.pathname === '/twitch') {
            return
        }

        let destroyed = false

        const init = async () => {
            try {
                await loadTwitchSDK()
            } catch {
                return
            }
            if (destroyed || !containerRef.current) return

            // Clear previous player
            if (playerRef.current) {
                containerRef.current.innerHTML = ''
                playerRef.current = null
            }

            const player = new window.Twitch.Player(containerRef.current, {
                channel: streamer.channel,
                width: '100%',
                height: '100%',
                muted: true,
                parent: [window.location.hostname],
            })

            playerRef.current = player

            player.addEventListener(window.Twitch.Player.ONLINE, () => {
                if (!destroyed) setIsLive(true)
            })
            player.addEventListener(window.Twitch.Player.OFFLINE, () => {
                if (!destroyed) setIsLive(false)
            })
        }

        init()

        return () => {
            destroyed = true
            if (containerRef.current) {
                containerRef.current.innerHTML = ''
            }
            playerRef.current = null
            setIsLive(false)
        }
    }, [streamer?.active, streamer?.channel, dismissed, location.pathname])

    // Persist collapse state
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false')
    }, [collapsed])

    const dismiss = () => {
        setDismissed(true)
        localStorage.setItem(DISMISS_KEY, 'true')
    }

    // Don't render anything if no active streamer, dismissed, or on /twitch
    if (!streamer?.active || dismissed || location.pathname === '/twitch') {
        return null
    }

    const showCard = isLive && !collapsed
    const showPill = isLive && collapsed

    return (
        <>
            {/* Collapsed LIVE pill */}
            {showPill && (
                <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
                    <button
                        onClick={() => setCollapsed(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-(--color-secondary) border border-white/10 shadow-lg shadow-black/30 hover:border-purple-500/50 transition-all cursor-pointer group"
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </span>
                        <Tv className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-(--color-text)">LIVE</span>
                        <ChevronUp className="w-3 h-3 text-(--color-text-secondary) group-hover:text-(--color-text) transition-colors" />
                    </button>
                    <button
                        onClick={dismiss}
                        className="p-1.5 rounded-full bg-(--color-secondary) border border-white/10 text-(--color-text-secondary) hover:text-(--color-text) hover:border-white/20 transition-colors cursor-pointer"
                        title="Dismiss for this session"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Expanded card — always mounted so the player stays alive for detection,
                but visually hidden when collapsed or not yet confirmed live */}
            <div
                className="fixed bottom-4 right-4 z-50 w-80 rounded-xl overflow-hidden bg-(--color-secondary) border border-white/10 shadow-2xl shadow-black/50 transition-opacity duration-300"
                style={{
                    opacity: showCard ? 1 : 0,
                    pointerEvents: showCard ? 'auto' : 'none',
                    ...(!showCard && { position: 'fixed', left: '-9999px', bottom: 'auto', right: 'auto' }),
                }}
            >
                {/* Header bar */}
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="text-xs font-bold text-red-400 uppercase">Live</span>
                        <span className="text-xs text-(--color-text-secondary) truncate">
                            {streamer.displayName || streamer.channel}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => setCollapsed(true)}
                            className="p-1 rounded text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer"
                            title="Minimize"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                            onClick={dismiss}
                            className="p-1 rounded text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer"
                            title="Dismiss for this session"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Twitch Player container — always in DOM */}
                <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
                    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
                </div>

                {/* Info footer */}
                <div className="px-3 py-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-(--color-text-secondary)">
                            <span className="text-purple-400 font-semibold">{streamer.channel}</span> on Twitch
                        </span>
                        <Link
                            to="/twitch"
                            className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors font-semibold"
                        >
                            Watch Full <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    )
}
