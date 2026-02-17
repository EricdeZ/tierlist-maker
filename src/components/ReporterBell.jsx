import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Camera } from 'lucide-react'
import { useReadyMatchCount } from '../hooks/useReadyMatchCount'

export default function ReporterBell() {
    const { count, matches, hasReportPermission } = useReadyMatchCount()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const navigate = useNavigate()

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    if (!hasReportPermission) return null

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(prev => !prev)}
                className="relative p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
                title={count > 0 ? `${count} match${count !== 1 ? 'es' : ''} ready to report` : 'No matches to report'}
            >
                <Bell className={`w-4 h-4 ${count > 0 ? 'text-(--color-accent)' : ''}`} />
                {count > 0 && (
                    <span
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: '#f8c56a', color: '#0a0f1a' }}
                    >
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-(--color-secondary) shadow-2xl shadow-black/50 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                        <h3 className="text-sm font-bold text-(--color-text)">Match Reporter</h3>
                        <p className="text-xs text-(--color-text-secondary) mt-0.5">
                            Screenshots matched to scheduled matches
                        </p>
                    </div>

                    {count === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <Bell className="w-6 h-6 text-(--color-text-secondary)/40 mx-auto mb-2" />
                            <p className="text-sm text-(--color-text-secondary)">No matches ready to report</p>
                        </div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto">
                            {matches.slice(0, 8).map(m => (
                                <div key={m.id} className="px-4 py-2.5 border-b border-white/5 last:border-b-0">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: m.team1_color || 'var(--color-accent)' }}
                                            />
                                            <span className="text-xs font-semibold text-(--color-text) truncate">{m.team1_name}</span>
                                            <span className="text-[10px] text-(--color-text-secondary)">vs</span>
                                            <span className="text-xs font-semibold text-(--color-text) truncate">{m.team2_name}</span>
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: m.team2_color || 'var(--color-accent)' }}
                                            />
                                        </div>
                                        <span className="inline-flex items-center gap-1 text-[10px] text-(--color-text-secondary) shrink-0">
                                            <Camera className="w-3 h-3" />
                                            {m.screenshot_count}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-(--color-text-secondary)">{m.league_name}</span>
                                        <span className="text-[10px] text-(--color-text-secondary)/40">·</span>
                                        <span className="text-[10px] text-(--color-text-secondary)">{m.division_name}</span>
                                        {m.week && (
                                            <>
                                                <span className="text-[10px] text-(--color-text-secondary)/40">·</span>
                                                <span className="text-[10px] text-(--color-text-secondary)">Week {m.week}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {matches.length > 8 && (
                                <div className="px-4 py-2 text-center text-[10px] text-(--color-text-secondary)">
                                    +{matches.length - 8} more
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setOpen(false)
                            navigate(count > 0 ? '/admin/matchreport' : '/admin')
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 border-t border-white/10 text-xs font-semibold text-(--color-accent) hover:bg-white/5 transition-colors w-full"
                    >
                        {count > 0 ? 'Report Matches' : 'Go to Dashboard'}
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    )
}
