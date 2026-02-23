import { useEffect, useState } from 'react'
import sparkIcon from '../../assets/spark.png'

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
            <img src={sparkIcon} alt="" className="w-5 h-5 object-contain" />
            <span>{message}</span>
        </div>
    )
}
