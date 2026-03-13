import { useRef, useState, useEffect, useCallback } from 'react'

const COLORS = ['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4']
const SIZES = [2, 4, 8, 16]

export default function SketchPad() {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(4)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const lastPos = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
  }, [])

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    const clientX = touch ? touch.clientX : e.clientX
    const clientY = touch ? touch.clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const drawLine = useCallback((from, to) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [color, size])

  const onStart = useCallback((e) => {
    e.preventDefault()
    setDrawing(true)
    lastPos.current = getPos(e)
  }, [getPos])

  const onMove = useCallback((e) => {
    if (!drawing) return
    e.preventDefault()
    const pos = getPos(e)
    if (lastPos.current) drawLine(lastPos.current, pos)
    lastPos.current = pos
  }, [drawing, getPos, drawLine])

  const onEnd = useCallback(() => {
    setDrawing(false)
    lastPos.current = null
  }, [])

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
  }

  const save = async () => {
    setSaving(true)
    try {
      const canvas = canvasRef.current
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const form = new FormData()
      form.append('sketch', blob, `sketch-${Date.now()}.png`)
      const res = await fetch('/api/sketch', { method: 'POST', body: form })
      const data = await res.json()
      setSaved(data.filename)
      setTimeout(() => setSaved(null), 3000)
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 flex flex-col items-center">
      <h1 className="text-white/60 text-sm font-bold tracking-widest uppercase mb-4" style={{ fontFamily: "'Teko', sans-serif" }}>
        Sketch Pad
      </h1>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap justify-center">
        {/* Colors */}
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer"
              style={{
                background: c,
                borderColor: color === c ? '#fff' : 'transparent',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        <span className="w-px h-6 bg-white/10" />

        {/* Sizes */}
        <div className="flex gap-1.5 items-center">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer"
              style={{
                background: size === s ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: size === s ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              }}
            >
              <div className="rounded-full bg-white" style={{ width: s, height: s }} />
            </button>
          ))}
        </div>

        <span className="w-px h-6 bg-white/10" />

        {/* Eraser */}
        <button
          onClick={() => setColor('#111111')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider cursor-pointer transition-all ${
            color === '#111111' ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 border border-transparent hover:text-white/60'
          }`}
        >
          ERASER
        </button>

        <button
          onClick={clear}
          className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider text-white/40 hover:text-white/60 border border-transparent hover:border-white/10 cursor-pointer transition-all"
        >
          CLEAR
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer transition-all disabled:opacity-40"
        >
          {saving ? 'SAVING...' : 'SAVE'}
        </button>

        {saved && (
          <span className="text-xs text-emerald-400 font-bold animate-pulse">Saved: {saved}</span>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="border border-white/10 rounded-xl cursor-crosshair touch-none"
        style={{ width: '100%', maxWidth: 900, height: 'calc(100vh - 160px)' }}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      />
    </div>
  )
}
