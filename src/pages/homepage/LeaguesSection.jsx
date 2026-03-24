import { Link } from 'react-router-dom'
import { Trophy, ArrowRight } from 'lucide-react'
import { getLeagueLogo } from '../../utils/leagueImages'

const LeaguesSection = ({ leagues, canPreview }) => {
    const classified = leagues.map(league => {
        const divisions = league.divisions || []
        const isActive = divisions.some(d => d.seasons?.some(s => s.is_active || canPreview(league.id)))
        const status = isActive ? 'live' : 'inactive'
        return { league, status }
    })

    const groups = [
        { key: 'live', label: 'Live Status', dotColor: '#22c55e', items: classified.filter(c => c.status === 'live') },
        { key: 'inactive', label: 'Waiting on Next Season', dotColor: '#64748b', items: classified.filter(c => c.status === 'inactive') },
    ]

    return (
        <section id="leagues" className="py-20 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <h2
                        className="font-heading text-3xl sm:text-4xl font-black uppercase tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, #f8c56a 0%, #fde68a 40%, #f8c56a 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            filter: 'drop-shadow(0 0 30px rgba(248, 197, 106, 0.15))',
                        }}
                    >
                        Choose Your League
                    </h2>
                    <p className="text-white/55 text-lg mt-2">
                        Find your community and jump in.
                    </p>
                </div>

                <div className="space-y-12">
                    {groups.map(group => {
                        if (group.items.length === 0) return null
                        return (
                            <SectionGroup
                                key={group.key}
                                label={group.label}
                                dotColor={group.dotColor}
                                items={group.items}
                            />
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

const SectionGroup = ({ label, dotColor, items }) => (
    <div>
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/10">
            <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: dotColor || items[0]?.league.color || '#64748b' }}
            />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/50">
                {label}
            </span>
            <span className="text-xs text-white/30 ml-auto">
                {items.length} {items.length === 1 ? 'league' : 'leagues'}
            </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map(({ league, status }) => (
                <LeagueCard key={league.id} league={league} status={status} />
            ))}
        </div>
    </div>
)

const LeagueCard = ({ league, status }) => {
    const logo = getLeagueLogo(league.slug, league.image_url)
    const color = league.color || 'var(--color-accent)'
    const isInactive = status === 'inactive'

    const card = (
        <div
            className={`group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col items-center text-center px-5 pt-6 pb-5 gap-3 h-full transition-all duration-300 ${
                isInactive
                    ? 'opacity-40 pointer-events-none'
                    : 'hover:-translate-y-[3px] hover:border-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] cursor-pointer'
            }`}
        >
            {/* Accent bar */}
            <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: isInactive ? 'linear-gradient(90deg, rgba(255,255,255,0.15), transparent)' : `linear-gradient(90deg, ${color}, transparent)` }}
            />

            {/* Background glow */}
            {!isInactive && (
                <div
                    className="absolute -top-5 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full opacity-[0.07] pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
                />
            )}

            {/* Logo */}
            <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
                {logo ? (
                    <img src={logo} alt="" className="w-[72px] h-[72px] object-contain" />
                ) : (
                    <Trophy className="w-9 h-9" style={{ color }} />
                )}
            </div>

            {/* Name */}
            <h4 className="font-heading text-base font-extrabold text-white leading-tight">
                {league.name}
            </h4>

            {/* Slogan */}
            {league.slogan && (
                <p className="text-xs text-white/40 -mt-1 leading-snug">
                    {league.slogan}
                </p>
            )}

            {/* Button */}
            {status === 'live' && (
                <span className="mt-auto relative inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold text-white/70 overflow-hidden transition-colors duration-300 group-hover:text-white">
                    <span
                        className="absolute inset-0 rounded-full bg-white/[0.06] transition-transform duration-500 ease-out origin-left scale-x-100"
                    />
                    <span
                        className="absolute inset-0 rounded-full transition-transform duration-500 ease-out origin-left scale-x-0 group-hover:scale-x-100"
                        style={{ backgroundColor: color }}
                    />
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                        View <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                </span>
            )}
        </div>
    )

    if (isInactive) return card

    return <Link to={`/${league.slug}`} className="no-underline h-full">{card}</Link>
}

export default LeaguesSection
