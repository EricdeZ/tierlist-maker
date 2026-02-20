import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { coinflipService } from '../../services/database'
import passionCoin from '../../assets/passion/passion.png'
import passionTails from '../../assets/passion/passiontails.png'

export default function XpCoinFlip() {
    const { user } = useAuth()
    const { balance, refreshBalance } = usePassion()

    const [flipping, setFlipping] = useState(false)
    const [lastResult, setLastResult] = useState(null)
    const [currentStreak, setCurrentStreak] = useState(0)
    const [bestStreak, setBestStreak] = useState(0)
    const [totalFlips, setTotalFlips] = useState(0)
    const [totalHeads, setTotalHeads] = useState(0)
    const [localBalance, setLocalBalance] = useState(null)
    const [resultDelta, setResultDelta] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [flipAngle, setFlipAngle] = useState(0)
    const flipRef = useRef(null)

    useEffect(() => {
        if (!user) return
        coinflipService.getMyStats()
            .then(data => {
                setCurrentStreak(data.currentStreak || 0)
                setBestStreak(data.bestStreak || 0)
                setTotalFlips(data.totalFlips || 0)
                setTotalHeads(data.totalHeads || 0)
            })
            .catch(() => {})
    }, [user])

    useEffect(() => {
        if (!flipping && balance !== undefined) setLocalBalance(balance)
    }, [balance, flipping])

    const loadLeaderboard = () => {
        coinflipService.getLeaderboard()
            .then(data => setLeaderboard(data.leaderboard || []))
            .catch(() => {})
    }

    const handleFlip = async () => {
        if (flipping || !user) return
        if ((localBalance ?? balance) < 1) return
        setFlipping(true)
        setResultDelta(null)
        setLastResult(null)

        // Fire API call and start 2s spin in parallel
        const apiPromise = coinflipService.flip().catch(err => { console.error('Flip failed:', err); return null })
        const timerPromise = new Promise(resolve => setTimeout(resolve, 2000))

        // Animate spinning for full 2 seconds
        const spinStart = performance.now()
        const spin = (now) => {
            const elapsed = now - spinStart
            // Speed up then slow down: fast in middle, decelerate near end
            const t = Math.min(elapsed / 2000, 1)
            const speed = t < 0.7 ? 20 : 20 * (1 - (t - 0.7) / 0.3) + 4
            setFlipAngle(prev => prev + speed)
            if (elapsed < 2000) flipRef.current = requestAnimationFrame(spin)
        }
        flipRef.current = requestAnimationFrame(spin)

        // Wait for both API and timer
        const [data] = await Promise.all([apiPromise, timerPromise])
        if (flipRef.current) cancelAnimationFrame(flipRef.current)

        if (data) {
            const isHeads = data.result === 'heads'
            setFlipAngle(isHeads ? 0 : 180)
            setLastResult(data.result)
            setResultDelta(isHeads ? +1 : -1)
            setCurrentStreak(data.currentStreak)
            setBestStreak(data.bestStreak)
            setTotalFlips(data.totalFlips)
            setTotalHeads(data.totalHeads)
            setLocalBalance(data.balance)
            setTimeout(() => refreshBalance(), 500)
        } else {
            setFlipAngle(0)
        }
        setFlipping(false)
    }

    useEffect(() => () => { if (flipRef.current) cancelAnimationFrame(flipRef.current) }, [])

    const headsRate = totalFlips > 0 ? Math.round((totalHeads / totalFlips) * 100) : 0

    // Determine which face to show
    const showTails = flipAngle % 360 >= 90 && flipAngle % 360 < 270
    const coinSrc = lastResult === 'tails' && !flipping ? passionTails
        : lastResult === 'heads' && !flipping ? passionCoin
        : showTails ? passionTails : passionCoin

    if (!user) {
        return (
            <div className="text-center py-6">
                <div style={{ fontSize: 32 }}>&#128176;</div>
                <div className="xp-text" style={{ fontWeight: 700, marginTop: 4 }}>Log in to flip</div>
                <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>Costs 1 Passion per flip</div>
            </div>
        )
    }

    return (
        <div style={{ padding: 4 }}>
            {/* Coin display */}
            <div className="flex flex-col items-center" style={{ padding: '10px 0 6px' }}>
                <div
                    className="xp-coin-wrap"
                    style={{ transform: flipping ? `rotateY(${flipAngle}deg)` : undefined }}
                >
                    <img src={coinSrc} alt="coin" className="xp-coin-img" draggable={false} />
                </div>

                {/* Result feedback */}
                {resultDelta !== null && (
                    <div style={{
                        fontSize: 14, fontWeight: 700, marginTop: 4,
                        fontFamily: '"Pixelify Sans", system-ui',
                        color: resultDelta > 0 ? '#2d8212' : '#cc0000',
                    }}>
                        {resultDelta > 0 ? 'HEADS! +1' : 'TAILS! -1'}
                    </div>
                )}

                {/* Flip button */}
                <button
                    onClick={handleFlip}
                    disabled={flipping || (localBalance ?? balance) < 1}
                    className="xp-btn xp-btn-primary"
                    style={{ marginTop: 6, padding: '4px 20px', fontSize: 12 }}
                >
                    {flipping ? 'Flipping...' : 'Flip (1 Passion)'}
                </button>

                {(localBalance ?? balance) < 1 && !flipping && (
                    <div className="xp-text" style={{ fontSize: 10, color: '#cc0000', marginTop: 2 }}>Not enough Passion!</div>
                )}
            </div>

            {/* Stats panel */}
            <fieldset className="xp-fieldset" style={{ marginTop: 4 }}>
                <legend className="xp-fieldset-legend">Stats</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                    <div className="xp-text"><b>Balance:</b> {localBalance ?? balance ?? 0}</div>
                    <div className="xp-text"><b>Streak:</b> {currentStreak}</div>
                    <div className="xp-text"><b>Best:</b> {bestStreak}</div>
                    <div className="xp-text"><b>Flips:</b> {totalFlips}</div>
                    <div className="xp-text"><b>Heads:</b> {totalHeads} ({headsRate}%)</div>
                    <div className="xp-text"><b>Tails:</b> {totalFlips - totalHeads}</div>
                </div>
            </fieldset>

            {/* Leaderboard toggle */}
            <button
                onClick={() => { setShowLeaderboard(!showLeaderboard); if (!showLeaderboard) loadLeaderboard() }}
                className="xp-btn w-full"
                style={{ marginTop: 4, fontSize: 11 }}
            >
                {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
            </button>

            {showLeaderboard && (
                <div style={{ marginTop: 4, background: '#fff', border: '2px solid', borderColor: '#7f9db9 #f0f0f0 #f0f0f0 #7f9db9', maxHeight: 150, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#ece9d8', borderBottom: '1px solid #c0c0c0' }}>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>#</th>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>Player</th>
                                <th className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700, fontSize: 10 }}>Best</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.slice(0, 10).map((entry, i) => (
                                <tr key={entry.userId || i} style={{ borderBottom: '1px solid #e8e8e8' }}>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.position || i + 1}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', fontSize: 10 }}>{entry.playerName || entry.discordUsername || '???'}</td>
                                    <td className="xp-text" style={{ padding: '2px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#0058e6' }}>{entry.bestStreak}</td>
                                </tr>
                            ))}
                            {leaderboard.length === 0 && (
                                <tr><td colSpan={3} className="xp-text" style={{ padding: '6px', textAlign: 'center', fontSize: 10, color: '#666' }}>No data yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
