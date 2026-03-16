import { Link } from 'react-router-dom'

const sizeClasses = {
    large: 'col-span-1 md:col-span-2',
    medium: 'col-span-1',
    small: 'col-span-1',
    xlarge: 'col-span-1 md:col-span-2 xl:col-span-3',
}

// Tailwind CSS 4 requires complete class names (no dynamic interpolation)
const accentStyles = {
    white:   { border: 'border-white/10 hover:border-white/20', topBorder: 'bg-white/20', icon: 'text-white', bg: 'from-white/[0.04] to-transparent', glow: 'rgba(255,255,255,0.06)' },
    blue:    { border: 'border-blue-500/20 hover:border-blue-500/40', topBorder: 'bg-blue-400/40', icon: 'text-blue-400', bg: 'from-blue-500/[0.08] to-transparent', glow: 'rgba(59,130,246,0.08)' },
    emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', topBorder: 'bg-emerald-400/40', icon: 'text-emerald-400', bg: 'from-emerald-500/[0.08] to-transparent', glow: 'rgba(16,185,129,0.08)' },
    amber:   { border: 'border-amber-500/20 hover:border-amber-500/40', topBorder: 'bg-amber-400/40', icon: 'text-amber-400', bg: 'from-amber-500/[0.08] to-transparent', glow: 'rgba(245,158,11,0.08)' },
    violet:  { border: 'border-violet-500/20 hover:border-violet-500/40', topBorder: 'bg-violet-400/40', icon: 'text-violet-400', bg: 'from-violet-500/[0.08] to-transparent', glow: 'rgba(139,92,246,0.08)' },
    cyan:    { border: 'border-cyan-500/20 hover:border-cyan-500/40', topBorder: 'bg-cyan-400/40', icon: 'text-cyan-400', bg: 'from-cyan-500/[0.08] to-transparent', glow: 'rgba(6,182,212,0.08)' },
    teal:    { border: 'border-teal-500/20 hover:border-teal-500/40', topBorder: 'bg-teal-400/40', icon: 'text-teal-400', bg: 'from-teal-500/[0.08] to-transparent', glow: 'rgba(20,184,166,0.08)' },
    orange:  { border: 'border-orange-500/20 hover:border-orange-500/40', topBorder: 'bg-orange-400/40', icon: 'text-orange-400', bg: 'from-orange-500/[0.08] to-transparent', glow: 'rgba(249,115,22,0.08)' },
}

export default function DashboardWidget({ title, icon, linkTo, size = 'medium', accent = 'white', children, className = '' }) {
    const styles = accentStyles[accent] || accentStyles.white

    return (
        <div className={`relative overflow-hidden rounded-xl border ${styles.border} bg-gradient-to-b ${styles.bg} p-4 sm:p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${sizeClasses[size]} ${className}`}>
            {/* Top border highlight */}
            <div className={`absolute top-0 left-0 right-0 h-px ${styles.topBorder}`} />
            {/* Inner glow */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top, ${styles.glow}, transparent 70%)` }}
            />
            <div className="relative flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-(--color-text-secondary)">{title}</h3>
                </div>
                {linkTo && (
                    <Link to={linkTo} className="text-xs text-(--color-text-secondary)/60 hover:text-(--color-text-secondary) transition-colors">
                        View all &rarr;
                    </Link>
                )}
            </div>
            <div className="relative">{children}</div>
        </div>
    )
}
