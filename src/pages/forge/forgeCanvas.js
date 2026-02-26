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
        this.r = Math.random() * 2.0 + 0.5
        this.vy = Math.random() * 0.5 + 0.12
        this.vx = (Math.random() - 0.5) * 0.12
        this.wobble = Math.random() * 6.28
        this.wobbleSpeed = Math.random() * 0.015 + 0.003
        this.wobbleAmp = Math.random() * 0.15 + 0.05
        this.alpha = Math.random() * 0.35 + 0.08
        this.life = 1
        this.decay = Math.random() * 0.0008 + 0.0002
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
    let embers = []
    let animId = null
    let lastFrame = 0
    const FPS_INTERVAL = 1000 / 20 // cap at 20fps

    function resize() {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio
        canvas.height = canvas.offsetHeight * window.devicePixelRatio
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        const displayW = canvas.offsetWidth
        const displayH = canvas.offsetHeight
        // Re-init embers with new bounds
        embers = Array.from({ length: 55 }, () => new Ember(displayW, displayH, EMBER_COLORS))
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
        grd.addColorStop(0, 'rgba(180,55,5,0.06)')
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


/* ═══════════════════════════════════════════════════
   Portfolio Chart — Interactive with event markers
   Returns { getEventAt(canvasX, canvasY) } for click/hover
   ═══════════════════════════════════════════════════ */

const EVENT_COLORS = {
    fuel: '#e86520',
    tutorial_fuel: '#e86520',
    referral_fuel: '#e86520',
    cool: '#4499bb',
    liquidate: '#4499bb',
    performance: '#f0c840',
    init: '#888888',
}

/**
 * Draw a dual-series portfolio chart: worth line (solid) + cost basis line (dashed).
 * Timeline items: { worth, basis, trigger, playerName, t }
 */
export function drawPortfolioChart(canvas, timeline, opts = {}) {
    if (!canvas || !timeline || timeline.length < 2) return null

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

    const padTop = 20
    const padBottom = 24
    const padLeft = 8
    const padRight = 8
    const chartW = w - padLeft - padRight
    const chartH = h - padTop - padBottom

    // Layer visibility
    const showWorth = opts.showWorth !== false
    const showBasis = opts.showBasis !== false
    const showFuel = opts.showFuel !== false
    const showCool = opts.showCool !== false
    const showPerf = opts.showPerf !== false

    // Coerce values — guard against undefined/null/NaN
    const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

    // Scale encompasses visible series
    const allValues = []
    for (const t of timeline) {
        if (showWorth) allValues.push(safeNum(t.worth))
        if (showBasis) allValues.push(safeNum(t.basis))
    }
    if (allValues.length === 0) allValues.push(0, 1)
    let min = Math.min(...allValues)
    let max = Math.max(...allValues)
    const flat = min === max
    if (flat) {
        // Add 5% padding so the line isn't pinned to an edge
        const pad5 = Math.max(Math.abs(min) * 0.05, 1)
        min -= pad5
        max += pad5
    }
    const range = max - min

    const toY = (v) => { const n = safeNum(v); return padTop + (1 - (n - min) / range) * chartH }
    const toX = (i) => padLeft + (i / Math.max(timeline.length - 1, 1)) * chartW

    const worthPts = timeline.map((t, i) => ({ x: toX(i), y: toY(t.worth), ...t }))
    const basisPts = timeline.map((t, i) => ({ x: toX(i), y: toY(t.basis), ...t }))

    const worthColor = opts.lineColor || '#e86520'

    // ── Worth fill gradient ──
    if (showWorth) {
        const gradient = ctx.createLinearGradient(0, padTop, 0, h - padBottom)
        gradient.addColorStop(0, opts.fillColor || 'rgba(232,101,32,0.15)')
        gradient.addColorStop(1, 'transparent')

        ctx.beginPath()
        worthPts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
        ctx.lineTo(worthPts[worthPts.length - 1].x, h - padBottom)
        ctx.lineTo(worthPts[0].x, h - padBottom)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()
    }

    // ── Cost basis line (dashed) ──
    if (showBasis) {
        ctx.save()
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        basisPts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
    }

    // ── Worth line (solid) ──
    if (showWorth) {
        ctx.beginPath()
        worthPts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
        ctx.strokeStyle = worthColor
        ctx.lineWidth = 2
        ctx.stroke()
    }

    // ── Determine which event types to show ──
    const visibleTriggers = new Set()
    if (showFuel) { visibleTriggers.add('fuel'); visibleTriggers.add('tutorial_fuel'); visibleTriggers.add('referral_fuel') }
    if (showCool) { visibleTriggers.add('cool'); visibleTriggers.add('liquidate') }
    if (showPerf) visibleTriggers.add('performance')

    // ── Event dots ──
    const eventPoints = []
    for (const pt of worthPts) {
        if (pt.trigger && pt.trigger !== 'init' && visibleTriggers.has(pt.trigger)) {
            const color = EVENT_COLORS[pt.trigger] || '#888'
            const radius = pt.trigger === 'performance' ? 4 : 5
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, radius, 0, 6.28)
            ctx.fillStyle = color
            ctx.shadowBlur = 8
            ctx.shadowColor = color
            ctx.fill()
            ctx.shadowBlur = 0
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, radius - 1.5, 0, 6.28)
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            ctx.lineWidth = 0.8
            ctx.stroke()
            eventPoints.push({ ...pt, radius: radius + 4 })
        }
    }

    // ── End dot ──
    if (showWorth) {
        const last = worthPts[worthPts.length - 1]
        ctx.beginPath()
        ctx.arc(last.x, last.y, 3, 0, 6.28)
        ctx.fillStyle = worthColor
        ctx.shadowBlur = 8
        ctx.shadowColor = worthColor
        ctx.fill()
        ctx.shadowBlur = 0
    }

    // ── Y-axis labels ──
    ctx.font = '10px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'left'
    if (flat) {
        // Single centered label when all values are the same
        const actualVal = allValues[0] + (max - min) / 2 // recover the original value
        ctx.fillText(Math.round(actualVal).toLocaleString(), padLeft + 2, padTop + chartH / 2 + 3)
    } else {
        ctx.fillText(Math.round(max).toLocaleString(), padLeft + 2, padTop - 4)
        ctx.fillText(Math.round(min).toLocaleString(), padLeft + 2, h - padBottom + 14)
    }

    // ── Hit-test for hover ──
    return {
        getEventAt(canvasX, canvasY) {
            for (const ep of eventPoints) {
                const dx = canvasX - ep.x
                const dy = canvasY - ep.y
                if (dx * dx + dy * dy <= ep.radius * ep.radius) {
                    return {
                        trigger: ep.trigger,
                        worth: ep.worth,
                        basis: ep.basis,
                        playerName: ep.playerName,
                        createdAt: ep.t,
                        x: ep.x,
                        y: ep.y,
                    }
                }
            }
            let closest = null
            let minDist = Infinity
            for (const pt of worthPts) {
                const dist = Math.abs(canvasX - pt.x)
                if (dist < minDist) {
                    minDist = dist
                    closest = pt
                }
            }
            if (closest && minDist < 20) {
                return {
                    trigger: closest.trigger || null,
                    worth: closest.worth,
                    basis: closest.basis,
                    playerName: closest.playerName,
                    createdAt: closest.t,
                    x: closest.x,
                    y: closest.y,
                    isLine: true,
                }
            }
            return null
        },
    }
}
