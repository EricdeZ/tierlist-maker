import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import PageTitle from '../components/PageTitle'

// ============================================================
// Constants
// ============================================================
const MAX_DISPLAY_W = 960
const VH_RATIO = 0.58
const EDGE_PX = 10
const MIN_CROP = 0.03
const MAX_HISTORY = 30
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.1
const MAX_ZOOM = 20
const MARCH_SPEED = 200
const MAG_SNAP_RADIUS = 15
const TOOLS = ['sample', 'brush', 'lasso', 'magLasso', 'wand', 'crop']
const TOOL_LABELS = { sample: 'Sample', brush: 'Brush', lasso: 'Lasso', magLasso: 'Mag Lasso', wand: 'Wand', crop: 'Crop' }
const TOOL_KEYS = { sample: 'S', brush: 'B', lasso: 'L', magLasso: 'M', wand: 'W', crop: 'C' }
const CURSOR_MAP = {
    nw: 'nwse-resize', se: 'nwse-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize',
    w: 'ew-resize', e: 'ew-resize',
    move: 'move',
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const rgb = (c) => `rgb(${c.r},${c.g},${c.b})`

// ============================================================
// Canny Edge Detection (Gaussian blur + Sobel + NMS + hysteresis)
// ============================================================
function gaussianBlur(gray, w, h, sigma) {
    const r = Math.ceil(sigma * 3)
    const kernel = []
    let sum = 0
    for (let i = -r; i <= r; i++) {
        const v = Math.exp(-(i * i) / (2 * sigma * sigma))
        kernel.push(v)
        sum += v
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum

    // Separable: horizontal pass
    const tmp = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let v = 0
            for (let k = -r; k <= r; k++) {
                const nx = Math.min(w - 1, Math.max(0, x + k))
                v += gray[y * w + nx] * kernel[k + r]
            }
            tmp[y * w + x] = v
        }
    }
    // Vertical pass
    const out = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let v = 0
            for (let k = -r; k <= r; k++) {
                const ny = Math.min(h - 1, Math.max(0, y + k))
                v += tmp[ny * w + x] * kernel[k + r]
            }
            out[y * w + x] = v
        }
    }
    return out
}

function computeEdges(imageData) {
    const { width: w, height: h, data } = imageData
    // Grayscale
    const rawGray = new Float32Array(w * h)
    for (let i = 0; i < rawGray.length; i++) {
        const j = i * 4
        rawGray[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114
    }

    // Step 1: Gaussian blur (sigma=1.4 — good balance of noise reduction vs edge preservation)
    const gray = gaussianBlur(rawGray, w, h, 1.4)

    // Step 2: Sobel gradients
    const rawMag = new Float32Array(w * h)
    const dir = new Float32Array(w * h)
    let maxMag = 0
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const tl = gray[(y - 1) * w + x - 1], tc = gray[(y - 1) * w + x], tr = gray[(y - 1) * w + x + 1]
            const ml = gray[y * w + x - 1], mr = gray[y * w + x + 1]
            const bl = gray[(y + 1) * w + x - 1], bc = gray[(y + 1) * w + x], br = gray[(y + 1) * w + x + 1]
            const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
            const m = Math.sqrt(gx * gx + gy * gy)
            rawMag[y * w + x] = m
            dir[y * w + x] = Math.atan2(gy, gx)
            if (m > maxMag) maxMag = m
        }
    }
    if (maxMag > 0) for (let i = 0; i < rawMag.length; i++) rawMag[i] /= maxMag

    // Step 3: Non-maximum suppression — thin edges to 1px
    const nms = new Float32Array(w * h)
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const pi = y * w + x
            const m = rawMag[pi]
            if (m === 0) continue
            // Quantize direction to 0/45/90/135 degrees
            let angle = dir[pi] * (180 / Math.PI)
            if (angle < 0) angle += 180
            let n1, n2
            if (angle < 22.5 || angle >= 157.5) {
                n1 = rawMag[y * w + x - 1]; n2 = rawMag[y * w + x + 1]
            } else if (angle < 67.5) {
                n1 = rawMag[(y - 1) * w + x + 1]; n2 = rawMag[(y + 1) * w + x - 1]
            } else if (angle < 112.5) {
                n1 = rawMag[(y - 1) * w + x]; n2 = rawMag[(y + 1) * w + x]
            } else {
                n1 = rawMag[(y - 1) * w + x - 1]; n2 = rawMag[(y + 1) * w + x + 1]
            }
            nms[pi] = (m >= n1 && m >= n2) ? m : 0
        }
    }

    // Step 4: Hysteresis thresholding — connect weak edges to strong ones
    const highT = 0.15, lowT = 0.05
    const mag = new Float32Array(w * h)
    const STRONG = 1, WEAK = 0.5
    for (let i = 0; i < nms.length; i++) {
        if (nms[i] >= highT) mag[i] = STRONG
        else if (nms[i] >= lowT) mag[i] = WEAK
    }
    // Promote weak edges connected to strong edges (BFS)
    const queue = []
    for (let i = 0; i < mag.length; i++) {
        if (mag[i] === STRONG) queue.push(i)
    }
    while (queue.length > 0) {
        const pi = queue.pop()
        const px = pi % w, py = (pi - px) / w
        for (let dy = -1; dy <= 1; dy++) {
            const ny = py + dy
            if (ny < 0 || ny >= h) continue
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue
                const nx = px + dx
                if (nx < 0 || nx >= w) continue
                const ni = ny * w + nx
                if (mag[ni] === WEAK) {
                    mag[ni] = STRONG
                    queue.push(ni)
                }
            }
        }
    }
    // Suppress remaining weak edges
    for (let i = 0; i < mag.length; i++) {
        if (mag[i] < STRONG) mag[i] = 0
    }

    return { mag, dir, width: w, height: h }
}

// ============================================================
// Flood Fill (existing algorithm, preserved)
// ============================================================
function floodFillRemove(src, samples, tol) {
    if (!samples.length) return src
    const { width, height } = src
    const orig = src.data
    const out = new ImageData(new Uint8ClampedArray(orig), width, height)
    const d = out.data
    const tolSq = tol * tol
    const featherW = Math.max(tol * 0.28, 5)
    const outerTol = tol + featherW
    const outerSq = outerTol * outerTol
    const alphaMap = new Float32Array(width * height).fill(1)

    for (const sample of samples) {
        const sx = Math.round(sample.rx * (width - 1))
        const sy = Math.round(sample.ry * (height - 1))
        const tr = sample.r, tg = sample.g, tb = sample.b
        const visited = new Uint8Array(width * height)
        const queue = new Int32Array(width * height)
        let head = 0, tail = 0
        const si = sy * width + sx
        visited[si] = 1
        queue[tail++] = si
        while (head < tail) {
            const pi = queue[head++]
            const ci = pi * 4
            const dr = orig[ci] - tr, dg = orig[ci + 1] - tg, db = orig[ci + 2] - tb
            const distSq = dr * dr + dg * dg + db * db
            if (distSq > outerSq) continue
            if (distSq <= tolSq) {
                alphaMap[pi] = Math.min(alphaMap[pi], 0)
            } else {
                alphaMap[pi] = Math.min(alphaMap[pi], (Math.sqrt(distSq) - tol) / featherW)
            }
            const px = pi % width, py = (pi - px) / width
            if (px > 0)          { const ni = pi - 1;     if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
            if (px < width - 1)  { const ni = pi + 1;     if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
            if (py > 0)          { const ni = pi - width;  if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
            if (py < height - 1) { const ni = pi + width;  if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
        }
    }
    const smoothed = new Float32Array(alphaMap)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pi = y * width + x
            if (alphaMap[pi] < 1) continue
            let removed = 0, total = 0
            for (let dy = -1; dy <= 1; dy++) {
                const ny = y + dy
                if (ny < 0 || ny >= height) continue
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue
                    const nx = x + dx
                    if (nx < 0 || nx >= width) continue
                    total++
                    if (alphaMap[ny * width + nx] < 0.1) removed++
                }
            }
            if (removed > 0) smoothed[pi] = Math.max(0, 1 - (removed / total) * 1.2)
        }
    }
    for (let i = 0; i < smoothed.length; i++) {
        if (smoothed[i] < 1) d[i * 4 + 3] = Math.round(smoothed[i] * d[i * 4 + 3])
    }
    return out
}

// ============================================================
// Flood Fill for Selection (Magic Wand)
// ============================================================
function floodFillSelect(srcData, startX, startY, tol) {
    const { width, height, data } = srcData
    const mask = new Uint8Array(width * height)
    const tolSq = tol * tol
    const si = startY * width + startX
    const tr = data[si * 4], tg = data[si * 4 + 1], tb = data[si * 4 + 2]
    const visited = new Uint8Array(width * height)
    const queue = new Int32Array(width * height)
    let head = 0, tail = 0
    visited[si] = 1
    queue[tail++] = si
    while (head < tail) {
        const pi = queue[head++]
        const ci = pi * 4
        const dr = data[ci] - tr, dg = data[ci + 1] - tg, db = data[ci + 2] - tb
        if (dr * dr + dg * dg + db * db > tolSq) continue
        mask[pi] = 255
        const px = pi % width, py = (pi - px) / width
        if (px > 0)          { const ni = pi - 1;     if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
        if (px < width - 1)  { const ni = pi + 1;     if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
        if (py > 0)          { const ni = pi - width;  if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
        if (py < height - 1) { const ni = pi + width;  if (!visited[ni]) { visited[ni] = 1; queue[tail++] = ni } }
    }
    return mask
}

// ============================================================
// Selection Utilities
// ============================================================
function rasterizePath(points, width, height) {
    const mask = new Uint8Array(width * height)
    if (points.length < 3) return mask
    let minY = height, maxY = 0
    for (const p of points) {
        if (p.y < minY) minY = Math.floor(p.y)
        if (p.y > maxY) maxY = Math.ceil(p.y)
    }
    minY = Math.max(0, minY)
    maxY = Math.min(height - 1, maxY)
    for (let y = minY; y <= maxY; y++) {
        const nodes = []
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const yi = points[i].y, yj = points[j].y
            if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
                nodes.push(points[i].x + (y - yi) / (yj - yi) * (points[j].x - points[i].x))
            }
        }
        nodes.sort((a, b) => a - b)
        for (let i = 0; i < nodes.length - 1; i += 2) {
            const x0 = Math.max(0, Math.ceil(nodes[i]))
            const x1 = Math.min(width - 1, Math.floor(nodes[i + 1]))
            for (let x = x0; x <= x1; x++) mask[y * width + x] = 255
        }
    }
    return mask
}

function featherMask(mask, width, height, radius) {
    if (radius < 1) return mask
    const out = new Uint8Array(mask)
    const r = Math.ceil(radius)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pi = y * width + x
            if (mask[pi] === 255) {
                let onEdge = false
                for (let dy = -1; dy <= 1 && !onEdge; dy++) {
                    for (let dx = -1; dx <= 1 && !onEdge; dx++) {
                        const nx = x + dx, ny = y + dy
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx] === 0) onEdge = true
                    }
                }
                if (!onEdge) continue
            } else if (mask[pi] === 0) {
                let onEdge = false
                for (let dy = -1; dy <= 1 && !onEdge; dy++) {
                    for (let dx = -1; dx <= 1 && !onEdge; dx++) {
                        const nx = x + dx, ny = y + dy
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx] === 255) onEdge = true
                    }
                }
                if (!onEdge) continue
            }
            let sum = 0, count = 0
            for (let dy = -r; dy <= r; dy++) {
                const ny = y + dy
                if (ny < 0 || ny >= height) continue
                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx
                    if (nx < 0 || nx >= width) continue
                    const d = Math.sqrt(dx * dx + dy * dy)
                    if (d > radius) continue
                    const w = 1 - d / radius
                    sum += mask[ny * width + nx] * w
                    count += w
                }
            }
            out[pi] = Math.round(count > 0 ? sum / count : mask[pi])
        }
    }
    return out
}

function invertMask(mask) {
    const out = new Uint8Array(mask.length)
    for (let i = 0; i < mask.length; i++) out[i] = 255 - mask[i]
    return out
}

function combineMasks(a, b, mode) {
    const out = new Uint8Array(a.length)
    for (let i = 0; i < a.length; i++) {
        if (mode === 'add') out[i] = Math.min(255, a[i] + b[i])
        else if (mode === 'subtract') out[i] = Math.max(0, a[i] - b[i])
        else out[i] = b[i]
    }
    return out
}

// ============================================================
// Magnetic Lasso — find edge-snapped path between two points
// ============================================================
function snapToEdge(x, y, sobelData, radius) {
    if (!sobelData) return { x, y }
    const { mag, width, height } = sobelData
    let bestX = Math.round(x), bestY = Math.round(y), bestMag = 0
    const r = Math.ceil(radius)
    for (let dy = -r; dy <= r; dy++) {
        const ny = Math.round(y) + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -r; dx <= r; dx++) {
            const nx = Math.round(x) + dx
            if (nx < 0 || nx >= width) continue
            if (dx * dx + dy * dy > radius * radius) continue
            const m = mag[ny * width + nx]
            if (m > bestMag) { bestMag = m; bestX = nx; bestY = ny }
        }
    }
    return { x: bestX, y: bestY }
}

// ============================================================
// Brush — apply stroke to ImageData
// ============================================================
function applyBrush(imageData, cx, cy, brushSize, hardness, erasing, edgeAware, sobelData) {
    const { width, height, data } = imageData
    const r = brushSize / 2
    const x0 = Math.max(0, Math.floor(cx - r))
    const y0 = Math.max(0, Math.floor(cy - r))
    const x1 = Math.min(width - 1, Math.ceil(cx + r))
    const y1 = Math.min(height - 1, Math.ceil(cy + r))

    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx, dy = y - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > r) continue

            let strength = 1
            if (hardness < 100) {
                const softStart = r * (hardness / 100)
                if (dist > softStart) strength = 1 - (dist - softStart) / (r - softStart)
            }

            if (edgeAware && sobelData) {
                const edgeMag = sobelData.mag[y * width + x]
                if (edgeMag > 0.3) strength *= Math.max(0, 1 - (edgeMag - 0.3) / 0.4)
            }

            const pi = (y * width + x) * 4
            if (erasing) {
                data[pi + 3] = Math.round(data[pi + 3] * (1 - strength))
            } else {
                data[pi + 3] = Math.min(255, Math.round(data[pi + 3] + (255 - data[pi + 3]) * strength))
            }
        }
    }
}

// ============================================================
// Main Component
// ============================================================
export default function BgRemover() {
    // --- Image state ---
    const [image, setImage] = useState(null)
    const [size, setSize] = useState(null)
    const [srcData, setSrcData] = useState(null)
    const [workingData, setWorkingData] = useState(null) // current pixel state after all edits

    // --- Tool state ---
    const [tool, setTool] = useState('sample')
    const [samples, setSamples] = useState([])
    const [tolerance, setTolerance] = useState(42)
    const [hoverColor, setHoverColor] = useState(null)
    const [fileDrag, setFileDrag] = useState(false)

    // --- Brush state ---
    const [brushSize, setBrushSize] = useState(30)
    const [brushHardness, setBrushHardness] = useState(80)
    const [brushErasing, setBrushErasing] = useState(true)
    const [edgeAware, setEdgeAware] = useState(true)

    // --- Selection state ---
    const [selectionMask, setSelectionMask] = useState(null)
    const [featherRadius, setFeatherRadius] = useState(0)
    const [marchOffset, setMarchOffset] = useState(0)

    // --- Lasso state ---
    const [lassoPoints, setLassoPoints] = useState([])
    const [isDrawingLasso, setIsDrawingLasso] = useState(false)

    // --- Magnetic lasso state ---
    const [magAnchors, setMagAnchors] = useState([])
    const [magPreview, setMagPreview] = useState(null)
    const [isDrawingMag, setIsDrawingMag] = useState(false)

    // --- Crop state ---
    const [crop, setCrop] = useState(null)
    const [hoverHandle, setHoverHandle] = useState(null)

    // --- Output state ---
    const [outputW, setOutputW] = useState(null)
    const [outputH, setOutputH] = useState(null)
    const [lockRatio, setLockRatio] = useState(true)

    // --- Zoom/Pan state ---
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })

    // --- History ---
    const [history, setHistory] = useState([])
    const [historyIdx, setHistoryIdx] = useState(-1)

    // --- Refs ---
    const canvasRef = useRef(null)
    const overlayRef = useRef(null)
    const containerRef = useRef(null)
    const tmpRef = useRef(null)
    const fileRef = useRef(null)
    const rafRef = useRef(null)
    const cropDrag = useRef(null)
    const brushDrag = useRef(false)
    const panDrag = useRef(null)
    const spaceDown = useRef(false)
    const sobelRef = useRef(null)
    const marchTimer = useRef(null)
    const lastBrushPos = useRef(null)

    // --- Checker pattern ---
    const checker = useMemo(() => {
        const c = document.createElement('canvas')
        c.width = 20; c.height = 20
        const x = c.getContext('2d')
        x.fillStyle = '#191930'
        x.fillRect(0, 0, 20, 20)
        x.fillStyle = '#212140'
        x.fillRect(0, 0, 10, 10)
        x.fillRect(10, 10, 10, 10)
        return c
    }, [])

    // --- Marching ants timer ---
    useEffect(() => {
        if (selectionMask) {
            marchTimer.current = setInterval(() => setMarchOffset(v => (v + 1) % 16), MARCH_SPEED)
            return () => clearInterval(marchTimer.current)
        }
    }, [selectionMask])

    // --- History helpers ---
    const pushHistory = useCallback((imgData) => {
        setHistory(prev => {
            const next = prev.slice(0, historyIdx + 1)
            next.push(new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height))
            if (next.length > MAX_HISTORY) next.shift()
            return next
        })
        setHistoryIdx(prev => Math.min(prev + 1, MAX_HISTORY - 1))
    }, [historyIdx])

    const undo = useCallback(() => {
        if (historyIdx <= 0) return
        const newIdx = historyIdx - 1
        setHistoryIdx(newIdx)
        setWorkingData(prev => {
            const h = history[newIdx]
            return h ? new ImageData(new Uint8ClampedArray(h.data), h.width, h.height) : prev
        })
    }, [historyIdx, history])

    const redo = useCallback(() => {
        if (historyIdx >= history.length - 1) return
        const newIdx = historyIdx + 1
        setHistoryIdx(newIdx)
        setWorkingData(prev => {
            const h = history[newIdx]
            return h ? new ImageData(new Uint8ClampedArray(h.data), h.width, h.height) : prev
        })
    }, [historyIdx, history])

    // --- Coordinate conversion ---
    const screenToCanvas = useCallback((e) => {
        const container = containerRef.current
        if (!container || !size) return { x: 0, y: 0 }
        const rect = container.getBoundingClientRect()
        const sx = (e.clientX - rect.left - pan.x) / zoom
        const sy = (e.clientY - rect.top - pan.y) / zoom
        return { x: sx, y: sy }
    }, [zoom, pan, size])

    const getRelCoords = useCallback((e) => {
        const { x, y } = screenToCanvas(e)
        if (!size) return { rx: 0, ry: 0 }
        return {
            rx: clamp(x / size.w, 0, 1),
            ry: clamp(y / size.h, 0, 1),
        }
    }, [screenToCanvas, size])

    // --- Crop hit test ---
    const hitTest = useCallback((rx, ry) => {
        if (!crop || !size) return null
        const t = EDGE_PX / (size.w * zoom)
        const tY = EDGE_PX / (size.h * zoom)

        const nearT = Math.abs(ry - crop.ry) < tY
        const nearB = Math.abs(ry - (crop.ry + crop.rh)) < tY
        const nearL = Math.abs(rx - crop.rx) < t
        const nearR = Math.abs(rx - (crop.rx + crop.rw)) < t
        const inH = rx > crop.rx - t && rx < crop.rx + crop.rw + t
        const inV = ry > crop.ry - tY && ry < crop.ry + crop.rh + tY

        if (nearT && nearL) return 'nw'
        if (nearT && nearR) return 'ne'
        if (nearB && nearL) return 'sw'
        if (nearB && nearR) return 'se'
        if (nearT && inH) return 'n'
        if (nearB && inH) return 's'
        if (nearL && inV) return 'w'
        if (nearR && inV) return 'e'
        if (rx >= crop.rx && rx <= crop.rx + crop.rw && ry >= crop.ry && ry <= crop.ry + crop.rh) return 'move'
        return null
    }, [crop, size, zoom])

    // --- Load ---
    const load = useCallback((file) => {
        if (!file?.type.startsWith('image/')) return
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            const maxW = Math.min(MAX_DISPLAY_W, window.innerWidth - 48)
            const maxH = window.innerHeight * VH_RATIO
            let w = img.width, h = img.height
            const s = Math.min(1, maxW / w, maxH / h)
            setImage(img)
            const newSize = { w: Math.round(w * s), h: Math.round(h * s) }
            setSize(newSize)
            setOutputW(img.width)
            setOutputH(img.height)
            setSamples([])
            setCrop(null)
            setHoverColor(null)
            setTool('sample')
            setSelectionMask(null)
            setLassoPoints([])
            setMagAnchors([])
            setIsDrawingLasso(false)
            setIsDrawingMag(false)
            setZoom(1)
            setPan({ x: 0, y: 0 })
            setHistory([])
            setHistoryIdx(-1)
            URL.revokeObjectURL(url)
        }
        img.src = url
    }, [])

    // Auto-init crop when entering crop mode
    const switchTool = useCallback((t) => {
        setTool(t)
        if (t === 'crop' && !crop) setCrop({ rx: 0, ry: 0, rw: 1, rh: 1 })
    }, [crop])

    // --- Init source data + Sobel ---
    useEffect(() => {
        if (!image || !size) return
        const c = canvasRef.current
        c.width = size.w; c.height = size.h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(image, 0, 0, size.w, size.h)
        const data = ctx.getImageData(0, 0, size.w, size.h)
        setSrcData(data)
        const initial = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)
        setWorkingData(initial)
        setHistory([new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)])
        setHistoryIdx(0)
        sobelRef.current = computeEdges(data)
    }, [image, size])

    // --- Init overlay canvas ---
    useEffect(() => {
        if (!size || !overlayRef.current) return
        const o = overlayRef.current
        o.width = size.w
        o.height = size.h
    }, [size])

    // Sync output size when crop changes
    useEffect(() => {
        if (!image) return
        if (crop && crop.rw > MIN_CROP && crop.rh > MIN_CROP) {
            setOutputW(Math.round(crop.rw * image.width))
            setOutputH(Math.round(crop.rh * image.height))
        } else if (!crop) {
            setOutputW(image.width)
            setOutputH(image.height)
        }
    }, [crop, image])

    // --- Apply samples to working data ---
    const applyResult = useMemo(() => {
        if (!workingData) return null
        if (!samples.length) return workingData
        return floodFillRemove(workingData, samples, tolerance * 2.5)
    }, [workingData, samples, tolerance])

    // --- Main render ---
    useEffect(() => {
        if (!applyResult) return
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
            const c = canvasRef.current
            if (!c) return
            const ctx = c.getContext('2d', { willReadFrequently: true })

            ctx.fillStyle = ctx.createPattern(checker, 'repeat')
            ctx.fillRect(0, 0, c.width, c.height)

            if (!tmpRef.current) tmpRef.current = document.createElement('canvas')
            const t = tmpRef.current
            t.width = c.width; t.height = c.height
            t.getContext('2d').putImageData(applyResult, 0, 0)
            ctx.drawImage(t, 0, 0)

            // Selection tint
            if (selectionMask && (tool === 'lasso' || tool === 'magLasso' || tool === 'wand')) {
                const overlay = ctx.getImageData(0, 0, c.width, c.height)
                const od = overlay.data
                for (let i = 0; i < selectionMask.length; i++) {
                    if (selectionMask[i] > 0) {
                        od[i * 4] = Math.min(255, od[i * 4] + 30)
                        od[i * 4 + 2] = Math.min(255, od[i * 4 + 2] + 50)
                    }
                }
                ctx.putImageData(overlay, 0, 0)
            }

            // Crop overlay
            if (crop && (crop.rw < 1 || crop.rh < 1 || crop.rx > 0 || crop.ry > 0)) {
                const cx = Math.round(crop.rx * c.width)
                const cy = Math.round(crop.ry * c.height)
                const cw = Math.round(crop.rw * c.width)
                const ch = Math.round(crop.rh * c.height)

                ctx.fillStyle = 'rgba(0,0,0,0.55)'
                ctx.fillRect(0, 0, c.width, cy)
                ctx.fillRect(0, cy + ch, c.width, c.height - cy - ch)
                ctx.fillRect(0, cy, cx, ch)
                ctx.fillRect(cx + cw, cy, c.width - cx - cw, ch)

                ctx.strokeStyle = 'rgba(34,211,238,0.8)'
                ctx.lineWidth = 1.5
                ctx.setLineDash([])
                ctx.strokeRect(cx, cy, cw, ch)

                ctx.strokeStyle = 'rgba(34,211,238,0.15)'
                ctx.lineWidth = 1
                for (let i = 1; i < 3; i++) {
                    ctx.beginPath()
                    ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch)
                    ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3)
                    ctx.stroke()
                }

                const hs = 12, hw = 3
                ctx.fillStyle = 'rgba(34,211,238,0.95)'
                ctx.fillRect(cx - hw / 2, cy - hw / 2, hs, hw)
                ctx.fillRect(cx - hw / 2, cy - hw / 2, hw, hs)
                ctx.fillRect(cx + cw - hs + hw / 2, cy - hw / 2, hs, hw)
                ctx.fillRect(cx + cw - hw / 2, cy - hw / 2, hw, hs)
                ctx.fillRect(cx - hw / 2, cy + ch - hw / 2, hs, hw)
                ctx.fillRect(cx - hw / 2, cy + ch - hs + hw / 2, hw, hs)
                ctx.fillRect(cx + cw - hs + hw / 2, cy + ch - hw / 2, hs, hw)
                ctx.fillRect(cx + cw - hw / 2, cy + ch - hs + hw / 2, hw, hs)

                ctx.fillStyle = 'rgba(34,211,238,0.6)'
                const mhs = 8, mhw = 2
                ctx.fillRect(cx + cw / 2 - mhs / 2, cy - mhw / 2, mhs, mhw)
                ctx.fillRect(cx + cw / 2 - mhs / 2, cy + ch - mhw / 2, mhs, mhw)
                ctx.fillRect(cx - mhw / 2, cy + ch / 2 - mhs / 2, mhw, mhs)
                ctx.fillRect(cx + cw - mhw / 2, cy + ch / 2 - mhs / 2, mhw, mhs)
            }
        })
    }, [applyResult, selectionMask, tool, checker, crop])

    // --- Overlay render (marching ants, brush cursor, lasso path) ---
    useEffect(() => {
        if (!overlayRef.current || !size) return
        const ctx = overlayRef.current.getContext('2d')
        ctx.clearRect(0, 0, size.w, size.h)

        // Marching ants for selection
        if (selectionMask && (tool === 'lasso' || tool === 'magLasso' || tool === 'wand')) {
            const w = size.w, h = size.h
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.lineDashOffset = -marchOffset

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (selectionMask[y * w + x] === 0) continue
                    const isBorder =
                        (x === 0 || selectionMask[y * w + x - 1] === 0) ||
                        (x === w - 1 || selectionMask[y * w + x + 1] === 0) ||
                        (y === 0 || selectionMask[(y - 1) * w + x] === 0) ||
                        (y === h - 1 || selectionMask[(y + 1) * w + x] === 0)
                    if (isBorder) {
                        // Draw border segments
                        if (x === 0 || selectionMask[y * w + x - 1] === 0) {
                            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 1); ctx.stroke()
                        }
                        if (x === w - 1 || selectionMask[y * w + x + 1] === 0) {
                            ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + 1); ctx.stroke()
                        }
                        if (y === 0 || selectionMask[(y - 1) * w + x] === 0) {
                            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y); ctx.stroke()
                        }
                        if (y === h - 1 || selectionMask[(y + 1) * w + x] === 0) {
                            ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 1, y + 1); ctx.stroke()
                        }
                    }
                }
            }
            ctx.setLineDash([])
        }

        // Lasso path preview
        if (isDrawingLasso && lassoPoints.length > 1) {
            ctx.strokeStyle = 'rgba(34,211,238,0.8)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y)
            for (let i = 1; i < lassoPoints.length; i++) ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y)
            ctx.stroke()
            ctx.setLineDash([])
        }

        // Magnetic lasso preview
        if (isDrawingMag && magAnchors.length > 0) {
            ctx.strokeStyle = 'rgba(34,211,238,0.8)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(magAnchors[0].x, magAnchors[0].y)
            for (let i = 1; i < magAnchors.length; i++) ctx.lineTo(magAnchors[i].x, magAnchors[i].y)
            if (magPreview) ctx.lineTo(magPreview.x, magPreview.y)
            ctx.stroke()

            // Anchor dots
            ctx.fillStyle = 'rgba(34,211,238,0.9)'
            for (const a of magAnchors) {
                ctx.beginPath()
                ctx.arc(a.x, a.y, 3, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }, [selectionMask, marchOffset, tool, size, isDrawingLasso, lassoPoints, isDrawingMag, magAnchors, magPreview])

    // --- Mouse handlers ---
    const handleMouseDown = useCallback((e) => {
        // Space+drag or middle-click = pan from any tool
        if (spaceDown.current || e.button === 1) {
            e.preventDefault()
            panDrag.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan } }
            return
        }

        if (e.button !== 0) return // only left-click for tools

        const { x, y } = screenToCanvas(e)

        if (tool === 'brush' && workingData) {
            e.preventDefault()
            brushDrag.current = true
            lastBrushPos.current = { x, y }
            const newData = new ImageData(new Uint8ClampedArray(workingData.data), workingData.width, workingData.height)
            applyBrush(newData, x, y, brushSize, brushHardness, brushErasing, edgeAware, sobelRef.current)
            setWorkingData(newData)
        }

        if (tool === 'lasso') {
            e.preventDefault()
            setIsDrawingLasso(true)
            setLassoPoints([{ x, y }])
        }

        if (tool === 'magLasso' && !isDrawingMag) {
            e.preventDefault()
            const snapped = snapToEdge(x, y, sobelRef.current, MAG_SNAP_RADIUS)
            setIsDrawingMag(true)
            setMagAnchors([snapped])
        }

        if (tool === 'crop' && crop) {
            e.preventDefault()
            const { rx, ry } = getRelCoords(e)
            const handle = hitTest(rx, ry)
            if (handle) {
                cropDrag.current = { handle, startRx: rx, startRy: ry, startCrop: { ...crop } }
            }
        }
    }, [tool, workingData, brushSize, brushHardness, brushErasing, edgeAware, screenToCanvas, pan, crop, getRelCoords, hitTest, isDrawingMag])

    const handleMouseMove = useCallback((e) => {
        // Pan drag
        if (panDrag.current) {
            const dx = e.clientX - panDrag.current.startX
            const dy = e.clientY - panDrag.current.startY
            setPan({ x: panDrag.current.startPan.x + dx, y: panDrag.current.startPan.y + dy })
            return
        }

        const { x, y } = screenToCanvas(e)

        // Hover color
        if (srcData && tool === 'sample') {
            const px = Math.floor(x), py = Math.floor(y)
            if (px >= 0 && py >= 0 && px < size.w && py < size.h) {
                const i = (py * size.w + px) * 4
                setHoverColor({ r: srcData.data[i], g: srcData.data[i + 1], b: srcData.data[i + 2] })
            } else {
                setHoverColor(null)
            }
        }

        // Brush drag
        if (tool === 'brush' && brushDrag.current && workingData) {
            const last = lastBrushPos.current
            const dx = x - last.x, dy = y - last.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const step = Math.max(1, brushSize / 6)
            const newData = new ImageData(new Uint8ClampedArray(workingData.data), workingData.width, workingData.height)
            if (dist < step) {
                applyBrush(newData, x, y, brushSize, brushHardness, brushErasing, edgeAware, sobelRef.current)
            } else {
                const steps = Math.ceil(dist / step)
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps
                    applyBrush(newData, last.x + dx * t, last.y + dy * t, brushSize, brushHardness, brushErasing, edgeAware, sobelRef.current)
                }
            }
            lastBrushPos.current = { x, y }
            setWorkingData(newData)
        }

        // Lasso drawing
        if (tool === 'lasso' && isDrawingLasso) {
            setLassoPoints(prev => [...prev, { x, y }])
        }

        // Magnetic lasso preview
        if (tool === 'magLasso' && isDrawingMag) {
            const snapped = snapToEdge(x, y, sobelRef.current, MAG_SNAP_RADIUS)
            setMagPreview(snapped)
        }

        // Crop
        if (tool === 'crop') {
            const { rx, ry } = getRelCoords(e)
            if (cropDrag.current) {
                const d = cropDrag.current
                const sc = d.startCrop
                const bottom = sc.ry + sc.rh, right = sc.rx + sc.rw
                let nr = { ...sc }

                const moveN = () => { nr.ry = clamp(ry, 0, bottom - MIN_CROP); nr.rh = bottom - nr.ry }
                const moveS = () => { nr.rh = clamp(ry - nr.ry, MIN_CROP, 1 - nr.ry) }
                const moveW = () => { nr.rx = clamp(rx, 0, right - MIN_CROP); nr.rw = right - nr.rx }
                const moveE = () => { nr.rw = clamp(rx - nr.rx, MIN_CROP, 1 - nr.rx) }

                switch (d.handle) {
                    case 'n': moveN(); break
                    case 's': moveS(); break
                    case 'w': moveW(); break
                    case 'e': moveE(); break
                    case 'nw': moveN(); moveW(); break
                    case 'ne': moveN(); moveE(); break
                    case 'sw': moveS(); moveW(); break
                    case 'se': moveS(); moveE(); break
                    case 'move': {
                        const ddx = rx - d.startRx, ddy = ry - d.startRy
                        nr.rx = clamp(sc.rx + ddx, 0, 1 - sc.rw)
                        nr.ry = clamp(sc.ry + ddy, 0, 1 - sc.rh)
                        break
                    }
                }
                setCrop(nr)
            } else {
                setHoverHandle(hitTest(rx, ry))
            }
        }
    }, [tool, srcData, size, workingData, brushSize, brushHardness, brushErasing, edgeAware, screenToCanvas, isDrawingLasso, isDrawingMag, getRelCoords, hitTest])

    const handleMouseUp = useCallback(() => {
        // End pan
        if (panDrag.current) {
            panDrag.current = null
            return
        }

        // End brush stroke — push history
        if (tool === 'brush' && brushDrag.current && workingData) {
            brushDrag.current = false
            lastBrushPos.current = null
            pushHistory(workingData)
        }

        // End lasso — create selection
        if (tool === 'lasso' && isDrawingLasso && lassoPoints.length > 2 && size) {
            setIsDrawingLasso(false)
            const mask = rasterizePath(lassoPoints, size.w, size.h)
            setSelectionMask(mask)
            setLassoPoints([])
        }

        // End crop drag
        cropDrag.current = null
    }, [tool, workingData, isDrawingLasso, lassoPoints, size, pushHistory])

    const handleCanvasClick = useCallback((e) => {
        if (spaceDown.current) return
        const { x, y } = screenToCanvas(e)

        if (tool === 'sample' && srcData) {
            const px = Math.floor(x), py = Math.floor(y)
            if (px < 0 || py < 0 || px >= size.w || py >= size.h) return
            const i = (py * size.w + px) * 4
            setSamples(prev => [...prev, {
                rx: px / (size.w - 1), ry: py / (size.h - 1),
                r: srcData.data[i], g: srcData.data[i + 1], b: srcData.data[i + 2]
            }])
        }

        if (tool === 'wand' && srcData) {
            const px = clamp(Math.floor(x), 0, size.w - 1)
            const py = clamp(Math.floor(y), 0, size.h - 1)
            const newMask = floodFillSelect(srcData, px, py, tolerance * 2.5)
            if (e.shiftKey && selectionMask) {
                setSelectionMask(combineMasks(selectionMask, newMask, 'add'))
            } else if (e.altKey && selectionMask) {
                setSelectionMask(combineMasks(selectionMask, newMask, 'subtract'))
            } else {
                setSelectionMask(newMask)
            }
        }

        // Magnetic lasso click
        if (tool === 'magLasso' && isDrawingMag) {
            const snapped = snapToEdge(x, y, sobelRef.current, MAG_SNAP_RADIUS)
            // Close if clicking near start
            if (magAnchors.length > 2) {
                const start = magAnchors[0]
                const dx = snapped.x - start.x, dy = snapped.y - start.y
                if (Math.sqrt(dx * dx + dy * dy) < 10) {
                    // Close the path
                    const allPoints = [...magAnchors]
                    const mask = rasterizePath(allPoints, size.w, size.h)
                    setSelectionMask(mask)
                    setMagAnchors([])
                    setIsDrawingMag(false)
                    setMagPreview(null)
                    return
                }
            }
            setMagAnchors(prev => [...prev, snapped])
        }
    }, [tool, srcData, size, screenToCanvas, tolerance, selectionMask, isDrawingMag, magAnchors])

    // Double-click to close mag lasso
    const handleDoubleClick = useCallback(() => {
        if (tool === 'magLasso' && isDrawingMag && magAnchors.length > 2 && size) {
            const mask = rasterizePath(magAnchors, size.w, size.h)
            setSelectionMask(mask)
            setMagAnchors([])
            setIsDrawingMag(false)
            setMagPreview(null)
        }
    }, [tool, isDrawingMag, magAnchors, size])

    // --- Scroll zoom (always active, cursor-centered) ---
    const handleWheel = useCallback((e) => {
        e.preventDefault()
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        // Mouse position relative to container
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        // Canvas point under cursor before zoom
        const cx = (mx - pan.x) / zoom
        const cy = (my - pan.y) / zoom

        const factor = e.deltaY > 0 ? 0.9 : 1.1
        const newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM)

        // Adjust pan so the same canvas point stays under cursor
        setPan({
            x: mx - cx * newZoom,
            y: my - cy * newZoom,
        })
        setZoom(newZoom)
    }, [zoom, pan])

    // --- Selection actions ---
    const deleteSelection = useCallback(() => {
        if (!selectionMask || !workingData) return
        const mask = featherRadius > 0 ? featherMask(selectionMask, size.w, size.h, featherRadius) : selectionMask
        const newData = new ImageData(new Uint8ClampedArray(workingData.data), workingData.width, workingData.height)
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] > 0) {
                newData.data[i * 4 + 3] = Math.round(newData.data[i * 4 + 3] * (1 - mask[i] / 255))
            }
        }
        setWorkingData(newData)
        pushHistory(newData)
        setSelectionMask(null)
    }, [selectionMask, workingData, featherRadius, size, pushHistory])

    const keepSelection = useCallback(() => {
        if (!selectionMask || !workingData) return
        const inv = invertMask(selectionMask)
        const mask = featherRadius > 0 ? featherMask(inv, size.w, size.h, featherRadius) : inv
        const newData = new ImageData(new Uint8ClampedArray(workingData.data), workingData.width, workingData.height)
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] > 0) {
                newData.data[i * 4 + 3] = Math.round(newData.data[i * 4 + 3] * (1 - mask[i] / 255))
            }
        }
        setWorkingData(newData)
        pushHistory(newData)
        setSelectionMask(null)
    }, [selectionMask, workingData, featherRadius, size, pushHistory])

    const invertSelection = useCallback(() => {
        if (!selectionMask) return
        setSelectionMask(invertMask(selectionMask))
    }, [selectionMask])

    const clearSelection = useCallback(() => {
        setSelectionMask(null)
        setLassoPoints([])
        setMagAnchors([])
        setIsDrawingLasso(false)
        setIsDrawingMag(false)
        setMagPreview(null)
    }, [])

    // --- Keyboard shortcuts ---
    useEffect(() => {
        const h = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

            // Space for panning
            if (e.code === 'Space' && !e.repeat) { e.preventDefault(); spaceDown.current = true; return }

            // Tool shortcuts
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 's': if (image) { e.preventDefault(); switchTool('sample') } return
                    case 'b': if (image) { e.preventDefault(); switchTool('brush') } return
                    case 'l': if (image) { e.preventDefault(); switchTool('lasso') } return
                    case 'm': if (image) { e.preventDefault(); switchTool('magLasso') } return
                    case 'w': if (image) { e.preventDefault(); switchTool('wand') } return
                    case 'c': if (image) { e.preventDefault(); switchTool('crop') } return
                    case 'x': if (image) { e.preventDefault(); setBrushErasing(v => !v) } return
                    case '[': if (image) { e.preventDefault(); setBrushSize(s => Math.max(1, s - 5)) } return
                    case ']': if (image) { e.preventDefault(); setBrushSize(s => Math.min(200, s + 5)) } return
                    case 'escape': clearSelection(); return
                    case 'delete': if (selectionMask) { e.preventDefault(); deleteSelection() } return
                }
            }

            // Ctrl shortcuts
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
                if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return }
                if (e.key === 'Z') { e.preventDefault(); redo(); return }
                if (e.key === '0') { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); return }
                if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP)); return }
                if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP)); return }
                if (e.key === 'I' && e.shiftKey) { e.preventDefault(); invertSelection(); return }
            }
        }
        const up = (e) => {
            if (e.code === 'Space') spaceDown.current = false
        }
        document.addEventListener('keydown', h)
        document.addEventListener('keyup', up)
        return () => { document.removeEventListener('keydown', h); document.removeEventListener('keyup', up) }
    }, [image, switchTool, clearSelection, selectionMask, deleteSelection, undo, redo, invertSelection])

    // --- Paste ---
    useEffect(() => {
        const h = (e) => {
            const f = e.clipboardData?.files?.[0]
            if (f) { e.preventDefault(); load(f) }
        }
        document.addEventListener('paste', h)
        return () => document.removeEventListener('paste', h)
    }, [load])

    // --- Resize helpers ---
    const cropAspect = crop && crop.rw > MIN_CROP && crop.rh > MIN_CROP
        ? (crop.rw * (image?.width || 1)) / (crop.rh * (image?.height || 1))
        : null
    const aspectRatio = cropAspect || (image ? image.width / image.height : 1)

    const changeWidth = useCallback((w) => {
        const v = Math.max(1, Math.round(w))
        setOutputW(v)
        if (lockRatio) setOutputH(Math.max(1, Math.round(v / aspectRatio)))
    }, [lockRatio, aspectRatio])

    const changeHeight = useCallback((h) => {
        const v = Math.max(1, Math.round(h))
        setOutputH(v)
        if (lockRatio) setOutputW(Math.max(1, Math.round(v * aspectRatio)))
    }, [lockRatio, aspectRatio])

    // --- Download ---
    const download = useCallback(() => {
        if (!image || !workingData) return
        // Re-apply at full resolution
        const proc = document.createElement('canvas')
        proc.width = image.width; proc.height = image.height
        const pCtx = proc.getContext('2d')
        pCtx.drawImage(image, 0, 0)

        // Apply flood fill samples at full res
        if (samples.length) {
            const full = pCtx.getImageData(0, 0, image.width, image.height)
            const result = floodFillRemove(full, samples, tolerance * 2.5)
            pCtx.putImageData(result, 0, 0)
        }

        // Apply brush/selection edits: scale the working alpha to full res
        if (workingData) {
            const fullData = pCtx.getImageData(0, 0, image.width, image.height)
            const fd = fullData.data
            const wd = workingData.data
            const sw = workingData.width, sh = workingData.height

            for (let fy = 0; fy < image.height; fy++) {
                for (let fx = 0; fx < image.width; fx++) {
                    const wx = Math.floor(fx * sw / image.width)
                    const wy = Math.floor(fy * sh / image.height)
                    const wi = (wy * sw + wx) * 4
                    const fi = (fy * image.width + fx) * 4
                    const workingAlpha = wd[wi + 3]
                    const srcAlpha = 255 // original is fully opaque from drawImage
                    if (workingAlpha < srcAlpha) {
                        fd[fi + 3] = Math.min(fd[fi + 3], Math.round(fd[fi + 3] * (workingAlpha / 255)))
                    }
                }
            }
            pCtx.putImageData(fullData, 0, 0)
        }

        let sx = 0, sy = 0, sw = image.width, sh = image.height
        if (crop && (crop.rw < 1 || crop.rh < 1 || crop.rx > 0 || crop.ry > 0)) {
            sx = Math.round(crop.rx * image.width)
            sy = Math.round(crop.ry * image.height)
            sw = Math.round(crop.rw * image.width)
            sh = Math.round(crop.rh * image.height)
        }
        const finalW = outputW || sw, finalH = outputH || sh
        const out = document.createElement('canvas')
        out.width = finalW; out.height = finalH
        out.getContext('2d').drawImage(proc, sx, sy, sw, sh, 0, 0, finalW, finalH)
        out.toBlob(blob => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'bg-removed.png'
            a.click()
            URL.revokeObjectURL(a.href)
        }, 'image/png')
    }, [image, workingData, samples, tolerance, crop, outputW, outputH])

    // --- Cursor ---
    const getCursor = () => {
        if (spaceDown.current || panDrag.current) return 'grab'
        if (tool === 'sample' || tool === 'wand') return 'crosshair'
        if (tool === 'brush') return 'none' // we draw custom cursor on overlay
        if (tool === 'lasso' || tool === 'magLasso') return 'crosshair'
        if (tool === 'crop') return CURSOR_MAP[hoverHandle] || 'default'
        return 'default'
    }

    // --- Brush cursor overlay (drawn via mouse move on overlay) ---
    const [mousePos, setMousePos] = useState(null)
    const handleOverlayMouseMove = useCallback((e) => {
        if (tool === 'brush') {
            const { x, y } = screenToCanvas(e)
            setMousePos({ x, y })
        } else {
            setMousePos(null)
        }
    }, [tool, screenToCanvas])

    // Draw brush cursor
    useEffect(() => {
        if (!overlayRef.current || !mousePos || tool !== 'brush') return
        const ctx = overlayRef.current.getContext('2d')
        // We need to re-draw the overlay since we're layering brush cursor on it
        // The marching ants effect handles the rest, so just add brush cursor
        ctx.strokeStyle = 'rgba(34,211,238,0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, Math.PI * 2)
        ctx.stroke()

        // Inner dot
        ctx.fillStyle = brushErasing ? 'rgba(255,100,100,0.5)' : 'rgba(100,255,100,0.5)'
        ctx.beginPath()
        ctx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2)
        ctx.fill()
    }, [mousePos, tool, brushSize, brushErasing])

    const naturalW = crop && crop.rw < 1 - MIN_CROP ? Math.round(crop.rw * (image?.width || 0)) : image?.width
    const naturalH = crop && crop.rh < 1 - MIN_CROP ? Math.round(crop.rh * (image?.height || 0)) : image?.height

    const hasSelection = tool === 'lasso' || tool === 'magLasso' || tool === 'wand'

    const sliderClasses = `flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(34,211,238,0.4)]
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:bg-cyan-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer`

    const zoomPercent = Math.round(zoom * 100)

    return (
        <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
            <PageTitle title="Background Remover" />

            <div className="mb-5">
                <h1 className="text-2xl font-bold text-white tracking-tight">Background Remover</h1>
                <p className="text-sm text-gray-400 mt-1">
                    {!image
                        ? 'Upload an image to get started. You can also paste from clipboard.'
                        : tool === 'crop'
                            ? 'Drag the edges or corners to crop.'
                            : tool === 'sample'
                                ? samples.length === 0
                                    ? 'Click on the color you want to remove.'
                                    : 'Adjust the slider or click more colors to refine.'
                                : tool === 'brush'
                                    ? `${brushErasing ? 'Erasing' : 'Restoring'} — paint on the image. [/] resize, X swap.`
                                    : tool === 'lasso'
                                        ? 'Draw around the area to select. Release to close.'
                                        : tool === 'magLasso'
                                            ? 'Click to place anchor points along edges. Double-click to close.'
                                            : tool === 'wand'
                                                ? 'Click to select similar colors. Shift+click to add, Alt+click to subtract.'
                                                : ''}
                </p>
            </div>

            {!image ? (
                <div
                    onDragOver={(e) => { e.preventDefault(); setFileDrag(true) }}
                    onDragLeave={() => setFileDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setFileDrag(false); load(e.dataTransfer.files[0]) }}
                    onClick={() => fileRef.current?.click()}
                    className={`
                        relative border-2 border-dashed rounded-xl cursor-pointer select-none
                        flex flex-col items-center justify-center gap-3 h-72 sm:h-80
                        transition-all duration-200
                        ${fileDrag
                            ? 'border-cyan-400/70 bg-cyan-400/[0.04]'
                            : 'border-white/[0.08] hover:border-white/20 bg-white/[0.015] hover:bg-white/[0.025]'}
                    `}
                >
                    <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <div className="text-center">
                        <p className="text-gray-300 text-sm font-medium">Drop an image here or click to browse</p>
                        <p className="text-gray-500 text-xs mt-1">PNG, JPG, WebP &middot; or Ctrl+V to paste</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-md overflow-hidden border border-white/[0.08]">
                            {TOOLS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => switchTool(t)}
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors relative group ${tool === t ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.02] text-gray-500 hover:text-gray-300'}`}
                                    title={`${TOOL_LABELS[t]} (${TOOL_KEYS[t]})`}
                                >
                                    {TOOL_LABELS[t]}
                                    <span className="ml-1 text-[10px] opacity-40">{TOOL_KEYS[t]}</span>
                                </button>
                            ))}
                        </div>

                        {/* Undo/Redo */}
                        <div className="flex items-center gap-1 ml-2">
                            <button
                                onClick={undo}
                                disabled={historyIdx <= 0}
                                className="p-1.5 rounded text-gray-500 hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="Undo (Ctrl+Z)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIdx >= history.length - 1}
                                className="p-1.5 rounded text-gray-500 hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                                </svg>
                            </button>
                        </div>

                        {/* Zoom indicator */}
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))} className="text-gray-500 hover:text-gray-300 text-xs px-1">-</button>
                            <span className="text-[11px] text-gray-400 font-mono tabular-nums w-10 text-center">{zoomPercent}%</span>
                            <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))} className="text-gray-500 hover:text-gray-300 text-xs px-1">+</button>
                            {zoom !== 1 && (
                                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                                    fit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Context options bar */}
                    <div className="flex items-center gap-4 min-h-[28px] flex-wrap">
                        {/* Sample: tolerance */}
                        {(tool === 'sample' || tool === 'wand') && (
                            <>
                                <label className="text-[11px] text-gray-500 uppercase tracking-widest shrink-0">Tolerance</label>
                                <input type="range" min={1} max={100} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className={sliderClasses} style={{ maxWidth: 200 }} />
                                <span className="text-sm text-gray-400 font-mono tabular-nums w-7 text-right">{tolerance}</span>
                            </>
                        )}

                        {/* Brush options */}
                        {tool === 'brush' && (
                            <>
                                <label className="text-[11px] text-gray-500 uppercase tracking-widest shrink-0">Size</label>
                                <input type="range" min={1} max={200} value={brushSize} onChange={(e) => setBrushSize(+e.target.value)} className={sliderClasses} style={{ maxWidth: 140 }} />
                                <span className="text-sm text-gray-400 font-mono tabular-nums w-7 text-right">{brushSize}</span>

                                <label className="text-[11px] text-gray-500 uppercase tracking-widest shrink-0 ml-2">Hard</label>
                                <input type="range" min={0} max={100} value={brushHardness} onChange={(e) => setBrushHardness(+e.target.value)} className={sliderClasses} style={{ maxWidth: 100 }} />
                                <span className="text-sm text-gray-400 font-mono tabular-nums w-7 text-right">{brushHardness}</span>

                                <button
                                    onClick={() => setBrushErasing(v => !v)}
                                    className={`px-2.5 py-1 text-[11px] rounded border transition-colors ml-2 ${brushErasing ? 'bg-red-500/15 text-red-300 border-red-400/20' : 'bg-green-500/15 text-green-300 border-green-400/20'}`}
                                >
                                    {brushErasing ? 'Erase' : 'Restore'}
                                </button>

                                <button
                                    onClick={() => setEdgeAware(v => !v)}
                                    className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${edgeAware ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20' : 'bg-white/[0.04] text-gray-500 border-white/[0.06]'}`}
                                    title="Edge-aware mode: brush respects detected edges"
                                >
                                    Edge Aware
                                </button>
                            </>
                        )}

                        {/* Selection tool options */}
                        {hasSelection && (
                            <>
                                <label className="text-[11px] text-gray-500 uppercase tracking-widest shrink-0">Feather</label>
                                <input type="range" min={0} max={20} value={featherRadius} onChange={(e) => setFeatherRadius(+e.target.value)} className={sliderClasses} style={{ maxWidth: 120 }} />
                                <span className="text-sm text-gray-400 font-mono tabular-nums w-7 text-right">{featherRadius}</span>

                                {selectionMask && (
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <button onClick={deleteSelection} className="px-2.5 py-1 text-[11px] rounded bg-red-500/15 text-red-300 border border-red-400/20 hover:bg-red-500/25 transition-colors">
                                            Delete
                                        </button>
                                        <button onClick={keepSelection} className="px-2.5 py-1 text-[11px] rounded bg-green-500/15 text-green-300 border border-green-400/20 hover:bg-green-500/25 transition-colors">
                                            Keep
                                        </button>
                                        <button onClick={invertSelection} className="px-2.5 py-1 text-[11px] rounded bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:text-gray-200 transition-colors">
                                            Invert
                                        </button>
                                        <button onClick={clearSelection} className="px-2.5 py-1 text-[11px] rounded bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:text-gray-200 transition-colors">
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Crop: clear */}
                        {tool === 'crop' && crop && (crop.rx > 0 || crop.ry > 0 || crop.rw < 1 || crop.rh < 1) && (
                            <button onClick={() => setCrop(null)} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                                clear crop
                            </button>
                        )}
                    </div>

                    {/* Canvas viewport */}
                    <div
                        ref={containerRef}
                        className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-[#0c0c18] select-none"
                        style={{ width: size?.w, height: size?.h }}
                        onDragOver={(e) => { e.preventDefault(); setFileDrag(true) }}
                        onDragLeave={() => setFileDrag(false)}
                        onDrop={(e) => { e.preventDefault(); setFileDrag(false); load(e.dataTransfer.files[0]) }}
                        onWheel={handleWheel}
                    >
                        <div
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                transformOrigin: '0 0',
                                position: 'relative',
                                width: size?.w,
                                height: size?.h,
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                className="block"
                                style={{ width: size?.w, height: size?.h }}
                            />
                            <canvas
                                ref={overlayRef}
                                className="absolute inset-0 block pointer-events-none"
                                style={{ width: size?.w, height: size?.h }}
                            />
                        </div>
                        {/* Interaction layer — captures all mouse events on top */}
                        <div
                            className="absolute inset-0"
                            style={{ cursor: getCursor() }}
                            onClick={handleCanvasClick}
                            onDoubleClick={handleDoubleClick}
                            onMouseDown={handleMouseDown}
                            onMouseMove={(e) => { handleMouseMove(e); handleOverlayMouseMove(e) }}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={() => { setHoverColor(null); setHoverHandle(null); setMousePos(null); handleMouseUp() }}
                            onContextMenu={(e) => e.preventDefault()}
                            onAuxClick={(e) => e.button === 1 && e.preventDefault()}
                        />

                        {/* Hover color indicator */}
                        {hoverColor && tool === 'sample' && (
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-md px-2.5 py-1.5 pointer-events-none z-10">
                                <div className="w-4 h-4 rounded-sm border border-white/20 shrink-0" style={{ background: rgb(hoverColor) }} />
                                <span className="text-[11px] text-gray-300 font-mono tabular-nums">
                                    {hoverColor.r}, {hoverColor.g}, {hoverColor.b}
                                </span>
                            </div>
                        )}

                        {/* Zoom indicator */}
                        {zoom !== 1 && (
                            <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 pointer-events-none z-10">
                                <span className="text-[11px] text-gray-300 font-mono tabular-nums">{zoomPercent}%</span>
                            </div>
                        )}

                        {fileDrag && (
                            <div className="absolute inset-0 bg-cyan-400/10 border-2 border-cyan-400/40 rounded-lg flex items-center justify-center z-20">
                                <span className="text-cyan-300 text-sm font-medium">Drop to replace</span>
                            </div>
                        )}
                    </div>

                    {/* Sampled colors */}
                    {samples.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-gray-500 uppercase tracking-widest mr-1">Sampled</span>
                            {samples.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSamples(prev => prev.filter((_, idx) => idx !== i))}
                                    className="group relative w-7 h-7 rounded-md border border-white/10 hover:border-red-400/50 transition-colors shrink-0"
                                    style={{ background: rgb(s) }}
                                    title={`${s.r}, ${s.g}, ${s.b} — click to remove`}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-xs font-bold transition-opacity">&times;</span>
                                </button>
                            ))}
                            <button onClick={() => setSamples([])} className="text-[11px] text-gray-500 hover:text-gray-300 ml-1 transition-colors">
                                clear all
                            </button>
                        </div>
                    )}

                    {/* Size */}
                    <div className="flex items-center gap-4">
                        <label className="text-[11px] text-gray-500 uppercase tracking-widest w-[72px] shrink-0">Size</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number" min={1} value={outputW || ''}
                                onChange={(e) => changeWidth(+e.target.value || 1)}
                                className="w-20 px-2 py-1 text-sm bg-white/[0.04] border border-white/[0.08] rounded-md text-gray-200 font-mono tabular-nums focus:outline-none focus:border-cyan-400/40"
                            />
                            <span className="text-gray-500 text-xs">&times;</span>
                            <input
                                type="number" min={1} value={outputH || ''}
                                onChange={(e) => changeHeight(+e.target.value || 1)}
                                className="w-20 px-2 py-1 text-sm bg-white/[0.04] border border-white/[0.08] rounded-md text-gray-200 font-mono tabular-nums focus:outline-none focus:border-cyan-400/40"
                            />
                            <span className="text-[11px] text-gray-500">px</span>
                            <button
                                onClick={() => setLockRatio(v => !v)}
                                title={lockRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                                className={`ml-1 p-1 rounded transition-colors ${lockRatio ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    {lockRatio ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    )}
                                </svg>
                            </button>
                            {(outputW !== naturalW || outputH !== naturalH) && (
                                <button
                                    onClick={() => { setOutputW(naturalW); setOutputH(naturalH) }}
                                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            onClick={() => { setImage(null); setSize(null); setSrcData(null); setWorkingData(null); setSamples([]); setCrop(null); setHoverColor(null); setSelectionMask(null); setHistory([]); setHistoryIdx(-1) }}
                            className="px-4 py-2 text-sm rounded-lg bg-white/[0.04] text-gray-400 hover:text-gray-200 hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                        >
                            New Image
                        </button>
                        <button
                            onClick={download}
                            className="px-5 py-2 text-sm rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-400/20 hover:border-cyan-400/40 transition-colors ml-auto font-medium"
                        >
                            Download PNG
                        </button>
                    </div>

                    {/* Keyboard shortcuts hint */}
                    <div className="text-[10px] text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                        <span>Scroll: Zoom</span>
                        <span>Middle-click drag / Space+drag: Pan</span>
                        <span>Ctrl+0: Reset view</span>
                        <span>Ctrl+Z/Shift+Z: Undo/Redo</span>
                        <span>X: Swap erase/restore</span>
                        <span>[ ]: Brush size</span>
                        <span>Del: Delete selection</span>
                        <span>Ctrl+Shift+I: Invert</span>
                        <span>Esc: Clear selection</span>
                    </div>
                </div>
            )}

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { load(e.target.files?.[0]); e.target.value = '' }}
            />
        </div>
    )
}
