import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import PackArt from './PackArt'
import scLogo from '../../../assets/smite2.png'
import './PackArt3D.css'

export default function PackArt3D({
  tier = 'standard',
  name,
  subtitle,
  cardCount,
  leagueLogo,
  leagueName,
  divisionIcon,
  divisionName,
  seed = 0,
  godImageUrl,
  className = '',
  width = 190,
}) {
  const sceneRef = useRef(null)
  const packRef = useRef(null)
  const rot = useRef({ x: 0, y: 0 })
  const drag = useRef({ active: false, lastX: 0, lastY: 0 })
  const [dragging, setDragging] = useState(false)
  const [idle, setIdle] = useState(true)

  const applyRotation = useCallback((rx, ry) => {
    const pack = packRef.current
    if (!pack) return
    pack.style.setProperty('--rx', `${rx}deg`)
    pack.style.setProperty('--ry', `${ry}deg`)
  }, [])

  const handleMouseDown = useCallback((e) => {
    drag.current = { active: true, lastX: e.clientX, lastY: e.clientY }
    setDragging(true)
    setIdle(false)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e) => {
    const pack = packRef.current
    const scene = sceneRef.current
    if (!pack || !scene) return

    const rect = scene.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    pack.style.setProperty('--mx', `${nx * 100}%`)
    pack.style.setProperty('--my', `${ny * 100}%`)

    if (drag.current.active) {
      const dx = e.clientX - drag.current.lastX
      const dy = e.clientY - drag.current.lastY
      rot.current.y += dx * 0.5
      rot.current.x -= dy * 0.5
      drag.current.lastX = e.clientX
      drag.current.lastY = e.clientY
      applyRotation(rot.current.x, rot.current.y)
    } else {
      // Hover tilt: small offset from base rotation
      applyRotation(
        rot.current.x + (0.5 - ny) * 15,
        rot.current.y + (nx - 0.5) * 20,
      )
    }
  }, [applyRotation])

  const stopDrag = useCallback(() => {
    if (drag.current.active) {
      drag.current.active = false
      setDragging(false)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    stopDrag()
    applyRotation(rot.current.x, rot.current.y)
  }, [stopDrag, applyRotation])

  // Catch mouseup anywhere on the page
  useEffect(() => {
    document.addEventListener('mouseup', stopDrag)
    return () => document.removeEventListener('mouseup', stopDrag)
  }, [stopDrag])

  const handleFlip = useCallback(() => {
    rot.current.y += 180
    setIdle(false)
    const pack = packRef.current
    if (!pack) return
    pack.classList.add('pack-3d--flipping')
    applyRotation(rot.current.x, rot.current.y)
    setTimeout(() => pack.classList.remove('pack-3d--flipping'), 600)
  }, [applyRotation])

  const handleReset = useCallback(() => {
    rot.current = { x: 0, y: 0 }
    setIdle(true)
    const pack = packRef.current
    if (!pack) return
    pack.classList.add('pack-3d--flipping')
    applyRotation(0, 0)
    setTimeout(() => pack.classList.remove('pack-3d--flipping'), 600)
  }, [applyRotation])

  const cornerStrips = useMemo(() => {
    const SEGMENTS = 6
    const strips = []
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (180 / SEGMENTS) * (i + 0.5)
      strips.push(
        <div key={`cr-${i}`} className="pack-3d__corner" style={{ '--corner-angle': `${angle}deg`, '--corner-dir': 1 }} />,
        <div key={`cl-${i}`} className="pack-3d__corner" style={{ '--corner-angle': `${-angle}deg`, '--corner-dir': -1 }} />,
      )
    }
    return strips
  }, [])

  return (
    <div className={`pack-3d-outer ${className}`}>
      <div
        className={`pack-3d-scene ${dragging ? 'pack-3d-scene--dragging' : ''}`}
        ref={sceneRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={packRef}
          className={`pack-3d ${dragging ? 'pack-3d--dragging' : ''} ${idle ? 'pack-3d--idle' : ''}`}
          data-tier={tier}
          style={{ '--w': `${width}px` }}
        >
          {/* Front face — the real PackArt component */}
          <div className="pack-3d__face pack-3d__face--front">
            <PackArt
              tier={tier}
              name={name}
              subtitle={subtitle}
              cardCount={cardCount}
              leagueLogo={leagueLogo}
              leagueName={leagueName}
              divisionIcon={divisionIcon}
              divisionName={divisionName}
              seed={seed}
              godImageUrl={godImageUrl}
            />
          </div>

          {/* Back face — custom metallic design */}
          <div className="pack-3d__face pack-3d__face--back">
            <div className="pack-3d__back">
              <div className="pack-3d__back-crimp pack-3d__back-crimp--top" />
              <div className="pack-3d__back-crimp pack-3d__back-crimp--bottom" />
              <div className="pack-3d__back-foil" />
              <div className="pack-3d__back-pattern" />
              <div className="pack-3d__back-grain" />
              <img className="pack-3d__back-logo" src={scLogo} alt="" draggable={false} />
              <div className="pack-3d__back-title">{name || 'Card Pack'}</div>
              <div className="pack-3d__back-glare" />
              <div className="pack-3d__back-edge" />
            </div>
          </div>

          {/* Rounded vertical edges (corner strips) */}
          {cornerStrips}
          {/* Top + bottom edges */}
          <div className="pack-3d__face pack-3d__face--top" />
          <div className="pack-3d__face pack-3d__face--bottom" />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleFlip} className="pack-3d__flip-btn">Flip</button>
        <button onClick={handleReset} className="pack-3d__flip-btn">Reset</button>
      </div>
    </div>
  )
}
