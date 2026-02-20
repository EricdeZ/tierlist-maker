import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function XpCalendar({ selectedDate, onSelectDate, scrimDates }) {
    const [viewMonth, setViewMonth] = useState(() => new Date())

    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const monthName = viewMonth.toLocaleString('en-US', { month: 'long' })

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    return (
        <div className="xp-calendar" style={{ maxWidth: 280, margin: '0 auto' }}>
            <div className="xp-calendar-header">
                <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                    <ChevronLeft size={12} />
                </button>
                <span style={{ fontFamily: '"Pixelify Sans", system-ui', fontSize: 13 }}>{monthName} {year}</span>
                <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="xp-title-btn xp-tbtn-min" style={{ width: 18, height: 18, fontSize: 11 }}>
                    <ChevronRight size={12} />
                </button>
            </div>
            <div className="xp-calendar-grid">
                {dayHeaders.map(d => <div key={d} className="xp-calendar-day-header">{d}</div>)}
                {cells.map((day, i) => {
                    if (!day) return <div key={`e${i}`} className="xp-calendar-day" />
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isPast = new Date(year, month, day) < today
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === selectedDate
                    const hasScrim = scrimDates.has(dateStr)
                    const cls = [
                        'xp-calendar-day',
                        isPast && 'xp-calendar-day-past',
                        isToday && 'xp-calendar-day-today',
                        isSelected && 'xp-calendar-day-selected',
                        hasScrim && 'xp-calendar-day-scrim',
                    ].filter(Boolean).join(' ')
                    return (
                        <div key={dateStr} className={cls}
                            onClick={() => !isPast && onSelectDate(dateStr, hasScrim)}>
                            {day}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
