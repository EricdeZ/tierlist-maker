import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './ForgePromoSection.css'

// Mock data snapshot — represents a typical Forge market state
const MOCK_PLAYERS = [
    { initials: 'PK', name: 'PolarisKing', role: 'MID', price: 1247, change: 18.4, heat: 'blazing', color: '#e86520' },
    { initials: 'NV', name: 'NovaStar',    role: 'ADC', price: 892,  change: 5.2,  heat: 'warm',    color: '#d4a030' },
    { initials: 'ZR', name: 'ZeroGrav',    role: 'SUP', price: 531,  change: -3.7, heat: 'cooling', color: '#4499bb' },
    { initials: 'AX', name: 'AxeRunner',   role: 'JNG', price: 1089, change: 12.1, heat: 'blazing', color: '#e86520' },
    { initials: 'SH', name: 'ShadowFX',    role: 'SOL', price: 756,  change: 3.8,  heat: 'warm',    color: '#d4a030' },
    { initials: 'MW', name: 'MoonWalker',  role: 'SUP', price: 418,  change: -6.2, heat: 'cooling', color: '#4499bb' },
    { initials: 'VX', name: 'VortexBlade', role: 'MID', price: 1412, change: 22.7, heat: 'blazing', color: '#e86520' },
    { initials: 'IF', name: 'Ironflame',   role: 'ADC', price: 663,  change: 1.9,  heat: 'warm',    color: '#d4a030' },
]

const HEAT_COLORS = {
    blazing: { hex: '#e86520', hexDark: '#c44a10' },
    warm:    { hex: '#d4a030', hexDark: '#8b6914' },
    cooling: { hex: '#4499bb', hexDark: '#2a4858' },
}

// Edgy/angular graph path (sharp peaks, not smooth curves)
const GRAPH_PATH = 'M0,145 L40,138 L75,125 L100,130 L140,115 L170,105 L195,110 L230,90 L260,95 L290,80 L320,70 L350,75 L385,55 L410,60 L440,50 L475,58 L510,42 L540,48 L570,35 L610,40 L640,30 L680,38 L710,25 L745,32 L780,28 L820,35 L855,42 L900,38'
const GRAPH_FILL = GRAPH_PATH + ' L900,180 L0,180 Z'

function TickerItem({ player }) {
    const colors = HEAT_COLORS[player.heat]
    const isUp = player.change >= 0
    return (
        <>
            <div className="forge-ticker-item">
                <div
                    className="forge-ticker-hex"
                    style={{ background: `linear-gradient(135deg, ${colors.hex}, ${colors.hexDark})` }}
                >
                    {player.initials}
                </div>
                <span className="forge-ticker-name">{player.name}</span>
                <span className="forge-ticker-price" style={{ color: colors.hex }}>
                    {player.price.toLocaleString()}
                </span>
                <span className={`forge-ticker-change ${isUp ? 'forge-mini-change up' : 'forge-mini-change down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(player.change)}%
                </span>
            </div>
            <div className="forge-ticker-sep" />
        </>
    )
}

function MiniCard({ player }) {
    const colors = HEAT_COLORS[player.heat]
    const isUp = player.change >= 0
    return (
        <div className={`forge-mini-card heat-${player.heat}`}>
            <div className={`forge-mini-heat ${player.heat}`} />
            <div
                className="forge-mini-hex"
                style={{ background: `linear-gradient(135deg, ${colors.hex}, ${colors.hexDark})` }}
            >
                {player.initials}
            </div>
            <span className="forge-mini-name">{player.name}</span>
            <span className="forge-mini-role">{player.role}</span>
            <span className={`forge-mini-price ${player.heat}`}>
                {player.price.toLocaleString()}
            </span>
            <span className={`forge-mini-change ${isUp ? 'up' : 'down'}`}>
                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{player.change}%
            </span>
        </div>
    )
}

export default function ForgePromoSection() {
    const tickerRef = useRef(null)

    // Adjust ticker speed based on content width so it always loops smoothly
    useEffect(() => {
        const el = tickerRef.current
        if (!el) return
        const measure = () => {
            const halfWidth = el.scrollWidth / 2
            // ~60px per second scroll speed
            const duration = Math.max(halfWidth / 60, 15)
            el.style.setProperty('--ticker-duration', `${duration}s`)
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    const topThree = MOCK_PLAYERS.slice(0, 3)

    return (
        <section className="py-3">
            <div className="forge-promo">
                    {/* Flowing lava bg */}
                    <div className="forge-promo-bg" />


                    {/* Angular price graph background */}
                    <div className="forge-promo-graph">
                        <svg viewBox="0 0 900 180" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="fp-graphFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#e86520" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#e86520" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="fp-graphLine" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#c44a10" />
                                    <stop offset="30%" stopColor="#e86520" />
                                    <stop offset="60%" stopColor="#ffaa33" />
                                    <stop offset="100%" stopColor="#e86520" />
                                </linearGradient>
                            </defs>
                            <path d={GRAPH_FILL} fill="url(#fp-graphFill)" />
                            <path d={GRAPH_PATH} fill="none" stroke="url(#fp-graphLine)" strokeWidth="1.5" strokeLinejoin="bevel" />
                        </svg>
                    </div>

                    {/* Accent lines */}
                    <div className="forge-promo-accent-bottom" />
                    <div className="forge-promo-accent-top" />

                    {/* Main content: info + mini cards — bounded to page width */}
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="forge-promo-content">
                            <div className="forge-promo-info">
                                <div className="forge-promo-title">Fantasy <span>Forge</span></div>
                                <p className="forge-promo-desc">
                                    A <strong>player investment market</strong> driven by real match performance.
                                    Fuel Sparks into players you believe in — prices rise and fall based on how they play.
                                    Build a portfolio. Climb the Hall of Flame.
                                </p>
                                <p className="forge-promo-fine">
                                    No real money. Just Passion, strategy, and bragging rights.
                                </p>
                                <Link to="/forge" className="forge-heat-btn">
                                    Enter the Forge
                                </Link>
                            </div>

                            {/* Mini player cards showing heat tiers */}
                            <div className="forge-promo-preview">
                                {topThree.map(p => (
                                    <MiniCard key={p.initials} player={p} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Seamless looping ticker — full width */}
                    <div className="forge-ticker-wrap">
                        <div className="forge-ticker" ref={tickerRef}>
                            {MOCK_PLAYERS.map(p => <TickerItem key={`a-${p.initials}`} player={p} />)}
                            {MOCK_PLAYERS.map(p => <TickerItem key={`b-${p.initials}`} player={p} />)}
                        </div>
                    </div>
                </div>
        </section>
    )
}
