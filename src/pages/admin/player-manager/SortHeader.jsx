import { ChevronDown } from 'lucide-react'

export default function SortHeader({ col, label, current, dir, onSort }) {
    const isActive = current === col
    return (
        <th
            className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase cursor-pointer select-none hover:text-[var(--color-text)] transition-colors"
            onClick={() => onSort(col)}
        >
            <span className="flex items-center gap-1">
                {label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isActive ? '' : 'opacity-30'} ${isActive && dir === 'desc' ? 'rotate-180' : ''}`} />
            </span>
        </th>
    )
}
