import { Clock, Shield, MessageSquare, Check, Copy, Target, Bell } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { RANK_LABELS, getDivisionImage } from '../../utils/divisionImages'
import ReliabilityBar from './ReliabilityBar'
import { XP_PICK_BADGE, formatPickMode, formatDateEST, formatRelativeDate, copyScrimsToClipboard } from './scrimUtils'

export default function ScrimCard({ scrim, showActions, captainTeams, currentUserId, onAccept, onCancel, onDecline, onReportOutcome, onDisputeOutcome, onConfirmAccept, onDenyAccept, actionLoading, acceptModal, setAcceptModal, isChallenge, reliabilityScores, activeDivisions }) {
    const isLoading = actionLoading === scrim.id
    const acceptableTeams = captainTeams.filter(t =>
        t.teamId !== scrim.teamId &&
        (t.teamId > 0 || scrim.allowCommunityTeams)
    )
    const handleAcceptClick = () => {
        if (acceptableTeams.length === 1) onAccept(scrim.id, acceptableTeams[0].teamId)
        else setAcceptModal(scrim.id)
    }
    const isOwnPost = currentUserId && scrim.userId === currentUserId
    const isOwnTeam = captainTeams.some(t => t.teamId === scrim.teamId)
    const canAccept = acceptableTeams.length > 0 && !isOwnPost
    const canCancel = isOwnPost || isOwnTeam
    const isPast = new Date(scrim.scheduledDate) < new Date()
    const isInvolvedCaptain = captainTeams.some(t => t.teamId === scrim.teamId || t.teamId === scrim.acceptedTeamId)

    // Determine if current user is captain of the accused team (for disputes)
    const accusedTeamId = scrim.outcome === 'no_show_by_poster' ? scrim.teamId
        : scrim.outcome === 'no_show_by_accepter' ? scrim.acceptedTeamId : null
    const isAccusedCaptain = accusedTeamId && captainTeams.some(t => t.teamId === accusedTeamId)

    const myTeamIds = new Set(captainTeams.map(t => t.teamId))
    const divImg = getDivisionImage(scrim.leagueSlug, scrim.divisionSlug, scrim.divisionTier)
    const reliability = reliabilityScores?.[scrim.teamId]
    const teamUrl = scrim.leagueSlug && scrim.divisionSlug ? `/${scrim.leagueSlug}/${scrim.divisionSlug}/teams/${scrim.teamSlug}` : null
    const leagueUrl = scrim.leagueSlug ? `/${scrim.leagueSlug}` : null

    return (
        <div className="xp-scrim-card" style={{ '--team-color': scrim.teamColor || null }}>
            <div className="xp-scrim-layout">
                {/* Header: Team logo + name + challenge badge */}
                <div className="xp-scrim-header">
                    <TeamLogo slug={scrim.teamSlug} name={scrim.teamName} size={47} color={scrim.teamColor} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {teamUrl ? (
                                <a href={teamUrl} target="_blank" rel="noopener noreferrer" className="xp-team-link">{scrim.teamName}</a>
                            ) : (
                                <span className="xp-text" style={{ fontWeight: 700, fontSize: 13 }}>{scrim.teamName}</span>
                            )}
                            {scrim.leagueName === 'Community' && <span className="xp-badge xp-badge-purple" style={{ fontSize: 9 }}>Community</span>}
                            {isChallenge && <span className="xp-badge xp-badge-purple" style={{ fontSize: 9 }}><Target size={8} /> Challenge</span>}
                        </div>
                        {/* League · Division — shown inline on desktop */}
                        <div className="xp-scrim-meta-inline flex items-center gap-1.5 flex-wrap">
                            {leagueUrl ? (
                                <a href={leagueUrl} target="_blank" rel="noopener noreferrer" className="xp-league-link">{scrim.leagueName}</a>
                            ) : (
                                <span className="xp-text" style={{ fontSize: 10, color: '#555' }}>{scrim.leagueName}</span>
                            )}
                            {scrim.divisionName && (
                                <>
                                    <span className="xp-text" style={{ fontSize: 10, color: '#bbb' }}>·</span>
                                    {divImg && <img src={divImg} alt="" style={{ width: 13, height: 13, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />}
                                    <span className="xp-text" style={{ fontSize: 10, color: '#555' }}>
                                        {scrim.divisionName}{scrim.divisionTier ? ` (${RANK_LABELS[scrim.divisionTier]})` : ''}
                                    </span>
                                </>
                            )}
                            {reliability?.score !== null && reliability?.score !== undefined && (
                                <div style={{ marginLeft: 4 }}>
                                    <ReliabilityBar score={reliability.score} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body: date, mode, tiers, notes, matchups */}
                <div className="xp-scrim-body">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock size={11} style={{ color: '#555', flexShrink: 0 }} />
                        <span className="xp-text" style={{ fontSize: 11, fontWeight: 600 }}>{formatDateEST(scrim.scheduledDate)}</span>
                        <span className="xp-text" style={{ fontSize: 10, color: '#999' }}>({formatRelativeDate(scrim.scheduledDate)})</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`xp-badge ${XP_PICK_BADGE[scrim.pickMode] || 'xp-badge-blue'}`}>{formatPickMode(scrim.pickMode)}</span>
                        {scrim.bannedContentLeague && (
                            <span className="xp-badge xp-badge-red"><Shield size={9} /> {scrim.bannedContentLeague} Bans</span>
                        )}
                        <span className={`xp-badge ${scrim.region === 'EU' ? 'xp-badge-purple' : 'xp-badge-blue'}`}>{scrim.region || 'NA'}</span>
                        {scrim.requiresConfirmation && scrim.status === 'open' && (
                            <span className="xp-badge xp-badge-amber" style={{ fontSize: 9 }}><Bell size={8} /> Requires Confirmation</span>
                        )}
                        {scrim.allowCommunityTeams && scrim.status === 'open' && (
                            <span className="xp-badge xp-badge-purple" style={{ fontSize: 9 }}>Community Teams OK</span>
                        )}
                    </div>

                    {scrim.acceptableDivisions && scrim.acceptableDivisions.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mb-1">
                            <span className="xp-text" style={{ fontSize: 10, color: '#666' }}>Open to:</span>
                            {scrim.acceptableDivisions.map(divId => {
                                const div = activeDivisions?.find(d => d.id === divId)
                                const tImg = div?.tier ? getDivisionImage(null, null, div.tier) : null
                                return (
                                    <span key={divId} className={`xp-badge ${div?.tier ? `xp-tier-badge-${div.tier}` : 'xp-badge-gray'}`}>
                                        {tImg && <img src={tImg} alt="" style={{ width: 10, height: 10, objectFit: 'contain', imageRendering: 'pixelated' }} />}
                                        {div?.name || `Division #${divId}`}
                                    </span>
                                )
                            })}
                        </div>
                    )}

                    {!scrim.acceptableDivisions && scrim.acceptableTiers && scrim.acceptableTiers.length < 5 && (
                        <div className="flex items-center gap-1 flex-wrap mb-1">
                            <span className="xp-text" style={{ fontSize: 10, color: '#666' }}>Open to:</span>
                            {scrim.acceptableTiers.sort((a, b) => a - b).map(tier => {
                                const tImg = getDivisionImage(null, null, tier)
                                return (
                                    <span key={tier} className={`xp-badge xp-tier-badge-${tier}`}>
                                        {tImg && <img src={tImg} alt="" style={{ width: 10, height: 10, objectFit: 'contain', imageRendering: 'pixelated' }} />}
                                        {RANK_LABELS[tier]}
                                    </span>
                                )
                            })}
                        </div>
                    )}

                    {scrim.notes && (
                        <div className="flex items-start gap-1 mb-1">
                            <MessageSquare size={10} style={{ color: '#888', marginTop: 2, flexShrink: 0 }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{scrim.notes}</span>
                        </div>
                    )}

                    {scrim.challengedTeamName && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <Target size={11} style={{ color: '#6a3ea1', flexShrink: 0 }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#6a3ea1' }}>Challenging:</span>
                            <TeamLogo slug={scrim.challengedTeamSlug} name={scrim.challengedTeamName} size={14} color={scrim.challengedTeamColor} />
                            {scrim.challengedLeagueName && scrim.challengedTeamSlug ? (
                                <a href={`/${scrim.challengedLeagueName}`} target="_blank" rel="noopener noreferrer" className="xp-team-link" style={{ fontSize: 11, color: '#6a3ea1' }}>{scrim.challengedTeamName}</a>
                            ) : (
                                <span className="xp-text" style={{ fontSize: 11, fontWeight: 700, color: '#6a3ea1' }}>{scrim.challengedTeamName}</span>
                            )}
                            {scrim.challengedDivisionName && <span className="xp-text" style={{ fontSize: 10, color: '#999' }}>· {scrim.challengedDivisionName}</span>}
                        </div>
                    )}

                    {scrim.status === 'pending_confirmation' && scrim.pendingTeamName && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <Clock size={11} style={{ color: '#c08030', flexShrink: 0 }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#c08030' }}>Pending confirmation:</span>
                            <TeamLogo slug={scrim.pendingTeamSlug} name={scrim.pendingTeamName} size={16} color={scrim.pendingTeamColor} />
                            <span className="xp-text" style={{ fontSize: 11, fontWeight: 700, color: '#c08030' }}>{scrim.pendingTeamName}</span>
                            {scrim.pendingDivisionName && <span className="xp-text" style={{ fontSize: 10, color: '#999' }}>· {scrim.pendingDivisionName}</span>}
                        </div>
                    )}

                    {scrim.status === 'accepted' && scrim.acceptedTeamName && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <Check size={11} style={{ color: '#2d8212', flexShrink: 0 }} />
                            <span className="xp-text" style={{ fontSize: 11, color: '#2d8212' }}>Accepted by:</span>
                            <TeamLogo slug={scrim.acceptedTeamSlug} name={scrim.acceptedTeamName} size={16} color={scrim.acceptedTeamColor} />
                            {scrim.acceptedLeagueName && scrim.acceptedDivisionSlug ? (
                                <a href={`/${scrim.acceptedLeagueName}/${scrim.acceptedDivisionSlug}/teams/${scrim.acceptedTeamSlug}`} target="_blank" rel="noopener noreferrer" className="xp-team-link" style={{ fontSize: 11, color: '#2d8212' }}>{scrim.acceptedTeamName}</a>
                            ) : (
                                <span className="xp-text" style={{ fontSize: 11, fontWeight: 700, color: '#2d8212' }}>{scrim.acceptedTeamName}</span>
                            )}
                            {scrim.acceptedLeagueName === 'Community' && <span className="xp-badge xp-badge-purple" style={{ fontSize: 8 }}>Community</span>}
                            {scrim.acceptedDivisionName && scrim.acceptedLeagueName !== 'Community' && <span className="xp-text" style={{ fontSize: 10, color: '#999' }}>· {scrim.acceptedDivisionName}</span>}
                        </div>
                    )}
                </div>

                {/* Footer: posted by + export */}
                <div className="xp-scrim-footer">
                    <span className="xp-text" style={{ fontSize: 10, color: '#aaa' }}>Posted by {scrim.postedBy}</span>
                    <button
                        onClick={() => copyScrimsToClipboard([scrim], myTeamIds)}
                        className="xp-export-btn"
                        title="Copy scrim info to clipboard"
                    >
                        <Copy size={10} /> Export
                    </button>
                </div>

                {/* Actions */}
                {showActions && (
                    <div className="xp-scrim-actions">
                        {scrim.status === 'open' && canAccept && (
                            <>
                                <button onClick={handleAcceptClick} disabled={isLoading} className="xp-btn xp-btn-primary">{isLoading ? '...' : 'Accept'}</button>
                                {acceptModal === scrim.id && acceptableTeams.length > 1 && (
                                    <div className="xp-listbox" style={{ minWidth: 150 }}>
                                        <div className="xp-text" style={{ fontSize: 10, padding: '2px 6px', color: '#555' }}>Accept as:</div>
                                        {acceptableTeams.map(t => (
                                            <button key={t.teamId} onClick={() => { onAccept(scrim.id, t.teamId); setAcceptModal(null) }} className="xp-listbox-item">
                                                <TeamLogo slug={t.teamSlug} name={t.teamName} size={14} color={t.teamColor} />
                                                <span>{t.teamName}{t.isCommunityTeam ? ' — Community' : t.divisionName ? ` — ${t.divisionName}` : ''}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {scrim.status === 'open' && isChallenge && (
                            <button onClick={() => onDecline(scrim.id)} disabled={isLoading} className="xp-btn xp-btn-danger">{isLoading ? '...' : 'Decline'}</button>
                        )}
                        {scrim.status === 'open' && canCancel && (
                            <button onClick={() => onCancel(scrim.id)} disabled={isLoading} className="xp-btn xp-btn-danger">{isLoading ? '...' : 'Cancel'}</button>
                        )}
                        {scrim.status === 'pending_confirmation' && isOwnTeam && onConfirmAccept && (
                            <>
                                <button onClick={() => onConfirmAccept(scrim.id)} disabled={isLoading}
                                    className="xp-btn xp-btn-primary" style={{ fontSize: 10 }}>
                                    {isLoading ? '...' : 'Confirm'}
                                </button>
                                <button onClick={() => onDenyAccept(scrim.id)} disabled={isLoading}
                                    className="xp-btn xp-btn-danger" style={{ fontSize: 10 }}>
                                    {isLoading ? '...' : 'Deny'}
                                </button>
                                <button onClick={() => onCancel(scrim.id)} disabled={isLoading}
                                    className="xp-btn xp-btn-danger" style={{ fontSize: 10 }}>
                                    {isLoading ? '...' : 'Cancel Scrim'}
                                </button>
                            </>
                        )}
                        {scrim.status === 'pending_confirmation' && !isOwnTeam && (
                            <span className="xp-badge xp-badge-amber">Awaiting Confirmation</span>
                        )}
                        {scrim.status === 'accepted' && !isPast && <span className="xp-badge xp-badge-green">Accepted</span>}
                        {scrim.status === 'accepted' && isPast && !scrim.outcome && isInvolvedCaptain && onReportOutcome && (
                            <>
                                <button onClick={() => onReportOutcome(scrim.id, 'completed')} disabled={isLoading}
                                    className="xp-btn xp-btn-primary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                                    {isLoading ? '...' : 'Completed'}
                                </button>
                                <button onClick={() => onReportOutcome(scrim.id, 'no_show_self')} disabled={isLoading}
                                    className="xp-btn xp-btn-danger" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                                    {isLoading ? '...' : 'We No-Showed'}
                                </button>
                                <button onClick={() => onReportOutcome(scrim.id, 'no_show_opponent')} disabled={isLoading}
                                    className="xp-btn xp-btn-danger" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                                    {isLoading ? '...' : 'They No-Showed'}
                                </button>
                            </>
                        )}
                        {scrim.status === 'accepted' && isPast && !scrim.outcome && !isInvolvedCaptain && (
                            <span className="xp-badge xp-badge-amber">Awaiting Report</span>
                        )}
                        {scrim.status === 'completed' && <span className="xp-badge xp-badge-green">Completed</span>}
                        {scrim.status === 'no_show' && !scrim.outcomeDisputed && (
                            <>
                                <span className="xp-badge xp-badge-red">No-Show</span>
                                {isAccusedCaptain && scrim.outcomeDisputeDeadline && new Date(scrim.outcomeDisputeDeadline) > new Date() && onDisputeOutcome && (
                                    <button onClick={() => onDisputeOutcome(scrim.id)} disabled={isLoading}
                                        className="xp-btn xp-btn-danger" style={{ fontSize: 10 }}>
                                        {isLoading ? '...' : 'Dispute'}
                                    </button>
                                )}
                            </>
                        )}
                        {scrim.status === 'disputed' && <span className="xp-badge xp-badge-amber">Disputed</span>}
                        {scrim.status === 'cancelled' && <span className="xp-badge xp-badge-red">Cancelled</span>}
                        {scrim.status === 'expired' && <span className="xp-badge xp-badge-gray">Expired</span>}
                    </div>
                )}
            </div>
        </div>
    )
}
