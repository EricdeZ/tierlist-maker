// src/pages/admin/roster/TeamCard.jsx
import TeamLogo from '../../../components/TeamLogo'
import { PlayerRow } from './PlayerRow'

export function TeamCard({
    team, showSubs, isDragOver, hasDraggedPlayer, isSameTeam, dragOverPlayer, opLoading,
    onDragStart, onDragOver, onDragEnter, onDragLeave, onDrop, onDragEnd,
    onDropOnPlayer, onSetDragOverPlayer,
    onRoleChange, onSetCaptain, onDropPlayer, onPromoteSub, onRemovePendingAdd, onManageAliases, onRenamePlayer, onAddPlayer,
}) {
    const isValidTarget = hasDraggedPlayer && !isSameTeam

    return (
        <div
            className={`rounded-xl border transition-all duration-200 ${
                isDragOver && isValidTarget
                    ? 'border-blue-400/50 bg-blue-500/5 scale-[1.02] shadow-lg shadow-blue-500/10'
                    : isSameTeam && hasDraggedPlayer
                        ? 'border-white/5 opacity-60'
                        : 'border-white/10'
            }`}
            style={{ backgroundColor: 'var(--color-secondary)' }}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Team color bar */}
            <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: team.color }} />

            {/* Team header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TeamLogo slug={team.team_slug} name={team.team_name} size={22} color={team.color} />
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                    <h3 className="font-heading text-base font-bold text-[var(--color-text)]">
                        {team.team_name}
                    </h3>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                    {team.players.filter(p => showSubs || p.roster_status !== 'sub').length} players
                </span>
            </div>

            {/* Player list */}
            <div className="px-3 pb-2 space-y-1 min-h-[120px]">
                {team.players.filter(p => showSubs || p.roster_status !== 'sub').map(player => (
                    <PlayerRow
                        key={player.league_player_id}
                        player={player}
                        teamId={team.team_id}
                        teamName={team.team_name}
                        teamColor={team.color}
                        isDragOverTarget={dragOverPlayer === player.league_player_id}
                        hasDraggedPlayer={hasDraggedPlayer}
                        isLoading={
                            opLoading[`role_${player.league_player_id}`] ||
                            opLoading[`drop_${player.league_player_id}`] ||
                            opLoading[`transfer_${player.league_player_id}`] ||
                            opLoading[`promote_${player.league_player_id}`]
                        }
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDropOnPlayer={onDropOnPlayer}
                        onSetDragOverPlayer={onSetDragOverPlayer}
                        onRoleChange={onRoleChange}
                        onSetCaptain={onSetCaptain}
                        onDropPlayer={onDropPlayer}
                        onPromoteSub={onPromoteSub}
                        onRemovePendingAdd={onRemovePendingAdd}
                        onManageAliases={onManageAliases}
                        onRenamePlayer={onRenamePlayer}
                    />
                ))}

                {team.players.filter(p => showSubs || p.roster_status !== 'sub').length === 0 && (
                    <div className="text-center py-6 text-sm text-[var(--color-text-secondary)]/50 italic">
                        No active players
                    </div>
                )}

                {/* Drop zone hint when dragging */}
                {isDragOver && isValidTarget && (
                    <div className="border-2 border-dashed border-blue-400/40 rounded-lg p-3 text-center text-xs text-blue-400/80 bg-blue-500/5">
                        Drop to transfer here
                    </div>
                )}
            </div>

            {/* Add player button */}
            <div className="px-3 pb-3">
                <button
                    onClick={onAddPlayer}
                    className="w-full py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] border border-dashed border-white/10 hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-all"
                >
                    + Add Player
                </button>
            </div>
        </div>
    )
}
