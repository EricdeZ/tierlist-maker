import useHoloEffect from '../hooks/useHoloEffect'
import './TradingCardHolo.css'

export default function TradingCardHolo({ children, rarity = 'holo', role = 'ADC', holoType = 'full', size }) {
    const { cardRef, dynamicStyles, interacting, active, handlers } = useHoloEffect()
    const roleClass = (role || 'adc').toLowerCase()

    return (
        <div
            className={`holo-card ${roleClass} ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
            data-rarity={rarity}
            data-holo-type={holoType}
            style={{ ...dynamicStyles, ...(size ? { width: size, '--card-scale': size / 340 } : {}) }}
            ref={cardRef}
        >
            <div className="holo-card__translater">
                <div className="holo-card__rotator" {...handlers}>
                    <div className="holo-card__front">
                        {children}
                        <div className="holo-card__shine" />
                        {rarity === 'unique' && <div className="holo-card__shine2" />}
                        <div className="holo-card__glare" />
                    </div>
                </div>
            </div>
        </div>
    )
}
