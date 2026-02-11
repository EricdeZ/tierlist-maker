import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ScheduledMatchPanel({ scheduledMatches = [], linkedScheduledIds = new Set(), onConfirm, hasTarget }) {
    const [selectedId, setSelectedId] = useState(null)

    const selectedMatch = scheduledMatches.find(sm => sm.id === selectedId)

    return (
        <div>
            {scheduledMatches.length === 0 ? (
                <div className="px-3 py-6 text-center">
                    <p className="text-xs text-[var(--color-text-secondary)]">No scheduled matches for this season</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {scheduledMatches.map(sm => {
                        const isLinked = linkedScheduledIds.has(sm.id)
                        const isSelected = selectedId === sm.id
                        return (
                            <div
                                key={sm.id}
                                onClick={() => !isLinked && setSelectedId(prev => prev === sm.id ? null : sm.id)}
                                className={`px-3 py-2.5 transition cursor-pointer ${
                                    isLinked ? 'opacity-40 cursor-default' :
                                    isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/3'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                                        isSelected ? 'border-cyan-400' : 'border-gray-600'
                                    }`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                                    </div>
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: sm.team1_color || '#3b82f6' }} />
                                        <span className="text-[11px] text-[var(--color-text)] font-medium truncate">{sm.team1_name}</span>
                                        <span className="text-[10px] text-[var(--color-text-secondary)]">vs</span>
                                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: sm.team2_color || '#ef4444' }} />
                                        <span className="text-[11px] text-[var(--color-text)] font-medium truncate">{sm.team2_name}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)] mt-0.5 ml-5.5">
                                    {sm.scheduled_date && <span>{sm.scheduled_date.slice(0, 10)}</span>}
                                    {sm.week && <span>W{sm.week}</span>}
                                    <span>Bo{sm.best_of}</span>
                                    {isLinked && <span className="text-cyan-400/60 ml-auto">In progress</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Footer */}
            <div className="px-3 py-2.5 border-t border-white/10 flex items-center justify-between">
                <Link to="/admin/schedule" className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition">
                    Manage Schedule →
                </Link>
                <button
                    onClick={() => selectedMatch && onConfirm(selectedMatch)}
                    disabled={!selectedMatch || !hasTarget}
                    title={!hasTarget ? 'Select "Scheduled" on a report card first' : ''}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    Link to Report
                </button>
            </div>
        </div>
    )
}
