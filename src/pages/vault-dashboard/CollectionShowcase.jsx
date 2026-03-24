import { useState, useEffect } from 'react'
import { vaultDashboardService } from '../../services/database'
import { RARITIES } from '../../data/vault/economy'
import StructuredCard from './preview/StructuredCard'
import MiniCardPreview from './preview/MiniCardPreview'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const CARD_SIZE = 120

export default function CollectionShowcase({ id, onBack }) {
    const [collection, setCollection] = useState(null)
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        vaultDashboardService.getCollection(id).then(data => {
            setCollection(data.collection)
            setEntries(data.entries || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto">
            <button onClick={onBack} className="text-xs text-white/40 hover:text-white/70 mb-4 cursor-pointer">&larr; Back</button>

            <h1 className="text-xl font-bold text-white mb-1">{collection?.name || 'Collection'} — Showcase</h1>
            {collection?.description && (
                <p className="text-sm text-white/40 mb-6">{collection.description}</p>
            )}

            {entries.length === 0 ? (
                <div className="text-center py-20 text-white/30 text-sm">No cards in this collection</div>
            ) : (
                <div className="space-y-8">
                    {entries.map(entry => (
                        <EntryRow key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    )
}

function EntryRow({ entry }) {
    const td = typeof entry.template_data === 'string' ? JSON.parse(entry.template_data) : entry.template_data
    const hasCardData = !!td?.cardData
    const hasElements = !!td?.elements?.length

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-white">{entry.template_name}</span>
                <span className="text-[10px] text-white/30 uppercase">{entry.card_type}</span>
                {entry.source_type === 'draft' && (
                    <span className="text-[10px] text-blue-400/60">draft</span>
                )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
                {RARITY_ORDER.map(rarity => (
                    <div key={rarity} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        {hasCardData ? (
                            <StructuredCard
                                cardData={td.cardData}
                                rarity={rarity}
                                cardType={entry.card_type || 'custom'}
                                size={CARD_SIZE}
                            />
                        ) : hasElements ? (
                            <div style={{
                                boxShadow: `0 0 8px 2px ${RARITIES[rarity]?.color || '#9ca3af'}40`,
                                borderRadius: 6,
                            }}>
                                <MiniCardPreview templateData={td} />
                            </div>
                        ) : (
                            <div
                                className="flex items-center justify-center bg-white/5 rounded"
                                style={{
                                    width: CARD_SIZE,
                                    height: CARD_SIZE * (88 / 63),
                                    border: `2px solid ${RARITIES[rarity]?.color || '#9ca3af'}`,
                                }}
                            >
                                <span className="text-[10px] text-white/20">No preview</span>
                            </div>
                        )}
                        <span className="text-[10px] font-bold" style={{ color: RARITIES[rarity]?.color || '#9ca3af' }}>
                            {RARITIES[rarity]?.name || rarity}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
