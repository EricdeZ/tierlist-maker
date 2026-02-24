import { Link } from 'react-router-dom'
import { Lock, Trophy, Eye } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import passionCoin from '../../assets/passion/passion.png'
import { getLeagueLogo } from '../../utils/leagueImages'
import { getDivisionImage } from '../../utils/divisionImages'
import { FilterBar } from './FilterBar'
import { CommunityOdds } from './MatchCards'

export function ResultsTab({
    matches, loading, error,
    leagues, selectedLeague, setSelectedLeague,
    selectedDivision, setSelectedDivision, availableDivisions,
    search, setSearch,
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#f8c56a] rounded-full animate-spin" />
            </div>
        )
    }

    let filtered = matches
    if (search.trim()) {
        const q = search.toLowerCase()
        filtered = filtered.filter(m =>
            m.team1.name.toLowerCase().includes(q) ||
            m.team2.name.toLowerCase().includes(q) ||
            m.leagueName?.toLowerCase().includes(q) ||
            m.divisionName?.toLowerCase().includes(q)
        )
    }

    // Sort by date descending (most recent first)
    const sorted = [...filtered].sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))

    return (
        <div>
            <FilterBar
                leagues={leagues} selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague}
                selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision}
                availableDivisions={availableDivisions} search={search} setSearch={setSearch}
            />

            {sorted.length === 0 ? (
                <div className="py-20 text-center">
                    <Trophy className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No Results Yet</h3>
                    <p className="text-white/40 text-sm">Results appear when predictions lock or matches complete.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.map((match, i) => {
                        const t1 = match.team1
                        const t2 = match.team2
                        const isResolved = match.userPrediction?.status === 'won' || match.userPrediction?.status === 'lost'
                        const userWon = match.userPrediction?.status === 'won'
                        const hasWager = match.userPrediction?.wagerAmount > 0
                        const leagueLogo = getLeagueLogo(match.leagueSlug)
                        const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

                        return (
                            <div key={match.id} className="relative rounded-xl overflow-hidden pred-card-enter"
                                style={{
                                    animationDelay: `${i * 30}ms`,
                                    background: isResolved && userWon ? 'rgba(34,197,94,0.06)' : isResolved ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.04)',
                                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    {leagueLogo && <img src={leagueLogo} alt="" className="absolute top-2 left-3 w-8 h-8 object-contain opacity-[0.08]" />}
                                    {divisionImg && <img src={divisionImg} alt="" className="absolute bottom-2 right-3 w-10 h-10 object-contain opacity-[0.09]" />}
                                </div>
                                <div className="relative p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                                            {leagueLogo && <img src={leagueLogo} alt="" className="w-3.5 h-3.5 object-contain" />}
                                            <span>{match.leagueName}</span>
                                            <span className="text-white/25">·</span>
                                            {divisionImg && <img src={divisionImg} alt="" className="w-3.5 h-3.5 object-contain" />}
                                            <span>{match.divisionName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isResolved && userWon && <span className="text-[10px] font-bold text-green-400">Won</span>}
                                            {isResolved && !userWon && <span className="text-[10px] font-bold text-red-400/70">Lost</span>}
                                            {match.userPrediction?.status === 'refunded' && <span className="text-[10px] font-bold text-yellow-400">Refunded</span>}
                                            {!isResolved && !match.userPrediction?.status && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/40"><Lock className="w-2.5 h-2.5" /> Locked</span>}
                                            <span className="text-xs text-white/50 tabular-nums">
                                                {new Date(match.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-evenly">
                                        <div className="flex flex-col items-center text-center md:flex-row md:text-left gap-1.5 md:gap-3 flex-1">
                                            <TeamLogo slug={t1.slug} name={t1.name} size={28} color={t1.color} className="md:!w-[36px] md:!h-[36px] flex-shrink-0" />
                                            <span className={`text-xs md:text-sm font-bold ${match.winnerTeamId === t1.id ? 'text-green-400' : 'text-white'}`}>{t1.name}</span>
                                            {match.winnerTeamId === t1.id && <span className="text-[9px] font-bold text-green-400">WIN</span>}
                                        </div>
                                        <span className="pred-vs text-xs md:text-sm px-1 md:px-3">VS</span>
                                        <div className="flex flex-col items-center text-center md:flex-row-reverse md:text-right gap-1.5 md:gap-3 flex-1">
                                            <TeamLogo slug={t2.slug} name={t2.name} size={28} color={t2.color} className="md:!w-[36px] md:!h-[36px] flex-shrink-0" />
                                            <span className={`text-xs md:text-sm font-bold ${match.winnerTeamId === t2.id ? 'text-green-400' : 'text-white'}`}>{t2.name}</span>
                                            {match.winnerTeamId === t2.id && <span className="text-[9px] font-bold text-green-400">WIN</span>}
                                        </div>
                                    </div>

                                    {match.community && <CommunityOdds match={match} t1={t1} t2={t2} compact />}

                                    {isResolved && match.userPrediction && (
                                        <div className={`flex items-center justify-between mt-3 text-xs ${userWon ? 'text-green-400' : 'text-red-400/60'}`}>
                                            <span>
                                                Picked {match.userPrediction.predictedTeamId === t1.id ? t1.name : t2.name}
                                                {hasWager && <> · {match.userPrediction.wagerAmount} <img src={passionCoin} alt="" className="w-3 h-3 inline" /></>}
                                            </span>
                                            {userWon && match.userPrediction.payoutAmount > 0 && (
                                                <span className="flex items-center gap-1 font-bold">
                                                    +{match.userPrediction.payoutAmount} <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <Link to={`/matchup/${match.id}`}
                                        className="flex items-center gap-1 mt-2 text-[10px] text-white/40 hover:text-[#f8c56a] transition-colors">
                                        <Eye className="w-3 h-3" /> Details
                                    </Link>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
