import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import { predictionsService } from '../../services/database'
import TeamLogo from '../../components/TeamLogo'
import passionCoin from '../../assets/passion/passion.png'
import { getLeagueLogo } from '../../utils/leagueImages'
import { getDivisionImage } from '../../utils/divisionImages'
import { WagerBar } from './WagerBar'

export function CommunityOdds({ match, t1, t2, compact }) {
    return (
        <div className={`${compact ? 'mt-3' : 'mt-5'}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Eye className="w-3 h-3 text-white/25" />
                <span className="text-[10px] font-medium text-white/40">{match.totalPicks} predictions</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/50 w-7 text-right tabular-nums">{match.community.team1Pct}%</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-l-full" style={{ width: `${match.community.team1Pct}%`, backgroundColor: t1.color || '#6366f1', opacity: 0.8 }} />
                    <div className="h-full rounded-r-full" style={{ width: `${match.community.team2Pct}%`, backgroundColor: t2.color || '#f59e0b', opacity: 0.8 }} />
                </div>
                <span className="text-[10px] text-white/50 w-7 tabular-nums">{match.community.team2Pct}%</span>
            </div>
            {match.odds && (
                <div className="flex justify-between mt-1 text-[9px] text-white/30 px-9">
                    <span>{match.odds.team1Multiplier.toFixed(2)}x</span>
                    <span>{match.odds.team2Multiplier.toFixed(2)}x</span>
                </div>
            )}
        </div>
    )
}

function TeamStatBlock({ team }) {
    const s = team.stats
    if (!s || s.matchesPlayed === 0) return <div className="text-[10px] text-white/30">No stats</div>

    return (
        <div>
            <div className="flex items-center justify-center gap-2 mb-2">
                <TeamLogo slug={team.slug} name={team.name} size={20} color={team.color} />
                <span className="text-xs font-bold text-white">{team.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
                <div>
                    <div className="text-lg font-bold text-white tabular-nums">{s.wins}</div>
                    <div className="text-[9px] text-white/40 uppercase">Wins</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-white tabular-nums">{s.losses}</div>
                    <div className="text-[9px] text-white/40 uppercase">Losses</div>
                </div>
                <div>
                    <div className="text-lg font-bold tabular-nums" style={{ color: s.winRate >= 50 ? '#22c55e' : '#ef4444' }}>{s.winRate}%</div>
                    <div className="text-[9px] text-white/40 uppercase">Win Rate</div>
                </div>
            </div>
            {/* Win rate bar */}
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all" style={{
                    width: `${s.winRate}%`,
                    background: s.winRate >= 50
                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                }} />
            </div>
        </div>
    )
}

function FeaturedTeamSide({ team, selected, onPick, disabled, align }) {
    const isTeam1 = align === 'right'
    return (
        <button onClick={onPick} disabled={disabled}
            className={`group pred-team-btn flex flex-col items-center text-center md:flex-row md:items-center md:gap-4 gap-2 p-3 sm:p-4 rounded-xl flex-1 ${
                !isTeam1 ? 'md:flex-row-reverse md:text-right' : 'md:text-left'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'} ${selected ? 'pred-selected' : ''}`}>
            <TeamLogo slug={team.slug} name={team.name} size={64} color={team.color} className="md:!w-[88px] md:!h-[88px] flex-shrink-0" />

            <div>
                <div className={`font-heading font-bold text-sm md:text-xl transition-colors duration-200 ${
                    selected ? 'text-[#f8c56a]' : 'text-white group-hover:text-white'
                }`}>
                    {team.name}
                </div>
                {team.stats?.matchesPlayed > 0 && (
                    <div className={`flex items-center gap-2 mt-0.5 justify-center ${isTeam1 ? 'md:justify-start' : 'md:justify-end'}`}>
                        <span className="text-[10px] md:text-xs text-white/60 tabular-nums">{team.stats.wins}W – {team.stats.losses}L</span>
                        <span className="text-[9px] md:text-[10px] font-bold tabular-nums" style={{ color: team.stats.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                            {team.stats.winRate}%
                        </span>
                    </div>
                )}
            </div>
        </button>
    )
}

export function FeaturedCard({ match, index, user, login, passion, onPredictionMade }) {
    const [selectedTeam, setSelectedTeam] = useState(match.userPrediction?.predictedTeamId || null)
    const [wagerBarOpen, setWagerBarOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const hasWager = match.userPrediction?.wagerAmount > 0

    const leagueLogo = getLeagueLogo(match.leagueSlug)
    const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

    const handleTeamClick = (teamId) => {
        if (match.isLocked || hasWager || submitting) return
        if (!user) { login(); return }
        if (selectedTeam === teamId && wagerBarOpen) {
            setWagerBarOpen(false)
        } else {
            setSelectedTeam(teamId)
            setWagerBarOpen(true)
            setSubmitError(null)
        }
    }

    const handleSubmit = async (wagerAmount) => {
        if (!selectedTeam) return
        if (wagerAmount > 0 && wagerAmount < 5) { setSubmitError('Minimum wager is 5'); return }
        if (wagerAmount > 0 && passion?.balance < wagerAmount) { setSubmitError('Insufficient balance'); return }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await predictionsService.predict({ scheduledMatchId: match.id, predictedTeamId: selectedTeam, wagerAmount })
            if (wagerAmount > 0) passion?.refreshBalance?.()
            onPredictionMade()
            setWagerBarOpen(false)
        } catch (err) { setSubmitError(err.message) }
        finally { setSubmitting(false) }
    }

    const t1 = match.team1
    const t2 = match.team2
    const canInteract = !match.isLocked && !hasWager && !submitting

    return (
        <div className="relative overflow-hidden rounded-2xl pred-featured-glow pred-card-enter"
            style={{
                animationDelay: `${index * 80}ms`,
                background: 'linear-gradient(135deg, rgba(248,197,106,0.06) 0%, rgba(255,255,255,0.03) 50%, rgba(168,85,247,0.04) 100%)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {leagueLogo && <img src={leagueLogo} alt="" className="absolute top-4 left-4 w-16 h-16 object-contain opacity-[0.09]" />}
                {divisionImg && <img src={divisionImg} alt="" className="absolute bottom-4 right-4 w-20 h-20 object-contain opacity-[0.1]" />}
                <div className="absolute inset-0 pred-shimmer" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(248,197,106,0.03) 50%, transparent 60%)' }} />
            </div>

            <div className="relative p-5 sm:p-7">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        {leagueLogo && <img src={leagueLogo} alt="" className="w-4 h-4 object-contain" />}
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
                            {match.leagueName}
                        </span>
                        {divisionImg && <img src={divisionImg} alt="" className="w-4 h-4 object-contain" />}
                        <span className="text-[11px] text-white/50">{match.divisionName}</span>
                        {match.week && <span className="text-[11px] text-white/40">· W{match.week}</span>}
                    </div>
                    {match.bestOf > 1 && <span className="hidden sm:inline text-[10px] font-medium text-white/40">Bo{match.bestOf}</span>}
                </div>

                {/* Date */}
                <div className="mb-5">
                    <div className="text-sm font-semibold text-white/80 tabular-nums">
                        {new Date(match.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                {/* Tap hint */}
                {canInteract && !selectedTeam && !match.userPrediction && (
                    <div className="text-center mb-3">
                        <span className="text-[10px] text-[#f8c56a]/60 uppercase tracking-wider font-medium">Tap a team to predict</span>
                    </div>
                )}

                {/* Teams face-off */}
                <div className="flex items-center justify-evenly gap-2 sm:gap-4">
                    <FeaturedTeamSide team={t1} selected={selectedTeam === t1.id}
                        onPick={() => handleTeamClick(t1.id)} disabled={!canInteract} align="right" />

                    <div className="flex-shrink-0 px-2 sm:px-4">
                        <span className="pred-vs text-2xl sm:text-3xl">VS</span>
                    </div>

                    <FeaturedTeamSide team={t2} selected={selectedTeam === t2.id}
                        onPick={() => handleTeamClick(t2.id)} disabled={!canInteract} align="left" />
                </div>

                {/* Wager bar */}
                {canInteract && wagerBarOpen && selectedTeam && (
                    <WagerBar
                        teamName={selectedTeam === t1.id ? t1.name : t2.name}
                        passion={passion}
                        onSubmit={handleSubmit}
                        onCancel={() => setWagerBarOpen(false)}
                        submitting={submitting}
                        submitError={submitError}
                    />
                )}

                {hasWager && (
                    <div className="flex items-center justify-center gap-2 mt-5 text-sm" style={{ color: '#f8c56a' }}>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Wagered {match.userPrediction.wagerAmount}</span>
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        <span className="text-white/40">on {selectedTeam === t1.id ? t1.name : t2.name}</span>
                    </div>
                )}

                {match.isLocked && match.community && (
                    <CommunityOdds match={match} t1={t1} t2={t2} />
                )}

                <Link to={`/matchup/${match.id}`}
                    className="flex items-center justify-center gap-2 mt-4 py-2.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
                    style={{ background: 'rgba(248,197,106,0.08)', border: '1px solid rgba(248,197,106,0.15)', color: '#f8c56a' }}>
                    <Eye className="w-3.5 h-3.5" /> View Full Matchup
                </Link>
            </div>
        </div>
    )
}

export function MatchCard({ match, index, user, login, passion, onPredictionMade }) {
    const [selectedTeam, setSelectedTeam] = useState(match.userPrediction?.predictedTeamId || null)
    const [wagerBarOpen, setWagerBarOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [expanded, setExpanded] = useState(false)

    const hasWager = match.userPrediction?.wagerAmount > 0
    const canInteract = !match.isLocked && !hasWager && !submitting

    const leagueLogo = getLeagueLogo(match.leagueSlug)
    const divisionImg = getDivisionImage(match.leagueSlug, match.divisionSlug, match.divisionTier)

    const handleTeamClick = (teamId) => {
        if (!canInteract) return
        if (!user) { login(); return }
        if (selectedTeam === teamId && wagerBarOpen) {
            setWagerBarOpen(false)
        } else {
            setSelectedTeam(teamId)
            setWagerBarOpen(true)
            setSubmitError(null)
        }
    }

    const handleSubmit = async (wagerAmount) => {
        if (!selectedTeam) return
        if (wagerAmount > 0 && wagerAmount < 5) { setSubmitError('Minimum wager is 5'); return }
        if (wagerAmount > 0 && passion?.balance < wagerAmount) { setSubmitError('Insufficient balance'); return }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await predictionsService.predict({ scheduledMatchId: match.id, predictedTeamId: selectedTeam, wagerAmount })
            if (wagerAmount > 0) passion?.refreshBalance?.()
            onPredictionMade()
            setWagerBarOpen(false)
        } catch (err) { setSubmitError(err.message) }
        finally { setSubmitting(false) }
    }

    const t1 = match.team1
    const t2 = match.team2
    const hasStats = t1.stats?.matchesPlayed > 0 || t2.stats?.matchesPlayed > 0

    return (
        <div className="relative rounded-xl overflow-hidden pred-card-enter"
            style={{
                animationDelay: `${index * 40}ms`,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {leagueLogo && <img src={leagueLogo} alt="" className="absolute top-2 left-3 w-8 h-8 object-contain opacity-[0.08]" />}
                {divisionImg && <img src={divisionImg} alt="" className="absolute bottom-2 right-3 w-10 h-10 object-contain opacity-[0.09]" />}
            </div>

            <div className="relative p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                        {leagueLogo && <img src={leagueLogo} alt="" className="w-3.5 h-3.5 object-contain" />}
                        <span>{match.leagueName}</span>
                        <span className="text-white/25">·</span>
                        {divisionImg && <img src={divisionImg} alt="" className="w-3.5 h-3.5 object-contain" />}
                        <span>{match.divisionName}</span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: '#f8c56a' }}>Open</span>
                </div>

                {/* Date */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/70 tabular-nums">
                        {new Date(match.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {hasStats && (
                        <button onClick={() => setExpanded(!expanded)}
                            className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer">
                            Stats {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}
                </div>

                {/* Teams */}
                <div className="flex items-center justify-evenly">
                    <button onClick={() => handleTeamClick(t1.id)} disabled={!canInteract}
                        className={`pred-team-btn flex-1 flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-1.5 md:gap-3 py-2.5 px-2 md:px-3 rounded-xl ${
                            canInteract ? 'cursor-pointer' : 'cursor-default'
                        } ${selectedTeam === t1.id ? 'pred-selected' : ''}`}>
                        <TeamLogo slug={t1.slug} name={t1.name} size={32} color={t1.color} className="md:!w-[40px] md:!h-[40px] flex-shrink-0" />
                        <div className="min-w-0 md:flex-1">
                            <div className={`text-xs md:text-sm font-bold truncate ${
                                selectedTeam === t1.id ? 'text-[#f8c56a]' : 'text-white'
                            }`}>{t1.name}</div>
                            {t1.stats?.matchesPlayed > 0 && (
                                <div className="text-[10px] text-white/50 tabular-nums">{t1.stats.wins}W – {t1.stats.losses}L</div>
                            )}
                        </div>
                    </button>

                    <span className="pred-vs text-xs md:text-sm flex-shrink-0 px-1 md:px-2">VS</span>

                    <button onClick={() => handleTeamClick(t2.id)} disabled={!canInteract}
                        className={`pred-team-btn flex-1 flex flex-col items-center text-center md:flex-row-reverse md:items-center md:text-right gap-1.5 md:gap-3 py-2.5 px-2 md:px-3 rounded-xl ${
                            canInteract ? 'cursor-pointer' : 'cursor-default'
                        } ${selectedTeam === t2.id ? 'pred-selected' : ''}`}>
                        <TeamLogo slug={t2.slug} name={t2.name} size={32} color={t2.color} className="md:!w-[40px] md:!h-[40px] flex-shrink-0" />
                        <div className="min-w-0 md:flex-1 md:text-right">
                            <div className={`text-xs md:text-sm font-bold truncate ${
                                selectedTeam === t2.id ? 'text-[#f8c56a]' : 'text-white'
                            }`}>{t2.name}</div>
                            {t2.stats?.matchesPlayed > 0 && (
                                <div className="text-[10px] text-white/50 tabular-nums">{t2.stats.wins}W – {t2.stats.losses}L</div>
                            )}
                        </div>
                    </button>
                </div>

                {/* Expanded stats */}
                {expanded && hasStats && (
                    <div className="pred-expand-enter mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <TeamStatBlock team={t1} />
                            <TeamStatBlock team={t2} />
                        </div>
                    </div>
                )}

                {/* Wager bar */}
                {canInteract && wagerBarOpen && selectedTeam && (
                    <WagerBar
                        teamName={selectedTeam === t1.id ? t1.name : t2.name}
                        passion={passion}
                        onSubmit={handleSubmit}
                        onCancel={() => setWagerBarOpen(false)}
                        submitting={submitting}
                        submitError={submitError}
                    />
                )}

                {hasWager && (
                    <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#f8c56a' }}>
                        <Lock className="w-3 h-3" />
                        <span>{match.userPrediction.wagerAmount}</span>
                        <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                        <span className="text-white/40">on {selectedTeam === t1.id ? t1.name : t2.name}</span>
                    </div>
                )}

                <Link to={`/matchup/${match.id}`}
                    className="flex items-center gap-1 mt-2 text-[10px] text-white/40 hover:text-[#f8c56a] transition-colors">
                    <Eye className="w-3 h-3" /> Details
                </Link>
            </div>
        </div>
    )
}
