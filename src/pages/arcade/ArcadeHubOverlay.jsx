import { useEffect, useRef, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { coinflipService } from '../../services/database'
import ArcadeLobbyList from './ArcadeLobbyList'
import ArcadeHighScores from './ArcadeHighScores'
import ArcadeCreateModal from './ArcadeCreateModal'

const TITLES = {
    'cabinets': 'ARCADE CABINETS',
    'my-games': 'MY GAMES',
    'high-scores': 'HIGH SCORES',
    'create': 'NEW GAME',
    'coinflip': 'COIN FLIP',
}

function CoinFlipMini() {
    const { user, login } = useAuth()
    const [flipping, setFlipping] = useState(false)
    const [result, setResult] = useState(null)
    const [streak, setStreak] = useState(0)
    const [error, setError] = useState(null)
    const coinRef = useRef(null)

    const loadStats = useCallback(async () => {
        if (!user) return
        try {
            const stats = await coinflipService.getMyStats()
            if (stats) setStreak(stats.current_streak || 0)
        } catch {}
    }, [user])

    useEffect(() => { loadStats() }, [loadStats])

    const doFlip = async () => {
        if (flipping || !user) return
        setFlipping(true)
        setError(null)

        // Spin animation
        if (coinRef.current) {
            coinRef.current.style.animation = 'arcade-coin-spin 0.6s ease-in-out'
        }

        try {
            const data = await coinflipService.flip()
            setTimeout(() => {
                setResult(data.result)
                setStreak(data.result === 'heads' ? (streak + 1) : 0)
                setFlipping(false)
                if (coinRef.current) coinRef.current.style.animation = ''
            }, 600)
        } catch (err) {
            setError(err.message || 'Flip failed')
            setFlipping(false)
            if (coinRef.current) coinRef.current.style.animation = ''
        }
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="arcade-label" style={{ color: 'var(--arcade-text-mid)' }}>LOG IN TO FLIP</p>
                <button
                    onClick={login}
                    className="arcade-label px-6 py-2 rounded"
                    style={{ background: 'var(--arcade-cyan-dim)', color: 'var(--arcade-cyan)' }}
                >
                    LOGIN WITH DISCORD
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center py-8 gap-6">
            {/* Coin */}
            <div
                ref={coinRef}
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold cursor-pointer select-none"
                style={{
                    background: result === 'tails'
                        ? 'linear-gradient(135deg, #cc4444, #882222)'
                        : 'linear-gradient(135deg, var(--arcade-yellow), #cc9900)',
                    border: '3px solid rgba(255,255,255,0.2)',
                    boxShadow: result === 'heads'
                        ? '0 0 20px rgba(255, 230, 0, 0.4)'
                        : result === 'tails'
                            ? '0 0 20px rgba(255, 68, 102, 0.4)'
                            : '0 0 20px rgba(255, 230, 0, 0.2)',
                    transition: 'box-shadow 0.3s',
                }}
                onClick={doFlip}
            >
                {result === 'heads' ? '★' : result === 'tails' ? '✕' : '?'}
            </div>

            {/* Result */}
            {result && (
                <div className="arcade-label text-center" style={{
                    color: result === 'heads' ? 'var(--arcade-win)' : 'var(--arcade-loss)',
                }}>
                    {result === 'heads' ? 'HEADS! +1 PASSION' : 'TAILS! -1 PASSION'}
                </div>
            )}

            {/* Streak */}
            {streak > 0 && (
                <div className="arcade-label" style={{ color: 'var(--arcade-yellow)' }}>
                    STREAK: {streak}
                </div>
            )}

            {/* Flip button */}
            <button
                onClick={doFlip}
                disabled={flipping}
                className="arcade-label px-8 py-3 rounded transition-all hover:scale-105 disabled:opacity-50"
                style={{
                    background: 'var(--arcade-yellow)',
                    color: 'var(--arcade-bg)',
                }}
            >
                {flipping ? 'FLIPPING...' : 'FLIP COIN'}
            </button>

            {error && (
                <p className="arcade-label text-xs" style={{ color: 'var(--arcade-loss)' }}>{error}</p>
            )}
        </div>
    )
}

export default function ArcadeHubOverlay({
    type,
    onClose,
    lobbies,
    myLobbies,
    loading,
    onSelectLobby,
    onCreate,
    user,
    login,
}) {
    const overlayRef = useRef(null)

    // ESC to close
    useEffect(() => {
        const handleKey = (e) => {
            if (e.code === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    // Click outside to close
    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose()
    }

    const renderContent = () => {
        switch (type) {
            case 'cabinets':
                return (
                    <ArcadeLobbyList
                        lobbies={lobbies}
                        loading={loading}
                        onSelect={onSelectLobby}
                    />
                )

            case 'my-games':
                return user ? (
                    <ArcadeLobbyList
                        lobbies={myLobbies}
                        loading={loading}
                        onSelect={onSelectLobby}
                        emptyMessage="You haven't joined any active games yet."
                    />
                ) : (
                    <div className="text-center py-16">
                        <p className="arcade-label mb-4" style={{ color: 'var(--arcade-text-mid)' }}>
                            LOG IN TO VIEW YOUR GAMES
                        </p>
                        <button
                            onClick={login}
                            className="arcade-label px-6 py-2 rounded"
                            style={{ background: 'var(--arcade-cyan-dim)', color: 'var(--arcade-cyan)' }}
                        >
                            LOGIN WITH DISCORD
                        </button>
                    </div>
                )

            case 'high-scores':
                return <ArcadeHighScores />

            case 'create':
                return user ? (
                    <ArcadeCreateModal
                        embedded
                        onClose={onClose}
                        onCreate={async (data) => {
                            await onCreate(data)
                            onClose()
                        }}
                    />
                ) : (
                    <div className="text-center py-16">
                        <p className="arcade-label mb-4" style={{ color: 'var(--arcade-text-mid)' }}>
                            LOG IN TO CREATE A GAME
                        </p>
                        <button
                            onClick={login}
                            className="arcade-label px-6 py-2 rounded"
                            style={{ background: 'var(--arcade-cyan-dim)', color: 'var(--arcade-cyan)' }}
                        >
                            LOGIN WITH DISCORD
                        </button>
                    </div>
                )

            case 'coinflip':
                return <CoinFlipMini />

            default:
                return null
        }
    }

    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.75)' }}
            onClick={handleBackdrop}
        >
            <div
                ref={overlayRef}
                className="arcade-hub-overlay w-full max-w-2xl max-h-[80vh] overflow-y-auto"
                style={{ animation: 'arcade-overlay-in 0.2s ease-out' }}
            >
                {/* CRT bezel frame */}
                <div className="arcade-hub-overlay-inner arcade-scanlines">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h2 className="arcade-title text-xs sm:text-sm" style={{ color: 'var(--arcade-cyan)' }}>
                            {TITLES[type] || 'ARCADE'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="flex items-center gap-1.5 arcade-label px-2 py-1 rounded transition-all hover:scale-105"
                            style={{ color: 'var(--arcade-text-mid)', background: 'var(--arcade-surface)' }}
                        >
                            <X className="w-3 h-3" />
                            ESC
                        </button>
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}
