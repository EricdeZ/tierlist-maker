// src/components/GodpoolTierListDisplay.jsx
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { godpoolService } from '../services/database'
import { Lock, Users, Globe, Pencil, Trash2, Plus } from 'lucide-react'

const TIERS = ['S', 'A', 'B', 'C', 'D', 'F']

const TIER_COLORS = {
    S: '#dc2626',
    A: '#ea580c',
    B: '#ca8a04',
    C: '#16a34a',
    D: '#2563eb',
    F: '#7c3aed',
}

const VISIBILITY_CONFIG = {
    private: { icon: Lock, label: 'Only Me', color: 'text-(--color-text-secondary)' },
    team: { icon: Users, label: 'My Team', color: 'text-blue-400' },
    public: { icon: Globe, label: 'Public', color: 'text-green-400' },
}

export default function GodpoolTierListDisplay({ playerSlug, isOwnProfile, gods }) {
    const [tierlist, setTierlist] = useState(null)
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)

    const godsMap = useMemo(() => new Map((gods || []).map(g => [g.id, g])), [gods])

    useEffect(() => {
        if (!playerSlug) return
        let cancelled = false

        godpoolService.get(playerSlug)
            .then(data => {
                if (!cancelled) setTierlist(data.tierlist)
            })
            .catch(() => {
                if (!cancelled) setTierlist(null)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => { cancelled = true }
    }, [playerSlug])

    const handleDelete = async () => {
        if (!confirm('Delete your godpool tier list?')) return
        setDeleting(true)
        try {
            await godpoolService.delete()
            setTierlist(null)
        } catch (err) {
            alert('Failed to delete: ' + err.message)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return null

    // No tier list exists
    if (!tierlist) {
        if (!isOwnProfile) return null

        return (
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                    Godpool Tier List
                </h3>
                <Link
                    to="/god-tierlist?godpool=1"
                    className="flex items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-(--color-accent)/40 bg-(--color-secondary) hover:bg-(--color-accent)/5 transition-colors group"
                >
                    <Plus className="w-5 h-5 text-(--color-text-secondary) group-hover:text-(--color-accent) transition-colors" />
                    <span className="text-sm font-medium text-(--color-text-secondary) group-hover:text-(--color-accent) transition-colors">
                        Add a Godpool Tier List
                    </span>
                </Link>
            </div>
        )
    }

    // Tier list exists — render it
    const visConfig = VISIBILITY_CONFIG[tierlist.visibility] || VISIBILITY_CONFIG.private
    const VisIcon = visConfig.icon
    const nonEmptyTiers = TIERS.filter(t => tierlist.tiers[t]?.length > 0)

    if (nonEmptyTiers.length === 0) return null

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">
                    Godpool Tier List
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs ${visConfig.color}`}>
                        <VisIcon className="w-3 h-3" />
                        {visConfig.label}
                    </span>
                    {isOwnProfile && (
                        <>
                            <Link
                                to="/god-tierlist?godpool=1"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-white/5 transition-colors"
                            >
                                <Pencil className="w-3 h-3" />
                                Edit
                            </Link>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-(--color-text-secondary) hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="w-3 h-3" />
                                Delete
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                {nonEmptyTiers.map(tier => {
                    const godIds = tierlist.tiers[tier]
                    return (
                        <div
                            key={tier}
                            className="flex rounded-lg border border-white/10 overflow-hidden"
                        >
                            <div
                                className="flex items-center justify-center w-10 sm:w-12 flex-shrink-0 text-sm sm:text-base font-bold text-white font-heading"
                                style={{ backgroundColor: TIER_COLORS[tier] }}
                            >
                                {tier}
                            </div>
                            <div className="flex-1 flex flex-wrap items-center gap-1 p-1.5 bg-(--color-secondary)">
                                {godIds.map(godId => {
                                    const god = godsMap.get(godId)
                                    if (!god) return null
                                    return (
                                        <div
                                            key={godId}
                                            className="relative w-10 h-10 rounded overflow-hidden ring-1 ring-white/10"
                                            title={god.name}
                                        >
                                            <img
                                                src={god.image_url}
                                                alt={god.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-0.5">
                                                <span className="text-[7px] text-white font-medium truncate block text-center">
                                                    {god.name}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
