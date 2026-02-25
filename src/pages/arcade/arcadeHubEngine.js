// arcadeHubEngine.js — 2D Pokemon-style Game Corner engine
// Grid-based movement, NPC wandering, authentic Pokemon Crystal feel

import {
    METATILES, MAP_BLOCKS, COLLISION,
    MAP_W_BLOCKS, MAP_H_BLOCKS, MAP_W_TILES, MAP_H_TILES,
    NATIVE_W, NATIVE_H, TILE_PX, TILES_PER_ROW,
    PALETTES, getTilePalette,
    QUAD_W, QUAD_H, buildCollisionGrid,
} from './pokemonTileData'
import { OBJECTS, SPAWN_QX, SPAWN_QY } from './arcadeHubMap'
import { NPC_SPRITE_MAP, getSpritePalette } from './npcSprites'

const FPS = 60
const FRAME_MS = 1000 / FPS
const STEP_FRAMES = 10        // frames to walk one grid tile
const INTERACT_DIST = 1.5     // grid tiles
const NPC_MOVE_MIN = 120      // min frames between NPC moves (~2s)
const NPC_MOVE_MAX = 420      // max frames between NPC moves (~7s)

function grayToPaletteIdx(gray) {
    if (gray > 200) return 0
    if (gray > 128) return 1
    if (gray > 40)  return 2
    return 3
}

export function createArcadeHub(canvas, callbacks = {}) {
    const ctx = canvas.getContext('2d')
    let animId = null, lastFrame = 0, running = false, paused = false
    let W = 0, H = 0, dpr = 1
    let scale = 1, offsetX = 0, offsetY = 0

    // Pre-rendered colored map
    let mapCanvas = null

    // Player — integer grid position + step animation
    let px = SPAWN_QX, py = SPAWN_QY
    let pDir = 'down'
    let pStepping = false, pStepT = 0
    let pFromX = px, pFromY = py, pToX = px, pToY = py
    let pWalkFrame = 0 // 0 or 1 for walk cycle

    // Input
    const keys = {}
    let interactTarget = null
    let interactNpc = null
    let message = null, messageTimer = 0

    // Click-to-move pathfinding
    let pathQueue = []           // array of { x, y } grid coords to walk
    let pathInteractObj = null   // object to interact with at end of path
    let pathInteractNpc = null   // NPC to interact with at end of path

    // Collision grid (1=walkable)
    const collGrid = buildCollisionGrid()

    // Images
    const images = {}
    let tilesetImg = null
    let tilesetLoaded = false

    // NPCs
    let npcs = []
    let npcRendered = {}

    if (callbacks.images) {
        for (const [key, src] of Object.entries(callbacks.images)) {
            const img = new Image()
            img.src = src
            images[key] = img
            if (key === 'tileset') {
                tilesetImg = img
                img.onload = () => { tilesetLoaded = true; preRenderMap() }
            }
        }
    }

    // ── Pre-render the colorized map ──
    function preRenderMap() {
        if (!tilesetImg || !tilesetLoaded) return
        mapCanvas = document.createElement('canvas')
        mapCanvas.width = NATIVE_W
        mapCanvas.height = NATIVE_H
        const mctx = mapCanvas.getContext('2d')
        mctx.imageSmoothingEnabled = false

        const tmpCanvas = document.createElement('canvas')
        tmpCanvas.width = TILE_PX; tmpCanvas.height = TILE_PX
        const tmpCtx = tmpCanvas.getContext('2d')
        tmpCtx.imageSmoothingEnabled = false

        for (let by = 0; by < MAP_H_BLOCKS; by++) {
            for (let bx = 0; bx < MAP_W_BLOCKS; bx++) {
                const blockId = MAP_BLOCKS[by * MAP_W_BLOCKS + bx]
                const metaOffset = blockId * 16
                for (let ty = 0; ty < 4; ty++) {
                    for (let tx = 0; tx < 4; tx++) {
                        const tileIdx = METATILES[metaOffset + ty * 4 + tx]
                        let pngIdx = tileIdx
                        if (tileIdx >= 128) pngIdx = tileIdx - 32
                        const inBounds = tileIdx < 96 || tileIdx >= 128
                        const srcX = (pngIdx % TILES_PER_ROW) * TILE_PX
                        const srcY = Math.floor(pngIdx / TILES_PER_ROW) * TILE_PX
                        const dstX = bx * 32 + tx * TILE_PX
                        const dstY = by * 32 + ty * TILE_PX

                        if (!inBounds || srcY + TILE_PX > tilesetImg.height) {
                            const palIdx = getTilePalette(tileIdx)
                            const [r, g, b] = PALETTES[palIdx][3]
                            mctx.fillStyle = `rgb(${r},${g},${b})`
                            mctx.fillRect(dstX, dstY, TILE_PX, TILE_PX)
                            continue
                        }

                        tmpCtx.clearRect(0, 0, TILE_PX, TILE_PX)
                        tmpCtx.drawImage(tilesetImg, srcX, srcY, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX)
                        const palIdx = getTilePalette(tileIdx)
                        const palette = PALETTES[palIdx]
                        const imgData = tmpCtx.getImageData(0, 0, TILE_PX, TILE_PX)
                        const d = imgData.data
                        for (let i = 0; i < d.length; i += 4) {
                            const gray = d[i]
                            const ci = grayToPaletteIdx(gray)
                            const [r, g, b] = palette[ci]
                            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
                        }
                        tmpCtx.putImageData(imgData, 0, 0)
                        mctx.drawImage(tmpCanvas, dstX, dstY)
                    }
                }
            }
        }
    }

    // ── Grid helpers ──
    function tileBlocked(gx, gy) {
        if (gx < 0 || gx >= QUAD_W || gy < 0 || gy >= QUAD_H) return true
        return collGrid[gy * QUAD_W + gx] !== 1
    }

    // Check if any entity (player or NPC) occupies or is stepping into a tile
    function tileOccupied(gx, gy, excludeNpcId) {
        // Player
        if (px === gx && py === gy) return true
        if (pStepping && pToX === gx && pToY === gy) return true
        // NPCs
        for (const n of npcs) {
            if (n.id === excludeNpcId) continue
            if (n.gx === gx && n.gy === gy) return true
            if (n.stepping && n.toX === gx && n.toY === gy) return true
        }
        return false
    }

    const DIR_DX = { left: -1, right: 1, up: 0, down: 0 }
    const DIR_DY = { left: 0, right: 0, up: -1, down: 1 }
    const DIRS = ['up', 'down', 'left', 'right']

    // ── BFS pathfinding ──
    function findPath(sx, sy, gx, gy) {
        if (sx === gx && sy === gy) return []
        if (tileBlocked(gx, gy)) return null

        const visited = new Set()
        const parent = new Map()
        const queue = [[sx, sy]]
        const key = (x, y) => x + ',' + y
        visited.add(key(sx, sy))

        while (queue.length > 0) {
            const [cx, cy] = queue.shift()
            if (cx === gx && cy === gy) {
                // Reconstruct path
                const path = []
                let cur = key(gx, gy)
                while (cur !== key(sx, sy)) {
                    const [px, py] = cur.split(',').map(Number)
                    path.unshift({ x: px, y: py })
                    cur = parent.get(cur)
                }
                return path
            }
            for (const dir of DIRS) {
                const nx = cx + DIR_DX[dir], ny = cy + DIR_DY[dir]
                const nk = key(nx, ny)
                if (visited.has(nk)) continue
                if (tileBlocked(nx, ny) || tileOccupied(nx, ny)) continue
                visited.add(nk)
                parent.set(nk, key(cx, cy))
                queue.push([nx, ny])
            }
        }
        return null // no path
    }

    // Find walkable tile adjacent to target for interaction
    function findAdjacentWalkable(tx, ty) {
        const candidates = [
            { x: tx, y: ty + 1 }, // prefer facing up at target
            { x: tx, y: ty - 1 },
            { x: tx - 1, y: ty },
            { x: tx + 1, y: ty },
        ]
        for (const c of candidates) {
            if (!tileBlocked(c.x, c.y)) return c
        }
        return null
    }

    // ── Resize ──
    function resize() {
        const parent = canvas.parentElement
        if (!parent) return
        dpr = window.devicePixelRatio || 1
        W = parent.offsetWidth; H = parent.offsetHeight
        canvas.width = W * dpr; canvas.height = H * dpr
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const sx = W / NATIVE_W, sy = H / NATIVE_H
        const maxScale = Math.min(sx, sy)
        scale = Math.max(1, Math.floor(maxScale))
        if (scale * NATIVE_W < W * 0.5) scale = maxScale

        offsetX = Math.floor((W - NATIVE_W * scale) / 2)
        offsetY = Math.floor((H - NATIVE_H * scale) / 2)
    }

    // ── Update ──
    function update() {
        if (paused) return
        updatePlayer()
        updateNpcs()
        updateInteractTarget()
        if (message && messageTimer > 0) { messageTimer--; if (messageTimer <= 0) message = null }
    }

    function updatePlayer() {
        if (pStepping) {
            pStepT++
            if (pStepT >= STEP_FRAMES) {
                px = pToX; py = pToY
                pStepping = false; pStepT = 0
                pWalkFrame = 1 - pWalkFrame

                // Check if path arrived at interaction target
                if (pathQueue.length === 0) {
                    if (pathInteractNpc) { triggerNpcInteract(pathInteractNpc); pathInteractNpc = null }
                    else if (pathInteractObj) { triggerInteract(pathInteractObj); pathInteractObj = null }
                }
            }
            return
        }

        // Keyboard input cancels path
        let wantDir = null
        if (keys.ArrowUp || keys.KeyW)         wantDir = 'up'
        else if (keys.ArrowDown || keys.KeyS)   wantDir = 'down'
        else if (keys.ArrowLeft || keys.KeyA)    wantDir = 'left'
        else if (keys.ArrowRight || keys.KeyD)   wantDir = 'right'

        if (wantDir) {
            pathQueue = []; pathInteractObj = null; pathInteractNpc = null
            pDir = wantDir
            const tx = px + DIR_DX[wantDir], ty = py + DIR_DY[wantDir]
            if (tileBlocked(tx, ty) || tileOccupied(tx, ty)) return
            pFromX = px; pFromY = py
            pToX = tx; pToY = ty
            pStepping = true; pStepT = 0
            return
        }

        // Follow pathfinding queue
        if (pathQueue.length > 0) {
            const next = pathQueue[0]
            // Blocked by NPC that moved into the way — recalc or cancel
            if (tileOccupied(next.x, next.y)) {
                pathQueue = []; pathInteractObj = null; pathInteractNpc = null
                return
            }
            pathQueue.shift()
            const dx = next.x - px, dy = next.y - py
            if (dx < 0) pDir = 'left'
            else if (dx > 0) pDir = 'right'
            else if (dy < 0) pDir = 'up'
            else pDir = 'down'
            pFromX = px; pFromY = py
            pToX = next.x; pToY = next.y
            pStepping = true; pStepT = 0
        }
    }

    function updateNpcs() {
        for (const npc of npcs) {
            if (npc.stepping) {
                npc.stepT++
                if (npc.stepT >= STEP_FRAMES) {
                    npc.gx = npc.toX; npc.gy = npc.toY
                    npc.stepping = false; npc.stepT = 0
                    npc.walkFrame = 1 - npc.walkFrame
                }
                continue
            }

            // Countdown to next move
            npc.moveTimer--
            if (npc.moveTimer > 0) continue

            // Reset timer
            npc.moveTimer = NPC_MOVE_MIN + Math.floor(Math.random() * (NPC_MOVE_MAX - NPC_MOVE_MIN))

            // Pick a random direction
            const dir = DIRS[Math.floor(Math.random() * 4)]
            npc.dir = dir
            const tx = npc.gx + DIR_DX[dir], ty = npc.gy + DIR_DY[dir]

            // Check walkable and unoccupied
            if (tileBlocked(tx, ty) || tileOccupied(tx, ty, npc.id)) continue

            // Start step
            npc.fromX = npc.gx; npc.fromY = npc.gy
            npc.toX = tx; npc.toY = ty
            npc.stepping = true; npc.stepT = 0
        }
    }

    function updateInteractTarget() {
        interactTarget = null
        interactNpc = null
        let minD = INTERACT_DIST
        for (const obj of OBJECTS) {
            const d = Math.abs(px - obj.qx) + Math.abs(py - obj.qy) // manhattan
            if (d < minD) { minD = d; interactTarget = obj }
        }
        for (const npc of npcs) {
            const d = Math.abs(px - npc.gx) + Math.abs(py - npc.gy)
            if (d < minD) { minD = d; interactTarget = null; interactNpc = npc }
        }
    }

    // ── Interpolated positions for rendering ──
    function getPlayerRenderPos() {
        if (!pStepping) return { x: px * 16, y: py * 16 }
        const t = pStepT / STEP_FRAMES
        return {
            x: (pFromX + (pToX - pFromX) * t) * 16,
            y: (pFromY + (pToY - pFromY) * t) * 16,
        }
    }

    function getNpcRenderPos(npc) {
        if (!npc.stepping) return { x: npc.gx * 16, y: npc.gy * 16 }
        const t = npc.stepT / STEP_FRAMES
        return {
            x: (npc.fromX + (npc.toX - npc.fromX) * t) * 16,
            y: (npc.fromY + (npc.toY - npc.fromY) * t) * 16,
        }
    }

    // ── Draw ──
    function draw() {
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#0a0a12'
        ctx.fillRect(0, 0, W, H)

        if (mapCanvas) {
            ctx.drawImage(mapCanvas,
                0, 0, NATIVE_W, NATIVE_H,
                offsetX, offsetY, NATIVE_W * scale, NATIVE_H * scale
            )
        } else {
            ctx.fillStyle = '#222'
            ctx.font = '14px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('Loading tileset...', W / 2, H / 2)
        }

        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(scale, scale)

        drawNpcs()
        drawPlayer()
        drawNpcHighlight()
        drawInteractPrompt()
        drawMessage()

        ctx.restore()
    }

    function drawPlayer() {
        const { x, y } = getPlayerRenderPos()
        const sprW = 14, sprH = 18

        if (images.zeus?.complete) {
            ctx.drawImage(images.zeus, x + 8 - sprW / 2, y + 8 - sprH + 4, sprW, sprH)
        } else {
            ctx.fillStyle = '#3a2855'
            ctx.fillRect(x + 1, y - 2, 14, 18)
        }
    }

    function drawNpcs() {
        for (const npc of npcs) {
            const { x, y } = getNpcRenderPos(npc)
            const rendered = npcRendered[npc.id]
            if (rendered) {
                ctx.drawImage(rendered, x, y, 16, 16)
            } else {
                ctx.fillStyle = '#885522'
                ctx.fillRect(x + 1, y, 14, 16)
                ctx.fillStyle = '#ffddaa'
                ctx.fillRect(x + 4, y + 2, 8, 6)
            }
        }
    }

    function drawNpcHighlight() {
        if (!interactNpc) return
        const { x, y } = getNpcRenderPos(interactNpc)
        ctx.strokeStyle = '#ffe600'
        ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 300) * 0.15
        ctx.lineWidth = 1
        ctx.strokeRect(x - 1, y - 1, 18, 18)
        ctx.globalAlpha = 1
    }

    function drawInteractPrompt() {
        const target = interactTarget || interactNpc
        if (!target) return

        const isNpc = !interactTarget && !!interactNpc
        let x, y
        if (isNpc) {
            const pos = getNpcRenderPos(target)
            x = pos.x + 8; y = pos.y - 16
        } else {
            x = target.qx * 16; y = target.qy * 16 - 24
        }
        const t = performance.now() / 1000
        const bobY = Math.sin(t * 3) * 1.5

        ctx.font = '5px monospace'
        ctx.textAlign = 'center'
        const label = isNpc ? target.name : target.label
        const prompt = 'PRESS ENTER'
        const color = isNpc ? '#ffe600' : target.color
        const w = Math.max(ctx.measureText(label).width, ctx.measureText(prompt).width) + 10
        const h = 15
        const bx = x - w / 2, by = y - h / 2 + bobY

        ctx.fillStyle = 'rgba(10,10,30,0.92)'
        ctx.fillRect(bx, by, w, h)
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.4
        ctx.lineWidth = 0.5
        ctx.strokeRect(bx, by, w, h)
        ctx.globalAlpha = 1

        ctx.fillStyle = '#e0e8ff'
        ctx.textBaseline = 'top'
        ctx.fillText(label, x, by + 2)
        if (Math.floor(t * 2.5) % 2) {
            ctx.fillStyle = color
            ctx.fillText(prompt, x, by + 8)
        }
    }

    function drawMessage() {
        if (!message) return
        const alpha = Math.min(1, messageTimer / 30)
        ctx.font = '5px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const w = ctx.measureText(message).width + 16
        const cx = NATIVE_W / 2, cy = NATIVE_H - 20
        const h = 12

        ctx.globalAlpha = alpha
        ctx.fillStyle = 'rgba(10,10,30,0.92)'
        ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
        ctx.strokeStyle = '#ff44ff'
        ctx.lineWidth = 0.5
        ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
        ctx.fillStyle = '#e0e8ff'
        ctx.fillText(message, cx, cy)
        ctx.globalAlpha = 1
    }

    // ── Game loop + Input ──
    function loop(ts) {
        animId = requestAnimationFrame(loop)
        if (ts - lastFrame < FRAME_MS) return
        lastFrame = ts - ((ts - lastFrame) % FRAME_MS)
        update()
        draw()
    }

    function onKeyDown(e) {
        if (paused) return
        keys[e.code] = true
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault()
        if (e.code === 'Enter' || e.code === 'Space') {
            if (interactNpc) { e.preventDefault(); triggerNpcInteract(interactNpc) }
            else if (interactTarget) { e.preventDefault(); triggerInteract(interactTarget) }
        }
    }
    function onKeyUp(e) { keys[e.code] = false }

    function onClick(e) {
        if (paused) return
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left, my = e.clientY - rect.top
        // Convert screen coords → game grid coords
        const gameX = (mx - offsetX) / scale, gameY = (my - offsetY) / scale
        const gx = Math.floor(gameX / 16), gy = Math.floor(gameY / 16)

        // Check if clicked on an NPC
        for (const npc of npcs) {
            if (npc.gx === gx && npc.gy === gy) {
                const adj = findAdjacentWalkable(npc.gx, npc.gy)
                if (!adj) return
                const path = findPath(px, py, adj.x, adj.y)
                if (path) { pathQueue = path; pathInteractNpc = npc; pathInteractObj = null }
                return
            }
        }

        // Check if clicked on an object
        for (const obj of OBJECTS) {
            if (obj.qx === gx && obj.qy === gy) {
                const adj = findAdjacentWalkable(obj.qx, obj.qy)
                if (!adj) return
                const path = findPath(px, py, adj.x, adj.y)
                if (path) { pathQueue = path; pathInteractObj = obj; pathInteractNpc = null }
                return
            }
        }

        // Walk to clicked tile
        if (!tileBlocked(gx, gy)) {
            const path = findPath(px, py, gx, gy)
            if (path) { pathQueue = path; pathInteractObj = null; pathInteractNpc = null }
        }
    }

    function triggerInteract(obj) {
        if (callbacks.onInteract) callbacks.onInteract(obj.type, obj)
    }
    function triggerNpcInteract(npc) {
        if (callbacks.onNpcInteract) callbacks.onNpcInteract(npc)
    }

    // Touch — swipe for direction
    let touchStartX = 0, touchStartY = 0, touching = false
    function onTouchStart(e) {
        if (paused) return
        const t = e.touches[0], r = canvas.getBoundingClientRect()
        touchStartX = t.clientX - r.left; touchStartY = t.clientY - r.top; touching = true
        if (interactNpc) triggerNpcInteract(interactNpc)
        else if (interactTarget) triggerInteract(interactTarget)
    }
    function onTouchMove(e) {
        if (!touching || paused) return
        const t = e.touches[0], r = canvas.getBoundingClientRect()
        const ddx = (t.clientX - r.left) - touchStartX, ddy = (t.clientY - r.top) - touchStartY
        keys.ArrowLeft = false; keys.ArrowRight = false; keys.ArrowUp = false; keys.ArrowDown = false
        if (Math.abs(ddx) > 15 || Math.abs(ddy) > 15) {
            if (Math.abs(ddx) > Math.abs(ddy)) {
                if (ddx > 0) keys.ArrowRight = true; else keys.ArrowLeft = true
            } else {
                if (ddy > 0) keys.ArrowDown = true; else keys.ArrowUp = true
            }
        }
    }
    function onTouchEnd() {
        touching = false
        keys.ArrowLeft = false; keys.ArrowRight = false; keys.ArrowUp = false; keys.ArrowDown = false
    }

    function start() {
        if (running) return; running = true; resize()
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        canvas.addEventListener('click', onClick)
        canvas.addEventListener('touchstart', onTouchStart, { passive: true })
        canvas.addEventListener('touchmove', onTouchMove, { passive: true })
        canvas.addEventListener('touchend', onTouchEnd)
        lastFrame = performance.now(); animId = requestAnimationFrame(loop)
    }

    function stop() {
        running = false; if (animId) cancelAnimationFrame(animId)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        canvas.removeEventListener('click', onClick)
        canvas.removeEventListener('touchstart', onTouchStart)
        canvas.removeEventListener('touchmove', onTouchMove)
        canvas.removeEventListener('touchend', onTouchEnd)
    }

    function pause() { paused = true; Object.keys(keys).forEach(k => keys[k] = false) }
    function resume() { paused = false }

    // ── NPC management ──
    function setNpcsData(npcList) {
        npcs = npcList.map(npc => {
            let gx = npc.spawn_qx, gy = npc.spawn_qy
            if (gx == null || gy == null) {
                const spot = findRandomWalkable()
                gx = spot.qx; gy = spot.qy
            }
            const spriteKey = npc.image_url
            if (spriteKey && !npcRendered[npc.id]) {
                const spriteDef = NPC_SPRITE_MAP[spriteKey]
                if (spriteDef) {
                    const img = new Image()
                    img.src = spriteDef.src
                    img.onload = () => { npcRendered[npc.id] = colorizeSprite(img, spriteKey) }
                }
            }
            return {
                ...npc,
                gx, gy,
                dir: 'down',
                stepping: false, stepT: 0,
                fromX: gx, fromY: gy, toX: gx, toY: gy,
                walkFrame: 0,
                moveTimer: NPC_MOVE_MIN + Math.floor(Math.random() * (NPC_MOVE_MAX - NPC_MOVE_MIN)),
            }
        })
    }

    function colorizeSprite(img, spriteKey) {
        const palette = getSpritePalette(spriteKey)
        const size = 16
        const c = document.createElement('canvas')
        c.width = size; c.height = size
        const cx = c.getContext('2d')
        cx.imageSmoothingEnabled = false
        cx.drawImage(img, 0, 0, size, size, 0, 0, size, size)
        const imgData = cx.getImageData(0, 0, size, size)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue
            const gray = d[i]
            const ci = grayToPaletteIdx(gray)
            if (ci === 0) { d[i + 3] = 0; continue }
            const [r, g, b] = palette[ci]
            d[i] = r; d[i + 1] = g; d[i + 2] = b
        }
        cx.putImageData(imgData, 0, 0)
        return c
    }

    function findRandomWalkable() {
        const walkable = []
        for (let y = 0; y < QUAD_H; y++) {
            for (let x = 0; x < QUAD_W; x++) {
                if (collGrid[y * QUAD_W + x] !== 1) continue
                const nearObj = OBJECTS.some(o => Math.abs(o.qx - x) < 2 && Math.abs(o.qy - y) < 2)
                if (nearObj) continue
                if (Math.abs(x - SPAWN_QX) < 2 && Math.abs(y - SPAWN_QY) < 2) continue
                const nearNpc = npcs.some(n => Math.abs(n.gx - x) < 2 && Math.abs(n.gy - y) < 2)
                if (nearNpc) continue
                walkable.push({ qx: x, qy: y })
            }
        }
        if (walkable.length === 0) return { qx: SPAWN_QX + 3, qy: SPAWN_QY }
        return walkable[Math.floor(Math.random() * walkable.length)]
    }

    return { start, stop, resize, pause, resume, setNpcs: setNpcsData }
}
