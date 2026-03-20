import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUp, ArrowDown, Plus, RefreshCw } from 'lucide-react'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { patchNotesService } from '../services/database'
import patchBanner from '../assets/patchnotebanner.webp'

const StatBadge = ({ count, label, color }) => count > 0 && (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${color}20`, color }}>
        {label === 'Buffs' && <ArrowUp size={12} />}
        {label === 'Nerfs' && <ArrowDown size={12} />}
        {label === 'New' && <Plus size={12} />}
        {label === 'Reworks' && <RefreshCw size={12} />}
        {count} {label}
    </span>
)

const BADGE_CONFIG = [
    { key: 'buff_count', label: 'Buffs', color: '#4ade80' },
    { key: 'nerf_count', label: 'Nerfs', color: '#f87171' },
    { key: 'new_item_count', label: 'New', color: '#60a5fa' },
    { key: 'rework_count', label: 'Reworks', color: '#c084fc' },
]

const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    })
}

export default function PatchNotes() {
    const [patches, setPatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const data = await patchNotesService.getAll()
                if (!cancelled) setPatches(data)
            } catch (err) {
                console.error('Failed to load patch notes:', err)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return patches
        const q = searchQuery.toLowerCase()
        return patches.filter(p =>
            p.title?.toLowerCase().includes(q) ||
            p.version?.toLowerCase().includes(q)
        )
    }, [patches, searchQuery])

    const latest = patches[0]

    if (loading) {
        return (
            <div className="min-h-screen">
                <PageTitle title="Patch Notes" />
                <Navbar title="Patch Notes" />
                <div className="pt-24 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)">Loading patch notes...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            <PageTitle title="Patch Notes" description="Browse all SMITE 2 patch notes and balance changes" />
            <Navbar title="Patch Notes" />

            <div>
                {/* Hero Banner — extends behind navbar */}
                <div className="relative w-full h-96 sm:h-[500px] overflow-hidden">
                    <img
                        src={patchBanner}
                        alt="Patch Notes Banner"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-(--color-primary) via-black/30 to-transparent" />
                </div>

                {/* Search + Grid */}
                <div className="max-w-6xl mx-auto px-4 py-8">
                    {/* Search Bar */}
                    <div className="relative mb-8">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                        <input
                            type="text"
                            placeholder="Search patches by title or version..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-(--color-accent)/50 transition-colors"
                        />
                    </div>

                    {/* Patch Cards Grid */}
                    {filtered.length === 0 ? (
                        <p className="text-center text-white/50 py-12">
                            {searchQuery ? 'No patches match your search.' : 'No patch notes available yet.'}
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {filtered.map((patch) => {
                                const isLatest = patch.id === latest?.id
                                return (
                                    <Link
                                        key={patch.id || patch.slug}
                                        to={`/patchnotes/${patch.slug}`}
                                        className={`flex items-center gap-6 bg-(--color-secondary) border rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300 ${
                                            isLatest
                                                ? 'border-(--color-accent)/40 shadow-[0_0_20px_rgba(248,197,106,0.1)]'
                                                : 'border-white/10 hover:border-(--color-accent)/30'
                                        }`}
                                    >
                                        <span className="font-(--font-heading) text-3xl font-bold text-white shrink-0 w-24 text-center">
                                            {patch.version}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-(--font-heading) text-lg font-semibold text-white/90">
                                                    {patch.title}
                                                </h3>
                                                {isLatest && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-(--color-accent)/20 text-(--color-accent) font-semibold">
                                                        LATEST
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-white/50 mb-2">
                                                {formatDate(patch.patch_date)}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {BADGE_CONFIG.map(b => (
                                                    <StatBadge key={b.key} count={patch[b.key]} label={b.label} color={b.color} />
                                                ))}
                                            </div>
                                        </div>
                                        <span className="shrink-0 px-4 py-2 rounded-lg bg-(--color-accent)/10 text-(--color-accent) text-sm font-semibold hover:bg-(--color-accent)/20 transition-colors">
                                            Show Patch Notes
                                        </span>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
