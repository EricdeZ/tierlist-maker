import { useCallback, useRef } from 'react'
import './PackArt.css'
import scLogo from '../../../assets/smite2.png'

const GOD_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods'

const PACK_FEATURED_GODS = {
  standard: ['Achilles', 'Bellona', 'Athena', 'Anubis', 'Ymir'],
  premium: ['Thor', 'Thanatos', 'Hecate', 'Susano', 'Izanami'],
  elite: ['Ares', 'Kali', 'Hades', 'Camazotz', 'Medusa'],
  legendary: ['Zeus', 'Odin', 'Ra', 'Poseidon', 'Agni'],
}

function getFeaturedGodUrl(tier, seed) {
  const gods = PACK_FEATURED_GODS[tier] || PACK_FEATURED_GODS.standard
  const god = gods[seed % gods.length]
  return `${GOD_CDN}/${god}/Default/t_GodCard_${god}.png`
}

export default function PackArt({
  tier = 'standard',
  name,
  subtitle,
  cardCount,
  leagueLogo,
  leagueName,
  divisionIcon,
  divisionName,
  compact,
  seed = 0,
  godImageUrl,
  className = '',
  onClick,
}) {
  const cardRef = useRef(null)
  const imgUrl = godImageUrl || getFeaturedGodUrl(tier, seed)

  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    el.style.setProperty('--rx', `${(0.5 - y) * 15}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 20}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }, [])

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
  }, [])

  const hasBadges = leagueLogo || divisionIcon

  return (
    <div className="pack-art-wrap">
      <div
        ref={cardRef}
        className={`pack-art ${compact ? 'compact' : ''} ${className}`}
        data-tier={tier}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={onClick ? { cursor: 'pointer' } : undefined}
      >
        {/* Crimped / serrated seal edges */}
        <div className="pack-art__crimp-top" />
        <div className="pack-art__crimp-bottom" />

        {/* Metallic foil base */}
        <div className="pack-art__foil" />

        {/* Full-bleed god art */}
        <div className="pack-art__god-art">
          <img src={imgUrl} alt="" loading="lazy" draggable={false} />
        </div>

        {/* Color tint overlay */}
        <div className="pack-art__foil-overlay" />

        {/* Brushed metal grain */}
        <div className="pack-art__grain" />

        {/* SC logo — overlaid on art */}
        <img className="pack-art__logo" src={scLogo} alt="" draggable={false} />

        {/* League + Division badges */}
        {hasBadges && (
          <div className="pack-art__badges">
            {leagueLogo && (
              <div className="pack-art__badge">
                <img src={leagueLogo} alt="" />
                {leagueName && <span>{leagueName}</span>}
              </div>
            )}
            {divisionIcon && (
              <div className="pack-art__badge">
                <img src={divisionIcon} alt="" />
                {divisionName && <span>{divisionName}</span>}
              </div>
            )}
          </div>
        )}

        {/* Pack title */}
        <div className="pack-art__title">
          <div className="pack-art__title-text">{name || 'Card Pack'}</div>
          {subtitle && <div className="pack-art__subtitle-text">{subtitle}</div>}
        </div>

        {/* Card count */}
        {cardCount && (
          <div className="pack-art__card-count">{cardCount} Cards</div>
        )}

        {/* Bottom metallic band */}
        <div className="pack-art__bottom-band" />

        {/* Mouse-tracking glare */}
        <div className="pack-art__glare" />

        {/* Edge bevel */}
        <div className="pack-art__edge" />

        {/* Traveling shimmer */}
        <div className="pack-art__shimmer" />
      </div>
    </div>
  )
}
