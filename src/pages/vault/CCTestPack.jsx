import { useState, useCallback, useRef } from 'react'
import PackArt from './components/PackArt'
import './components/testpack.css'

const TIERS = [
  { value: 'osl-mixed', label: 'OSL Mixed' },
  { value: 'bsl-mixed', label: 'BSL Mixed' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'elite', label: 'Elite' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'mixed', label: 'Mixed' },
]

const PACK_DISPLAY = {
  'osl-mixed': { name: 'OSL', subtitle: 'Olympus League' },
  'bsl-mixed': { name: 'BSL', subtitle: 'Babylon League' },
  standard:    { name: 'STANDARD', subtitle: 'Card Pack' },
  premium:     { name: 'PREMIUM', subtitle: 'Card Pack' },
  elite:       { name: 'ELITE', subtitle: 'Card Pack' },
  legendary:   { name: 'LEGENDARY', subtitle: 'Card Pack' },
  mixed:       { name: 'MIXED', subtitle: 'Card Pack' },
}

const ENHANCEMENTS = [
  { key: 'rounded',   cls: 'enh-rounded',    label: 'Rounded Corners',  desc: 'Subtle border-radius like real packaging' },
  { key: 'shadow',    cls: 'enh-shadow',     label: 'Ambient Glow',     desc: 'Stronger shadow with tier-colored ambient light' },
  { key: 'frame',     cls: 'enh-frame',      label: 'Inner Frame',      desc: 'Thin metallic border inset from edges' },
  { key: 'emboss',    cls: 'enh-emboss',     label: 'Embossed Title',   desc: 'Stamped-into-metal text with highlight edge' },
  { key: 'holo',      cls: 'enh-holo',       label: 'Holographic Strip',desc: 'Rainbow-shifting prismatic band' },
  { key: 'creases',   cls: 'enh-creases',    label: 'Package Creases',  desc: 'Fold lines suggesting physical wrapper' },
  { key: 'noise',     cls: 'enh-noise',      label: 'Surface Noise',    desc: 'Fine grain to break up smooth gradients' },
  { key: 'thickness', cls: 'enh-thickness',  label: 'Pack Thickness',   desc: '3D side edges showing physical depth' },
  { key: 'foilStamp', cls: 'enh-foil-stamp', label: 'Foil Stamp',      desc: 'Metallic reflective zones for logo/title' },
  { key: 'moreTilt',  cls: 'enh-more-tilt',  label: 'More Tilt',       desc: 'Amplified 3D rotation + tighter perspective' },
]

export default function CCTestPack() {
  const [tier, setTier] = useState('osl-mixed')
  const [active, setActive] = useState({})
  const wrapRef = useRef(null)

  const toggle = (key) => setActive(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleAll = (on) => setActive(
    Object.fromEntries(ENHANCEMENTS.map(e => [e.key, on]))
  )

  const classes = ENHANCEMENTS
    .filter(e => active[e.key])
    .map(e => e.cls)
    .join(' ')

  const handleMouseMove = useCallback((e) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    if (active.moreTilt) {
      const packArt = el.querySelector('.pack-art')
      if (packArt) {
        packArt.style.setProperty('--rx', `${(0.5 - y) * 30}deg`)
        packArt.style.setProperty('--ry', `${(x - 0.5) * 40}deg`)
      }
    }
  }, [active.moreTilt])

  const display = PACK_DISPLAY[tier] || PACK_DISPLAY.standard

  const tierSelector = (
    <select
      value={tier}
      onChange={e => setTier(e.target.value)}
      className="bg-white/10 text-white text-sm px-3 py-1.5 rounded border border-white/20 cursor-pointer"
    >
      {TIERS.map(t => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  )

  return (
    <div className="py-8">
      <div className="flex items-center justify-center gap-4 mb-8">
        {tierSelector}
      </div>

      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-12">
        {/* Pack preview */}
        <div className="flex flex-col items-center gap-6">
          <div
            ref={wrapRef}
            className={`testpack-wrap ${classes}`}
            data-tier={tier}
            onMouseMove={handleMouseMove}
          >
            <div className="testpack-pack-layer">
              <PackArt
                tier={tier}
                name={display.name}
                subtitle={display.subtitle}
                cardCount={6}
                seed={5}
              />
            </div>
            <div className="enh-overlay enh-holo-el" />
            <div className="enh-overlay enh-creases-el" />
            <div className="enh-overlay enh-noise-el" />
          </div>
          <div className="text-xs text-white/30 text-center">Hover to see 3D tilt + glare</div>
        </div>

        {/* Toggle panel */}
        <div className="flex flex-col gap-1 bg-white/5 rounded-lg p-5 min-w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">Enhancements</h3>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAll(true)}
                className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/50 hover:text-white/80 cursor-pointer"
              >
                All On
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/50 hover:text-white/80 cursor-pointer"
              >
                All Off
              </button>
            </div>
          </div>

          {ENHANCEMENTS.map(({ key, label, desc }) => (
            <label
              key={key}
              className={`flex items-start gap-3 cursor-pointer p-2 rounded transition-colors ${
                active[key] ? 'bg-white/8' : 'hover:bg-white/4'
              }`}
            >
              <input
                type="checkbox"
                checked={!!active[key]}
                onChange={() => toggle(key)}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <div className={`text-sm font-semibold ${active[key] ? 'text-amber-300' : 'text-white/80'}`}>
                  {label}
                </div>
                <div className="text-[11px] text-white/40 leading-tight">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
