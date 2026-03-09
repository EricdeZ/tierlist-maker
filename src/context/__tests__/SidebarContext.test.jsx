import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SidebarProvider, useSidebar } from '../SidebarContext'

beforeEach(() => {
    localStorage.clear()
})

afterEach(() => {
    localStorage.clear()
})

function wrapper({ children }) {
    return <SidebarProvider>{children}</SidebarProvider>
}

describe('SidebarContext', () => {
    it('initial state is closed', () => {
        const { result } = renderHook(() => useSidebar(), { wrapper })
        expect(result.current.isOpen).toBe(false)
    })

    it('open() sets isOpen to true', () => {
        const { result } = renderHook(() => useSidebar(), { wrapper })
        act(() => result.current.open())
        expect(result.current.isOpen).toBe(true)
    })

    it('close() sets isOpen to false', () => {
        const { result } = renderHook(() => useSidebar(), { wrapper })
        act(() => result.current.open())
        expect(result.current.isOpen).toBe(true)
        act(() => result.current.close())
        expect(result.current.isOpen).toBe(false)
    })

    it('toggle() flips the state', () => {
        const { result } = renderHook(() => useSidebar(), { wrapper })
        expect(result.current.isOpen).toBe(false)
        act(() => result.current.toggle())
        expect(result.current.isOpen).toBe(true)
        act(() => result.current.toggle())
        expect(result.current.isOpen).toBe(false)
    })

    it('hasUsedShortcut defaults to false', () => {
        const { result } = renderHook(() => useSidebar(), { wrapper })
        expect(result.current.hasUsedShortcut).toBe(false)
    })

    it('reads hasUsedShortcut from localStorage', () => {
        localStorage.setItem('sidebar-shortcut-used', 'true')
        const { result } = renderHook(() => useSidebar(), { wrapper })
        expect(result.current.hasUsedShortcut).toBe(true)
    })

    it('throws when used outside SidebarProvider', () => {
        expect(() => {
            renderHook(() => useSidebar())
        }).toThrow('useSidebar must be used within SidebarProvider')
    })
})
