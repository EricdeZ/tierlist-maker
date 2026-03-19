import './easter.css'

export default function EasterHUD({ eggsCollected, timeRemaining, gameState, coresAwarded, playsRemaining, onPlayAgain }) {
    const formatTime = (s) => {
        if (s == null) return null
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
    }

    return (
        <div className="easter-hud">
            <div className="easter-hud-item">
                🥚 {eggsCollected}
            </div>

            {gameState === 'active' && timeRemaining != null && (
                <div className="easter-hud-item easter-hud-timer">
                    ⏱ {formatTime(timeRemaining)}
                </div>
            )}

            {gameState === 'ended' && coresAwarded != null && (
                <div className="easter-hud-item easter-hud-score">
                    +{coresAwarded} Cores
                </div>
            )}

            {gameState === 'ended' && playsRemaining > 0 && (
                <div className="easter-hud-item easter-hud-play-again" onClick={onPlayAgain}>
                    Play Again
                </div>
            )}

            <div className="easter-hud-item" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                {playsRemaining}/5 hunts
            </div>
        </div>
    )
}
