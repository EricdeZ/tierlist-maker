import { useState, useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { useSidebar } from '../../context/SidebarContext'

const shortcutLabel = 'Space'

export default function SidebarTrigger({ hideOnSmall = false }) {
    const { isOpen, toggle, hasUsedShortcut } = useSidebar()
    const [expanded, setExpanded] = useState(false)
    const hasFired = useRef(false)
    const [isBigScreen, setIsBigScreen] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(min-width: 87.5rem)').matches
    )

    // Track sidebar breakpoint (87.5rem) for persistent shortcut hint
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 87.5rem)')
        setIsBigScreen(mq.matches)
        const handler = (e) => setIsBigScreen(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    // On big screens, keep showing shortcut hint until user presses it
    const showPersistentHint = isBigScreen && !hasUsedShortcut && !isOpen
    const isExpanded = expanded || showPersistentHint

    // One-time expand after scrolling past the hero
    useEffect(() => {
        const onScroll = () => {
            if (hasFired.current || isOpen) return
            if (window.scrollY > window.innerHeight * 0.7) {
                hasFired.current = true
                setExpanded(true)
                setTimeout(() => setExpanded(false), 3500)
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [isOpen])

    // Cancel if user opens sidebar first
    useEffect(() => {
        if (isOpen) {
            hasFired.current = true
            setExpanded(false)
        }
    }, [isOpen])

    return (
        <button
            onClick={toggle}
            className={`fixed top-3 left-3 z-[55] h-[55px] items-center gap-2 overflow-hidden
                rounded-xl border border-(--color-accent)/30
                text-(--color-accent) hover:border-(--color-accent)/60
                transition-all duration-500 ease-in-out cursor-pointer
                ${hideOnSmall ? 'hidden sidebar:flex' : 'flex'}
                ${!isOpen && !isExpanded ? 'sidebar-trigger-wiggle sidebar-trigger-glow' : ''}
                ${isOpen ? 'bg-(--color-primary)/80 backdrop-blur-sm' : ''}
            `}
            style={{
                width: isExpanded ? '195px' : '55px',
                ...(!isOpen ? {
                    background: isExpanded
                        ? 'linear-gradient(135deg, #2a1f0a, #1a1408)'
                        : 'linear-gradient(135deg, #2a1f0a, #1a1408)',
                } : {}),
            }}
            aria-label={isOpen ? 'Close menu' : `Open menu (${shortcutLabel})`}
        >
            <ChevronRight
                className={`w-6 h-6 shrink-0 ml-[15px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
            />
            <span
                className="text-xs font-semibold whitespace-nowrap transition-opacity duration-500"
                style={{ opacity: isExpanded ? 1 : 0 }}
            >
                {showPersistentHint ? `Press ${shortcutLabel}` : `Show Sidebar (${shortcutLabel})`}
            </span>
        </button>
    )
}
