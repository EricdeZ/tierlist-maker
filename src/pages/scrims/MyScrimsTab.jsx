import ScrimCard from './ScrimCard'

export default function MyScrimsTab({ scrims, incomingScrims, captainTeams, currentUserId, onAccept, onCancel, onEdit, onDecline, onReportOutcome, onDisputeOutcome, onConfirmAccept, onDenyAccept, actionLoading, acceptModal, setAcceptModal, reliabilityScores, activeDivisions }) {
    const pendingScrims = scrims.filter(s => s.status === 'pending_confirmation')
    const openScrims = scrims.filter(s => s.status === 'open' && !incomingScrims.some(i => i.id === s.id))
    const upcomingScrims = scrims.filter(s => s.status === 'accepted' && new Date(s.scheduledDate) >= new Date())
    const needsReport = scrims.filter(s => s.status === 'accepted' && new Date(s.scheduledDate) < new Date() && !s.outcome)
    const completedScrims = scrims.filter(s => s.status === 'completed')
    const noShowScrims = scrims.filter(s => s.status === 'no_show' || s.status === 'disputed')
    const pastScrims = scrims.filter(s => s.status === 'cancelled' || s.status === 'expired')

    const Section = ({ title, items, challenge = false, dim = false }) => items.length > 0 && (
        <fieldset className="xp-fieldset" style={dim ? { opacity: 0.55 } : undefined}>
            <legend className="xp-fieldset-legend">{title} ({items.length})</legend>
            <div className="flex flex-col gap-0.5">
                {items.map(s => (
                    <ScrimCard key={s.id} scrim={s} showActions captainTeams={captainTeams} currentUserId={currentUserId}
                        onAccept={onAccept} onCancel={onCancel} onEdit={onEdit} onDecline={onDecline}
                        onReportOutcome={onReportOutcome} onDisputeOutcome={onDisputeOutcome}
                        onConfirmAccept={onConfirmAccept} onDenyAccept={onDenyAccept}
                        actionLoading={actionLoading} acceptModal={acceptModal} setAcceptModal={setAcceptModal}
                        isChallenge={challenge || !!s.challengedTeamId} reliabilityScores={reliabilityScores}
                        activeDivisions={activeDivisions} />
                ))}
            </div>
        </fieldset>
    )

    return (
        <div className="flex flex-col gap-3">
            <Section title="Pending Confirmation" items={pendingScrims} />
            <Section title="Incoming Challenges" items={incomingScrims} challenge />
            {needsReport.length > 0 && <Section title="Needs Report" items={needsReport} />}
            <Section title="Your Open Requests" items={openScrims} />
            <Section title="Upcoming Scrims" items={upcomingScrims} />
            <Section title="Completed" items={completedScrims} dim />
            {noShowScrims.length > 0 && <Section title="No-Shows / Disputes" items={noShowScrims} dim />}
            <Section title="Past Scrims" items={pastScrims} dim />
            {scrims.length === 0 && incomingScrims.length === 0 && (
                <div className="text-center py-10">
                    <div style={{ fontSize: 36 }}>&#128187;</div>
                    <div className="xp-text" style={{ fontWeight: 700, marginTop: 4 }}>No scrims yet</div>
                    <div className="xp-text" style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {captainTeams.length > 0 ? 'Post a scrim or accept one from Open Scrims.' : 'You need to be a team captain to manage scrims.'}
                    </div>
                </div>
            )}
        </div>
    )
}
