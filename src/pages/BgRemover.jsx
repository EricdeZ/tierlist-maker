import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import PageTitle from '../components/PageTitle'

const MAX_DISPLAY_W = 960
const VH_RATIO = 0.58
const EDGE_PX = 10 // hit zone for edge dragging
const MIN_CROP = 0.03

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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const CURSOR_MAP = {
    nw: 'nwse-resize', se: 'nwse-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize',
    w: 'ew-resize', e: 'ew-resize',
    move: 'move',
}

export default function BgRemover() {
    const [image, setImage] = useState(null)
    const [size, setSize] = useState(null)
    const [srcData, setSrcData] = useState(null)
    const [samples, setSamples] = useState([])
    const [tolerance, setTolerance] = useState(42)
    const [hoverColor, setHoverColor] = useState(null)
    const [fileDrag, setFileDrag] = useState(false)
    const [outputW, setOutputW] = useState(null)
    const [outputH, setOutputH] = useState(null)
    const [lockRatio, setLockRatio] = useState(true)
    const [mode, setMode] = useState('sample')
    const [crop, setCrop] = useState(null) // { rx, ry, rw, rh } relative 0-1
    const [hoverHandle, setHoverHandle] = useState(null)

    const canvasRef = useRef(null)
    const tmpRef = useRef(null)
    const fileRef = useRef(null)
    const rafRef = useRef(null)
    const cropDrag = useRef(null)

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

    // --- Helpers ---
    const getRelCoords = useCallback((e) => {
        const c = canvasRef.current, r = c.getBoundingClientRect()
        return {
            rx: clamp((e.clientX - r.left) / r.width, 0, 1),
            ry: clamp((e.clientY - r.top) / r.height, 0, 1),
        }
    }, [])

    const hitTest = useCallback((rx, ry) => {
        if (!crop || !canvasRef.current) return null
        const rect = canvasRef.current.getBoundingClientRect()
        const t = EDGE_PX / rect.width  // threshold in relative coords
        const tY = EDGE_PX / rect.height

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
    }, [crop])

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
            setSize({ w: Math.round(w * s), h: Math.round(h * s) })
            setOutputW(img.width)
            setOutputH(img.height)
            setSamples([])
            setCrop(null)
            setHoverColor(null)
            setMode('sample')
            URL.revokeObjectURL(url)
        }
        img.src = url
    }, [])

    // Auto-init crop when entering crop mode
    const switchMode = useCallback((m) => {
        setMode(m)
        if (m === 'crop' && !crop) setCrop({ rx: 0, ry: 0, rw: 1, rh: 1 })
    }, [crop])

    // Init source data
    useEffect(() => {
        if (!image || !size) return
        const c = canvasRef.current
        c.width = size.w; c.height = size.h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(image, 0, 0, size.w, size.h)
        setSrcData(ctx.getImageData(0, 0, size.w, size.h))
    }, [image, size])

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

    // Render
    useEffect(() => {
        if (!srcData) return
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
            const c = canvasRef.current
            const ctx = c.getContext('2d', { willReadFrequently: true })

            if (!samples.length) {
                ctx.putImageData(srcData, 0, 0)
            } else {
                const result = floodFillRemove(srcData, samples, tolerance * 2.5)
                ctx.fillStyle = ctx.createPattern(checker, 'repeat')
                ctx.fillRect(0, 0, c.width, c.height)
                if (!tmpRef.current) tmpRef.current = document.createElement('canvas')
                const t = tmpRef.current
                t.width = c.width; t.height = c.height
                t.getContext('2d').putImageData(result, 0, 0)
                ctx.drawImage(t, 0, 0)
            }

            // Crop overlay
            if (crop && (crop.rw < 1 || crop.rh < 1 || crop.rx > 0 || crop.ry > 0)) {
                const cx = Math.round(crop.rx * c.width)
                const cy = Math.round(crop.ry * c.height)
                const cw = Math.round(crop.rw * c.width)
                const ch = Math.round(crop.rh * c.height)

                // Dim outside
                ctx.fillStyle = 'rgba(0,0,0,0.55)'
                ctx.fillRect(0, 0, c.width, cy)
                ctx.fillRect(0, cy + ch, c.width, c.height - cy - ch)
                ctx.fillRect(0, cy, cx, ch)
                ctx.fillRect(cx + cw, cy, c.width - cx - cw, ch)

                // Border
                ctx.strokeStyle = 'rgba(34,211,238,0.8)'
                ctx.lineWidth = 1.5
                ctx.setLineDash([])
                ctx.strokeRect(cx, cy, cw, ch)

                // Rule of thirds lines
                ctx.strokeStyle = 'rgba(34,211,238,0.15)'
                ctx.lineWidth = 1
                for (let i = 1; i < 3; i++) {
                    ctx.beginPath()
                    ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch)
                    ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3)
                    ctx.stroke()
                }

                // Corner handles
                const hs = 12, hw = 3
                ctx.fillStyle = 'rgba(34,211,238,0.95)'
                // NW
                ctx.fillRect(cx - hw / 2, cy - hw / 2, hs, hw)
                ctx.fillRect(cx - hw / 2, cy - hw / 2, hw, hs)
                // NE
                ctx.fillRect(cx + cw - hs + hw / 2, cy - hw / 2, hs, hw)
                ctx.fillRect(cx + cw - hw / 2, cy - hw / 2, hw, hs)
                // SW
                ctx.fillRect(cx - hw / 2, cy + ch - hw / 2, hs, hw)
                ctx.fillRect(cx - hw / 2, cy + ch - hs + hw / 2, hw, hs)
                // SE
                ctx.fillRect(cx + cw - hs + hw / 2, cy + ch - hw / 2, hs, hw)
                ctx.fillRect(cx + cw - hw / 2, cy + ch - hs + hw / 2, hw, hs)

                // Edge midpoint handles
                ctx.fillStyle = 'rgba(34,211,238,0.6)'
                const mhs = 8, mhw = 2
                ctx.fillRect(cx + cw / 2 - mhs / 2, cy - mhw / 2, mhs, mhw) // N
                ctx.fillRect(cx + cw / 2 - mhs / 2, cy + ch - mhw / 2, mhs, mhw) // S
                ctx.fillRect(cx - mhw / 2, cy + ch / 2 - mhs / 2, mhw, mhs) // W
                ctx.fillRect(cx + cw - mhw / 2, cy + ch / 2 - mhs / 2, mhw, mhs) // E
            }
        })
    }, [srcData, samples, tolerance, checker, crop])

    // --- Mouse handlers ---
    const handleMouseDown = useCallback((e) => {
        if (mode === 'crop' && crop) {
            e.preventDefault()
            const { rx, ry } = getRelCoords(e)
            const handle = hitTest(rx, ry)
            if (handle) {
                cropDrag.current = { handle, startRx: rx, startRy: ry, startCrop: { ...crop } }
            }
        }
    }, [mode, crop, getRelCoords, hitTest])

    const handleMouseMove = useCallback((e) => {
        // Hover color
        if (srcData && mode === 'sample') {
            const c = canvasRef.current, r = c.getBoundingClientRect()
            const x = Math.floor((e.clientX - r.left) * (c.width / r.width))
            const y = Math.floor((e.clientY - r.top) * (c.height / r.height))
            if (x >= 0 && y >= 0 && x < c.width && y < c.height) {
                const i = (y * c.width + x) * 4
                setHoverColor({ r: srcData.data[i], g: srcData.data[i + 1], b: srcData.data[i + 2] })
            } else {
                setHoverColor(null)
            }
        }

        if (mode !== 'crop') return
        const { rx, ry } = getRelCoords(e)

        // Active drag
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
                    const dx = rx - d.startRx, dy = ry - d.startRy
                    nr.rx = clamp(sc.rx + dx, 0, 1 - sc.rw)
                    nr.ry = clamp(sc.ry + dy, 0, 1 - sc.rh)
                    break
                }
            }
            setCrop(nr)
        } else {
            // Hover cursor
            setHoverHandle(hitTest(rx, ry))
        }
    }, [mode, srcData, getRelCoords, hitTest])

    const handleMouseUp = useCallback(() => {
        cropDrag.current = null
    }, [])

    const handleCanvasClick = useCallback((e) => {
        if (mode !== 'sample' || !srcData) return
        const c = canvasRef.current, r = c.getBoundingClientRect()
        const x = Math.floor((e.clientX - r.left) * (c.width / r.width))
        const y = Math.floor((e.clientY - r.top) * (c.height / r.height))
        const i = (y * c.width + x) * 4
        setSamples(prev => [...prev, {
            rx: x / (c.width - 1), ry: y / (c.height - 1),
            r: srcData.data[i], g: srcData.data[i + 1], b: srcData.data[i + 2]
        }])
    }, [mode, srcData])

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
        if (!image) return
        const proc = document.createElement('canvas')
        proc.width = image.width; proc.height = image.height
        const pCtx = proc.getContext('2d')
        pCtx.drawImage(image, 0, 0)
        if (samples.length) {
            const full = pCtx.getImageData(0, 0, image.width, image.height)
            const result = floodFillRemove(full, samples, tolerance * 2.5)
            pCtx.putImageData(result, 0, 0)
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
    }, [image, samples, tolerance, crop, outputW, outputH])

    // Paste
    useEffect(() => {
        const h = (e) => {
            const f = e.clipboardData?.files?.[0]
            if (f) { e.preventDefault(); load(f) }
        }
        document.addEventListener('paste', h)
        return () => document.removeEventListener('paste', h)
    }, [load])

    const rgb = (c) => `rgb(${c.r},${c.g},${c.b})`

    const cursor = mode === 'crop' ? (CURSOR_MAP[hoverHandle] || 'default') : 'crosshair'

    const sliderClasses = `flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(34,211,238,0.4)]
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:bg-cyan-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer`

    const naturalW = crop && crop.rw < 1 - MIN_CROP ? Math.round(crop.rw * (image?.width || 0)) : image?.width
    const naturalH = crop && crop.rh < 1 - MIN_CROP ? Math.round(crop.rh * (image?.height || 0)) : image?.height

    return (
        <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
            <PageTitle title="Background Remover" />

            <div className="mb-5">
                <h1 className="text-2xl font-bold text-white tracking-tight">Background Remover</h1>
                <p className="text-sm text-gray-400 mt-1">
                    {!image
                        ? 'Upload an image to get started. You can also paste from clipboard.'
                        : mode === 'crop'
                            ? 'Drag the edges or corners to crop.'
                            : samples.length === 0
                                ? 'Click on the color you want to remove.'
                                : 'Adjust the slider or click more colors to refine.'}
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
                    {/* Mode toggle */}
                    <div className="flex items-center gap-3">
                        <div className="flex rounded-md overflow-hidden border border-white/[0.08]">
                            <button
                                onClick={() => switchMode('sample')}
                                className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${mode === 'sample' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.02] text-gray-500 hover:text-gray-300'}`}
                            >
                                Sample
                            </button>
                            <button
                                onClick={() => switchMode('crop')}
                                className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${mode === 'crop' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.02] text-gray-500 hover:text-gray-300'}`}
                            >
                                Crop
                            </button>
                        </div>
                        {crop && (crop.rx > 0 || crop.ry > 0 || crop.rw < 1 || crop.rh < 1) && (
                            <button onClick={() => setCrop(null)} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                                clear crop
                            </button>
                        )}
                    </div>

                    {/* Canvas */}
                    <div
                        className="relative inline-block rounded-lg overflow-hidden border border-white/[0.06] bg-[#0c0c18] select-none"
                        onDragOver={(e) => { e.preventDefault(); setFileDrag(true) }}
                        onDragLeave={() => setFileDrag(false)}
                        onDrop={(e) => { e.preventDefault(); setFileDrag(false); load(e.dataTransfer.files[0]) }}
                    >
                        <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={() => { setHoverColor(null); setHoverHandle(null); handleMouseUp() }}
                            className="block max-w-full h-auto"
                            style={{ cursor }}
                        />
                        {hoverColor && mode === 'sample' && (
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-md px-2.5 py-1.5 pointer-events-none">
                                <div className="w-4 h-4 rounded-sm border border-white/20 shrink-0" style={{ background: rgb(hoverColor) }} />
                                <span className="text-[11px] text-gray-300 font-mono tabular-nums">
                                    {hoverColor.r}, {hoverColor.g}, {hoverColor.b}
                                </span>
                            </div>
                        )}
                        {fileDrag && (
                            <div className="absolute inset-0 bg-cyan-400/10 border-2 border-cyan-400/40 rounded-lg flex items-center justify-center">
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

                    {/* Tolerance */}
                    <div className="flex items-center gap-4">
                        <label className="text-[11px] text-gray-500 uppercase tracking-widest w-[72px] shrink-0">Tolerance</label>
                        <input type="range" min={1} max={100} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className={sliderClasses} />
                        <span className="text-sm text-gray-400 font-mono tabular-nums w-7 text-right">{tolerance}</span>
                    </div>

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
                            onClick={() => { setImage(null); setSize(null); setSrcData(null); setSamples([]); setCrop(null); setHoverColor(null) }}
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
