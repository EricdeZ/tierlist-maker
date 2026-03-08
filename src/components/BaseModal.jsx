import { useEffect, useCallback } from 'react'

export default function BaseModal({ onClose, maxWidth = 'max-w-md', className = '', children }) {
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') onClose?.()
    }, [onClose])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && onClose?.()}
        >
            <div
                className={`rounded-xl border border-white/10 shadow-2xl ${maxWidth} w-full ${className}`}
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                {children}
            </div>
        </div>
    )
}

export function ModalHeader({ title, subtitle, onClose, children }) {
    return (
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
                {children || (
                    <>
                        <h3 className="text-base font-bold text-[var(--color-text)]">{title}</h3>
                        {subtitle && <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>}
                    </>
                )}
            </div>
            {onClose && (
                <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
            )}
        </div>
    )
}
