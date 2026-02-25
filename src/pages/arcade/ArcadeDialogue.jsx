import { useState, useEffect, useCallback } from 'react'
import { NPC_SPRITE_MAP } from './npcSprites'
import './arcade.css'

export default function ArcadeDialogue({ npc, onClose }) {
    const [displayedText, setDisplayedText] = useState('')
    const [done, setDone] = useState(false)

    const fullText = npc?.quote || ''

    useEffect(() => {
        if (!fullText) return
        setDisplayedText('')
        setDone(false)

        let i = 0
        const interval = setInterval(() => {
            i++
            if (i >= fullText.length) {
                setDisplayedText(fullText)
                setDone(true)
                clearInterval(interval)
            } else {
                setDisplayedText(fullText.slice(0, i))
            }
        }, 30)

        return () => clearInterval(interval)
    }, [fullText])

    const handleAdvance = useCallback(() => {
        if (!done) {
            setDisplayedText(fullText)
            setDone(true)
        } else {
            onClose()
        }
    }, [done, fullText, onClose])

    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
                e.preventDefault()
                handleAdvance()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [handleAdvance])

    if (!npc) return null

    return (
        <div className="arcade-dialogue-backdrop" onClick={handleAdvance}>
            <div className="arcade-dialogue" onClick={handleAdvance}>
                {/* Name header */}
                <div className="arcade-dialogue-name">{npc.name}</div>

                <div className="arcade-dialogue-body">
                    {/* Portrait — show only top 16×16 frame from sprite sheet */}
                    {npc.image_url && NPC_SPRITE_MAP[npc.image_url] && (
                        <div className="arcade-dialogue-portrait">
                            <img src={NPC_SPRITE_MAP[npc.image_url].src} alt={npc.name}
                                style={{ objectPosition: 'top' }} />
                        </div>
                    )}

                    {/* Text */}
                    <div className="arcade-dialogue-text">
                        {displayedText}
                        {!done && <span className="arcade-dialogue-cursor">|</span>}
                    </div>
                </div>

                {/* Advance indicator */}
                {done && (
                    <div className="arcade-dialogue-advance">
                        PRESS ENTER
                    </div>
                )}
            </div>
        </div>
    )
}
