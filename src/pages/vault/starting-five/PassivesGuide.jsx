import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { STAFF_PASSIVES, PassiveIcon } from '../../../data/vault/passives'

const PASSIVES_LIST = Object.entries(STAFF_PASSIVES).map(([key, info]) => ({
  key,
  ...info,
}))

export default function PassivesGuide() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="cd-panel cd-corners rounded-xl mb-6 sm:mb-8 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-400" />
          <span className="text-xs font-bold cd-head tracking-wider text-white/60">STAFF PASSIVES</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-[var(--cd-border)]">
          <div className="flex items-center gap-2 mt-3 mb-4 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <Clock size={14} className="text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300/90 font-medium">Coming soon — passives are not yet active</span>
          </div>

          <div className="space-y-2">
            {PASSIVES_LIST.map(p => (
              <div key={p.key} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02]">
                <div className="shrink-0 mt-0.5 text-white/50">
                  <PassiveIcon passive={p.key} size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white/80">{p.name}</div>
                  <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{p.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
