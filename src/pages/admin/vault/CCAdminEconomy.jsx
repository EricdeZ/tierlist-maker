import { useState, useEffect } from 'react'
import { RARITIES } from '../../../data/vault/economy'
import { vaultService } from '../../../services/database'

export default function CCAdminEconomy() {
  const [packTypes, setPackTypes] = useState([])

  useEffect(() => {
    vaultService.load().then(data => setPackTypes(data.packTypes || []))
  }, [])

  return (
    <div className="space-y-6">
      {/* Rarity config */}
      <Section title="Rarity Configuration">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                <th className="p-3">Rarity</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Drop Rate</th>
                <th className="p-3">Ember Value</th>
                <th className="p-3">Craft Cost</th>
                <th className="p-3">Targeted Craft</th>
                <th className="p-3">Holo Effects</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(RARITIES).map(([key, r]) => (
                <tr key={key} className="border-b border-white/5">
                  <td className="p-3">
                    <span className="font-bold capitalize" style={{ color: r.color }}>{r.name}</span>
                  </td>
                  <td className="p-3 font-mono">{r.tier}</td>
                  <td className="p-3 font-mono">{(r.dropRate * 100).toFixed(1)}%</td>
                  <td className="p-3 font-mono">{r.emberValue}</td>
                  <td className="p-3 font-mono">{r.craftCost}</td>
                  <td className="p-3 font-mono">{r.targetedCraftCost}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.holoEffects.map(h => (
                        <span key={h} className="px-1.5 py-0.5 rounded bg-white/5 text-xs">{h}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Pack types */}
      <Section title="Pack Types">
        {packTypes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packTypes.map(pack => (
              <div key={pack.id} className="bg-black/20 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-amber-400">{pack.name}</h4>
                <div className="text-xs text-white/40 font-mono">{pack.id}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--color-text-secondary)]">Cost:</span> <strong>{pack.cost} Ember</strong></div>
                  <div><span className="text-[var(--color-text-secondary)]">Cards:</span> <strong>{pack.cards}</strong></div>
                  <div><span className="text-[var(--color-text-secondary)]">Category:</span> <strong>{pack.category}</strong></div>
                  {pack.leagueId && (
                    <div><span className="text-[var(--color-text-secondary)]">League:</span> <strong>#{pack.leagueId}</strong></div>
                  )}
                </div>
                {pack.guarantees?.length > 0 && (
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    <strong>Guarantees:</strong>
                    {pack.guarantees.map((g, i) => (
                      <span key={i} className="ml-1">{g.count}x {g.minRarity}+</span>
                    ))}
                  </div>
                )}
                {pack.description && (
                  <div className="text-xs text-[var(--color-text-secondary)]">{pack.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-400">
          Pack types are managed in the <code className="bg-black/30 px-1 rounded">cc_pack_types</code> database table. Rarity values are defined in <code className="bg-black/30 px-1 rounded">src/data/vault/economy.js</code>.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
      <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}
