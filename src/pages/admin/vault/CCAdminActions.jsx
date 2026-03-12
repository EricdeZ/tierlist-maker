import { useState } from 'react'
import { vaultAdminService } from '../../../services/database'

const ACTIONS = [
  {
    key: 'refresh-best-gods',
    label: 'Refresh Most Played Gods',
    description: 'Backfill best_god_name for all player defs that are missing it. Fixes cards showing initials instead of god art.',
    run: () => vaultAdminService.refreshBestGods(),
    formatResult: (r) => `Checked ${r.checked} defs, updated ${r.updated}`,
  },
  {
    key: 'backfill-card-defs',
    label: 'Backfill Card Definitions',
    description: 'Link existing player cards to their definition (def_id) if missing.',
    run: () => vaultAdminService.backfillCardDefs(),
    formatResult: (r) => `Updated ${r.updated} cards`,
  },
]

export default function CCAdminActions() {
  const [running, setRunning] = useState(null)
  const [results, setResults] = useState({})

  const handleRun = async (action) => {
    setRunning(action.key)
    setResults(prev => ({ ...prev, [action.key]: null }))
    try {
      const data = await action.run()
      setResults(prev => ({ ...prev, [action.key]: { success: true, message: action.formatResult(data) } }))
    } catch (err) {
      setResults(prev => ({ ...prev, [action.key]: { success: false, message: err.message || 'Failed' } }))
    }
    setRunning(null)
  }

  return (
    <div className="space-y-4">
      {ACTIONS.map(action => {
        const result = results[action.key]
        return (
          <div key={action.key} className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--cd-text)]">{action.label}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{action.description}</p>
                {result && (
                  <p className={`text-xs mt-2 font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRun(action)}
                disabled={running === action.key}
                className="shrink-0 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {running === action.key ? 'Running...' : 'Run'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
