import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { vaultService } from '../../services/database'
import { RARITIES } from '../../data/vault/economy'
import VaultCard from './components/VaultCard'
import Navbar from '../../components/layout/Navbar'
import PageTitle from '../../components/PageTitle'
import { ArrowLeft, X } from 'lucide-react'
import FanShowcase from '../vault-dashboard/FanShowcase'
import './compdeck.css'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const CARD_SIZE = 140

export default function CollectionShowcasePage() {
    const { collectionSlug } = useParams()
    const [collection, setCollection] = useState(null)
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!collectionSlug) return
        vaultService.getShowcaseCollection(collectionSlug)
            .then(data => {
                setCollection(data.collection)
                setEntries(data.entries || [])
            })
            .catch(() => setError('Collection not found'))
            .finally(() => setLoading(false))
    }, [collectionSlug])

    const branding = (
        <Link to="/vault" className="hidden sm:flex items-center gap-1.5 no-underline">
            <span className="cd-head text-[0.6rem] tracking-[0.4em] text-[var(--cd-cyan)] opacity-55">THE</span>
            <span className="cd-head text-sm font-bold tracking-[0.12em]" style={{ background: 'linear-gradient(180deg, #e0e8f0 20%, #00e5ff 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>VAULT</span>
        </Link>
    )

    if (loading) {
        return (
            <div className="compdeck min-h-screen">
                <Navbar branding={branding} />
                <div className="flex items-center justify-center py-20">
                    <div className="cd-spinner w-8 h-8" />
                </div>
            </div>
        )
    }

    if (error || !collection) {
        return (
            <div className="compdeck min-h-screen">
                <Navbar branding={branding} />
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-white/50 mb-4">{error || 'Collection not found'}</p>
                    <Link to="/vault" className="text-sm text-[var(--cd-cyan)] hover:underline">
                        Back to The Vault
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="compdeck min-h-screen">
            <PageTitle title={`${collection.name} — The Vault`} />
            <Navbar branding={branding} />

            <main className="max-w-[1400px] mx-auto px-4 pt-6 pb-12">
                <Link
                    to="/vault"
                    className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-6 no-underline"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to The Vault
                </Link>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white cd-head tracking-wider">{collection.name}</h1>
                    {collection.description && (
                        <p className="text-sm text-white/40 mt-1">{collection.description}</p>
                    )}
                    <p className="text-xs text-white/20 mt-2">{entries.length} card{entries.length !== 1 ? 's' : ''} in this collection</p>
                </div>

                {entries.length > 0 && (
                    <FanShowcase entries={entries} collection={collection} />
                )}

                {entries.length === 0 ? (
                    <div className="text-center py-20 text-white/30 text-sm">No cards in this collection yet</div>
                ) : (
                    <div className="space-y-10">
                        {entries.map(entry => (
                            <EntryRow key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

function ShowcaseZoomModal({ card, rarity, onClose }) {
    const [closing, setClosing] = useState(false)
    const rarityInfo = RARITIES[rarity]

    const handleClose = useCallback(() => {
        setClosing(true)
        setTimeout(onClose, 200)
    }, [onClose])

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') handleClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [handleClose])

    return createPortal(
        <div
            className={`card-zoom-backdrop ${closing ? 'card-zoom-out' : 'card-zoom-in'}`}
            onClick={handleClose}
        >
            <div className="card-zoom-content" onClick={e => e.stopPropagation()}>
                <button
                    onClick={handleClose}
                    className="absolute -top-10 right-0 text-white/40 hover:text-white/80 transition-colors cursor-pointer z-10"
                >
                    <X className="w-6 h-6" />
                </button>

                <VaultCard card={card} size={280} holo />

                <div className="mt-3 text-center">
                    <span
                        className="text-xs font-bold uppercase tracking-widest cd-head"
                        style={{ color: rarityInfo?.color || '#fff', textShadow: `0 0 12px ${rarityInfo?.color || '#fff'}44` }}
                    >
                        {rarityInfo?.name || 'Common'}
                    </span>
                </div>
            </div>
        </div>,
        document.body
    )
}

function buildFakeCard(entry, rarity) {
    const td = typeof entry.template_data === 'string' ? JSON.parse(entry.template_data) : entry.template_data
    return {
        rarity,
        blueprintId: entry.blueprint_id,
        cardType: entry.card_type || 'custom',
        _blueprintData: td ? {
            elements: td.elements,
            border: td.border,
            cardData: td.cardData,
            cardType: entry.card_type || 'custom',
        } : null,
    }
}

function EntryRow({ entry }) {
    const [zoomed, setZoomed] = useState(null)

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-bold text-white">{entry.template_name}</span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">{entry.card_type}</span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3">
                {RARITY_ORDER.map(rarity => {
                    const card = buildFakeCard(entry, rarity)
                    return (
                        <div
                            key={rarity}
                            className="flex flex-col items-center gap-2 flex-shrink-0 card-zoomable"
                            onClick={() => setZoomed(rarity)}
                        >
                            <VaultCard card={card} size={CARD_SIZE} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RARITIES[rarity]?.color || '#9ca3af' }}>
                                {RARITIES[rarity]?.name || rarity}
                            </span>
                        </div>
                    )
                })}
            </div>

            {zoomed && (
                <ShowcaseZoomModal
                    card={buildFakeCard(entry, zoomed)}
                    rarity={zoomed}
                    onClose={() => setZoomed(null)}
                />
            )}
        </div>
    )
}
