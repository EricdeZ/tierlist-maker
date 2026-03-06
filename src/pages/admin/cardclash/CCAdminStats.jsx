import { useState, useEffect } from 'react'
import { cardclashAdminService } from '../../../services/database'
import { RARITIES } from '../../../data/cardclash/economy'

export default function CCAdminStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cardclashAdminService.getStats().then(data => {
      setStats(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading stats...</div>
  if (!stats) return <div className="text-center py-12 text-red-400">Failed to load stats</div>

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Cards" value={stats.totalCards} color="amber" />
        <StatCard label="Total Players" value={stats.totalPlayers} color="blue" />
        <StatCard label="Packs Opened" value={stats.totalPacks} color="purple" />
        <StatCard label="Unique Gods" value={Object.keys(stats.rarityCounts || {}).length + ' rarities'} color="emerald" />
      </div>

      {/* Rarity distribution */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">Rarity Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['common', 'uncommon', 'rare', 'epic', 'legendary'].map(r => (
            <div key={r} className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: RARITIES[r]?.color }} />
              <div>
                <div className="text-xs text-[var(--color-text-secondary)] capitalize">{r}</div>
                <div className="text-lg font-bold" style={{ color: RARITIES[r]?.color }}>
                  {stats.rarityCounts?.[r] || 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Holo distribution */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">Holo Effect Distribution</h3>
        <div className="flex flex-wrap gap-2">
          {(stats.holoDistribution || []).map(h => (
            <div key={h.holo_effect} className="px-3 py-1.5 rounded-lg bg-black/20 text-sm">
              <span className="text-amber-400 font-bold">{h.holo_effect}</span>
              <span className="text-[var(--color-text-secondary)] ml-2">{h.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top players */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
          <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">Top Players by ELO</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(stats.topPlayers || []).map((p, i) => (
              <div key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <span className="text-xs text-[var(--color-text-secondary)] w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.discord_name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {p.card_count} cards &middot; {p.wins}W {p.losses}L &middot; {p.packs_opened} packs
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-400">{p.elo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent cards */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
          <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">Recently Created Cards</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(stats.recentCards || []).map(card => (
              <div key={card.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RARITIES[card.rarity]?.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {card.godName}
                    <span className="text-xs text-[var(--color-text-secondary)] ml-2">{card.holoEffect}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {card.ownerName} &middot; Power {card.power} &middot; {card.acquiredVia}
                  </div>
                </div>
                <span className="text-xs font-bold capitalize" style={{ color: RARITIES[card.rarity]?.color }}>
                  {card.rarity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    amber: 'text-amber-400 border-amber-500/20',
    blue: 'text-blue-400 border-blue-500/20',
    purple: 'text-purple-400 border-purple-500/20',
    emerald: 'text-emerald-400 border-emerald-500/20',
  }
  return (
    <div className={`bg-[var(--color-secondary)] rounded-xl border ${colors[color]} p-4`}>
      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color]?.split(' ')[0]}`}>{value}</div>
    </div>
  )
}
