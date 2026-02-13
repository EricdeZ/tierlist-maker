import { ChevronRight } from 'lucide-react'
import { useSidebar } from '../../context/SidebarContext'

export default function SidebarTrigger({ hideOnSmall = false }) {
    const { isOpen, toggle } = useSidebar()

    return (
        <button
            onClick={toggle}
            className={`fixed top-3 left-3 z-[55] w-10 h-10 items-center justify-center
                rounded-xl border border-(--color-accent)/30
                text-(--color-accent) hover:text-(--color-accent) hover:border-(--color-accent)/60
                transition-all duration-300 cursor-pointer
                ${hideOnSmall ? 'hidden sidebar:flex' : 'flex'}
                ${!isOpen ? 'sidebar-trigger-wiggle sidebar-trigger-glow' : 'bg-(--color-primary)/80 backdrop-blur-sm'}
            `}
            style={!isOpen ? {
                background: 'linear-gradient(135deg, rgba(248,197,106,0.15), rgba(248,197,106,0.05))',
            } : undefined}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
            <ChevronRight
                className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
            />
        </button>
    )
}
