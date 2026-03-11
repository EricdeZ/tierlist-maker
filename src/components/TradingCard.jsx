import './TradingCard.css'

import passiontailsImg from '../assets/passion/passiontails.png'
import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'

const ROLE_IMAGES = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage,
}

const normalizeRole = (role) => {
    if (!role) return 'ADC'
    const upper = role.toUpperCase()
    if (upper === 'SUPP') return 'SUPPORT'
    if (ROLE_IMAGES[upper]) return upper
    return 'ADC'
}

const fmt = (num) => {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    return Math.round(num).toLocaleString()
}

// Player variant: 2 stats per role (KDA always first)
const ROLE_STATS = {
    'SOLO':    'mitigated',
    'SUPPORT': 'mitigated',
    'JUNGLE':  'damage',
    'MID':     'damage',
    'ADC':     'damage',
}

export default function TradingCard({
    playerName,
    teamName,
    teamColor,
    seasonName,
    role,
    avatarUrl,
    level,
    power,
    stats,
    bestGod,
    variant,
    leagueName,
    divisionName,
    rarity,
    isConnected,
    isFirstEdition,
    size,
}) {
    const normalizedRole = normalizeRole(role)
    const roleImg = ROLE_IMAGES[normalizedRole]
    const hp = stats?.gamesPlayed ? stats.gamesPlayed * 10 : 0
    const isPlayer = variant === 'player'

    return (
        <div className={`trading-card ${isPlayer ? 'trading-card--player' : ''}`} data-role={normalizedRole} data-rarity={rarity || undefined} style={size ? { width: size } : undefined}>
            {/* Gold outer border */}
            <div className="card-border">
                {/* Dark inner body */}
                <div className="card-body">

                    {isPlayer ? (
                        <div className="card-top-banner">
                            <div className="card-top-left">
                                <span className="card-name">{playerName}</span>
                                {isFirstEdition && <span className="card-edition-badge">1st Edition</span>}
                            </div>
                            <div className="card-top-right">
                                <span className="card-stage-label">{normalizedRole}</span>
                                <div className="card-emblem card-emblem--sm">
                                    <img src={roleImg} alt={normalizedRole} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Top banner with role emblem */}
                            <div className="card-top-banner">
                                <div className="card-top-left">
                                    <span className="card-stage-label">{normalizedRole}</span>
                                </div>
                                <div className="card-emblem">
                                    <img src={roleImg} alt={normalizedRole} />
                                </div>
                                <div className="card-top-right">
                                    <span className="card-hp-label">HP</span>
                                    <span className="card-hp-value">{hp}</span>
                                </div>
                            </div>

                            {/* Player name */}
                            <div className="card-name-bar">
                                <span className="card-name">{playerName}</span>
                            </div>
                        </>
                    )}

                    {/* Image frame */}
                    <div className="card-image-wrap">
                        <div className="card-image-frame">
                            {isConnected === false ? (
                                <div className="card-image-placeholder" style={{ position: 'relative' }}>
                                    <img src={passiontailsImg} alt="Passionless" style={{ width: '100%', height: '100%', opacity: 0.5, objectFit: 'contain' }} />
                                    <span style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, fontSize: '10px', fontWeight: 700, color: 'var(--text-dim, #9a8a70)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.3 }}>
                                        Passionless<br />Not Connected
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={playerName} onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }} />
                                    ) : null}
                                    <div className="card-image-placeholder" style={avatarUrl ? { display: 'none' } : undefined}>
                                        {isPlayer ? (
                                            <span className="card-image-initials" style={{ color: teamColor || 'var(--accent)' }}>
                                                {(playerName || '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                                            </span>
                                        ) : (
                                            <img src={roleImg} alt={normalizedRole} />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Corner accents */}
                        <div className="card-corner card-corner-tl" />
                        <div className="card-corner card-corner-tr" />
                        <div className="card-corner card-corner-bl" />
                        <div className="card-corner card-corner-br" />
                    </div>

                    {/* Team / Season info */}
                    <div className="card-info-bar">
                        <span className="card-info-text">
                            {isPlayer
                                ? [teamName, leagueName, divisionName].filter(Boolean).join(' \u00b7 ')
                                : [teamName, seasonName].filter(Boolean).join(' \u00b7 ')
                            }
                        </span>
                    </div>

                    {/* Stats section */}
                    {stats && (
                        <div className="card-stats-section">
                            <div className="card-stats-grid">
                                <div className="card-stat-row">
                                    <div className="card-stat-energy">
                                        <div className="card-energy-circle">
                                            <img src={roleImg} alt="" />
                                        </div>
                                    </div>
                                    <div className="card-stat-info">
                                        <span className="card-stat-name">KDA Strike</span>
                                        <span className="card-stat-sub">{stats.gamesPlayed ? `${stats.totalKills}/${stats.totalDeaths}/${stats.totalAssists}` : '—/—/—'}</span>
                                    </div>
                                    <span className="card-stat-value">{stats.gamesPlayed ? stats.kda?.toFixed(1) : '—'}</span>
                                </div>
                                {(!isPlayer || ROLE_STATS[normalizedRole] === 'damage') && (
                                    <div className="card-stat-row">
                                        <div className="card-stat-energy">
                                            <div className="card-energy-circle">
                                                <img src={roleImg} alt="" />
                                            </div>
                                            <div className="card-energy-circle">
                                                <img src={roleImg} alt="" />
                                            </div>
                                        </div>
                                        <div className="card-stat-info">
                                            <span className="card-stat-name">Damage</span>
                                            <span className="card-stat-sub">Avg per game</span>
                                        </div>
                                        <span className="card-stat-value">{stats.gamesPlayed ? fmt(stats.avgDamage || 0) : '—'}</span>
                                    </div>
                                )}
                                {(!isPlayer || ROLE_STATS[normalizedRole] === 'mitigated') && (
                                    <div className="card-stat-row">
                                        <div className="card-stat-energy">
                                            <div className="card-energy-circle">
                                                <img src={roleImg} alt="" />
                                            </div>
                                            <div className="card-energy-circle">
                                                <img src={roleImg} alt="" />
                                            </div>
                                        </div>
                                        <div className="card-stat-info">
                                            <span className="card-stat-name">Mitigated</span>
                                            <span className="card-stat-sub">Avg per game</span>
                                        </div>
                                        <span className="card-stat-value">{stats.gamesPlayed ? fmt(stats.avgMitigated || 0) : '—'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Record bar */}
                            <div className="card-record-bar">
                                <div className="card-record-item">
                                    <span className="card-record-val">{stats.gamesPlayed ? `${stats.winRate?.toFixed(0)}%` : '—'}</span>
                                    <span className="card-record-label">WR</span>
                                </div>
                                <div className="card-record-divider" />
                                <div className="card-record-item">
                                    <span className="card-record-val">{stats.gamesPlayed ? `${stats.wins || 0}W-${(stats.gamesPlayed || 0) - (stats.wins || 0)}L` : '—'}</span>
                                    <span className="card-record-label">Record</span>
                                </div>
                                <div className="card-record-divider" />
                                <div className="card-record-item">
                                    <span className="card-record-val">{stats.gamesPlayed || '—'}</span>
                                    <span className="card-record-label">Games</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Flavor text */}
                    <div className="card-flavor">
                        {bestGod?.imageUrl && (
                            <img src={bestGod.imageUrl} alt={bestGod.name} className="card-flavor-img" />
                        )}
                        <span className="card-flavor-text">
                            {bestGod
                                ? `${playerName}'s most played god is ${bestGod.name} with ${bestGod.games} game${bestGod.games !== 1 ? 's' : ''} and a ${bestGod.winRate?.toFixed(0)}% win rate.`
                                : 'No games recorded this season.'
                            }
                        </span>
                    </div>

                    {/* Footer */}
                    <div className="card-footer">
                        <div className="card-footer-left">
                            <img src={roleImg} alt="" className="card-footer-icon" />
                            <span>{teamName || 'Free Agent'}</span>
                        </div>
                        <span className="card-footer-set">{seasonName}</span>
                    </div>

                </div>
            </div>
        </div>
    )
}
