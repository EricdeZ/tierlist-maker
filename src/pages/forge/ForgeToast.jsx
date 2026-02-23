import { useEffect, useState } from 'react'

export default function ForgeToast({ message, onDone }) {
    const [phase, setPhase] = useState('show') // show → hide → gone

    useEffect(() => {
        if (!message) return
        setPhase('show')
        const hideTimer = setTimeout(() => setPhase('hide'), 2200)
        const doneTimer = setTimeout(() => {
            setPhase('gone')
            onDone?.()
        }, 2600)
        return () => { clearTimeout(hideTimer); clearTimeout(doneTimer) }
    }, [message])

    if (!message || phase === 'gone') return null

    return (
        <div className={`forge-toast ${phase}`}>
            <span className="text-xl">&#128293;</span>
            <span>{message}</span>
        </div>
    )
}
