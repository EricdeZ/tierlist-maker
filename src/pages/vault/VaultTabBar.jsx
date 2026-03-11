import { useState } from 'react'
import { Package, Users, Library, Store, MoreHorizontal, X } from 'lucide-react'

const PRIMARY_TABS = [
  { key: 'packs', label: 'Packs', icon: Package },
  { key: 'lineup', label: 'Starting 5', icon: Users },
  { key: 'collection', label: 'Collection', icon: Library },
  { key: 'market', label: 'Market', icon: Store },
]

const PRIMARY_KEYS = new Set(PRIMARY_TABS.map(t => t.key))

export default function VaultTabBar({ tabs, activeTab, onTabChange, unseenGifts, pendingTradeCount, packMode, onPackModeChange, myPacksCount }) {
  const [moreOpen, setMoreOpen] = useState(false)

  const secondaryTabs = tabs.filter(t => !PRIMARY_KEYS.has(t.key))
  const activeIsSecondary = secondaryTabs.some(t => t.key === activeTab)

  const moreBadge = secondaryTabs.some(t =>
    (t.key === 'gifts' && unseenGifts > 0) ||
    (t.key === 'trade' && pendingTradeCount > 0)
  )

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && (
        <div
          className="fixed bottom-[68px] left-2 right-2 z-[100] bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl p-3 shadow-2xl"
          style={{ animation: 'cd-fade-in 0.15s ease-out' }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-white/30 uppercase tracking-widest cd-head font-bold">More</span>
            <button onClick={() => setMoreOpen(false)} className="text-white/30 hover:text-white/60 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {secondaryTabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { onTabChange(tab.key); setMoreOpen(false) }}
                  className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[10px] font-bold cd-head tracking-wider">{tab.label}</span>
                  {tab.key === 'gifts' && unseenGifts > 0 && (
                    <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[var(--cd-cyan)] text-[8px] font-bold text-black flex items-center justify-center">
                      {unseenGifts}
                    </span>
                  )}
                  {tab.key === 'trade' && pendingTradeCount > 0 && (
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-[98] bg-[var(--cd-edge)] backdrop-blur-md border-t border-[var(--cd-border)] px-2 pb-[env(safe-area-inset-bottom)]">
        {/* Pack sub-toggles — second row when on packs tab */}
        {activeTab === 'packs' && onPackModeChange && (
          <div className="flex items-center justify-center gap-1.5 pt-1.5 pb-0.5 max-w-lg mx-auto">
            {[
              { key: 'my-packs', label: 'MY PACKS', active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', badge: myPacksCount },
              { key: 'shop', label: 'SHOP', active: 'bg-white/10 text-white border-white/30' },
              { key: 'sale', label: 'LIMITED', active: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => onPackModeChange(m.key)}
                className={`relative px-3 py-0.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
                  packMode === m.key ? m.active : 'bg-transparent text-white/30 border-white/10'
                }`}
                style={{ fontFamily: "'Teko', sans-serif", fontSize: 11, letterSpacing: '0.15em' }}
              >
                {m.label}
                {m.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-emerald-500 text-[8px] font-bold text-black flex items-center justify-center">
                    {m.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-stretch justify-around max-w-lg mx-auto">
          {PRIMARY_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { onTabChange(tab.key); setMoreOpen(false) }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all cursor-pointer ${
                  active ? 'text-[var(--cd-cyan)]' : 'text-white/30'
                }`}
              >
                <Icon size={20} className={active ? 'cd-icon-glow' : ''} />
                <span className="text-[9px] font-bold cd-head tracking-wider whitespace-nowrap">{tab.label}</span>
                {active && (
                  <span className="w-4 h-0.5 rounded-full bg-[var(--cd-cyan)] mt-0.5" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.4)' }} />
                )}
              </button>
            )
          })}

          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all cursor-pointer relative ${
              moreOpen || activeIsSecondary ? 'text-[var(--cd-cyan)]' : 'text-white/30'
            }`}
          >
            <MoreHorizontal size={20} className={moreOpen || activeIsSecondary ? 'cd-icon-glow' : ''} />
            <span className="text-[9px] font-bold cd-head tracking-wider">More</span>
            {moreBadge && !moreOpen && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-[var(--cd-cyan)] animate-pulse" />
            )}
            {(moreOpen || activeIsSecondary) && (
              <span className="w-4 h-0.5 rounded-full bg-[var(--cd-cyan)] mt-0.5" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.4)' }} />
            )}
          </button>
        </div>
      </div>
    </>
  )
}
