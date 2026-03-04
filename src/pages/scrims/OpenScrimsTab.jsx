import ScrimCard from './ScrimCard'

export default function OpenScrimsTab({ scrims, user, currentUserId, captainTeams, leagueFilter, setLeagueFilter, tierFilter, setTierFilter, regionFilter, setRegionFilter, divisionFilter, setDivisionFilter, uniqueLeagues, uniqueTiers, activeDivisions, onAccept, onCancel, onEdit, actionLoading, acceptModal, setAcceptModal, reliabilityScores }) {
    return (
        <div>
            {scrims.length > 0 && (
                <div className="sd-filter-row">
                    <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)} className="sd-filter-select">
                        <option value="">All Leagues</option>
                        {uniqueLeagues.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                        <option value="community">Community Teams</option>
                    </select>
                    <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="sd-filter-select">
                        <option value="">All Tiers</option>
                        {uniqueTiers.map(t => <option key={t} value={t}>Tier {t}</option>)}
                    </select>
                    <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="sd-filter-select">
                        <option value="">All Regions</option>
                        <option value="NA">NA</option>
                        <option value="EU">EU</option>
                    </select>
                    <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)} className="sd-filter-select">
                        <option value="">All Divisions</option>
                        {(activeDivisions || []).map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.leagueName})</option>
                        ))}
                    </select>
                </div>
            )}
            <div className="flex flex-col gap-0.5">
                {scrims.map(scrim => (
                    <ScrimCard key={scrim.id} scrim={scrim} showActions={!!user} captainTeams={captainTeams}
                        currentUserId={currentUserId} onAccept={onAccept} onCancel={onCancel} onEdit={onEdit} onDecline={() => {}}
                        actionLoading={actionLoading} acceptModal={acceptModal} setAcceptModal={setAcceptModal}
                        isChallenge={false} reliabilityScores={reliabilityScores} activeDivisions={activeDivisions} />
                ))}
            </div>
            {scrims.length === 0 && (
                <div className="text-center py-10">
                    <div style={{ fontSize: 36 }}>&#9876;</div>
                    <div className="xp-text" style={{ fontWeight: 700, marginTop: 4 }}>No open scrims right now</div>
                    <div className="xp-text" style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {user ? 'Be the first to post a scrim request!' : 'Check back later or log in to post one.'}
                    </div>
                </div>
            )}
        </div>
    )
}
