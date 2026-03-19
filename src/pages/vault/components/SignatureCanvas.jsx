import { useRef, useState, useEffect, useCallback } from 'react'

const CANVAS_W = 315
const CANVAS_H = 440

const PEN_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Silver', value: '#a0a0c0' },
  { name: 'Gold', value: '#ffd700' },
  { name: 'Red', value: '#ff4444' },
  { name: 'Orange', value: '#ff8c00' },
  { name: 'Yellow', value: '#ffee44' },
  { name: 'Lime', value: '#66ff66' },
  { name: 'Cyan', value: '#00e5ff' },
  { name: 'Blue', value: '#4488ff' },
  { name: 'Purple', value: '#aa44ff' },
  { name: 'Pink', value: '#ff66cc' },
  { name: 'Black', value: '#222222' },
]

export default function SignatureCanvas({ onConfirm, onCancel, onRedo, cardBackground, onStrokeChange }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [paths, setPaths] = useState([])
  const [currentPath, setCurrentPath] = useState([])
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value)
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Notify parent of signature data URL for live preview
  const emitPreview = useCallback((updatedPaths) => {
    if (!onStrokeChange) return
    const canvas = canvasRef.current
    if (!canvas) return
    if (updatedPaths.length === 0) { onStrokeChange(null); return }
    onStrokeChange(canvas.toDataURL('image/png'))
  }, [onStrokeChange])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const drawPath = (points, color) => {
      if (points.length < 2) return
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 3
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const mid = { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 }
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, mid.x, mid.y)
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
      ctx.stroke()
    }

    for (const p of paths) drawPath(p.points, p.color)
    if (currentPath.length > 0) drawPath(currentPath, penColor)
  }, [paths, currentPath, penColor])

  useEffect(() => { redraw() }, [redraw])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  // Refs for touch handlers (need current values without re-attaching listeners)
  const drawingRef = useRef(false)
  const penColorRef = useRef(penColor)
  const pathsRef = useRef(paths)
  penColorRef.current = penColor
  pathsRef.current = paths

  const startDraw = (e) => {
    e.preventDefault()
    drawingRef.current = true
    setDrawing(true)
    setCurrentPath([getPos(e)])
  }

  const moveDraw = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    setCurrentPath(prev => [...prev, getPos(e)])
  }

  const endDraw = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    setDrawing(false)
    if (currentPath.length > 1) {
      const newPaths = [...paths, { points: currentPath, color: penColor }]
      setPaths(newPaths)
      setCurrentPath([])
      // Emit after next redraw
      requestAnimationFrame(() => emitPreview(newPaths))
    } else {
      setCurrentPath([])
    }
  }

  // Attach touch listeners with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const opts = { passive: false }
    canvas.addEventListener('touchstart', startDraw, opts)
    canvas.addEventListener('touchmove', moveDraw, opts)
    canvas.addEventListener('touchend', endDraw)
    return () => {
      canvas.removeEventListener('touchstart', startDraw, opts)
      canvas.removeEventListener('touchmove', moveDraw, opts)
      canvas.removeEventListener('touchend', endDraw)
    }
  }, [])

  const clear = () => {
    setPaths([])
    setCurrentPath([])
    setPreviewUrl(null)
    emitPreview([])
  }

  const generatePreview = () => {
    const canvas = canvasRef.current
    setPreviewUrl(canvas.toDataURL('image/png'))
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const res = await fetch(previewUrl)
      const blob = await res.blob()
      await onConfirm(blob)
    } finally {
      setSaving(false)
    }
  }

  const handleRedo = () => {
    setPreviewUrl(null)
    clear()
    onRedo?.()
  }

  const hasStrokes = paths.length > 0

  // Preview mode
  if (previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="text-[10px] text-[#e8e8ff]/60 uppercase tracking-wider cd-head text-center">
          Happy with your signature?
        </div>
        <div
          className="relative rounded-xl overflow-hidden border border-[#e8e8ff]/20 w-full"
          style={{ maxWidth: 240, aspectRatio: '63 / 88' }}
        >
          {cardBackground && (
            <div className="absolute inset-0 opacity-25 overflow-hidden"
              style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' }}>
              <div style={{ width: '100%', height: '100%' }}
                className="[&>.trading-card]:!w-full [&>.trading-card]:!h-full [&>.game-card]:!w-full [&>.game-card]:!h-full">
                {cardBackground}
              </div>
            </div>
          )}
          <img src={previewUrl} alt="Signature preview" className="relative z-10 w-full h-full" />
        </div>
        <div className="flex gap-2 w-full" style={{ maxWidth: 240 }}>
          <button
            onClick={handleRedo}
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--cd-border)] text-[var(--cd-text-dim)] text-xs font-bold uppercase tracking-wider cd-head hover:bg-white/[0.03] transition-all cursor-pointer"
          >
            Redo
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 px-3 py-2 rounded-lg bg-[#e8e8ff]/[0.12] border border-[#e8e8ff]/30 text-[#e8e8ff] text-xs font-bold uppercase tracking-wider cd-head hover:bg-[#e8e8ff]/[0.2] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? 'Signing...' : 'Confirm'}
          </button>
        </div>
      </div>
    )
  }

  // Drawing mode
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-[10px] text-[#e8e8ff]/60 uppercase tracking-wider cd-head text-center">
        Draw your signature on the card
      </div>

      {/* Color picker */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[240px]">
        {PEN_COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => setPenColor(c.value)}
            className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
              penColor === c.value ? 'border-white scale-125' : 'border-white/20 hover:border-white/50'
            }`}
            style={{ backgroundColor: c.value, boxShadow: penColor === c.value ? `0 0 8px ${c.value}66` : undefined }}
            title={c.name}
          />
        ))}
      </div>

      <div
        className="relative rounded-xl overflow-hidden border border-[#e8e8ff]/20 w-full"
        style={{ maxWidth: 240, aspectRatio: '63 / 88' }}
      >
        {cardBackground && (
          <div className="absolute inset-0 pointer-events-none opacity-25 overflow-hidden"
            style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' }}>
            <div style={{ width: '100%', height: '100%', transform: 'scale(1)', transformOrigin: 'top left' }}
              className="[&>.trading-card]:!w-full [&>.trading-card]:!h-full [&>.game-card]:!w-full [&>.game-card]:!h-full">
              {cardBackground}
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="relative z-10"
          style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
        {!hasStrokes && !drawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span className="text-[#e8e8ff]/20 text-sm cd-head">Sign here</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 w-full" style={{ maxWidth: 240 }}>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--cd-border)] text-[var(--cd-text-dim)] text-[10px] font-bold uppercase tracking-wider cd-head hover:bg-white/[0.03] transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={clear}
          disabled={!hasStrokes}
          className="px-3 py-1.5 rounded-lg border border-[var(--cd-border)] text-[var(--cd-text-dim)] text-[10px] font-bold uppercase tracking-wider cd-head hover:bg-white/[0.03] transition-all cursor-pointer disabled:opacity-30"
        >
          Clear
        </button>
        <button
          onClick={generatePreview}
          disabled={!hasStrokes}
          className="flex-1 px-3 py-1.5 rounded-lg bg-[#e8e8ff]/[0.12] border border-[#e8e8ff]/30 text-[#e8e8ff] text-[10px] font-bold uppercase tracking-wider cd-head hover:bg-[#e8e8ff]/[0.2] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Preview
        </button>
      </div>
    </div>
  )
}
