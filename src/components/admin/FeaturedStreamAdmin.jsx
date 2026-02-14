import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../../services/adminApi'
import { siteConfigService } from '../../services/database'
import { Tv } from 'lucide-react'

export default function FeaturedStreamAdmin() {
    const [channel, setChannel] = useState('')
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState(null)

    const loadConfig = useCallback(async () => {
        try {
            const data = await siteConfigService.get([
                'featured_stream_channel',
                'featured_stream_title',
            ])
            setChannel(data.config?.featured_stream_channel || '')
            setTitle(data.config?.featured_stream_title || '')
        } catch (err) {
            console.error('Failed to load stream config:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadConfig() }, [loadConfig])

    const showToast = (type, message) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 3000)
    }

    const save = async () => {
        setSaving(true)
        try {
            await adminFetch('site-config', { body: { key: 'featured_stream_channel', value: channel.trim() } })
            await adminFetch('site-config', { body: { key: 'featured_stream_title', value: title.trim() } })
            showToast('success', 'Stream updated!')
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const clear = async () => {
        setSaving(true)
        try {
            await adminFetch('site-config', { body: { key: 'featured_stream_channel', value: '' } })
            await adminFetch('site-config', { body: { key: 'featured_stream_title', value: '' } })
            setChannel('')
            setTitle('')
            showToast('success', 'Stream cleared')
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return null

    return (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-4">
                <Tv className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-(--color-text)">Featured Twitch Stream</h3>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs text-(--color-text-secondary) mb-1">
                        Twitch Channel Name
                    </label>
                    <input
                        type="text"
                        value={channel}
                        onChange={e => setChannel(e.target.value)}
                        placeholder="e.g. ninja"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) text-sm placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                    />
                </div>

                <div>
                    <label className="block text-xs text-(--color-text-secondary) mb-1">
                        Display Title (optional)
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. SPL Finals Watch Party"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) text-sm placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                    />
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    {channel && (
                        <button
                            onClick={clear}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            Clear Stream
                        </button>
                    )}
                </div>
            </div>

            {toast && (
                <div className={`mt-3 text-sm ${toast.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}
