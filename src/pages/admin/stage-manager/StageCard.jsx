import { STAGE_TYPE_LABELS, STAGE_TYPE_COLORS, STATUS_COLORS } from './constants'
import GroupsSection from './GroupsSection'
import RoundsSection from './RoundsSection'
import BracketVisualization from './BracketVisualization'

export default function StageCard({
    stage, expanded, onToggle, onEdit, onDelete,
    groups, groupTeams, seasonTeams,
    onNewGroup, onEditGroup, onDeleteGroup,
    onEditGroupTeams, editingGroupTeams, groupTeamDraft,
    onAddTeamToDraft, onRemoveTeamFromDraft, onUpdateDraftSeed,
    onSubmitGroupTeams, onCancelGroupTeams,
    rounds, onNewRound, onEditRound, onDeleteRound,
    scheduledMatches, getSourceDescription,
    saving,
}) {
    const typeLabel = stage.stage_type ? (STAGE_TYPE_LABELS[stage.stage_type] || stage.stage_type) : 'Freeform'
    const typeColor = stage.stage_type ? (STAGE_TYPE_COLORS[stage.stage_type] || 'bg-gray-500/15 border-gray-500/30 text-gray-400') : 'bg-gray-500/15 border-gray-500/30 text-gray-400'
    const statusColor = STATUS_COLORS[stage.status] || STATUS_COLORS.pending

    const isElimination = stage.stage_type === 'single_elimination' || stage.stage_type === 'double_elimination'

    return (
        <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={onToggle}
            >
                <span className="text-[var(--color-text-secondary)] text-xs select-none w-4 text-center">
                    {expanded ? '\u25BC' : '\u25B6'}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-6 text-center">
                    #{stage.sort_order}
                </span>
                <span className="text-sm font-semibold text-[var(--color-text)] flex-1">{stage.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${typeColor}`}>{typeLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${statusColor}`}>{stage.status}</span>
                {stage.counts_for_team_record === false && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400/70">
                        No record
                    </span>
                )}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={onEdit} className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors">
                        Edit
                    </button>
                    <button onClick={onDelete} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                        Delete
                    </button>
                </div>
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-white/10 px-4 py-4 space-y-6">
                    {/* Groups section */}
                    <GroupsSection
                        groups={groups}
                        groupTeams={groupTeams}
                        seasonTeams={seasonTeams}
                        onNewGroup={onNewGroup}
                        onEditGroup={onEditGroup}
                        onDeleteGroup={onDeleteGroup}
                        onEditGroupTeams={onEditGroupTeams}
                        editingGroupTeams={editingGroupTeams}
                        groupTeamDraft={groupTeamDraft}
                        onAddTeamToDraft={onAddTeamToDraft}
                        onRemoveTeamFromDraft={onRemoveTeamFromDraft}
                        onUpdateDraftSeed={onUpdateDraftSeed}
                        onSubmitGroupTeams={onSubmitGroupTeams}
                        onCancelGroupTeams={onCancelGroupTeams}
                        saving={saving}
                    />

                    {/* Rounds section */}
                    <RoundsSection
                        rounds={rounds}
                        onNewRound={onNewRound}
                        onEditRound={onEditRound}
                        onDeleteRound={onDeleteRound}
                    />

                    {/* Bracket visualization for elimination types */}
                    {isElimination && scheduledMatches.length > 0 && (
                        <BracketVisualization
                            stage={stage}
                            rounds={rounds}
                            scheduledMatches={scheduledMatches}
                            getSourceDescription={getSourceDescription}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
