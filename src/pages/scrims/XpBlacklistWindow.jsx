import { useState } from 'react'
import TeamLogo from '../../components/TeamLogo'
import { RANK_LABELS } from '../../utils/divisionImages'

export default function XpBlacklistWindow({ captainTeams, allTeams, blacklist, onAdd, onRemove }) {
    const [selectedTeamId, setSelectedTeamId] = useState(() => captainTeams[0]?.teamId || '')
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)

    const teamBlacklist = blacklist.filter(b => b.teamId === Number(selectedTeamId))
    const blockedIds = new Set(teamBlacklist.map(b => b.blockedTeamId))

    const filteredTeams = allTeams.filter(t =>
        t.id !== Number(selectedTeamId) &&
        !blockedIds.has(t.id) &&
        (searchQuery === '' || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div style={{ padding: 6 }}>
            {captainTeams.length > 1 && (
                <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}
                        className="xp-select w-full" style={{ marginBottom: 6, fontSize: 11 }}>
                    {captainTeams.map(t => (
                        <option key={t.teamId} value={t.teamId}>{t.teamName} — {t.divisionName}{t.divisionTier ? ` (${RANK_LABELS[t.divisionTier] || 'Tier ' + t.divisionTier})` : ''}</option>
                    ))}
                </select>
            )}
            {captainTeams.length === 1 && (
                <div className="flex items-center gap-2 mb-2">
                    <TeamLogo slug={captainTeams[0].teamSlug} name={captainTeams[0].teamName} size={18} />
                    <span className="xp-text" style={{ fontWeight: 700, fontSize: 12 }}>{captainTeams[0].teamName}</span>
                    <span className="xp-text" style={{ fontSize: 9, color: '#666' }}>{captainTeams[0].divisionName}{captainTeams[0].divisionTier ? ` (${RANK_LABELS[captainTeams[0].divisionTier] || 'Tier ' + captainTeams[0].divisionTier})` : ''}</span>
                </div>
            )}

            {teamBlacklist.length === 0 ? (
                <div className="xp-text" style={{ textAlign: 'center', color: '#888', padding: '12px 0', fontSize: 11 }}>
                    No teams blocked.
                </div>
            ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 6 }}>
                    {teamBlacklist.map(entry => (
                        <div key={entry.id} className="flex items-center gap-2 p-1.5"
                             style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <TeamLogo slug={entry.blockedTeamSlug} name={entry.blockedTeamName} size={18} />
                            <div className="flex-1 min-w-0">
                                <div className="xp-text" style={{ fontWeight: 600, fontSize: 11 }}>{entry.blockedTeamName}</div>
                                <div className="xp-text" style={{ fontSize: 9, color: '#666' }}>
                                    {entry.blockedLeagueName} - {entry.blockedDivisionName}{entry.blockedDivisionTier ? ` (${RANK_LABELS[entry.blockedDivisionTier] || 'Tier ' + entry.blockedDivisionTier})` : ''}
                                </div>
                            </div>
                            <button onClick={() => onRemove(entry.teamId, entry.blockedTeamId)}
                                    className="xp-btn xp-btn-danger" style={{ padding: '1px 6px', fontSize: 9 }}>
                                Unblock
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {!showSearch ? (
                <button onClick={() => setShowSearch(true)} className="xp-btn w-full" style={{ fontSize: 11 }}>
                    + Block a Team
                </button>
            ) : (
                <div>
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                           placeholder="Search team to block..." className="xp-input w-full" style={{ fontSize: 11, marginBottom: 4 }} autoFocus />
                    {searchQuery && (
                        <div className="xp-listbox" style={{ maxHeight: 140, overflowY: 'auto' }}>
                            {filteredTeams.slice(0, 15).map(team => (
                                <button key={team.id} onClick={() => {
                                    onAdd(Number(selectedTeamId), team.id)
                                    setSearchQuery('')
                                    setShowSearch(false)
                                }} className="xp-listbox-item">
                                    <TeamLogo slug={team.slug} name={team.name} size={14} />
                                    <span className="xp-text" style={{ fontSize: 11 }}>{team.name}</span>
                                    <span className="xp-text" style={{ fontSize: 9, color: '#888', marginLeft: 'auto' }}>{team.divisionName}{team.divisionTier ? ` (${RANK_LABELS[team.divisionTier] || 'T' + team.divisionTier})` : ''}</span>
                                </button>
                            ))}
                            {filteredTeams.length === 0 && (
                                <div className="xp-text" style={{ padding: '4px 8px', fontSize: 10, color: '#666' }}>
                                    No teams found
                                </div>
                            )}
                        </div>
                    )}
                    <button onClick={() => { setShowSearch(false); setSearchQuery('') }}
                            className="xp-btn w-full" style={{ fontSize: 10, marginTop: 4 }}>Cancel</button>
                </div>
            )}
        </div>
    )
}
