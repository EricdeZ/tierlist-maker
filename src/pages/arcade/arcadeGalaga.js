// arcadeGalaga.js — Canvas-based Galaga minigame engine
// Returns { start, stop, resize } — no React dependency

const CYAN = '#00f0ff'
const MAGENTA = '#ff00aa'
const YELLOW = '#ffe600'
const BG = '#0a0a1a'
const DIM = '#1a1a3a'
const TEXT = '#e0e8ff'

const FPS = 60
const FRAME_MS = 1000 / FPS

const PLAYER_W = 20
const PLAYER_H = 14
const PLAYER_SPEED = 4
const BULLET_SPEED = 6
const BULLET_W = 2
const BULLET_H = 8
const ENEMY_W = 16
const ENEMY_H = 12
const ENEMY_BULLET_SPEED = 3
const ENEMY_COLS = 7
const ENEMY_ROWS = 3
const ENEMY_GAP_X = 28
const ENEMY_GAP_Y = 24
const FIRE_COOLDOWN = 200 // ms between shots

export function createGalagaGame(canvas, callbacks = {}) {
    const ctx = canvas.getContext('2d')
    let animId = null
    let lastFrame = 0
    let running = false

    // Game state
    let state = 'idle' // idle | playing | gameover
    let score = 0
    let lives = 3
    let wave = 1
    let highScore = 0

    // Load high score
    try { highScore = parseInt(localStorage.getItem('arcade_galaga_high') || '0') || 0 } catch {}

    // Entities
    let player = { x: 0, y: 0 }
    let bullets = []
    let enemyBullets = []
    let enemies = []
    let enemyDir = 1
    let enemySpeed = 0.6
    let enemyDropTimer = 0
    let particles = []
    let lastFireTime = 0
    let starField = []

    // Input
    const keys = {}

    // Canvas dimensions (logical)
    let W = 0
    let H = 0
    let dpr = 1

    function resize() {
        const parent = canvas.parentElement
        if (!parent) return
        dpr = window.devicePixelRatio || 1
        W = parent.offsetWidth
        H = parent.offsetHeight
        canvas.width = W * dpr
        canvas.height = H * dpr
        canvas.style.width = W + 'px'
        canvas.style.height = H + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Regenerate starfield
        starField = []
        for (let i = 0; i < 60; i++) {
            starField.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.5 + 0.2,
                speed: Math.random() * 0.3 + 0.1,
            })
        }
    }

    function initGame() {
        score = 0
        lives = 3
        wave = 1
        bullets = []
        enemyBullets = []
        particles = []
        player.x = W / 2
        player.y = H - 30
        spawnWave()
        state = 'playing'
        if (callbacks.onStateChange) callbacks.onStateChange(state)
    }

    function spawnWave() {
        enemies = []
        enemyDir = 1
        enemySpeed = 0.6 + (wave - 1) * 0.15
        enemyDropTimer = 0

        const totalW = ENEMY_COLS * ENEMY_GAP_X
        const startX = (W - totalW) / 2 + ENEMY_GAP_X / 2

        for (let row = 0; row < ENEMY_ROWS; row++) {
            for (let col = 0; col < ENEMY_COLS; col++) {
                enemies.push({
                    x: startX + col * ENEMY_GAP_X,
                    y: 40 + row * ENEMY_GAP_Y,
                    row,
                    alive: true,
                })
            }
        }
    }

    // ── Update ──────────────────────────
    function update(dt) {
        if (state !== 'playing') return

        // Player movement
        if (keys.ArrowLeft || keys.KeyA) player.x -= PLAYER_SPEED
        if (keys.ArrowRight || keys.KeyD) player.x += PLAYER_SPEED
        player.x = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, player.x))

        // Player fire
        const now = performance.now()
        if (keys.Space && now - lastFireTime > FIRE_COOLDOWN) {
            bullets.push({ x: player.x, y: player.y - PLAYER_H / 2 })
            lastFireTime = now
        }

        // Update player bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].y -= BULLET_SPEED
            if (bullets[i].y < -10) bullets.splice(i, 1)
        }

        // Update enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            enemyBullets[i].y += ENEMY_BULLET_SPEED
            if (enemyBullets[i].y > H + 10) enemyBullets.splice(i, 1)
        }

        // Move enemies
        let hitEdge = false
        const aliveEnemies = enemies.filter(e => e.alive)
        for (const e of aliveEnemies) {
            e.x += enemySpeed * enemyDir
            if (e.x < ENEMY_W / 2 + 8 || e.x > W - ENEMY_W / 2 - 8) hitEdge = true
        }
        if (hitEdge) {
            enemyDir *= -1
            for (const e of aliveEnemies) {
                e.y += 8
                // If enemies reach player line, game over
                if (e.y > H - 50) {
                    gameOver()
                    return
                }
            }
        }

        // Enemy fire (random)
        if (aliveEnemies.length > 0 && Math.random() < 0.01 + wave * 0.003) {
            const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]
            enemyBullets.push({ x: shooter.x, y: shooter.y + ENEMY_H / 2 })
        }

        // Bullet → enemy collision
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi]
            for (const e of enemies) {
                if (!e.alive) continue
                if (Math.abs(b.x - e.x) < ENEMY_W / 2 + BULLET_W / 2 &&
                    Math.abs(b.y - e.y) < ENEMY_H / 2 + BULLET_H / 2) {
                    e.alive = false
                    bullets.splice(bi, 1)
                    score += 10
                    // Explosion particles
                    for (let p = 0; p < 6; p++) {
                        const angle = Math.random() * Math.PI * 2
                        const speed = Math.random() * 2 + 1
                        particles.push({
                            x: e.x, y: e.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 1,
                            color: e.row === 0 ? YELLOW : MAGENTA,
                        })
                    }
                    break
                }
            }
        }

        // Enemy bullet → player collision
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const b = enemyBullets[i]
            if (Math.abs(b.x - player.x) < PLAYER_W / 2 + BULLET_W / 2 &&
                Math.abs(b.y - player.y) < PLAYER_H / 2 + BULLET_H / 2) {
                enemyBullets.splice(i, 1)
                lives--
                // Player hit particles
                for (let p = 0; p < 10; p++) {
                    const angle = Math.random() * Math.PI * 2
                    const speed = Math.random() * 3 + 1
                    particles.push({
                        x: player.x, y: player.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 1,
                        color: CYAN,
                    })
                }
                if (lives <= 0) {
                    gameOver()
                    return
                }
            }
        }

        // Wave clear
        if (enemies.every(e => !e.alive)) {
            wave++
            spawnWave()
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]
            p.x += p.vx
            p.y += p.vy
            p.life -= 0.03
            if (p.life <= 0) particles.splice(i, 1)
        }

        // Update stars
        for (const s of starField) {
            s.y += s.speed
            if (s.y > H) { s.y = 0; s.x = Math.random() * W }
        }
    }

    function gameOver() {
        state = 'gameover'
        if (score > highScore) {
            highScore = score
            try { localStorage.setItem('arcade_galaga_high', String(highScore)) } catch {}
        }
        if (callbacks.onStateChange) callbacks.onStateChange(state)
    }

    // ── Draw ────────────────────────────
    function draw() {
        ctx.fillStyle = BG
        ctx.fillRect(0, 0, W, H)

        // Stars
        for (const s of starField) {
            ctx.globalAlpha = s.alpha
            ctx.fillStyle = TEXT
            ctx.fillRect(s.x, s.y, s.size, s.size)
        }
        ctx.globalAlpha = 1

        if (state === 'idle') {
            drawIdleScreen()
            return
        }

        if (state === 'playing' || state === 'gameover') {
            // Draw enemies
            for (const e of enemies) {
                if (!e.alive) continue
                drawEnemy(e)
            }

            // Draw player (if alive)
            if (state === 'playing') {
                drawPlayer()
            }

            // Draw bullets
            ctx.fillStyle = CYAN
            for (const b of bullets) {
                ctx.fillRect(b.x - BULLET_W / 2, b.y - BULLET_H / 2, BULLET_W, BULLET_H)
            }

            // Draw enemy bullets
            ctx.fillStyle = MAGENTA
            for (const b of enemyBullets) {
                ctx.fillRect(b.x - BULLET_W / 2, b.y - BULLET_H / 2, BULLET_W, BULLET_H)
            }

            // Draw particles
            for (const p of particles) {
                ctx.globalAlpha = p.life
                ctx.fillStyle = p.color
                ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
            }
            ctx.globalAlpha = 1

            // HUD
            drawHUD()
        }

        if (state === 'gameover') {
            drawGameOverScreen()
        }
    }

    function drawPlayer() {
        const x = player.x
        const y = player.y
        // Ship body (triangle-ish)
        ctx.fillStyle = CYAN
        ctx.beginPath()
        ctx.moveTo(x, y - PLAYER_H / 2)          // nose
        ctx.lineTo(x - PLAYER_W / 2, y + PLAYER_H / 2) // left wing
        ctx.lineTo(x - 3, y + PLAYER_H / 4)       // left indent
        ctx.lineTo(x + 3, y + PLAYER_H / 4)       // right indent
        ctx.lineTo(x + PLAYER_W / 2, y + PLAYER_H / 2) // right wing
        ctx.closePath()
        ctx.fill()
        // Engine glow
        ctx.fillStyle = YELLOW
        ctx.fillRect(x - 2, y + PLAYER_H / 4, 4, 3 + Math.random() * 3)
    }

    function drawEnemy(e) {
        const x = e.x
        const y = e.y
        const color = e.row === 0 ? YELLOW : e.row === 1 ? MAGENTA : '#cc44ff'
        ctx.fillStyle = color
        // Body
        ctx.fillRect(x - ENEMY_W / 2, y - ENEMY_H / 2, ENEMY_W, ENEMY_H)
        // Eyes
        ctx.fillStyle = BG
        ctx.fillRect(x - 4, y - 2, 3, 3)
        ctx.fillRect(x + 1, y - 2, 3, 3)
        // Wings (small rects on sides)
        ctx.fillStyle = color
        ctx.fillRect(x - ENEMY_W / 2 - 3, y, 3, 4)
        ctx.fillRect(x + ENEMY_W / 2, y, 3, 4)
    }

    function drawHUD() {
        ctx.font = '10px "Press Start 2P", monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = TEXT
        ctx.fillText(`SCORE ${String(score).padStart(6, '0')}`, 10, 18)

        ctx.textAlign = 'right'
        ctx.fillStyle = TEXT
        ctx.fillText(`HI ${String(highScore).padStart(6, '0')}`, W - 10, 18)

        // Lives as small ships
        for (let i = 0; i < lives; i++) {
            const lx = W - 20 - i * 18
            const ly = 30
            ctx.fillStyle = CYAN
            ctx.beginPath()
            ctx.moveTo(lx, ly - 5)
            ctx.lineTo(lx - 6, ly + 5)
            ctx.lineTo(lx + 6, ly + 5)
            ctx.closePath()
            ctx.fill()
        }

        // Wave indicator
        ctx.textAlign = 'center'
        ctx.fillStyle = DIM
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(`WAVE ${wave}`, W / 2, 18)
    }

    function drawIdleScreen() {
        // Title
        ctx.textAlign = 'center'
        ctx.font = '16px "Press Start 2P", monospace'
        ctx.fillStyle = CYAN
        ctx.fillText('THE ARCADE', W / 2, H / 2 - 30)

        // Press start (flashing)
        const blink = Math.floor(performance.now() / 600) % 2
        if (blink) {
            ctx.font = '10px "Press Start 2P", monospace'
            ctx.fillStyle = YELLOW
            ctx.fillText('PRESS START', W / 2, H / 2 + 10)
        }

        // High score
        if (highScore > 0) {
            ctx.font = '8px "Press Start 2P", monospace'
            ctx.fillStyle = DIM
            ctx.fillText(`HI SCORE: ${highScore}`, W / 2, H / 2 + 40)
        }

        // Decorative enemies floating
        const t = performance.now() / 1000
        for (let i = 0; i < 5; i++) {
            const ex = W * 0.2 + i * (W * 0.15)
            const ey = H / 2 - 60 + Math.sin(t + i * 0.8) * 8
            drawEnemy({ x: ex, y: ey, row: i % 3, alive: true })
        }
    }

    function drawGameOverScreen() {
        // Overlay
        ctx.fillStyle = 'rgba(10, 10, 26, 0.7)'
        ctx.fillRect(0, 0, W, H)

        ctx.textAlign = 'center'
        ctx.font = '14px "Press Start 2P", monospace'
        ctx.fillStyle = MAGENTA
        ctx.fillText('GAME OVER', W / 2, H / 2 - 30)

        ctx.font = '10px "Press Start 2P", monospace'
        ctx.fillStyle = TEXT
        ctx.fillText(`SCORE: ${score}`, W / 2, H / 2)

        if (score >= highScore && score > 0) {
            ctx.fillStyle = YELLOW
            ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 20)
        }

        const blink = Math.floor(performance.now() / 600) % 2
        if (blink) {
            ctx.font = '8px "Press Start 2P", monospace'
            ctx.fillStyle = CYAN
            ctx.fillText('PRESS START TO PLAY AGAIN', W / 2, H / 2 + 50)
        }
    }

    // ── Game loop ───────────────────────
    function loop(timestamp) {
        animId = requestAnimationFrame(loop)
        const elapsed = timestamp - lastFrame
        if (elapsed < FRAME_MS) return
        lastFrame = timestamp - (elapsed % FRAME_MS)

        update(elapsed)
        draw()
    }

    // ── Input handlers ──────────────────
    function onKeyDown(e) {
        keys[e.code] = true
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
            e.preventDefault()
        }
        // Start/restart on Enter or Space when not playing
        if ((e.code === 'Enter' || e.code === 'Space') && state !== 'playing') {
            initGame()
        }
    }

    function onKeyUp(e) {
        keys[e.code] = false
    }

    // Touch support
    let touchAction = null
    function onTouchStart(e) {
        if (state !== 'playing') {
            initGame()
            return
        }
        const touch = e.touches[0]
        const rect = canvas.getBoundingClientRect()
        const tx = touch.clientX - rect.left
        const third = rect.width / 3
        if (tx < third) touchAction = 'left'
        else if (tx > third * 2) touchAction = 'right'
        else {
            touchAction = 'fire'
            keys.Space = true
        }
        if (touchAction === 'left') keys.ArrowLeft = true
        if (touchAction === 'right') keys.ArrowRight = true
    }

    function onTouchEnd() {
        keys.ArrowLeft = false
        keys.ArrowRight = false
        keys.Space = false
        touchAction = null
    }

    // ── Public API ──────────────────────
    function start() {
        if (running) return
        running = true
        resize()

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        canvas.addEventListener('touchstart', onTouchStart, { passive: true })
        canvas.addEventListener('touchend', onTouchEnd)

        lastFrame = performance.now()
        animId = requestAnimationFrame(loop)
    }

    function stop() {
        running = false
        if (animId) cancelAnimationFrame(animId)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        canvas.removeEventListener('touchstart', onTouchStart)
        canvas.removeEventListener('touchend', onTouchEnd)
    }

    function pressStart() {
        if (state !== 'playing') initGame()
    }

    return { start, stop, resize, pressStart, getState: () => state }
}
