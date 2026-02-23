import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const SidebarContext = createContext(null)

const SHORTCUT_USED_KEY = 'sidebar-shortcut-used'

export const SidebarProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [hasUsedShortcut, setHasUsedShortcut] = useState(() =>
        localStorage.getItem(SHORTCUT_USED_KEY) === 'true'
    )
    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const toggle = useCallback(() => setIsOpen(prev => !prev), [])

    // Spacebar to toggle sidebar (skip when typing in inputs or interactive elements)
    const isOpenRef = useRef(false)
    isOpenRef.current = isOpen
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key !== ' ') return
            // SmiteRunner uses spacebar for jump — never hijack it
            if (document.querySelector('[data-smiterunner]')) return
            // Always allow spacebar to close an open sidebar
            if (!isOpenRef.current) {
                const tag = e.target.tagName
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || e.target.isContentEditable) return
            }
            e.preventDefault()
            toggle()
            if (localStorage.getItem(SHORTCUT_USED_KEY) !== 'true') {
                localStorage.setItem(SHORTCUT_USED_KEY, 'true')
                setHasUsedShortcut(true)
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [toggle])

    return (
        <SidebarContext.Provider value={{ isOpen, open, close, toggle, hasUsedShortcut }}>
            {children}
        </SidebarContext.Provider>
    )
}

export const useSidebar = () => {
    const ctx = useContext(SidebarContext)
    if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
    return ctx
}
