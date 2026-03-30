import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { STAFF_PASSIVES, PASSIVE_COLORS, PassiveIcon } from '../../../data/vault/passives'

const PASSIVES_LIST = Object.entries(STAFF_PASSIVES).map(([key, info]) => ({
  key,
  ...info,
}))

export default function PassivesGuide() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="cd-panel cd-corners rounded-xl mt-4 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-white/40" />
          <span className="text-xs font-bold cd-head tracking-wider text-white/60">PASSIVES GUIDE</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-[var(--cd-border)]">
          <div className="space-y-2 mt-3">
            {PASSIVES_LIST.map(p => {
              const color = PASSIVE_COLORS[p.key]
              return (
                <div key={p.key} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02]">
                  <div className="shrink-0 mt-0.5" style={{ color: color?.primary }}>
                    <PassiveIcon passive={p.key} size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: color?.primary }}>{p.name}</div>
                    <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{p.description}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 px-3 py-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xs font-semibold text-white/60 mb-1.5">Swap Cooldown</div>
            <div className="text-xs text-white/40 leading-relaxed">
              Removing a staff card from your staff slot triggers a cooldown before you can slot a new one. The cooldown duration depends on the passive of the card you removed — more powerful passives have longer cooldowns. This prevents rapidly swapping between passives to exploit different effects.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
