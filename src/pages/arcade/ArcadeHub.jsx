import { useRef, useEffect, useCallback, useState } from 'react'
import { createArcadeHub } from './arcadeHubEngine'
import ArcadeHubOverlay from './ArcadeHubOverlay'
import ArcadeDialogue from './ArcadeDialogue'
import { arcadeNpcService } from '../../services/database'

// Image assets for the game world
import tilesetImg from '../../assets/arcade/game_corner.png'
import zeusImg from '../../assets/zeus.png'

export default function ArcadeHub({
    lobbies,
    myLobbies,
    loading,
    user,
    login,
    onSelectLobby,
    onCreate,
}) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const gameRef = useRef(null)
    const [activeOverlay, setActiveOverlay] = useState(null)
    const [dialogueNpc, setDialogueNpc] = useState(null)

    const handleInteract = useCallback((type) => {
        setActiveOverlay(type)
    }, [])

    const handleNpcInteract = useCallback((npc) => {
        setDialogueNpc(npc)
    }, [])

    const handleClose = useCallback(() => {
        setActiveOverlay(null)
    }, [])

    const handleDialogueClose = useCallback(() => {
        setDialogueNpc(null)
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const game = createArcadeHub(canvas, {
            onInteract: (type) => handleInteract(type),
            onNpcInteract: (npc) => handleNpcInteract(npc),
            images: {
                tileset: tilesetImg,
                zeus: zeusImg,
            },
        })
        gameRef.current = game
        game.start()

        // Fetch NPCs
        arcadeNpcService.list().then(data => {
            if (data.npcs) game.setNpcs(data.npcs)
        }).catch(() => {})

        if (containerRef.current) {
            containerRef.current.setAttribute('data-arcade-game', 'true')
        }

        const handleResize = () => game.resize()
        window.addEventListener('resize', handleResize)

        return () => {
            game.stop()
            window.removeEventListener('resize', handleResize)
        }
    }, [handleInteract, handleNpcInteract])

    useEffect(() => {
        if (!gameRef.current) return
        if (activeOverlay || dialogueNpc) gameRef.current.pause()
        else gameRef.current.resume()
    }, [activeOverlay, dialogueNpc])

    return (
        <div
            ref={containerRef}
            className="fixed inset-0"
            style={{ background: '#0a0a1a' }}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                style={{ imageRendering: 'pixelated' }}
            />

            {activeOverlay && (
                <ArcadeHubOverlay
                    type={activeOverlay}
                    onClose={handleClose}
                    lobbies={lobbies}
                    myLobbies={myLobbies}
                    loading={loading}
                    onSelectLobby={onSelectLobby}
                    onCreate={onCreate}
                    user={user}
                    login={login}
                />
            )}

            {dialogueNpc && (
                <ArcadeDialogue npc={dialogueNpc} onClose={handleDialogueClose} />
            )}

            {/* Mobile hint */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 arcade-label pointer-events-none sm:hidden"
                style={{ color: 'var(--arcade-text-dim)', fontSize: '0.45rem' }}
            >
                SWIPE TO MOVE · TAP TO INTERACT
            </div>
        </div>
    )
}
