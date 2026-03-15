import { useState, useEffect, useMemo } from 'react'
import { vaultAdminService } from '../../../services/database'

const STATUS_BADGES = {
  new: { label: 'New', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  exists: { label: 'Exists', cls: 'bg-white/5 text-[var(--cd-text-mid)] border-white/10' },
  excluded: { label: 'Excluded', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

const SORTABLE_COLUMNS = [
  { key: 'playerName', label: 'Player' },
  { key: 'teamName', label: 'Team' },
  { key: 'role', label: 'Role' },
  { key: 'divisionName', label: 'Division' },
  { key: 'seasonName', label: 'Season' },
  { key: 'bestGodName', label: 'Best God' },
  { key: 'status', label: 'Status' },
]

function SortHeader({ column, sortKey, sortDir, onSort }) {
  const active = sortKey === column.key
  return (
    <th
      className="pb-2 pr-4 cursor-pointer select-none hover:text-[var(--cd-text)]"
      onClick={() => onSort(column.key)}
    >
      <span className="flex items-center gap-1">
        {column.label}
        {active && <span className="text-amber-400">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
      </span>
    </th>
  )
}

export default function CCAdminPlayerDefs() {
  const [seasons, setSeasons] = useState([])
  const [selectedSeasons, setSelectedSeasons] = useState(new Set())
  const [entries, setEntries] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [showExisting, setShowExisting] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('teamName')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    vaultAdminService.getSeasons()
      .then(data => setSeasons(data.seasons || []))
      .catch(() => {})
  }, [])

  const seasonsByLeague = useMemo(() => {
    const map = new Map()
    for (const s of seasons) {
      const key = s.league_name || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return map
  }, [seasons])

  const toggleSeason = (id) => {
    setSelectedSeasons(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAllActive = () => {
    setSelectedSeasons(new Set(seasons.filter(s => s.is_active).map(s => s.id)))
  }

  const handlePreview = async () => {
    if (!selectedSeasons.size) return
    setLoading(true)
    setEntries(null)
    setResult(null)
    try {
      const data = await vaultAdminService.previewPlayerDefs({
        seasonIds: [...selectedSeasons].join(','),
      })
      const list = data.entries || []
      setEntries(list)
      setSelected(new Set(
        list.filter(e => e.status === 'new').map(e => `${e.playerId}-${e.teamId}-${e.seasonId}`)
      ))
    } catch (err) {
      setResult({ success: false, message: err.message || 'Failed to load preview' })
    }
    setLoading(false)
  }

  const toggleEntry = (key) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    let list = showExisting ? entries : entries.filter(e => e.status !== 'exists')
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        (e.playerName || '').toLowerCase().includes(q) ||
        (e.teamName || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q) ||
        (e.divisionName || '').toLowerCase().includes(q) ||
        (e.seasonName || '').toLowerCase().includes(q) ||
        (e.bestGodName || '').toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      const aVal = (a[sortKey] || '').toString().toLowerCase()
      const bVal = (b[sortKey] || '').toString().toLowerCase()
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [entries, showExisting, search, sortKey, sortDir])

  const existingCount = useMemo(() => {
    if (!entries) return 0
    return entries.filter(e => e.status === 'exists').length
  }, [entries])

  const selectableEntries = useMemo(() => {
    return filteredEntries.filter(e => e.status !== 'excluded')
  }, [filteredEntries])

  const selectAll = () => {
    setSelected(new Set(selectableEntries.map(e => `${e.playerId}-${e.teamId}-${e.seasonId}`)))
  }

  const selectNone = () => {
    setSelected(new Set())
  }

  const handleExclude = async (entry) => {
    try {
      await vaultAdminService.excludePlayerDef(entry.playerId, entry.teamId, entry.seasonId)
      setEntries(prev => prev.map(e =>
        e.playerId === entry.playerId && e.teamId === entry.teamId && e.seasonId === entry.seasonId
          ? { ...e, status: 'excluded' } : e
      ))
      const key = `${entry.playerId}-${entry.teamId}-${entry.seasonId}`
      setSelected(prev => { const next = new Set(prev); next.delete(key); return next })
    } catch {}
  }

  const handleUnexclude = async (entry) => {
    try {
      await vaultAdminService.unexcludePlayerDef(entry.playerId, entry.teamId, entry.seasonId)
      setEntries(prev => prev.map(e =>
        e.playerId === entry.playerId && e.teamId === entry.teamId && e.seasonId === entry.seasonId
          ? { ...e, status: 'new' } : e
      ))
    } catch {}
  }

  const handleGenerate = async () => {
    if (!selected.size) return
    setGenerating(true)
    setResult(null)
    try {
      const toGenerate = [...selected].map(key => {
        const [playerId, teamId, seasonId] = key.split('-').map(Number)
        return { playerId, teamId, seasonId }
      })
      const data = await vaultAdminService.generateSelectedDefs(toGenerate)
      setResult({ success: true, message: `Created ${data.created}, updated ${data.updated} (${data.total} total)` })
      await handlePreview()
    } catch (err) {
      setResult({ success: false, message: err.message || 'Generation failed' })
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      {/* Season Selector */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--cd-text)]">Select Seasons</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllActive}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors cursor-pointer"
            >
              All Active Seasons
            </button>
            <button
              onClick={handlePreview}
              disabled={!selectedSeasons.size || loading}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {[...seasonsByLeague.entries()].map(([league, leagueSeasons]) => (
            <div key={league}>
              <div className="text-xs font-bold text-[var(--cd-text-mid)] mb-1.5">{league}</div>
              <div className="flex flex-wrap gap-2">
                {leagueSeasons.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleSeason(s.id)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                      selectedSeasons.has(s.id)
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[var(--cd-edge)] text-[var(--cd-text-mid)] border-white/10 hover:border-white/20'
                    }`}
                  >
                    {s.division_name} — {s.name}
                    {s.is_active && <span className="ml-1 text-emerald-400">&#9679;</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Result message */}
      {result && (
        <div className={`text-sm font-bold px-4 py-2 rounded-lg ${result.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {result.message}
        </div>
      )}

      {/* Preview Table */}
      {entries && (
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-bold text-[var(--cd-text)]">
                Preview ({filteredEntries.length} shown, {selected.size} selected)
              </h3>
              {existingCount > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-[var(--cd-text-mid)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showExisting}
                    onChange={(e) => setShowExisting(e.target.checked)}
                    className="accent-amber-500 cursor-pointer"
                  />
                  Show existing ({existingCount})
                </label>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!selected.size || generating}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {generating ? 'Generating...' : `Generate ${selected.size} Selected`}
            </button>
          </div>

          {/* Search + Select All/None */}
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players, teams, gods..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--cd-edge)] border border-white/10 text-[var(--cd-text)] placeholder:text-[var(--cd-text-mid)] focus:outline-none focus:border-amber-500/40"
            />
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/5 text-[var(--cd-text-mid)] border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/5 text-[var(--cd-text-mid)] border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
            >
              Select None
            </button>
          </div>

          {filteredEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--cd-text-mid)] border-b border-white/10">
                    <th className="pb-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectableEntries.length > 0 && selected.size === selectableEntries.length}
                        onChange={() => selected.size === selectableEntries.length ? selectNone() : selectAll()}
                        className="accent-amber-500 cursor-pointer"
                      />
                    </th>
                    {SORTABLE_COLUMNS.map(col => (
                      <SortHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    ))}
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(entry => {
                    const key = `${entry.playerId}-${entry.teamId}-${entry.seasonId}`
                    const isExcluded = entry.status === 'excluded'
                    const badge = STATUS_BADGES[entry.status] || STATUS_BADGES.new

                    return (
                      <tr key={key} className={`border-b border-white/5 ${isExcluded ? 'opacity-40' : ''}`}>
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggleEntry(key)}
                            disabled={isExcluded}
                            className="accent-amber-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2 pr-4 font-bold text-[var(--cd-text)]">{entry.playerName}</td>
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-1.5">
                            {entry.teamColor && (
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.teamColor }} />
                            )}
                            {entry.teamName}
                          </span>
                        </td>
                        <td className="py-2 pr-4 capitalize">{entry.role || '\u2014'}</td>
                        <td className="py-2 pr-4">{entry.divisionName || '\u2014'}</td>
                        <td className="py-2 pr-4">{entry.seasonName}</td>
                        <td className="py-2 pr-4">{entry.bestGodName || '\u2014'}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2">
                          {isExcluded ? (
                            <button
                              onClick={() => handleUnexclude(entry)}
                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                            >
                              Unexclude
                            </button>
                          ) : (
                            <button
                              onClick={() => handleExclude(entry)}
                              className="text-[10px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                            >
                              Exclude
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-sm text-[var(--cd-text-mid)] py-8">No player-team combos found for selected seasons.</p>
          )}
        </div>
      )}
    </div>
  )
}
