import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Users, Sparkles, Check, AlertCircle } from 'lucide-react'
import { TEAM_SYNERGY_BONUS, RARITIES } from '../../../data/vault/economy'
import { buildTeamOpportunities, buildGodOpportunities } from './synergyHelpers'

export default function SynergyPlanner({ collection, startingFive }) {
  const [expanded, setExpanded] = useState(false)

  const csSlots = startingFive?.currentSeason?.slots
  const asSlots = startingFive?.allStar?.slots

  const teamOpps = useMemo(
    () => buildTeamOpportunities(collection, csSlots, asSlots),
    [collection, csSlots, asSlots]
  )

  const godOpps = useMemo(
    () => buildGodOpportunities(csSlots, asSlots, collection),
    [csSlots, asSlots, collection]
  )

  const actionableCount = teamOpps.filter(t => t.owned > Math.max(t.slottedCurrent, t.slottedAllStar)).length
    + godOpps.filter(g => g.status === 'available').length

  if (teamOpps.length === 0 && godOpps.length === 0) return null

  return (
    <div className="cd-panel cd-corners rounded-xl mb-6 sm:mb-8 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--cd-cyan)]" />
          <span className="text-xs font-bold cd-head tracking-wider text-white/60">SYNERGY PLANNER</span>
          {actionableCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold cd-head bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]">
              {actionableCount} tip{actionableCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-5 border-t border-[var(--cd-border)]">

          {/* Team Synergy Section */}
          {teamOpps.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={12} className="text-sky-400" />
                <span className="text-[11px] font-bold cd-head text-sky-400 tracking-wider">TEAM SYNERGY</span>
              </div>
              <div className="space-y-2">
                {teamOpps.map(t => {
                  const maxSlotted = Math.max(t.slottedCurrent, t.slottedAllStar)
                  const room = t.owned - maxSlotted
                  return (
                    <div key={t.teamId} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.teamColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/70 cd-head truncate">{t.teamName}</span>
                          <span className="text-[10px] text-white/30 cd-num">{t.owned} owned</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                          {t.slottedCurrent > 0 && <span>{t.slottedCurrent} in Current</span>}
                          {t.slottedCurrent > 0 && t.slottedAllStar > 0 && <span className="text-white/15">&middot;</span>}
                          {t.slottedAllStar > 0 && <span>{t.slottedAllStar} in All-Star</span>}
                          {maxSlotted === 0 && <span className="text-white/25">none slotted</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {t.currentBonus > 0 ? (
                          <div className="text-[11px] font-bold cd-head text-sky-400">+{Math.round(t.currentBonus * 100)}%</div>
                        ) : (
                          <div className="text-[11px] font-bold cd-head text-white/20">&mdash;</div>
                        )}
                        {room > 0 && t.nextBonus > t.currentBonus && (
                          <div className="text-[9px] text-white/30 cd-head">
                            +1 &rarr; {Math.round(t.nextBonus * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* God Synergy Section */}
          {godOpps.length > 0 && (
            <div className={teamOpps.length > 0 ? '' : 'pt-4'}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={12} className="text-emerald-400" />
                <span className="text-[11px] font-bold cd-head text-emerald-400 tracking-wider">GOD SYNERGY</span>
              </div>
              <div className="space-y-2">
                {godOpps.map((g, i) => {
                  const rarityColor = RARITIES[g.godCard?.rarity]?.color || '#9ca3af'
                  return (
                    <div key={`${g.lineup}-${g.role}-${i}`} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/70 cd-head truncate">{g.playerName}</span>
                          <span className="text-[10px] text-white/25 cd-head">{g.lineup}</span>
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          Best god: <span className="text-white/60">{g.bestGodName}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {g.status === 'matched' && (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Check size={12} />
                              <span className="text-[10px] font-bold cd-head">MATCHED</span>
                            </div>
                            {!g.holoMatch && (
                              <span className="text-[9px] cd-head text-amber-400/70">holo mismatch</span>
                            )}
                          </div>
                        )}
                        {g.status === 'available' && (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold cd-head text-amber-400">AVAILABLE</span>
                            <span className="text-[9px] cd-head" style={{ color: rarityColor }}>
                              {g.godCard.rarity} {g.godCard.holoType}
                            </span>
                            {!g.holoMatch && (
                              <span className="text-[9px] cd-head text-amber-400/70">holo mismatch</span>
                            )}
                          </div>
                        )}
                        {g.status === 'available-ineligible' && (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold cd-head text-white/30">OWNED</span>
                            <span className="text-[9px] cd-head" style={{ color: rarityColor }}>
                              {g.godCard.rarity} {g.godCard.holoType} — too low
                            </span>
                          </div>
                        )}
                        {g.status === 'not-owned' && (
                          <div className="flex items-center gap-1 text-white/20">
                            <AlertCircle size={11} />
                            <span className="text-[10px] font-bold cd-head">NOT OWNED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
