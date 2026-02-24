import { useState, useMemo } from 'react'
import { Clock, Copy, Target, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { XP_PICK_BADGE, formatPickMode, formatDateEST, copyScrimsToClipboard } from './scrimUtils'

function toESTDateStr(isoStr) {
    const d = new Date(isoStr)
    const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    return `${est.getFullYear()}-${String(est.getMonth() + 1).padStart(2, '0')}-${String(est.getDate()).padStart(2, '0')}`
}

export default function XpScrimCalendarWindow({ myScrims, myTeams }) {
    const [viewMonth, setViewMonth] = useState(() => new Date())
    const [selectedDay, setSelectedDay] = useState(null)

    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const monthName = viewMonth.toLocaleString('en-US', { month: 'long' })

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Build map: dateStr → array of scrims
    const scrimsByDate = useMemo(() => {
        const map = {}
        const teamIds = new Set(myTeams.map(t => t.teamId))
        for (const s of (myScrims || [])) {
            if (s.status === 'cancelled' || s.status === 'expired') continue
            if (!teamIds.has(s.teamId) && !teamIds.has(s.acceptedTeamId)) continue
            const dateStr = toESTDateStr(s.scheduledDate)
            if (!map[dateStr]) map[dateStr] = []
            map[dateStr].push(s)
        }
        return map
    }, [myScrims, myTeams])

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    const selectedScrims = selectedDay ? (scrimsByDate[selectedDay] || []) : []

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Calendar grid */}
            <div className="xp-calendar" style={{ maxWidth: 'none', border: 'none', borderBottom: '2px groove #d4d0c8' }}>
                <div className="xp-calendar-header">
                    <button type="button" onClick={() => { setViewMonth(new Date(year, month - 1, 1)); setSelectedDay(null) }} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                        <ChevronLeft size={12} />
                    </button>
                    <span style={{ fontFamily: '"Pixelify Sans", system-ui', fontSize: 14 }}>{monthName} {year}</span>
                    <button type="button" onClick={() => { setViewMonth(new Date(year, month + 1, 1)); setSelectedDay(null) }} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                        <ChevronRight size={12} />
                    </button>
                </div>
                <div className="xp-calendar-grid">
                    {dayHeaders.map(d => <div key={d} className="xp-calendar-day-header">{d}</div>)}
                    {cells.map((day, i) => {
                        if (!day) return <div key={`e${i}`} className="xp-calendar-day xp-cal-big-day" />
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const scrims = scrimsByDate[dateStr] || []
                        const hasConfirmed = scrims.some(s => s.status === 'accepted')
                        const hasPending = scrims.some(s => s.status === 'open')
                        const isToday = dateStr === todayStr
                        const isSelected = dateStr === selectedDay
                        const cls = [
                            'xp-calendar-day xp-cal-big-day',
                            isToday && 'xp-calendar-day-today',
                            isSelected && 'xp-calendar-day-selected',
                        ].filter(Boolean).join(' ')
                        return (
                            <div key={dateStr} className={cls} onClick={() => setSelectedDay(dateStr)}>
                                <span>{day}</span>
                                {(hasConfirmed || hasPending) && (
                                    <div className="xp-cal-dots">
                                        {hasConfirmed && <span className="xp-cal-dot xp-cal-dot-confirmed" />}
                                        {hasPending && <span className="xp-cal-dot xp-cal-dot-pending" />}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                {/* Legend + Export */}
                <div className="flex items-center gap-3 px-2 py-1.5" style={{ background: '#ece9d8', borderTop: '1px solid #c0c0c0' }}>
                    <div className="flex items-center gap-1">
                        <span className="xp-cal-dot xp-cal-dot-confirmed" style={{ position: 'static' }} />
                        <span className="xp-text" style={{ fontSize: 10 }}>Confirmed</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="xp-cal-dot xp-cal-dot-pending" style={{ position: 'static' }} />
                        <span className="xp-text" style={{ fontSize: 10 }}>Pending</span>
                    </div>
                    <div className="flex-1" />
                    <button onClick={() => {
                        const allScrims = Object.values(scrimsByDate).flat().sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
                        if (allScrims.length === 0) return
                        copyScrimsToClipboard(allScrims, new Set(myTeams.map(t => t.teamId)))
                    }} className="xp-copy-btn" title="Copy all scrims to clipboard" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Copy size={10} /> Export All
                    </button>
                </div>
            </div>

            {/* Day detail panel */}
            <div className="xp-cal-detail" style={{ flex: 1, overflowY: 'auto', padding: 6, minHeight: 60 }}>
                {!selectedDay && (
                    <div className="xp-text" style={{ color: '#888', textAlign: 'center', paddingTop: 12 }}>
                        Click a day to see scrim details.
                    </div>
                )}
                {selectedDay && selectedScrims.length === 0 && (
                    <div className="xp-text" style={{ color: '#888', textAlign: 'center', paddingTop: 12 }}>
                        No scrims on {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.
                    </div>
                )}
                {selectedDay && selectedScrims.length > 0 && (
                    <div>
                        <div className="xp-text" style={{ fontWeight: 700, marginBottom: 4 }}>
                            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="flex flex-col gap-1">
                            {selectedScrims.map(s => (
                                <div key={s.id} className="xp-cal-scrim-item">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <TeamLogo slug={s.teamSlug} name={s.teamName} size={18} color={s.teamColor} />
                                        <span className="xp-text" style={{ fontWeight: 700 }}>{s.teamName}</span>
                                        {s.status === 'accepted' ? (
                                            <span className="xp-badge xp-badge-green" style={{ fontSize: 9 }}>Confirmed</span>
                                        ) : (
                                            <span className="xp-badge xp-badge-amber" style={{ fontSize: 9 }}>Pending</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Clock size={10} style={{ color: '#555' }} />
                                        <span className="xp-text" style={{ fontSize: 11 }}>{formatDateEST(s.scheduledDate)}</span>
                                        <span className={`xp-badge ${XP_PICK_BADGE[s.pickMode] || 'xp-badge-blue'}`} style={{ fontSize: 9 }}>{formatPickMode(s.pickMode)}</span>
                                    </div>
                                    {s.status === 'accepted' && s.acceptedTeamName && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="xp-text" style={{ fontSize: 10, color: '#2d8212' }}>vs</span>
                                            <TeamLogo slug={s.acceptedTeamSlug} name={s.acceptedTeamName} size={14} color={s.acceptedTeamColor} />
                                            <span className="xp-text" style={{ fontSize: 11, fontWeight: 600, color: '#2d8212' }}>{s.acceptedTeamName}</span>
                                        </div>
                                    )}
                                    {s.challengedTeamName && s.status === 'open' && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Target size={10} style={{ color: '#6a3ea1' }} />
                                            <span className="xp-text" style={{ fontSize: 10, color: '#6a3ea1' }}>Challenging {s.challengedTeamName}</span>
                                        </div>
                                    )}
                                    {s.notes && (
                                        <div className="xp-text" style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
                                            <MessageSquare size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                                            {s.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
