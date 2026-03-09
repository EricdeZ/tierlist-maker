import TeamLogo from '../../../components/TeamLogo'
import { inputStyle, inputClassSm, numInputClassSm } from './constants'

export default function GroupsSection({
    groups, groupTeams, seasonTeams,
    onNewGroup, onEditGroup, onDeleteGroup,
    onEditGroupTeams, editingGroupTeams, groupTeamDraft,
    onAddTeamToDraft, onRemoveTeamFromDraft, onUpdateDraftSeed,
    onSubmitGroupTeams, onCancelGroupTeams,
    saving,
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Groups</h3>
                <button onClick={onNewGroup} className="text-xs text-[var(--color-accent)] hover:underline">+ Add Group</button>
            </div>
            {groups.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] italic">No groups yet.</p>
            ) : (
                <div className="space-y-2">
                    {groups.map(group => {
                        const gTeams = groupTeams.filter(gt => gt.group_id === group.id)
                        const isEditing = editingGroupTeams === group.id
                        return (
                            <div key={group.id} className="rounded-lg border border-white/5 bg-[var(--color-primary)] p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-[var(--color-text)]">{group.name}</span>
                                        <span className="text-xs text-[var(--color-text-secondary)]">({gTeams.length} teams)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => isEditing ? onCancelGroupTeams() : onEditGroupTeams(group.id)}
                                            className={`px-2 py-1 rounded text-xs transition-colors ${isEditing ? 'text-yellow-400 bg-yellow-500/10' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5'}`}>
                                            {isEditing ? 'Cancel' : 'Set Teams'}
                                        </button>
                                        <button onClick={() => onEditGroup(group)} className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors">
                                            Edit
                                        </button>
                                        <button onClick={() => onDeleteGroup(group)} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {/* Team list (read-only) */}
                                {!isEditing && gTeams.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {gTeams.map(gt => (
                                            <div key={gt.team_id} className="flex items-center gap-1.5 bg-[var(--color-secondary)] rounded-md px-2 py-1">
                                                <TeamLogo slug={gt.team_slug} name={gt.team_name} size={14} color={gt.team_color} />
                                                <span className="text-xs text-[var(--color-text)]">{gt.team_name}</span>
                                                {gt.seed != null && (
                                                    <span className="text-xs text-[var(--color-text-secondary)]">#{gt.seed}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Team editor (inline) */}
                                {isEditing && (
                                    <div className="mt-2 space-y-2">
                                        {groupTeamDraft.map(dt => {
                                            const team = seasonTeams.find(t => t.team_id === dt.team_id)
                                            return (
                                                <div key={dt.team_id} className="flex items-center gap-2">
                                                    <TeamLogo slug={team?.team_slug} name={team?.team_name || `Team #${dt.team_id}`} size={16} color={team?.color} />
                                                    <span className="text-xs text-[var(--color-text)] flex-1">{team?.team_name || `Team #${dt.team_id}`}</span>
                                                    <label className="text-xs text-[var(--color-text-secondary)]">Seed:</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={dt.seed}
                                                        onChange={e => onUpdateDraftSeed(dt.team_id, e.target.value)}
                                                        placeholder="-"
                                                        className={`w-14 ${numInputClassSm}`}
                                                        style={inputStyle}
                                                    />
                                                    <button onClick={() => onRemoveTeamFromDraft(dt.team_id)} className="text-xs text-red-400 hover:text-red-300">{'\u2715'}</button>
                                                </div>
                                            )
                                        })}
                                        <div className="flex items-center gap-2">
                                            <select
                                                defaultValue=""
                                                onChange={e => { onAddTeamToDraft(e.target.value); e.target.value = '' }}
                                                className={inputClassSm}
                                                style={inputStyle}
                                            >
                                                <option value="">+ Add team...</option>
                                                {seasonTeams
                                                    .filter(t => !groupTeamDraft.some(d => d.team_id === t.team_id))
                                                    .map(t => (
                                                        <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={onSubmitGroupTeams}
                                                disabled={saving}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                                            >
                                                {saving ? 'Saving...' : 'Set Teams'}
                                            </button>
                                            <button
                                                onClick={onCancelGroupTeams}
                                                className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
