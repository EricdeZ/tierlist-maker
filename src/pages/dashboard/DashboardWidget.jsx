import { Link } from 'react-router-dom'

const sizeClasses = {
    large: 'col-span-1 md:col-span-2',
    medium: 'col-span-1',
    small: 'col-span-1',
}

// Tailwind CSS 4 requires complete class names (no dynamic interpolation)
const accentStyles = {
    white:   { border: 'border-white/10 hover:border-white/20', icon: 'text-white' },
    blue:    { border: 'border-blue-500/20 hover:border-blue-500/40', icon: 'text-blue-400' },
    emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', icon: 'text-emerald-400' },
    amber:   { border: 'border-amber-500/20 hover:border-amber-500/40', icon: 'text-amber-400' },
    violet:  { border: 'border-violet-500/20 hover:border-violet-500/40', icon: 'text-violet-400' },
    cyan:    { border: 'border-cyan-500/20 hover:border-cyan-500/40', icon: 'text-cyan-400' },
    teal:    { border: 'border-teal-500/20 hover:border-teal-500/40', icon: 'text-teal-400' },
    orange:  { border: 'border-orange-500/20 hover:border-orange-500/40', icon: 'text-orange-400' },
}

export default function DashboardWidget({ title, icon, linkTo, size = 'medium', accent = 'white', children, className = '' }) {
    const styles = accentStyles[accent] || accentStyles.white

    return (
        <div className={`relative overflow-hidden rounded-xl border ${styles.border} bg-gradient-to-b from-white/5 to-transparent p-4 sm:p-5 transition-colors ${sizeClasses[size]} ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-(--color-text-secondary)">{title}</h3>
                </div>
                {linkTo && (
                    <Link to={linkTo} className="text-xs text-(--color-text-secondary) hover:text-(--color-text) transition-colors">
                        View all &rarr;
                    </Link>
                )}
            </div>
            {children}
        </div>
    )
}
