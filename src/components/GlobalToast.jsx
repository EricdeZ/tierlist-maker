import { useEffect, useState } from 'react'

export default function GlobalToast({ message, onDone }) {
    const [phase, setPhase] = useState('show')

    useEffect(() => {
        if (!message) return
        setPhase('show')
        const hideTimer = setTimeout(() => setPhase('hide'), 3000)
        const doneTimer = setTimeout(() => {
            setPhase('gone')
            onDone?.()
        }, 3400)
        return () => { clearTimeout(hideTimer); clearTimeout(doneTimer) }
    }, [message])

    if (!message || phase === 'gone') return null

    return (
        <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
            style={{
                animation: phase === 'show'
                    ? 'globalToastIn 0.3s ease-out forwards'
                    : 'globalToastOut 0.3s ease-in forwards',
            }}
        >
            <div className="flex items-center gap-3 px-5 py-3 rounded-lg bg-(--color-secondary) border border-green-500/30 shadow-lg shadow-black/40">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    )
}
