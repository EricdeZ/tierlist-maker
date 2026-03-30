import { useState } from 'react'
import { PassiveIcon, STAFF_PASSIVES, PASSIVE_COLORS } from '../../../data/vault/passives'
import './PassiveIndicator.css'

export default function PassiveIndicator({ passiveName, size = 240 }) {
  const [expanded, setExpanded] = useState(false)
  if (!passiveName) return null

  const info = STAFF_PASSIVES[passiveName]
  if (!info) return null

  const colors = PASSIVE_COLORS[passiveName] || PASSIVE_COLORS.collector_boost
  const scale = Math.max(0.7, Math.min(1.4, size / 200))
  const iconSize = Math.round(22 * scale)

  return (
    <div
      className={`passive-indicator ${expanded ? 'passive-indicator--expanded' : ''}`}
      style={{
        '--pi-scale': scale,
        '--pi-primary': colors.primary,
        '--pi-light': colors.light,
        '--pi-shadow': colors.shadow,
        '--pi-shadow-hover': colors.shadowHover,
        '--pi-panel-from': colors.panelFrom,
        '--pi-panel-to': colors.panelTo,
        '--pi-panel-shadow': colors.panelShadow,
      }}
    >
      <div
        className="passive-indicator__tab"
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
        title={info.name}
      >
        <PassiveIcon passive={passiveName} size={iconSize} className="passive-indicator__icon" />
      </div>

      <div className="passive-indicator__panel" onClick={(e) => e.stopPropagation()}>
        <div className="passive-indicator__panel-header">
          <PassiveIcon passive={passiveName} size={Math.round(22 * scale)} className="passive-indicator__panel-icon" />
          <span className="passive-indicator__panel-name">{info.name}</span>
        </div>
        <p className="passive-indicator__panel-desc">{info.description}</p>
        <div
          className="passive-indicator__panel-close"
          onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
        >
          Dismiss
        </div>
      </div>
    </div>
  )
}
