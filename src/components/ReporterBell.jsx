import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useReadyMatchCount } from '../hooks/useReadyMatchCount'

export default function ReporterBell() {
    const { count, hasReportPermission } = useReadyMatchCount()

    if (!hasReportPermission) return null

    return (
        <Link
            to="/admin"
            className="relative p-2 rounded-lg text-(--nav-text) hover:text-(--color-accent) hover:bg-white/10 transition-all duration-200"
            title={count > 0 ? `${count} match${count !== 1 ? 'es' : ''} ready to report` : 'No matches to report'}
        >
            <Bell className={`w-4 h-4 ${count > 0 ? 'text-(--color-accent)' : ''}`} />
            {count > 0 && (
                <span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: '#f8c56a', color: '#0a0f1a' }}
                >
                    {count}
                </span>
            )}
        </Link>
    )
}
