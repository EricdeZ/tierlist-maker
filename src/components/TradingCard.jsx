import { useState, useEffect } from 'react'
import useHoloEffect from '../hooks/useHoloEffect'
import { resolvePlayerImage, getGodCardUrl, getPlayerInitials } from '../utils/playerAvatar'
import './TradingCard.css'
import './TradingCardHolo.css'

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
    stats: statsProp,
    bestGod: bestGodProp,
    leagueName,
    divisionName,
    rarity,
    isConnected: isConnectedProp,
    isFirstEdition,
    size,
    holo,
    loadStats,
}) {
    const normalizedRole = normalizeRole(role)
    const roleImg = ROLE_IMAGES[normalizedRole]

    // --- loadStats: fetch card detail from API ---
    const [fetchedData, setFetchedData] = useState(null)
    const [loadingStats, setLoadingStats] = useState(!!loadStats)

    useEffect(() => {
        if (!loadStats) return
        setLoadingStats(true)
        setFetchedData(null)
        import('../services/database').then(({ vaultService }) =>
            vaultService.getCardDetail(loadStats)
        ).then(data => {
            setFetchedData(data)
        }).catch(err => {
            console.error('Failed to load card stats:', err)
        }).finally(() => setLoadingStats(false))
    }, [loadStats])

    // Merge fetched data over props
    const stats = fetchedData?.stats || statsProp
    const bestGod = fetchedData?.bestGod || bestGodProp || (
        fetchedData?.bestGodName ? { name: fetchedData.bestGodName } : null
    )
    const seasonNameResolved = fetchedData?.seasonName || seasonName
    const isConnected = fetchedData?.isConnected !== undefined ? fetchedData.isConnected : isConnectedProp

    // --- Image fallback chain ---
    const bestGodName = bestGod?.name
    const initial = resolvePlayerImage({ avatarUrl, bestGodName, isConnected })
    const godCardFallbackUrl = bestGodName && isConnected !== false ? getGodCardUrl(bestGodName) : null

    const [imgSrc, setImgSrc] = useState(initial.src)
    const [imgFailed, setImgFailed] = useState(false)
    const [isGodImage, setIsGodImage] = useState(initial.isGodImage)

    useEffect(() => {
        const resolved = resolvePlayerImage({ avatarUrl, bestGodName, isConnected })
        setImgSrc(resolved.src)
        setImgFailed(false)
        setIsGodImage(resolved.isGodImage)
    }, [avatarUrl, bestGodName, isConnected])

    const handleImgError = () => {
        if (imgSrc === avatarUrl && godCardFallbackUrl && imgSrc !== godCardFallbackUrl) {
            setImgSrc(godCardFallbackUrl)
            setIsGodImage(true)
        } else {
            setImgFailed(true)
        }
    }

    // --- Holo effect (always called — React rules of hooks) ---
    const { cardRef, dynamicStyles, interacting, active, handlers } = useHoloEffect()
    const roleClass = normalizedRole.toLowerCase()

    // --- Loading placeholder ---
    if (loadingStats) {
        const loadingSize = size || 340
        return (
            <div style={{ width: loadingSize, aspectRatio: '63 / 88', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="cd-spinner w-8 h-8" />
            </div>
        )
    }

    // --- Render card content ---
    const cardStyle = !holo && size ? { width: size, '--card-scale': size / 340 } : undefined

    const cardContent = (
        <div className="trading-card trading-card--player" data-role={normalizedRole} data-rarity={rarity || undefined} style={cardStyle}>
            {/* Gold outer border */}
            <div className="card-border">
                {/* Dark inner body */}
                <div className="card-body">

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

                    {/* Image frame — fallback: Discord → Passionless → God Card → Initials */}
                    <div className="card-image-wrap">
                        <div className="card-image-frame">
                            {isConnected === false && !imgSrc ? (
                                <div className="card-image-placeholder" style={{ position: 'relative' }}>
                                    <img src={passiontailsImg} alt="Passionless" style={{ width: '100%', height: '100%', opacity: 0.5, objectFit: 'contain' }} />
                                    <span style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, fontSize: '10px', fontWeight: 700, color: 'var(--text-dim, #9a8a70)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.3 }}>
                                        Passionless<br />Not Connected
                                    </span>
                                </div>
                            ) : imgSrc && !imgFailed ? (
                                <img
                                    src={imgSrc}
                                    alt={playerName}
                                    style={isGodImage ? { objectPosition: 'center 20%' } : undefined}
                                    onError={handleImgError}
                                />
                            ) : (
                                <div className="card-image-placeholder">
                                    <span className="card-image-initials" style={{ color: teamColor || 'var(--accent)' }}>
                                        {getPlayerInitials(playerName)}
                                    </span>
                                </div>
                            )}
                        </div>
                        {/* Corner accents */}
                        <div className="card-corner card-corner-tl" />
                        <div className="card-corner card-corner-tr" />
                        <div className="card-corner card-corner-bl" />
                        <div className="card-corner card-corner-br" />
                    </div>

                    {/* Team / League / Division info */}
                    <div className="card-info-bar">
                        <span className="card-info-text">
                            {[teamName, leagueName, divisionName].filter(Boolean).join(' \u00b7 ')}
                        </span>
                    </div>

                    {/* Stats section — structure always present, values show — when no stats */}
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
                                    <span className="card-stat-sub">{stats?.gamesPlayed ? `${stats.totalKills}/${stats.totalDeaths}/${stats.totalAssists}` : '\u2014/\u2014/\u2014'}</span>
                                </div>
                                <span className="card-stat-value">{stats?.gamesPlayed ? stats.kda?.toFixed(1) : '\u2014'}</span>
                            </div>
                            {ROLE_STATS[normalizedRole] === 'damage' && (
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
                                    <span className="card-stat-value">{stats?.gamesPlayed ? fmt(stats.avgDamage || 0) : '\u2014'}</span>
                                </div>
                            )}
                            {ROLE_STATS[normalizedRole] === 'mitigated' && (
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
                                    <span className="card-stat-value">{stats?.gamesPlayed ? fmt(stats.avgMitigated || 0) : '\u2014'}</span>
                                </div>
                            )}
                        </div>

                        {/* Record bar */}
                        <div className="card-record-bar">
                            <div className="card-record-item">
                                <span className="card-record-val">{stats?.gamesPlayed ? `${stats.winRate?.toFixed(0)}%` : '\u2014'}</span>
                                <span className="card-record-label">WR</span>
                            </div>
                            <div className="card-record-divider" />
                            <div className="card-record-item">
                                <span className="card-record-val">{stats?.gamesPlayed ? `${stats.wins || 0}W-${(stats.gamesPlayed || 0) - (stats.wins || 0)}L` : '\u2014'}</span>
                                <span className="card-record-label">Record</span>
                            </div>
                            <div className="card-record-divider" />
                            <div className="card-record-item">
                                <span className="card-record-val">{stats?.gamesPlayed || '\u2014'}</span>
                                <span className="card-record-label">Games</span>
                            </div>
                        </div>
                    </div>

                    {/* Flavor text */}
                    <div className="card-flavor">
                        {bestGod?.imageUrl && (
                            <img src={bestGod.imageUrl} alt={bestGod.name} className="card-flavor-img" />
                        )}
                        <span className="card-flavor-text">
                            {bestGod
                                ? bestGod.games != null
                                    ? `${playerName}'s most played god is ${bestGod.name} with ${bestGod.games} game${bestGod.games !== 1 ? 's' : ''} and a ${bestGod.winRate?.toFixed(0)}% win rate.`
                                    : `${playerName}'s most played god is ${bestGod.name}.`
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
                        <span className="card-footer-set">{seasonNameResolved}</span>
                    </div>

                </div>
            </div>

        </div>
    )

    // --- Holo wrapper ---
    if (holo) {
        return (
            <div
                className={`holo-card ${roleClass} ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
                data-rarity={holo.rarity}
                data-holo-type={holo.holoType}
                style={{ ...dynamicStyles, ...(size ? { width: size, '--card-scale': size / 340 } : {}) }}
                ref={cardRef}
            >
                <div className="holo-card__translater">
                    <div className="holo-card__rotator" {...handlers}>
                        <div className="holo-card__front">
                            {cardContent}
                            <div className="holo-card__shine" />
                            {holo.rarity === 'unique' && <div className="holo-card__shine2" />}
                            <div className="holo-card__glare" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return cardContent
}
