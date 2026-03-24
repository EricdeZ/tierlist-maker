import { Component } from 'react'
import StructuredCard from '../../vault-dashboard/preview/StructuredCard'
import EmptyCardSlot from './EmptyCardSlot'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import CanvasCard from './CanvasCard'

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

export default function VaultCard({ card, getTemplate, size, holo }) {
    const tid = card.templateId || card.template_id
    const template = card._templateData || getTemplate?.(tid)
    const rarity = card.rarity || 'common'
    const hasElements = template?.elements?.length > 0
    const hasCardData = !!template?.cardData
    const isFullArt = FULL_ART_RARITIES.has(rarity)

    // Full art rarities (mythic/unique) with elements → CanvasCard
    if (hasElements && isFullArt) {
        const holoEffect = holo ? getHoloEffect(rarity) : null
        const holoType = card.holoType || card.holo_type || 'reverse'
        return (
            <CardErrorBoundary fallback={<EmptyCardSlot rarity={rarity} size={size} />}>
                <CanvasCard
                    elements={template.elements}
                    border={template.border}
                    rarity={rarity}
                    size={size ? parseFloat(size) : 240}
                    holo={holo ? { rarity: holoEffect, holoType } : undefined}
                    signatureUrl={card.signatureUrl}
                />
            </CardErrorBoundary>
        )
    }

    // Structured rarities (common–legendary) with cardData → StructuredCard
    // Canvas prebuilt elements (banner, footer, subtitle, blocks) get extracted and passed as props
    if (hasCardData) {
        const cardData = card.signatureUrl
            ? { ...template.cardData, signatureUrl: card.signatureUrl }
            : template.cardData

        const canvasProps = hasElements ? extractCanvasProps(template.elements) : {}

        const structured = (
            <CardErrorBoundary fallback={<EmptyCardSlot rarity={rarity} size={size} />}>
                <StructuredCard
                    cardData={cardData}
                    rarity={rarity}
                    cardType={template.cardType || 'custom'}
                    size={size}
                    {...canvasProps}
                />
            </CardErrorBoundary>
        )

        if (holo) {
            const holoEffect = getHoloEffect(rarity)
            const holoType = card.holoType || card.holo_type || 'reverse'
            return (
                <TradingCardHolo rarity={holoEffect} holoType={holoType} size={size}>
                    {structured}
                </TradingCardHolo>
            )
        }
        return structured
    }

    // Elements but no cardData and not full art → still render via CanvasCard as fallback
    if (hasElements) {
        const holoEffect = holo ? getHoloEffect(rarity) : null
        const holoType = card.holoType || card.holo_type || 'reverse'
        return (
            <CardErrorBoundary fallback={<EmptyCardSlot rarity={rarity} size={size} />}>
                <CanvasCard
                    elements={template.elements}
                    border={template.border}
                    rarity={rarity}
                    size={size ? parseFloat(size) : 240}
                    holo={holo ? { rarity: holoEffect, holoType } : undefined}
                    signatureUrl={card.signatureUrl}
                />
            </CardErrorBoundary>
        )
    }

    return <EmptyCardSlot rarity={rarity} size={size} />
}
