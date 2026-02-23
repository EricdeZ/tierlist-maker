import { BURST_COLORS, EMBER_COLORS } from './forgeConstants'

// Check if user prefers reduced motion
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ═══════════════════════════════════════════════════
   Background Ember System
   Slow-rising ambient particles, ~20fps cap
   ═══════════════════════════════════════════════════ */

class Ember {
    constructor(w, h, colors) {
        this.w = w
        this.h = h
        this.colors = colors
        this.reset()
    }

    reset() {
        this.x = Math.random() * this.w
        this.y = this.h + 30
        this.r = Math.random() * 1.2 + 0.3
        this.vy = Math.random() * 0.3 + 0.06
        this.vx = (Math.random() - 0.5) * 0.08
        this.wobble = Math.random() * 6.28
        this.wobbleSpeed = Math.random() * 0.01 + 0.002
        this.wobbleAmp = Math.random() * 0.1 + 0.03
        this.alpha = Math.random() * 0.2 + 0.04
        this.life = 1
        this.decay = Math.random() * 0.001 + 0.0003
        this.color = this.colors[Math.random() * this.colors.length | 0]
    }

    update() {
        this.wobble += this.wobbleSpeed
        this.y -= this.vy
        this.x += this.vx + Math.sin(this.wobble) * this.wobbleAmp
        this.life -= this.decay
        if (this.life <= 0 || this.y < -20) this.reset()
    }

    draw(ctx) {
        const opacity = this.alpha * this.life
        if (opacity < 0.005) return
        const [r, g, b] = this.color
        ctx.save()
        ctx.globalAlpha = opacity
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.shadowBlur = this.r * 4
        ctx.shadowColor = `rgba(${r},${g},${b},0.5)`
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.r * this.life, 0, 6.28)
        ctx.fill()
        ctx.restore()
    }
}

export function createEmberSystem(canvas) {
    if (prefersReducedMotion()) {
        return { start() {}, stop() {}, resize() {} }
    }

    const ctx = canvas.getContext('2d')
    let w = 0, h = 0
    let embers = []
    let animId = null
    let lastFrame = 0
    const FPS_INTERVAL = 1000 / 20 // cap at 20fps

    function resize() {
        w = canvas.width = canvas.offsetWidth * window.devicePixelRatio
        h = canvas.height = canvas.offsetHeight * window.devicePixelRatio
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        const displayW = canvas.offsetWidth
        const displayH = canvas.offsetHeight
        // Re-init embers with new bounds
        embers = Array.from({ length: 30 }, () => new Ember(displayW, displayH, EMBER_COLORS))
    }

    function animate(timestamp) {
        animId = requestAnimationFrame(animate)
        const elapsed = timestamp - lastFrame
        if (elapsed < FPS_INTERVAL) return
        lastFrame = timestamp - (elapsed % FPS_INTERVAL)

        const displayW = canvas.offsetWidth
        const displayH = canvas.offsetHeight
        ctx.clearRect(0, 0, displayW, displayH)

        // Subtle bottom glow
        const grd = ctx.createRadialGradient(
            displayW * 0.5, displayH + 40, 0,
            displayW * 0.5, displayH + 40, displayH * 0.4,
        )
        grd.addColorStop(0, 'rgba(150,45,5,0.02)')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, displayW, displayH)

        embers.forEach(e => {
            e.update()
            e.draw(ctx)
        })
    }

    function start() {
        resize()
        lastFrame = performance.now()
        animId = requestAnimationFrame(animate)
    }

    function stop() {
        if (animId) cancelAnimationFrame(animId)
        animId = null
    }

    return { start, stop, resize }
}


/* ═══════════════════════════════════════════════════
   Fire Burst (on Fuel click)
   Explodes particles from a point, self-cleaning
   ═══════════════════════════════════════════════════ */

export function fireBurst(canvas, x, y, count = 40) {
    if (prefersReducedMotion()) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const particles = []

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 6 + 2
        const size = Math.random() * 3 + 1
        const life = Math.random() * 0.6 + 0.4
        const color = BURST_COLORS[Math.random() * BURST_COLORS.length | 0]
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - Math.random() * 2,
            size, life, maxLife: life,
            r: color[0], g: color[1], b: color[2],
            gravity: 0.08 + Math.random() * 0.04,
        })
    }

    function animate() {
        // Don't clear — multiple bursts can overlap, orchestrator clears
        let alive = false
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]
            p.x += p.vx
            p.y += p.vy
            p.vy += p.gravity
            p.vx *= 0.98
            p.life -= 0.016
            if (p.life <= 0) {
                particles.splice(i, 1)
                continue
            }
            alive = true
            const a = p.life / p.maxLife
            ctx.save()
            ctx.globalAlpha = a
            ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`
            ctx.shadowBlur = p.size * 3
            ctx.shadowColor = `rgba(${p.r},${p.g},${p.b},0.6)`
            ctx.beginPath()
            ctx.arc(p.x * dpr, p.y * dpr, p.size * a * dpr, 0, 6.28)
            ctx.fill()
            ctx.restore()
        }
        if (alive) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
}


/* ═══════════════════════════════════════════════════
   Sparkline Renderer
   Draws a mini price chart on a canvas element
   ═══════════════════════════════════════════════════ */

export function drawSparkline(canvas, data, { lineColor, fillColor }) {
    if (!canvas || !data || data.length < 2) return

    const parent = canvas.parentElement
    const dpr = window.devicePixelRatio || 1
    const w = parent.offsetWidth
    const h = parent.offsetHeight

    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.width = w * dpr
    canvas.height = h * dpr

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const pad = 4
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((v, i) => ({
        x: (i / (data.length - 1)) * w,
        y: pad + (1 - (v - min) / range) * (h - pad * 2),
    }))

    // Fill area under line
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, fillColor)
    gradient.addColorStop(1, 'transparent')

    ctx.beginPath()
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw line
    ctx.beginPath()
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.5
    ctx.stroke()

    // End dot
    const last = points[points.length - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, 2.5, 0, 6.28)
    ctx.fillStyle = lineColor
    ctx.shadowBlur = 6
    ctx.shadowColor = lineColor
    ctx.fill()
}
