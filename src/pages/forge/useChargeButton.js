import { useRef, useCallback, useEffect } from 'react'

// Spark particle for the charge effect — flies off button edges
class Spark {
    constructor(x, y, intensity, hueBase) {
        this.x = x
        this.y = y
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (0.6 + intensity * 0.6)
        const speed = 0.8 + Math.random() * 3.5 * intensity
        this.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 1.5
        this.vy = Math.sin(angle) * speed
        this.gravity = 0.03 + Math.random() * 0.03
        this.life = 15 + Math.random() * 25
        this.maxLife = this.life
        this.size = 0.8 + Math.random() * 2.5 * intensity
        this.hue = hueBase + Math.random() * 30
        this.lightness = 50 + Math.random() * 35
    }

    update() {
        this.x += this.vx
        this.y += this.vy
        this.vy += this.gravity
        this.vx *= 0.97
        this.life--
        return this.life > 0
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.lightness}%, ${alpha})`
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size * (0.3 + 0.7 * alpha), 0, Math.PI * 2)
        ctx.fill()
    }
}

// Burst particle for the release explosion — radial with trails
class BurstParticle {
    constructor(x, y, charge, hueBase) {
        this.x = x
        this.y = y
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 10 * charge
        this.vx = Math.cos(angle) * speed
        this.vy = Math.sin(angle) * speed
        this.gravity = 0.12
        this.friction = 0.96
        this.life = 20 + Math.random() * 30
        this.maxLife = this.life
        this.size = 1.5 + Math.random() * 3.5 * charge
        this.hue = hueBase + Math.random() * 40
        this.lightness = 55 + Math.random() * 35
        this.trail = []
    }

    update() {
        this.trail.push({ x: this.x, y: this.y })
        if (this.trail.length > 4) this.trail.shift()
        this.x += this.vx
        this.y += this.vy
        this.vy += this.gravity
        this.vx *= this.friction
        this.vy *= this.friction
        this.life--
        return this.life > 0
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife
        ctx.globalCompositeOperation = 'lighter'

        // Trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i]
            const ta = (i / this.trail.length) * alpha * 0.4
            ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.lightness}%, ${ta})`
            ctx.beginPath()
            ctx.arc(t.x, t.y, this.size * 0.4, 0, Math.PI * 2)
            ctx.fill()
        }

        // Core
        ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.lightness}%, ${alpha})`
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size * (0.3 + 0.7 * alpha), 0, Math.PI * 2)
        ctx.fill()

        // Hot center
        ctx.fillStyle = `hsla(${this.hue}, 60%, 90%, ${alpha * 0.6})`
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size * 0.3 * alpha, 0, Math.PI * 2)
        ctx.fill()
    }
}

const CHARGE_DURATION = 1.8 // seconds to full charge
const MIN_THRESHOLD = 0.9 // minimum charge to fire
const FUEL_HUE = 20 // orange
const COOL_HUE = 190 // blue

export default function useChargeButton({ onFire, mode = 'fuel', disabled = false }) {
    const btnRef = useRef(null)
    const canvasRef = useRef(null)
    const stateRef = useRef({
        charging: false,
        charge: 0,
        particles: [],
        glowAngle: 0,
        fired: false,
        startTime: 0,
    })

    const hueBase = mode === 'fuel' ? FUEL_HUE : COOL_HUE

    const fire = useCallback((charge) => {
        if (stateRef.current.fired) return
        stateRef.current.fired = true

        const btn = btnRef.current
        const canvas = canvasRef.current
        if (btn && canvas) {
            const rect = btn.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const count = Math.floor(25 + charge * 55)
            for (let i = 0; i < count; i++) {
                stateRef.current.particles.push(new BurstParticle(cx, cy, charge, hueBase))
            }
        }

        // Reset button visuals
        if (btn) {
            btn.style.setProperty('--charge', 0)
            btn.style.setProperty('--shake', 0)
            btn.classList.remove('forge-charge-active')
        }
        stateRef.current.charge = 0
        stateRef.current.charging = false

        onFire?.()
    }, [onFire, hueBase])

    useEffect(() => {
        const btn = btnRef.current
        const canvas = canvasRef.current
        if (!btn || !canvas) return

        const ctx = canvas.getContext('2d')
        let rafId

        // Size canvas to viewport (uses devicePixelRatio for crisp rendering)
        const resize = () => {
            const dpr = window.devicePixelRatio || 1
            const vw = window.innerWidth
            const vh = window.innerHeight
            canvas.width = vw * dpr
            canvas.height = vh * dpr
            canvas.style.width = vw + 'px'
            canvas.style.height = vh + 'px'
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        resize()
        window.addEventListener('resize', resize)

        const tick = () => {
            const s = stateRef.current
            const vw = window.innerWidth
            const vh = window.innerHeight

            if (s.charging && !disabled) {
                const elapsed = (performance.now() - s.startTime) / 1000
                s.charge = Math.min(elapsed / CHARGE_DURATION, 1)

                btn.style.setProperty('--charge', s.charge)
                btn.style.setProperty('--shake', s.charge > 0.3 ? (s.charge - 0.3) * 1.43 : 0)

                // Spawn charge sparks from button edges (using viewport coords)
                if (s.charge > 0.15) {
                    const rect = btn.getBoundingClientRect()
                    const spawns = Math.floor(s.charge * 3)
                    for (let i = 0; i < spawns; i++) {
                        const edge = Math.random()
                        let sx, sy
                        if (edge < 0.4) {
                            sx = rect.left + Math.random() * rect.width
                            sy = rect.top
                        } else if (edge < 0.7) {
                            sx = Math.random() < 0.5 ? rect.left : rect.right
                            sy = rect.top + Math.random() * rect.height
                        } else {
                            sx = rect.left + Math.random() * rect.width
                            sy = rect.bottom
                        }
                        s.particles.push(new Spark(sx, sy, s.charge, hueBase))
                    }
                }

                // Spin the glow
                s.glowAngle = (s.glowAngle + 2 + s.charge * 8) % 360
                btn.style.setProperty('--glow-angle', `${s.glowAngle}deg`)

                // Auto-fire at 100%
                if (s.charge >= 1) {
                    fire(1)
                }
            }

            // Render particles (always, even after firing — for the burst)
            ctx.clearRect(0, 0, vw, vh)
            if (s.particles.length > 0) {
                s.particles = s.particles.filter(p => {
                    if (!p.update()) return false
                    p.draw(ctx)
                    return true
                })
            }

            rafId = requestAnimationFrame(tick)
        }

        const startCharge = (e) => {
            if (disabled) return
            e.preventDefault()
            e.stopPropagation()
            const s = stateRef.current
            s.charging = true
            s.charge = 0
            s.fired = false
            s.particles = []
            s.startTime = performance.now()
            btn.classList.add('forge-charge-active')
        }

        const endCharge = () => {
            const s = stateRef.current
            if (!s.charging) return
            s.charging = false

            if (s.charge >= MIN_THRESHOLD && !s.fired) {
                fire(s.charge)
            } else if (!s.fired) {
                // Didn't meet threshold — reset
                s.charge = 0
                btn.style.setProperty('--charge', 0)
                btn.style.setProperty('--shake', 0)
                btn.classList.remove('forge-charge-active')
            }
        }

        const cancelCharge = () => {
            const s = stateRef.current
            if (!s.charging) return
            s.charging = false
            s.charge = 0
            s.fired = false
            btn.style.setProperty('--charge', 0)
            btn.style.setProperty('--shake', 0)
            btn.classList.remove('forge-charge-active')
        }

        const preventContext = (e) => e.preventDefault()

        btn.addEventListener('mousedown', startCharge)
        btn.addEventListener('touchstart', startCharge, { passive: false })
        window.addEventListener('mouseup', endCharge)
        window.addEventListener('touchend', endCharge)
        window.addEventListener('touchcancel', cancelCharge)
        btn.addEventListener('mouseleave', cancelCharge)
        btn.addEventListener('contextmenu', preventContext)

        rafId = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(rafId)
            window.removeEventListener('resize', resize)
            btn.removeEventListener('mousedown', startCharge)
            btn.removeEventListener('touchstart', startCharge)
            window.removeEventListener('mouseup', endCharge)
            window.removeEventListener('touchend', endCharge)
            window.removeEventListener('touchcancel', cancelCharge)
            btn.removeEventListener('mouseleave', cancelCharge)
            btn.removeEventListener('contextmenu', preventContext)
        }
    }, [disabled, fire, hueBase])

    return { btnRef, canvasRef }
}
