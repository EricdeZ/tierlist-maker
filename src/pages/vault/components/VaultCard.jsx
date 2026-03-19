import { Component } from 'react'
import StructuredCard from '../../vault-dashboard/preview/StructuredCard'
import EmptyCardSlot from './EmptyCardSlot'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'

class CardErrorBoundary extends Component {
    state = { hasError: false }
    static getDerivedStateFromError() { return { hasError: true } }
    render() {
        if (this.state.hasError) return this.props.fallback
        return this.props.children
    }
}

export default function VaultCard({ card, getTemplate, size, holo }) {
    const tid = card.templateId || card.template_id
    const template = card._templateData || getTemplate?.(tid)
    if (!template?.cardData) return <EmptyCardSlot rarity={card.rarity} size={size} />

    const cardData = card.signatureUrl
        ? { ...template.cardData, signatureUrl: card.signatureUrl }
        : template.cardData

    const structured = (
        <CardErrorBoundary fallback={<EmptyCardSlot rarity={card.rarity} size={size} />}>
            <StructuredCard
                cardData={cardData}
                rarity={card.rarity}
                cardType={template.cardType || 'custom'}
                size={size}
            />
        </CardErrorBoundary>
    )

    if (holo) {
        const holoEffect = getHoloEffect(card.rarity)
        const holoType = card.holoType || card.holo_type || 'reverse'
        return (
            <TradingCardHolo rarity={holoEffect} holoType={holoType} size={size}>
                {structured}
            </TradingCardHolo>
        )
    }
    return structured
}
