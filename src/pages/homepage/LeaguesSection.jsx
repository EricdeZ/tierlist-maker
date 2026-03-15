import { Link } from 'react-router-dom'
import { Trophy, ChevronRight, MessageCircle, ArrowRight, DollarSign, Gem, Heart, Shield } from 'lucide-react'
import diamondsImg from '../../assets/diamonds.png'
import { getDivisionImage, RANK_LABELS } from '../../utils/divisionImages'
import { getLeagueLogo } from '../../utils/leagueImages'

const LeaguesSection = ({ leagues, canPreview }) => {
    return (
        <section id="leagues" className="py-20 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Competition</span>
                    <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text)">
                        Choose Your League
                    </h2>
                </div>

                <div className="space-y-16">
                    {leagues.map(league => {
                        const divisions = league.divisions || []
                        const logo = getLeagueLogo(league.slug, league.image_url)
                        const leagueColor = league.color || 'var(--color-accent)'
                        const isActive = divisions.some(d => d.seasons?.some(s => s.is_active || canPreview(league.id)))

                        return (
                            <div key={league.id} id={`league-${league.slug}`}>
                                <LeagueHeader league={league} logo={logo} leagueColor={leagueColor} isActive={isActive} />

                                {league.slug === 'agl' && (
                                    <AGLPromoBanner />
                                )}

                                {league.slug === 'sal' && (
                                    <SALPromoBanner />
                                )}

                                {divisions.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {divisions.map(division => (
                                            <DivisionCard
                                                key={division.id}
                                                league={league}
                                                division={division}
                                                leagueColor={leagueColor}
                                                canPreview={canPreview}
                                            />
                                        ))}
                                    </div>
                                )}

                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

const SIGNUP_ROUTES = { agl: '/agl/signup', 'sal': '/sal/signup' }

const LeagueHeader = ({ league, logo, leagueColor, isActive }) => {
    const hasSignup = !!SIGNUP_ROUTES[league.slug]
    const signupPath = SIGNUP_ROUTES[league.slug]
    return (
    <div className="flex items-center gap-4 mb-6">
        {logo ? (
            <img src={logo} alt="" className={`h-12 w-12 object-contain rounded-lg ${!isActive && !hasSignup ? 'opacity-40' : ''}`} />
        ) : (
            <div className={`h-12 w-12 rounded-lg bg-white/5 flex items-center justify-center ${!isActive && !hasSignup ? 'opacity-40' : ''}`}>
                <Trophy className="w-6 h-6" style={{ color: leagueColor }} />
            </div>
        )}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
                {isActive || hasSignup ? (
                    <Link
                        to={signupPath || `/${league.slug}`}
                        className={`font-heading text-2xl font-bold transition-colors ${hasSignup ? 'text-white hover:text-white/80' : 'text-(--color-text) hover:text-(--color-accent)'}`}
                    >
                        {league.name}
                    </Link>
                ) : (
                    <h3 className="font-heading text-2xl font-bold text-(--color-text)/40">
                        {league.name}
                    </h3>
                )}
                {hasSignup ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}15`, color: leagueColor, border: `1px solid ${leagueColor}25` }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: leagueColor }} />
                        Signups are now open
                    </span>
                ) : isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}15`, color: leagueColor, border: `1px solid ${leagueColor}25` }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: leagueColor }} />
                        Live
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${leagueColor}10`, color: `${leagueColor}90`, border: `1px solid ${leagueColor}15` }}>
                        Not Tracked
                    </span>
                )}
            </div>
            {league.slogan && (
                <p className={`text-sm ${isActive || hasSignup ? 'text-(--color-text-secondary)' : 'text-(--color-text-secondary)/40'}`}>
                    {league.slogan}
                </p>
            )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
            {league.discord_url && (
                <a
                    href={league.discord_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${isActive ? 'bg-[#5865F2] hover:bg-[#4752C4]' : 'bg-[#5865F2]/50 hover:bg-[#5865F2]/70'}`}
                    onClick={e => e.stopPropagation()}
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Discord</span>
                </a>
            )}
            {isActive && (
                <Link
                    to={`/${league.slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-(--color-text-secondary) hover:text-(--color-text) border border-white/10 hover:border-white/20 transition-colors"
                >
                    View League
                    <ChevronRight className="w-3.5 h-3.5" />
                </Link>
            )}
        </div>
    </div>
    )
}

const AGLPromoBanner = () => (
    <Link
        to="/agl/signup"
        className="group relative block mb-5 overflow-hidden rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-[#F57C20]/15 hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #2a1200 40%, #1a0800 100%)' }}
    >
        <div className="absolute inset-0 rounded-2xl p-px" style={{
            background: 'linear-gradient(135deg, #F57C20, #FFB347, #F57C20, #E8941A)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            opacity: 0.4,
        }} />
        <div className="absolute top-0 right-0 w-72 h-72 opacity-15 blur-3xl pointer-events-none" style={{
            background: 'radial-gradient(circle, #F57C20, transparent 70%)',
        }} />
        <div className="absolute bottom-0 left-0 w-56 h-56 opacity-10 blur-3xl pointer-events-none" style={{
            background: 'radial-gradient(circle, #FFB347, transparent 70%)',
        }} />
        <div className="absolute top-0 left-0 right-0 h-px" style={{
            background: 'linear-gradient(90deg, transparent 10%, #F57C20 50%, transparent 90%)',
            opacity: 0.6,
        }} />

        <div className="relative px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-4 sm:gap-5">
            <div className="shrink-0 hidden sm:block">
                <img
                    src={diamondsImg}
                    alt=""
                    className="w-14 h-14 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500"
                    style={{ filter: 'drop-shadow(0 0 12px rgba(245,124,32,0.3))' }}
                />
            </div>

            <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F57C20]/70 mb-1 block">
                    Albion Giants League
                </span>
                <h4 className="font-heading text-lg sm:text-xl font-black text-white mb-2 leading-tight">
                    Season Signups
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        style={{
                            background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
                            color: '#4ade80',
                            border: '1px solid rgba(34,197,94,0.25)',
                        }}
                    >
                        <DollarSign className="w-3 h-3" />
                        Cash Prizes
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        style={{
                            background: 'linear-gradient(135deg, rgba(147,197,253,0.15), rgba(147,197,253,0.05))',
                            color: '#93c5fd',
                            border: '1px solid rgba(147,197,253,0.25)',
                        }}
                    >
                        <Gem className="w-3 h-3" />
                        Diamond Prizes
                    </span>
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
                <span className="text-white font-semibold text-sm whitespace-nowrap">Sign up now</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                        background: 'linear-gradient(135deg, #F57C20, #E8941A)',
                        boxShadow: '0 4px 20px rgba(245,124,32,0.3)',
                    }}
                >
                    <ArrowRight className="w-4.5 h-4.5 text-white group-hover:translate-x-0.5 transition-transform duration-300" />
                </div>
            </div>
        </div>
    </Link>
)

const SALPromoBanner = () => (
    <Link
        to="/sal/signup"
        className="group relative block mb-5 overflow-hidden rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-[#719c3a]/15 hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, #0a1a04 0%, #152d08 40%, #0a1804 100%)' }}
    >
        <div className="absolute inset-0 rounded-2xl p-px" style={{
            background: 'linear-gradient(135deg, #719c3a, #8fbf4a, #719c3a, #5a7d2e)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            opacity: 0.4,
        }} />
        <div className="absolute top-0 right-0 w-72 h-72 opacity-15 blur-3xl pointer-events-none" style={{
            background: 'radial-gradient(circle, #719c3a, transparent 70%)',
        }} />
        <div className="absolute bottom-0 left-0 w-56 h-56 opacity-10 blur-3xl pointer-events-none" style={{
            background: 'radial-gradient(circle, #8fbf4a, transparent 70%)',
        }} />
        <div className="absolute top-0 left-0 right-0 h-px" style={{
            background: 'linear-gradient(90deg, transparent 10%, #719c3a 50%, transparent 90%)',
            opacity: 0.6,
        }} />

        <div className="relative px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-4 sm:gap-5">
            <div className="shrink-0 hidden sm:block">
                <span
                    className="text-5xl block group-hover:scale-110 transition-transform duration-500"
                    style={{ filter: 'drop-shadow(0 0 12px rgba(113,156,58,0.3))' }}
                >🐍</span>
            </div>

            <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#719c3a]/70 mb-1 block">
                    Serpent Ascension League
                </span>
                <h4 className="font-heading text-lg sm:text-xl font-black text-white mb-2 leading-tight">
                    Season Signups
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        style={{
                            background: 'linear-gradient(135deg, rgba(113,156,58,0.15), rgba(113,156,58,0.05))',
                            color: '#8fbf4a',
                            border: '1px solid rgba(113,156,58,0.25)',
                        }}
                    >
                        <Heart className="w-3 h-3" />
                        Beginner Friendly
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        style={{
                            background: 'linear-gradient(135deg, rgba(147,197,253,0.15), rgba(147,197,253,0.05))',
                            color: '#93c5fd',
                            border: '1px solid rgba(147,197,253,0.25)',
                        }}
                    >
                        <Shield className="w-3 h-3" />
                        Low Level
                    </span>
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
                <span className="text-white font-semibold text-sm whitespace-nowrap">Sign up now</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                        background: 'linear-gradient(135deg, #719c3a, #5a7d2e)',
                        boxShadow: '0 4px 20px rgba(113,156,58,0.3)',
                    }}
                >
                    <ArrowRight className="w-4.5 h-4.5 text-white group-hover:translate-x-0.5 transition-transform duration-300" />
                </div>
            </div>
        </div>
    </Link>
)

const DivisionCard = ({ league, division, leagueColor, canPreview }) => {
    const rankImg = getDivisionImage(league.slug, division.slug, division.tier)
    const rankLabel = RANK_LABELS[division.tier]
    const activeSeason = division.seasons?.find(s => s.is_active || canPreview(league.id))
    const divActive = !!activeSeason

    if (divActive) {
        return (
            <Link
                to={`/${league.slug}/${division.slug}`}
                className="group relative overflow-hidden rounded-xl border border-white/10 hover:border-white/20 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
            >
                <div
                    className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(90deg, transparent, ${leagueColor}, transparent)` }}
                />
                <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                        {rankImg && (
                            <img src={rankImg} alt={rankLabel} className="h-10 w-10 object-contain" />
                        )}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-heading text-lg font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors truncate">
                                {division.name}
                            </h4>
                            {rankLabel && (
                                <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                    {rankLabel} Tier
                                </span>
                            )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-(--color-text-secondary) group-hover:translate-x-1 transition-all shrink-0" />
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-(--color-text-secondary)">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {activeSeason.name}
                    </div>
                </div>
            </Link>
        )
    }

    return (
        <div
            className="rounded-xl border border-white/5 bg-(--color-secondary)/50 p-5 opacity-35"
        >
            <div className="flex items-center gap-3">
                {rankImg && (
                    <img src={rankImg} alt={rankLabel} className="h-10 w-10 object-contain" />
                )}
                <div className="flex-1 min-w-0">
                    <h4 className="font-heading text-lg font-bold text-(--color-text) truncate">
                        {division.name}
                    </h4>
                    {rankLabel && (
                        <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">
                            {rankLabel} Tier
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

export default LeaguesSection
