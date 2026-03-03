import { useState, useEffect, useRef } from 'react'
import { challengeService } from '../../services/database'
import { usePassion } from '../../context/PassionContext'
import { useAuth } from '../../context/AuthContext'
import { CHALLENGE_TIERS, getTierColor, getTierLabel } from '../../config/challengeTiers'
import passionCoin from '../../assets/passion/passion.png'

const TIER_ORDER = CHALLENGE_TIERS.map(t => t.key)

function spawnFlyingCoins(sourceEl) {
    const targets = document.querySelectorAll('#passion-balance-coin')
    let target = null
    for (const el of targets) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) { target = el; break }
    }
    if (!sourceEl || !target) return

    const sr = sourceEl.getBoundingClientRect()
    const tr = target.getBoundingClientRect()
    const sx = sr.left + sr.width / 2
    const sy = sr.top + sr.height / 2
    const tx = tr.left + tr.width / 2
    const ty = tr.top + tr.height / 2

    for (let i = 0; i < 6; i++) {
        const coin = document.createElement('img')
        coin.src = passionCoin
        const size = 14 + Math.random() * 8
        coin.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:9999;pointer-events:none;will-change:transform;`
        document.body.appendChild(coin)

        const spreadX = (Math.random() - 0.5) * 60
        const spreadY = (Math.random() - 0.5) * 30
        const hs = size / 2

        const anim = coin.animate([
            { transform: `translate(${sx + spreadX - hs}px, ${sy + spreadY - hs}px) scale(1)`, opacity: 1 },
            { transform: `translate(${tx - hs}px, ${ty - hs}px) scale(0.4)`, opacity: 0.3 },
        ], { duration: 700 + Math.random() * 300, delay: i * 60, easing: 'ease-in', fill: 'forwards' })
        anim.onfinish = () => coin.remove()
    }
}

export default function XpScrimChallengesWindow({ dark }) {
    const { user, login } = useAuth()
    const { refreshBalance } = usePassion()
    const [challenges, setChallenges] = useState([])
    const [loading, setLoading] = useState(true)
    const [claimingId, setClaimingId] = useState(null)
    const [claimedIds, setClaimedIds] = useState(new Set())
    const claimRefs = useRef({})

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        challengeService.getAll().then(data => {
            if (cancelled) return
            // Flatten all tiers, filter to scrim category
            const all = Object.values(data.challenges || {}).flat()
            const scrim = all.filter(ch => ch.category === 'scrim')
            // Sort by tier order, then sort_order
            scrim.sort((a, b) => {
                const ta = TIER_ORDER.indexOf(a.tier)
                const tb = TIER_ORDER.indexOf(b.tier)
                if (ta !== tb) return ta - tb
                return (a.targetValue || 0) - (b.targetValue || 0)
            })
            setChallenges(scrim)
        }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [user])

    const handleClaim = async (ch) => {
        setClaimingId(ch.id)
        try {
            await challengeService.claim(ch.id)
            // Flying coins animation
            const el = claimRefs.current[ch.id]
            if (el) spawnFlyingCoins(el)
            setClaimedIds(prev => new Set([...prev, ch.id]))
            // Refresh challenge list + passion balance
            refreshBalance()
            const data = await challengeService.getAll()
            const all = Object.values(data.challenges || {}).flat()
            const scrim = all.filter(c => c.category === 'scrim')
            scrim.sort((a, b) => {
                const ta = TIER_ORDER.indexOf(a.tier)
                const tb = TIER_ORDER.indexOf(b.tier)
                if (ta !== tb) return ta - tb
                return (a.targetValue || 0) - (b.targetValue || 0)
            })
            setChallenges(scrim)
        } catch (err) {
            console.error('Claim failed:', err)
        } finally {
            setClaimingId(null)
        }
    }

    if (!user) {
        return (
            <div style={{ padding: 10, textAlign: 'center' }}>
                <div className="xp-text" style={{ fontSize: 11, color: dark ? '#5a7a98' : '#444', marginBottom: 8 }}>
                    Log in to track scrim challenge progress.
                </div>
                <button className="xp-btn xp-btn-primary" style={{ fontSize: 11 }} onClick={login}>
                    Log In
                </button>
            </div>
        )
    }

    if (loading) {
        return (
            <div style={{ padding: 12, textAlign: 'center' }}>
                <div className="xp-text" style={{ fontSize: 11, color: dark ? '#5a7a98' : '#666' }}>Loading challenges...</div>
            </div>
        )
    }

    if (challenges.length === 0) {
        return (
            <div style={{ padding: 12, textAlign: 'center' }}>
                <div className="xp-text" style={{ fontSize: 11, color: dark ? '#5a7a98' : '#666' }}>No scrim challenges available.</div>
            </div>
        )
    }

    const completed = challenges.filter(ch => ch.completed).length
    const claimable = challenges.filter(ch => ch.claimable).length

    const d = dark
    const c = {
        summaryBg: d ? 'rgba(255,255,255,0.04)' : '#f0efe4',
        summaryBorder: d ? '1px solid rgba(255,255,255,0.06)' : '1px solid #d4d0c8',
        summaryText: d ? '#8899aa' : '#333',
        claimableText: d ? '#6ce86c' : '#006600',
        itemBorder: (claimable) => d
            ? `1px solid ${claimable ? 'rgba(100,200,60,0.25)' : 'rgba(255,255,255,0.06)'}`
            : `1px solid ${claimable ? '#4a0' : '#c0c0c0'}`,
        itemBg: (completed, claimable) => d
            ? (completed ? 'rgba(255,255,255,0.02)' : claimable ? 'rgba(100,200,60,0.04)' : 'rgba(255,255,255,0.025)')
            : (completed ? '#f4f8f4' : claimable ? '#fffff0' : '#fafaf6'),
        titleColor: d ? '#e0e6ed' : '#222',
        rewardColor: d ? '#8899aa' : '#666',
        descColor: d ? '#7a8a9a' : '#555',
        barBg: d ? 'rgba(255,255,255,0.08)' : '#e0ddd4',
        barBorder: d ? '1px solid rgba(255,255,255,0.06)' : '1px inset #c0c0c0',
        barText: d ? '#c8d4e0' : '#333',
        barShadow: d ? '0 0 2px rgba(0,0,0,0.5)' : '0 0 2px rgba(255,255,255,0.8)',
        claimedColor: d ? '#6ce86c' : '#060',
        tierFont: d ? "'Lato', system-ui, sans-serif" : '"Pixelify Sans", monospace',
    }

    return (
        <div style={{ padding: 6 }}>
            {/* Summary bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 6px', marginBottom: 6, background: c.summaryBg,
                border: c.summaryBorder, fontSize: 10, borderRadius: d ? 6 : undefined,
            }}>
                <span className="xp-text" style={{ color: c.summaryText }}>
                    {completed}/{challenges.length} completed
                </span>
                {claimable > 0 && (
                    <span className="xp-text" style={{ color: c.claimableText, fontWeight: 700 }}>
                        {claimable} ready to claim!
                    </span>
                )}
            </div>

            {/* Challenge list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {challenges.map(ch => {
                    const tierColor = getTierColor(ch.tier)
                    const progress = Math.min((ch.currentValue || 0) / ch.targetValue, 1)
                    const isClaimable = ch.claimable && !ch.completed
                    const justClaimed = claimedIds.has(ch.id)

                    return (
                        <div key={ch.id} style={{
                            border: c.itemBorder(isClaimable),
                            background: c.itemBg(ch.completed, isClaimable),
                            padding: '5px 6px',
                            borderRadius: d ? 6 : 2,
                            opacity: ch.completed ? 0.65 : 1,
                        }}>
                            {/* Title row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                <span style={{
                                    display: 'inline-block', padding: '0 4px',
                                    background: tierColor, color: '#fff', fontSize: 9,
                                    fontWeight: 700, borderRadius: d ? 4 : 2, lineHeight: '15px',
                                    textShadow: '0 1px 1px rgba(0,0,0,0.3)',
                                    fontFamily: c.tierFont,
                                }}>
                                    {getTierLabel(ch.tier)}
                                </span>
                                <span className="xp-text" style={{
                                    fontSize: 11, fontWeight: 600, color: c.titleColor, flex: 1,
                                }}>
                                    {ch.title}
                                    {ch.givesBadge && <span style={{ color: tierColor, marginLeft: 3 }} title="Grants badge">★</span>}
                                </span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: 2,
                                    fontSize: 10, color: c.rewardColor, fontWeight: 600,
                                }}>
                                    <img src={passionCoin} alt="" style={{ width: 12, height: 12 }} />
                                    {ch.reward}
                                </span>
                            </div>

                            {/* Description */}
                            <div className="xp-text" style={{ fontSize: 10, color: c.descColor, marginBottom: 3 }}>
                                {ch.description}
                            </div>

                            {/* Progress bar + claim */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                    flex: 1, height: 12, background: c.barBg,
                                    border: c.barBorder, borderRadius: d ? 4 : 1, overflow: 'hidden',
                                    position: 'relative',
                                }}>
                                    <div style={{
                                        width: `${progress * 100}%`,
                                        height: '100%',
                                        background: ch.completed
                                            ? (d ? 'rgba(100,200,100,0.4)' : '#8c8')
                                            : isClaimable
                                                ? `linear-gradient(180deg, ${tierColor}cc, ${tierColor})`
                                                : `linear-gradient(180deg, ${tierColor}88, ${tierColor}aa)`,
                                        transition: 'width 0.3s ease',
                                        borderRadius: d ? 4 : 0,
                                    }} />
                                    <span style={{
                                        position: 'absolute', inset: 0, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9, fontWeight: 600, color: c.barText,
                                        textShadow: c.barShadow,
                                    }}>
                                        {ch.completed ? 'Completed' : `${ch.currentValue || 0} / ${ch.targetValue}`}
                                    </span>
                                </div>

                                {isClaimable && (
                                    <button
                                        ref={el => { claimRefs.current[ch.id] = el }}
                                        className="xp-btn xp-btn-primary"
                                        style={{ fontSize: 9, padding: '1px 8px', lineHeight: '16px', whiteSpace: 'nowrap' }}
                                        onClick={() => handleClaim(ch)}
                                        disabled={claimingId === ch.id}
                                    >
                                        {claimingId === ch.id ? '...' : 'Claim'}
                                    </button>
                                )}
                                {justClaimed && ch.completed && (
                                    <span style={{ fontSize: 9, color: c.claimedColor, fontWeight: 700 }}>Claimed!</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
