import { useState, useEffect } from 'react'
import { featuredStreamerService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { Tv, Users } from 'lucide-react'

export default function FeaturedStream() {
    const [streamer, setStreamer] = useState(null)
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const [current, queueData] = await Promise.all([
                    featuredStreamerService.getCurrent(),
                    featuredStreamerService.getQueue(),
                ])
                if (cancelled) return
                setStreamer(current)
                setQueue(queueData.queue || [])
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    const parent = window.location.hostname

    return (
        <>
            <PageTitle title="Featured SMITE 2 Stream" description="Watch featured SMITE 2 competitive streams live. Catch community league matches, caster commentary, and competitive gameplay." />
            <Navbar title="Featured Stream" />

            <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--color-accent)" />
                    </div>
                ) : error ? (
                    <div className="text-center py-24 text-red-400">{error}</div>
                ) : !streamer?.active ? (
                    <div className="text-center py-24">
                        <Tv className="w-16 h-16 mx-auto mb-4 text-(--color-text-secondary)/30" />
                        <h2 className="text-xl font-bold text-(--color-text) mb-2">
                            No Stream Featured
                        </h2>
                        <p className="text-(--color-text-secondary)">
                            Check back later — featured streamers rotate automatically.
                        </p>
                    </div>
                ) : (
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-(--color-text) mb-4 text-center">
                            {streamer.displayName || streamer.channel}
                        </h1>
                        <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black"
                             style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src={`https://player.twitch.tv/?channel=${encodeURIComponent(streamer.channel)}&parent=${parent}`}
                                className="absolute inset-0 w-full h-full"
                                allowFullScreen
                                title={`${streamer.channel} Twitch Stream`}
                            />
                        </div>
                        <p className="text-center text-sm text-(--color-text-secondary) mt-3">
                            Watching <span className="text-purple-400 font-semibold">{streamer.channel}</span> on Twitch
                        </p>
                    </div>
                )}

                {/* Queue info */}
                {queue.length > 0 && (
                    <div className="mt-12">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-4 h-4 text-(--color-text-secondary)" />
                            <h2 className="text-sm font-bold text-(--color-text-secondary) uppercase tracking-wider">
                                Streamer Queue ({queue.length})
                            </h2>
                        </div>
                        <div className="grid gap-2">
                            {queue.map((s) => (
                                <div
                                    key={s.streamerId}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                                        s.isCurrent
                                            ? 'bg-purple-500/10 border-purple-500/30'
                                            : 'bg-white/5 border-white/10'
                                    }`}
                                >
                                    <span className="text-sm font-bold text-(--color-text-secondary) w-6 text-right">
                                        #{s.position}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-(--color-text)">
                                            {s.displayName}
                                        </span>
                                        <span className="text-xs text-(--color-text-secondary) ml-2">
                                            {s.channel}
                                        </span>
                                    </div>
                                    {s.isCurrent && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                            </span>
                                            NOW
                                        </span>
                                    )}
                                    <span className="text-xs text-(--color-text-secondary) tabular-nums">
                                        {formatFeaturedTime(s.totalFeaturedSeconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

function formatFeaturedTime(seconds) {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}
