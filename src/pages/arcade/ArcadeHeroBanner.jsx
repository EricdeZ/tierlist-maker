import { useRef, useEffect, useCallback } from 'react'
import { createGalagaGame } from './arcadeGalaga'

const REDUCED_MOTION = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ArcadeHeroBanner() {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const gameRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || REDUCED_MOTION) return

        const game = createGalagaGame(canvas, {
            onStateChange: (state) => {
                // Set data attribute so SidebarContext knows not to steal keys
                if (containerRef.current) {
                    if (state === 'playing') {
                        containerRef.current.setAttribute('data-arcade-game', 'true')
                    } else {
                        containerRef.current.removeAttribute('data-arcade-game')
                    }
                }
            },
        })
        gameRef.current = game
        game.start()

        const handleResize = () => game.resize()
        window.addEventListener('resize', handleResize)

        return () => {
            game.stop()
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    const handleClick = useCallback(() => {
        if (gameRef.current) {
            gameRef.current.pressStart()
        }
    }, [])

    if (REDUCED_MOTION) {
        return (
            <div
                className="w-full rounded-lg mb-6 flex items-center justify-center"
                style={{
                    height: 200,
                    background: 'var(--arcade-panel)',
                    border: '1.5px solid var(--arcade-border)',
                }}
            >
                <h2 className="arcade-title text-lg" style={{ color: 'var(--arcade-cyan)' }}>
                    THE ARCADE
                </h2>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="w-full rounded-lg mb-6 overflow-hidden cursor-pointer arcade-scanlines"
            style={{
                height: 220,
                background: 'var(--arcade-bg)',
                border: '1.5px solid var(--arcade-border)',
            }}
            onClick={handleClick}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    )
}
