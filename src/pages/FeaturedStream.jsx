import { useState, useEffect } from 'react'
import { siteConfigService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { Tv } from 'lucide-react'

export default function FeaturedStream() {
    const [channel, setChannel] = useState(null)
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const data = await siteConfigService.get([
                    'featured_stream_channel',
                    'featured_stream_title',
                ])
                if (cancelled) return
                setChannel(data.config?.featured_stream_channel || '')
                setTitle(data.config?.featured_stream_title || '')
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
            <PageTitle title="Featured Stream" />
            <Navbar title="Featured Stream" />

            <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--color-accent)" />
                    </div>
                ) : error ? (
                    <div className="text-center py-24 text-red-400">{error}</div>
                ) : !channel ? (
                    <div className="text-center py-24">
                        <Tv className="w-16 h-16 mx-auto mb-4 text-(--color-text-secondary)/30" />
                        <h2 className="text-xl font-bold text-(--color-text) mb-2">
                            No Stream Featured
                        </h2>
                        <p className="text-(--color-text-secondary)">
                            Check back later — an admin will feature a stream when one is live.
                        </p>
                    </div>
                ) : (
                    <div>
                        {title && (
                            <h1 className="text-2xl font-heading font-bold text-(--color-text) mb-4 text-center">
                                {title}
                            </h1>
                        )}
                        <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black"
                             style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src={`https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}`}
                                className="absolute inset-0 w-full h-full"
                                allowFullScreen
                                title={`${channel} Twitch Stream`}
                            />
                        </div>
                        <p className="text-center text-sm text-(--color-text-secondary) mt-3">
                            Watching <span className="text-purple-400 font-semibold">{channel}</span> on Twitch
                        </p>
                    </div>
                )}
            </div>
        </>
    )
}
