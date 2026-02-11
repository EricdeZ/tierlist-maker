import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getAuthHeaders } from '../../services/adminApi.js'

const API = import.meta.env.VITE_API_URL || '/.netlify/functions'

function groupItems(items) {
    const sorted = [...items].sort((a, b) => new Date(a.message_timestamp) - new Date(b.message_timestamp))
    const groups = []
    let cur = null

    for (const item of sorted) {
        const ts = new Date(item.message_timestamp).getTime()
        const sameAuthor = cur?.author_id === item.author_id
        const withinWindow = cur && (ts - cur.lastTs < 10 * 60 * 1000)

        if (sameAuthor && withinWindow) {
            cur.items.push(item)
            cur.lastTs = ts
            if (item.message_content) cur.texts.add(item.message_content)
        } else {
            cur = {
                id: `grp_${item.id}`,
                author_id: item.author_id,
                author_name: item.author_name,
                division_name: item.division_name,
                channel_name: item.channel_name,
                firstTs: ts,
                lastTs: ts,
                texts: new Set(item.message_content ? [item.message_content] : []),
                items: [item],
            }
            groups.push(cur)
        }
    }

    return groups.reverse()
}

function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - ts
    const mins = Math.round(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
}

export default function DiscordImagesPanel({ onConfirmSelection, hasTarget }) {
    const [discordItems, setDiscordItems] = useState([])
    const [selectedImages, setSelectedImages] = useState({})
    const [polling, setPolling] = useState(false)
    const [fetching, setFetching] = useState(false)
    const [error, setError] = useState(null)

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${API}/discord-queue?action=queue`, { headers: getAuthHeaders() })
            if (!res.ok) return
            const data = await res.json()
            setDiscordItems(data.items || [])
        } catch { /* silent */ }
    }, [])

    useEffect(() => { fetchQueue() }, [fetchQueue])

    const getImages = async () => {
        setPolling(true)
        setError(null)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'poll-now' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            const results = data.results || []
            const errors = results.filter(r => r.error)
            if (errors.length) {
                setError(errors.map(e => `${e.channelName || e.channelId}: ${e.error}`).join('; '))
            }
            await fetchQueue()
        } catch (err) {
            setError(err.message)
        } finally {
            setPolling(false)
        }
    }

    const groups = useMemo(() => groupItems(discordItems), [discordItems])

    const selectedImageIds = Object.keys(selectedImages).filter(k => selectedImages[k]).map(Number)
    const selectedImageCount = selectedImageIds.length

    const toggleImage = (id) => setSelectedImages(prev => ({ ...prev, [id]: !prev[id] }))

    const toggleGroup = (group) => {
        const allSelected = group.items.every(item => selectedImages[item.id])
        const next = { ...selectedImages }
        for (const item of group.items) next[item.id] = !allSelected
        setSelectedImages(next)
    }

    const isGroupSelected = (group) => group.items.every(item => selectedImages[item.id])
    const isGroupPartial = (group) => group.items.some(item => selectedImages[item.id]) && !isGroupSelected(group)

    const skipSelected = async () => {
        if (!selectedImageCount) return
        try {
            await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'update-status', queue_item_ids: selectedImageIds, status: 'skipped' }),
            })
            setSelectedImages({})
            fetchQueue()
        } catch { /* silent */ }
    }

    const confirmSelection = async () => {
        if (!selectedImageCount) return
        setFetching(true)
        setError(null)
        try {
            const res = await fetch(`${API}/discord-queue`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'fetch-images', queue_item_ids: selectedImageIds }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            const images = (data.images || []).filter(img => img.data)
            if (!images.length) throw new Error('No images could be fetched')

            const selectedItems = discordItems.filter(q => selectedImages[q.id])
            const texts = [...new Set(selectedItems.map(q => q.message_content).filter(Boolean))]
            const text = texts.join('\n').trim()

            onConfirmSelection({ images, text, queueItemIds: selectedImageIds })

            setSelectedImages({})
            fetchQueue()
        } catch (err) {
            setError(err.message)
        } finally {
            setFetching(false)
        }
    }

    return (
        <div>
            {/* Header with get images */}
            <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
                <span className="text-[10px] text-[var(--color-text-secondary)]">
                    {discordItems.length} pending
                </span>
                <button
                    onClick={getImages}
                    disabled={polling}
                    className="text-[10px] px-2 py-1 rounded-md bg-purple-600/80 hover:bg-purple-600 disabled:opacity-50 text-white transition"
                >
                    {polling ? 'Fetching...' : 'Get Images'}
                </button>
            </div>

            {error && (
                <div className="px-3 py-2 text-[10px] text-red-400 bg-red-500/10 border-b border-white/5">
                    {error}
                </div>
            )}

            {/* Groups */}
            <div>
                {groups.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                        <p className="text-[10px] text-[var(--color-text-secondary)]">No pending screenshots</p>
                        <Link to="/admin/discord" className="text-[10px] text-purple-400 hover:text-purple-300">
                            Configure channels →
                        </Link>
                    </div>
                ) : groups.map(group => (
                    <div key={group.id} className="border-b border-white/5 last:border-0">
                        <div
                            className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-white/3"
                            onClick={() => toggleGroup(group)}
                        >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition ${
                                isGroupSelected(group) ? 'bg-blue-600 border-blue-600' :
                                isGroupPartial(group) ? 'bg-blue-600/40 border-blue-500' :
                                'border-gray-500'
                            }`}>
                                {(isGroupSelected(group) || isGroupPartial(group)) && (
                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                        {isGroupPartial(group) ? <path d="M3 6h6" /> : <path d="M2 6l3 3 5-5" />}
                                    </svg>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[10px] text-[var(--color-text)] font-medium">{group.author_name || 'Unknown'}</span>
                                <span className="text-[10px] text-[var(--color-text-secondary)] ml-1.5">{timeAgo(group.firstTs)}</span>
                            </div>
                            <span className="text-[9px] text-purple-400 shrink-0">{group.division_name}</span>
                        </div>

                        {group.texts.size > 0 && (
                            <div className="px-3 pb-1">
                                <p className="text-[10px] text-[var(--color-text-secondary)] italic truncate">
                                    {[...group.texts].join(' | ')}
                                </p>
                            </div>
                        )}

                        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                            {group.items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={(e) => { e.stopPropagation(); toggleImage(item.id) }}
                                    className={`relative w-14 h-10 rounded overflow-hidden cursor-pointer border-2 transition ${
                                        selectedImages[item.id]
                                            ? 'border-blue-500 ring-1 ring-blue-500/30'
                                            : 'border-transparent hover:border-white/20'
                                    }`}
                                >
                                    <img
                                        src={item.attachment_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={e => { e.target.style.display = 'none' }}
                                    />
                                    {selectedImages[item.id] && (
                                        <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M2 6l3 3 5-5" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-2.5 border-t border-white/10 flex items-center justify-between">
                <div>
                    {selectedImageCount > 0 && (
                        <button onClick={skipSelected} className="text-[10px] text-[var(--color-text-secondary)] hover:text-red-400 transition">
                            Skip {selectedImageCount}
                        </button>
                    )}
                </div>
                <button
                    onClick={confirmSelection}
                    disabled={!selectedImageCount || fetching || !hasTarget}
                    title={!hasTarget ? 'Select "Discord" on a report card first' : ''}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    {fetching ? 'Fetching...' : `Add to Report${selectedImageCount ? ` (${selectedImageCount})` : ''}`}
                </button>
            </div>
        </div>
    )
}
