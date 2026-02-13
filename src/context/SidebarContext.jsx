import { createContext, useContext, useState, useCallback } from 'react'

const SidebarContext = createContext(null)

export const SidebarProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false)
    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const toggle = useCallback(() => setIsOpen(prev => !prev), [])

    return (
        <SidebarContext.Provider value={{ isOpen, open, close, toggle }}>
            {children}
        </SidebarContext.Provider>
    )
}

export const useSidebar = () => {
    const ctx = useContext(SidebarContext)
    if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
    return ctx
}
