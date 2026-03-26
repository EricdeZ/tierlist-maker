import { Component } from 'react'
import StructuredCard from '../../vault-dashboard/preview/StructuredCard'
import EmptyCardSlot from './EmptyCardSlot'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import CanvasCard from './CanvasCard'
import PassiveIndicator from './PassiveIndicator'

class CardErrorBoundary extends Component {
    state = { hasError: false }
    static getDerivedStateFromError() { return { hasError: true } }
    render() {
        if (this.state.hasError) return this.props.fallback
        return this.props.children
    }
}

const FULL_ART_RARITIES = new Set(['mythic', 'unique', 'full_art'])

// Extract canvas prebuilt elements into StructuredCard props
// Mirrors the logic in RarityStrip.jsx
function extractCanvasProps(elements) {
    const visible = elements.filter(el => el.visible !== false)
    const footer = visible.find(el => el.type === 'footer')
    const banner = visible.find(el => el.type === 'name-banner')
    const subtitleEl = visible.find(el => el.type === 'subtitle')
    const blockEls = visible.filter(el => el.type === 'stats-block' || el.type === 'text-block')
    const canvasBlocks = blockEls.length > 0
        ? [...blockEls].sort((a, b) => (a.y ?? 0) - (b.y ?? 0)).map(el => {
            if (el.type === 'stats-block') return { type: 'stats', rows: el.rows || [] }
            return { type: 'text', title: el.title || '', content: el.content || '' }
        })
        : null
    return { footer: footer || undefined, banner: banner || undefined, subtitleEl: subtitleEl || undefined, canvasBlocks }
}

export default function VaultCard({ card, getBlueprint, size, holo }) {
    const bid = card.blueprintId || card.blueprint_id
    const blueprint = card._blueprintData || getBlueprint?.(bid)
    const rarity = card.rarity || 'common'
    const hasElements = blueprint?.elements?.length > 0
    const hasCardData = !!blueprint?.cardData
    const isFullArt = FULL_ART_RARITIES.has(rarity)
    const passiveName = card.passiveName || null

    const indicator = passiveName ? <PassiveIndicator passiveName={passiveName} size={size ? parseFloat(size) : 240} /> : null

    // Full art rarities (mythic/unique) with elements → CanvasCard
    if (hasElements && isFullArt) {
        const holoEffect = holo ? getHoloEffect(rarity) : null
        const holoType = card.holoType || card.holo_type || 'reverse'
        return (
            <div style={{ position: 'relative' }}>
                <CardErrorBoundary fallback={<EmptyCardSlot rarity={rarity} size={size} />}>
                    <CanvasCard
                        elements={blueprint.elements}
                        border={blueprint.border}
                        rarity={rarity}
                        size={size ? parseFloat(size) : 240}
                        holo={holo ? { rarity: holoEffect, holoType } : undefined}
                        signatureUrl={card.signatureUrl}
                    />
                </CardErrorBoundary>
                {indicator}
            </div>
        )
    }

    // Structured rarities (common–legendary) with cardData → StructuredCard
    // Canvas prebuilt elements (banner, footer, subtitle, blocks) get extracted and passed as props
    if (hasCardData) {
        const cardData = card.signatureUrl
            ? { ...blueprint.cardData, signatureUrl: card.signatureUrl }
            : blueprint.cardData

        const canvasProps = hasElements ? extractCanvasProps(blueprint.elements) : {}

        const structured = (
            <CardErrorBoundary fallback={<EmptyCardSlot rarity={rarity} size={size} />}>
                <StructuredCard
                    cardData={cardData}
                    rarity={rarity}
                    cardType={blueprint.cardType || 'custom'}
                    size={size}
                    {...canvasProps}
                />
            </CardErrorBoundary>
        )

        if (holo) {
            const holoEffect = getHoloEffect(rarity)
            const holoType = card.holoType || card.holo_type || 'reverse'
            return (
                <div style={{ position: 'relative' }}>
                    <TradingCardHolo rarity={holoEffect} holoType={holoType} size={size}>
                        {structured}
                    </TradingCardHolo>
                    {indicator}
                </div>
            )
        }
        return (
            <div style={{ position: 'relative' }}>
                {structured}
                {indicator}
            </div>
        )
    }

    // Elements but no cardData and not full art → still render via CanvasCard as fallback
    if (hasElements) {
        const holoEffect = holo ? getHoloEffect(rarity) : null
        const holoType = card.holoType || card.holo_type || 'reverse'
        return (
            <div style={{ position: 'relative' }}>
                <CardErrorBoundary fallback={<EmptyCardSlot rarity={rarity} size={size} />}>
                    <CanvasCard
                        elements={blueprint.elements}
                        border={blueprint.border}
                        rarity={rarity}
                        size={size ? parseFloat(size) : 240}
                        holo={holo ? { rarity: holoEffect, holoType } : undefined}
                        signatureUrl={card.signatureUrl}
                    />
                </CardErrorBoundary>
                {indicator}
            </div>
        )
    }

    return <EmptyCardSlot rarity={rarity} size={size} />
}
