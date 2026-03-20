import { useState, useEffect, useCallback, useMemo } from 'react'
import PageTitle from '../../components/PageTitle'
import { rotationService } from '../../services/database'
import { ChevronLeft, ChevronRight, Plus, Trash2, Copy, Check } from 'lucide-react'

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

function getWeekDates(offset = 0) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  start.setDate(start.getDate() + offset * 7)
  // Go to Monday of that week
  const day = start.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)

  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RotationManager() {
  const [schedule, setSchedule] = useState({})
  const [packTypes, setPackTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(null)
  const [copySource, setCopySource] = useState(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const todayStr = formatDate(new Date())

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await rotationService.load()
      setSchedule(data.schedule || {})
      setPackTypes(data.packTypes || [])
    } catch (err) {
      console.error('Failed to load rotation data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rotationOnlyPacks = useMemo(() =>
    packTypes.filter(p => p.rotationOnly).sort((a, b) => a.sortOrder - b.sortOrder),
    [packTypes]
  )

  const allEnabledPacks = useMemo(() =>
    packTypes.sort((a, b) => a.sortOrder - b.sortOrder),
    [packTypes]
  )

  const togglePack = useCallback(async (dateStr, packId) => {
    const current = schedule[dateStr] || []
    const ids = current.map(p => p.packTypeId)
    const newIds = ids.includes(packId)
      ? ids.filter(id => id !== packId)
      : [...ids, packId]

    setSaving(dateStr)
    try {
      await rotationService.setDate(dateStr, newIds)
      // Optimistic update
      if (newIds.length === 0) {
        setSchedule(prev => {
          const next = { ...prev }
          delete next[dateStr]
          return next
        })
      } else {
        const packMap = {}
        for (const p of packTypes) packMap[p.id] = p
        setSchedule(prev => ({
          ...prev,
          [dateStr]: newIds.map(id => ({
            packTypeId: id,
            packName: packMap[id]?.name || id,
            cost: packMap[id]?.cost || 0,
            cards: packMap[id]?.cards || 6,
            color: packMap[id]?.color,
            leagueName: packMap[id]?.leagueName,
          })),
        }))
      }
    } catch (err) {
      console.error('Failed to save rotation:', err)
    } finally {
      setSaving(null)
    }
  }, [schedule, packTypes])

  const clearDate = useCallback(async (dateStr) => {
    setSaving(dateStr)
    try {
      await rotationService.removeDate(dateStr)
      setSchedule(prev => {
        const next = { ...prev }
        delete next[dateStr]
        return next
      })
    } catch (err) {
      console.error('Failed to clear date:', err)
    } finally {
      setSaving(null)
    }
  }, [])

  const pasteToDate = useCallback(async (dateStr) => {
    if (!copySource || !schedule[copySource]) return
    const sourceIds = schedule[copySource].map(p => p.packTypeId)
    setSaving(dateStr)
    try {
      await rotationService.setDate(dateStr, sourceIds)
      const packMap = {}
      for (const p of packTypes) packMap[p.id] = p
      setSchedule(prev => ({
        ...prev,
        [dateStr]: sourceIds.map(id => ({
          packTypeId: id,
          packName: packMap[id]?.name || id,
          cost: packMap[id]?.cost || 0,
          cards: packMap[id]?.cards || 6,
          color: packMap[id]?.color,
          leagueName: packMap[id]?.leagueName,
        })),
      }))
      setCopySource(null)
    } catch (err) {
      console.error('Failed to paste rotation:', err)
    } finally {
      setSaving(null)
    }
  }, [copySource, schedule, packTypes])

  // Find the effective rotation for today (most recent date <= today)
  const effectiveDate = useMemo(() => {
    const dates = Object.keys(schedule).sort().reverse()
    return dates.find(d => d <= todayStr) || null
  }, [schedule, todayStr])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <PageTitle title="Pack Rotation" noindex />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <PageTitle title="Pack Rotation" noindex />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Pack Rotation Manager</h1>
        <p className="text-sm text-white/50">Schedule which packs appear in the Special Rotation shop section. Rotation changes daily at midnight UTC.</p>
      </div>

      {/* Current Rotation Info */}
      {effectiveDate && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-emerald-400">Live Now</span>
            <span className="text-xs text-white/40 ml-auto">
              Effective since {effectiveDate}{effectiveDate !== todayStr && ' (carried over)'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(schedule[effectiveDate] || []).map(p => (
              <span key={p.packTypeId} className="px-2.5 py-1 rounded-lg text-xs font-bold border" style={{
                color: p.color || '#22d3ee',
                borderColor: (p.color || '#22d3ee') + '40',
                backgroundColor: (p.color || '#22d3ee') + '15',
              }}>
                {p.packName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Copy mode indicator */}
      {copySource && (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
          <span className="text-xs text-blue-400">
            Copied <strong>{copySource}</strong> — click a day to paste, or
          </span>
          <button
            onClick={() => setCopySource(null)}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-bold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2 mb-8">
        {weekDates.map((date, i) => {
          const dateStr = formatDate(date)
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr
          const dayPacks = schedule[dateStr] || []
          const isEffective = dateStr === effectiveDate
          const isSelected = selectedDate === dateStr
          const isSaving = saving === dateStr

          return (
            <div
              key={dateStr}
              className={`rounded-xl border p-2.5 min-h-[140px] transition-all cursor-pointer ${
                isToday
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : isSelected
                    ? 'border-white/30 bg-white/5'
                    : isPast
                      ? 'border-white/5 bg-white/[0.01] opacity-50'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-amber-400' : 'text-white/30'}`}>
                    {DAY_NAMES[i]}
                  </div>
                  <div className={`text-sm font-bold ${isToday ? 'text-amber-400' : 'text-white/70'}`}>
                    {date.getUTCDate()}
                  </div>
                </div>
                {isEffective && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Currently live" />
                )}
                {isSaving && (
                  <div className="animate-spin w-3 h-3 border border-amber-500 border-t-transparent rounded-full" />
                )}
              </div>

              {/* Pack pills */}
              <div className="space-y-1">
                {dayPacks.map(p => (
                  <div
                    key={p.packTypeId}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded truncate"
                    style={{
                      color: p.color || '#22d3ee',
                      backgroundColor: (p.color || '#22d3ee') + '15',
                    }}
                    title={p.packName}
                  >
                    {p.packName}
                  </div>
                ))}
                {dayPacks.length === 0 && !isPast && (
                  <div className="text-[9px] text-white/15 text-center py-2">Empty</div>
                )}
              </div>

              {/* Quick actions */}
              {isSelected && !isPast && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/10" onClick={e => e.stopPropagation()}>
                  {dayPacks.length > 0 && (
                    <>
                      <button
                        onClick={() => setCopySource(dateStr)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-blue-400 cursor-pointer transition-colors"
                        title="Copy this day"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => clearDate(dateStr)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-red-400 cursor-pointer transition-colors"
                        title="Clear this day"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {copySource && copySource !== dateStr && (
                    <button
                      onClick={() => pasteToDate(dateStr)}
                      className="p-1 rounded hover:bg-white/10 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
                      title="Paste here"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pack Picker — shown when a date is selected */}
      {selectedDate && selectedDate >= todayStr && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">
              Edit rotation for <span className="text-amber-400">{selectedDate}</span>
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-white/40 hover:text-white/60 cursor-pointer"
            >
              Done
            </button>
          </div>

          {/* Rotation-Only Packs */}
          {rotationOnlyPacks.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Rotation Packs</div>
              <div className="flex flex-wrap gap-2">
                {rotationOnlyPacks.map(pack => {
                  const isActive = (schedule[selectedDate] || []).some(p => p.packTypeId === pack.id)
                  return (
                    <button
                      key={pack.id}
                      onClick={() => togglePack(selectedDate, pack.id)}
                      disabled={saving === selectedDate}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                        isActive
                          ? 'border-opacity-40 bg-opacity-15'
                          : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/60'
                      }`}
                      style={isActive ? {
                        color: pack.color || '#22d3ee',
                        borderColor: (pack.color || '#22d3ee') + '60',
                        backgroundColor: (pack.color || '#22d3ee') + '20',
                      } : undefined}
                    >
                      <div>{pack.name}</div>
                      <div className="text-[9px] font-normal mt-0.5 opacity-60">
                        {pack.cost} Cores · {pack.cards} cards
                        {pack.leagueName ? ` · ${pack.leagueName}` : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Regular Packs (can also be added to rotation) */}
          {allEnabledPacks.filter(p => !p.rotationOnly).length > 0 && (
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Regular Packs</div>
              <div className="flex flex-wrap gap-2">
                {allEnabledPacks.filter(p => !p.rotationOnly).map(pack => {
                  const isActive = (schedule[selectedDate] || []).some(p => p.packTypeId === pack.id)
                  return (
                    <button
                      key={pack.id}
                      onClick={() => togglePack(selectedDate, pack.id)}
                      disabled={saving === selectedDate}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                        isActive
                          ? 'border-opacity-40 bg-opacity-15'
                          : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/60'
                      }`}
                      style={isActive ? {
                        color: pack.color || '#22d3ee',
                        borderColor: (pack.color || '#22d3ee') + '60',
                        backgroundColor: (pack.color || '#22d3ee') + '20',
                      } : undefined}
                    >
                      <div>{pack.name}</div>
                      <div className="text-[9px] font-normal mt-0.5 opacity-60">
                        {pack.cost} Cores · {pack.cards} cards
                        {pack.leagueName ? ` · ${pack.leagueName}` : ''}
                      </div>
                    </button>
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
