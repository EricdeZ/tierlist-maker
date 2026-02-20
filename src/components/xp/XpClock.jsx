import { useState, useEffect } from 'react'

export default function XpClock() {
    const [time, setTime] = useState('')
    useEffect(() => {
        const tick = () => setTime(new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }))
        tick()
        const id = setInterval(tick, 30000)
        return () => clearInterval(id)
    }, [])
    return <span className="xp-tray-clock">{time} EST</span>
}
