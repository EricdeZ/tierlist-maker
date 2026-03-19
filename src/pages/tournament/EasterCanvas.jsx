import { useEffect, useRef, useCallback } from 'react'

const EGG_COLORS = [
    { fill: '#f472b6', stripe: '#db2777' },
    { fill: '#a78bfa', stripe: '#7c3aed' },
    { fill: '#60a5fa', stripe: '#2563eb' },
    { fill: '#fbbf24', stripe: '#d97706' },
    { fill: '#f87171', stripe: '#dc2626' },
]

const CHICK_COUNT = 8
const EGG_COUNT = 5
const BUNNY_SPEED = 2.5 // pixels per frame
const COLLECT_RADIUS = 50
const FORM_PADDING = 20
const SPAWN_MIN_BUNNY_DIST = 100

function distance(ax, ay, bx, by) {
    const dx = ax - bx
    const dy = ay - by
    return Math.sqrt(dx * dx + dy * dy)
}

function isInsideRect(x, y, rect, padding = 0) {
    if (!rect) return false
    return (
        x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding
    )
}

function findSpawnPosition(canvasW, canvasH, formRect, bunnyX, bunnyY, minBunnyDist) {
    const margin = 40
    for (let attempt = 0; attempt < 80; attempt++) {
        const x = margin + Math.random() * (canvasW - margin * 2)
        const y = margin + Math.random() * (canvasH - margin * 2)
        if (isInsideRect(x, y, formRect, FORM_PADDING)) continue
        if (minBunnyDist > 0 && distance(x, y, bunnyX, bunnyY) < minBunnyDist) continue
        return { x, y }
    }
    return { x: margin, y: margin }
}

function initChicks(count, canvasW, canvasH) {
    const chicks = []
    for (let i = 0; i < count; i++) {
        const x = 40 + Math.random() * (canvasW - 80)
        const y = 40 + Math.random() * (canvasH - 80)
        chicks.push({
            x,
            y,
            targetX: x,
            targetY: y,
            angle: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 0.4,
            pauseUntil: performance.now() + Math.random() * 2000,
        })
    }
    return chicks
}

// --- Drawing functions ---

function drawBunny(ctx, x, y, angle, hopScale = 1.0) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle) // 0 = facing right
    ctx.scale(hopScale, hopScale)

    // Shadow beneath (stays at ground level — drawn bigger when bunny is "up")
    ctx.beginPath()
    ctx.ellipse(0, 4, 28, 20, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.08 / hopScale})`
    ctx.fill()

    // Cottontail
    ctx.beginPath()
    ctx.arc(-26, 0, 10, 0, Math.PI * 2)
    ctx.fillStyle = '#e8e8e8'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-26, 0, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#f5f5f5'
    ctx.fill()

    // Hind legs — behind and to the sides
    ctx.fillStyle = '#e5e0dc'
    ctx.beginPath()
    ctx.ellipse(-14, -16, 10, 5, -0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-14, 16, 10, 5, 0.6, 0, Math.PI * 2)
    ctx.fill()

    // Front legs — forward and to the sides
    ctx.beginPath()
    ctx.ellipse(16, -14, 8, 4, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(16, 14, 8, 4, 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Body
    ctx.beginPath()
    ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f3f4f6'
    ctx.fill()
    ctx.strokeStyle = '#dcdcdc'
    ctx.lineWidth = 1
    ctx.stroke()

    // Head
    ctx.beginPath()
    ctx.arc(22, 0, 15, 0, Math.PI * 2)
    ctx.fillStyle = '#f3f4f6'
    ctx.fill()
    ctx.strokeStyle = '#dcdcdc'
    ctx.lineWidth = 1
    ctx.stroke()

    // Left ear — 50% smaller relative to doubled body
    ctx.save()
    ctx.translate(12, -16)
    ctx.rotate(-1.2)
    ctx.beginPath()
    ctx.ellipse(0, -6, 3, 8, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f0f0f0'
    ctx.fill()
    ctx.strokeStyle = '#dcdcdc'
    ctx.lineWidth = 0.5
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, -6, 1.8, 5.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f8c4d4'
    ctx.fill()
    ctx.restore()

    // Right ear
    ctx.save()
    ctx.translate(12, 16)
    ctx.rotate(1.2)
    ctx.beginPath()
    ctx.ellipse(0, 6, 3, 8, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f0f0f0'
    ctx.fill()
    ctx.strokeStyle = '#dcdcdc'
    ctx.lineWidth = 0.5
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 6, 1.8, 5.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f8c4d4'
    ctx.fill()
    ctx.restore()

    // Eyes
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.arc(28, -7, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(28, 7, 2.5, 0, Math.PI * 2)
    ctx.fill()

    // Nose
    ctx.beginPath()
    ctx.arc(36, 0, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#f0a0b8'
    ctx.fill()

    ctx.restore()
}

function drawChick(ctx, x, y, angle) {
    ctx.save()
    ctx.translate(x, y)

    // Body
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#fde047'
    ctx.fill()
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 0.6
    ctx.stroke()

    // Inner body highlight
    ctx.beginPath()
    ctx.arc(-1.5, -1.5, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(254, 249, 195, 0.5)'
    ctx.fill()

    // Beak — pointing in movement direction
    ctx.save()
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(13, -2.5)
    ctx.lineTo(13, 2.5)
    ctx.closePath()
    ctx.fillStyle = '#f97316'
    ctx.fill()
    ctx.restore()

    // Eyes — positioned based on angle so they face the movement direction
    const eyeOffset = 3.5
    const eyeForward = 3
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // Perpendicular to movement direction
    const perpX = -sin
    const perpY = cos

    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.arc(
        cos * eyeForward + perpX * eyeOffset,
        sin * eyeForward + perpY * eyeOffset,
        1.2, 0, Math.PI * 2
    )
    ctx.fill()
    ctx.beginPath()
    ctx.arc(
        cos * eyeForward - perpX * eyeOffset,
        sin * eyeForward - perpY * eyeOffset,
        1.2, 0, Math.PI * 2
    )
    ctx.fill()

    ctx.restore()
}

function drawEgg(ctx, x, y, color, bobOffset) {
    ctx.save()
    ctx.translate(x, y + bobOffset)
    ctx.scale(1.8, 1.8)

    // Shadow
    ctx.beginPath()
    ctx.ellipse(0, 10, 8, 2.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
    ctx.fill()

    // Egg shape
    ctx.beginPath()
    ctx.moveTo(0, -10)
    ctx.bezierCurveTo(-9, -8, -9, 5, -7, 8)
    ctx.bezierCurveTo(-5, 11, 5, 11, 7, 8)
    ctx.bezierCurveTo(9, 5, 9, -8, 0, -10)
    ctx.closePath()
    ctx.fillStyle = color.fill
    ctx.fill()
    ctx.strokeStyle = color.stripe
    ctx.lineWidth = 0.8
    ctx.stroke()

    // Middle stripe band
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, -10)
    ctx.bezierCurveTo(-9, -8, -9, 5, -7, 8)
    ctx.bezierCurveTo(-5, 11, 5, 11, 7, 8)
    ctx.bezierCurveTo(9, 5, 9, -8, 0, -10)
    ctx.closePath()
    ctx.clip()

    ctx.fillStyle = color.stripe
    ctx.globalAlpha = 0.35
    ctx.fillRect(-10, -1, 20, 5)

    ctx.globalAlpha = 0.5
    ctx.fillStyle = '#ffffff'
    for (let dx = -6; dx <= 6; dx += 4) {
        ctx.beginPath()
        ctx.arc(dx, 1.5, 1.2, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.restore()

    // Top highlight
    ctx.beginPath()
    ctx.ellipse(-2, -5, 3, 2, -0.3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fill()

    ctx.restore()
}

// --- Main component ---

export default function EasterCanvas({ formRef, onEggCollected, enabled }) {
    const canvasRef = useRef(null)
    const stateRef = useRef({
        bunny: { x: -100, y: -100, targetX: -100, targetY: -100, angle: 0, hopPhase: 0 },
        chicks: [],
        eggs: [],
        mouseX: -100,
        mouseY: -100,
        initialized: false,
        lastTime: 0,
    })
    const animFrameRef = useRef(null)
    const enabledRef = useRef(enabled)
    const onEggCollectedRef = useRef(onEggCollected)

    // Keep refs in sync without triggering effect re-runs
    useEffect(() => { enabledRef.current = enabled }, [enabled])
    useEffect(() => { onEggCollectedRef.current = onEggCollected }, [onEggCollected])

    const getFormRect = useCallback(() => {
        return formRef?.current?.getBoundingClientRect() ?? null
    }, [formRef])

    // Resize handler
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        const w = window.innerWidth
        const h = window.innerHeight
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'

        const state = stateRef.current

        // Re-init chicks if canvas size changed significantly
        if (!state.initialized) {
            state.chicks = initChicks(CHICK_COUNT, w, h)
            state.bunny.x = w / 2
            state.bunny.y = h / 2
            state.bunny.targetX = w / 2
            state.bunny.targetY = h / 2
            state.initialized = true
        }
    }, [])

    // Mouse/touch tracking
    useEffect(() => {
        const handleMouse = (e) => {
            stateRef.current.mouseX = e.clientX
            stateRef.current.mouseY = e.clientY
        }
        const handleTouch = (e) => {
            if (e.touches.length > 0) {
                stateRef.current.mouseX = e.touches[0].clientX
                stateRef.current.mouseY = e.touches[0].clientY
            }
        }

        window.addEventListener('mousemove', handleMouse)
        window.addEventListener('touchmove', handleTouch, { passive: true })
        window.addEventListener('touchstart', handleTouch, { passive: true })

        return () => {
            window.removeEventListener('mousemove', handleMouse)
            window.removeEventListener('touchmove', handleTouch)
            window.removeEventListener('touchstart', handleTouch)
        }
    }, [])

    // Canvas setup + animation loop
    useEffect(() => {
        handleResize()
        window.addEventListener('resize', handleResize)

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        function tick(timestamp) {
            const state = stateRef.current
            const w = window.innerWidth
            const h = window.innerHeight
            const currentDpr = window.devicePixelRatio || 1

            // Update canvas size if dpr changed
            if (canvas.width !== w * currentDpr || canvas.height !== h * currentDpr) {
                canvas.width = w * currentDpr
                canvas.height = h * currentDpr
                canvas.style.width = w + 'px'
                canvas.style.height = h + 'px'
            }

            ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0)
            ctx.clearRect(0, 0, w, h)

            const now = timestamp
            const formRect = getFormRect()

            // --- Update bunny ---
            const bunny = state.bunny
            bunny.targetX = state.mouseX
            bunny.targetY = state.mouseY
            const dx = bunny.targetX - bunny.x
            const dy = bunny.targetY - bunny.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            const isMoving = dist > 5
            if (isMoving) {
                // Move at fixed speed toward cursor
                const step = Math.min(BUNNY_SPEED, dist)
                bunny.x += (dx / dist) * step
                bunny.y += (dy / dist) * step
                bunny.angle = Math.atan2(dy, dx)
                bunny.hopPhase += 0.15
            }
            // Hop animation when moving
            const hopScale = isMoving ? 1.0 + Math.abs(Math.sin(bunny.hopPhase)) * 0.15 : 1.0
            const hopLift = isMoving ? Math.abs(Math.sin(bunny.hopPhase)) * 4 : 0

            // --- Update chicks ---
            for (const chick of state.chicks) {
                if (now < chick.pauseUntil) continue

                const cdx = chick.targetX - chick.x
                const cdy = chick.targetY - chick.y
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy)

                if (cdist < 3) {
                    // Reached target, pause and pick new one
                    chick.pauseUntil = now + 1000 + Math.random() * 2000
                    chick.targetX = 30 + Math.random() * (w - 60)
                    chick.targetY = 30 + Math.random() * (h - 60)
                } else {
                    const moveX = (cdx / cdist) * chick.speed
                    const moveY = (cdy / cdist) * chick.speed
                    chick.x += moveX
                    chick.y += moveY
                    chick.angle = Math.atan2(cdy, cdx)
                }
            }

            // --- Manage eggs (always visible as decoration) ---
            while (state.eggs.length < EGG_COUNT) {
                const pos = findSpawnPosition(w, h, formRect, bunny.x, bunny.y, SPAWN_MIN_BUNNY_DIST)
                const colorIdx = Math.floor(Math.random() * EGG_COLORS.length)
                state.eggs.push({
                    x: pos.x,
                    y: pos.y,
                    color: EGG_COLORS[colorIdx],
                    bobPhase: Math.random() * Math.PI * 2,
                })
            }

            // Check collection only when game is enabled
            if (enabledRef.current) {
                for (let i = state.eggs.length - 1; i >= 0; i--) {
                    const egg = state.eggs[i]
                    if (distance(bunny.x, bunny.y, egg.x, egg.y) < COLLECT_RADIUS) {
                        state.eggs.splice(i, 1)
                        if (onEggCollectedRef.current) {
                            onEggCollectedRef.current()
                        }
                    }
                }
            }

            // --- Draw everything ---

            // Eggs (behind characters)
            for (const egg of state.eggs) {
                egg.bobPhase += 0.02
                const bobOffset = Math.sin(egg.bobPhase) * 1.5
                drawEgg(ctx, egg.x, egg.y, egg.color, bobOffset)
            }

            // Chicks
            for (const chick of state.chicks) {
                drawChick(ctx, chick.x, chick.y, chick.angle)
            }

            // Bunny (on top) — with hop animation
            drawBunny(ctx, bunny.x, bunny.y - hopLift, bunny.angle, hopScale)

            animFrameRef.current = requestAnimationFrame(tick)
        }

        animFrameRef.current = requestAnimationFrame(tick)

        return () => {
            window.removeEventListener('resize', handleResize)
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
            }
        }
    }, [handleResize, getFormRect])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                pointerEvents: 'none',
            }}
        />
    )
}
