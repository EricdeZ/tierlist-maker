import { getContrastColor } from '../../utils/colorContrast'

export default function PlayerCard({
    player,
    role,
    index,
    teamColor,
    draggedItem,
    lockedStats,
    getStatValue,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDrop,
    removeFromRanking,
    showSpotlight,
    setSpotlightPlayer,
    getPlayerTeamName,
    rankings,
}) {
    const textColor = getContrastColor(teamColor)
    const isDraggedItem = draggedItem && draggedItem.player === player
    const isOriginalPosition = draggedItem &&
        draggedItem.sourceRole === role &&
        draggedItem.sourceIndex === index &&
        rankings[role][index] === player
    const locked = lockedStats[player]
    const stat = locked ? getStatValue(player, locked) : null

    return (
        <div key={`${role}-${player}-${index}`}>
            <div
                className="h-3 -mb-1"
                onDragOver={handleDragOver}
                onDragEnter={(e) => {
                    e.stopPropagation()
                    handleDragEnter(e, role, index)
                }}
                onDrop={(e) => {
                    e.stopPropagation()
                    handleDrop(e, role, index)
                }}
            />
            <div
                className={`px-2.5 py-2 rounded shadow cursor-move border group hover:shadow-md transition-all ${
                    isDraggedItem && isOriginalPosition ? 'opacity-30' :
                        isDraggedItem && draggedItem.sourceRole !== role ? 'opacity-70 scale-95' : ''
                }`}
                style={{ backgroundColor: teamColor, borderColor: teamColor, color: textColor }}
                draggable
                onMouseDown={() => showSpotlight && setSpotlightPlayer(player)}
                onDragStart={(e) => handleDragStart(e, player, null, role, index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragEnter={(e) => {
                    e.stopPropagation()
                    handleDragEnter(e, role, index)
                }}
                onDrop={(e) => {
                    e.stopPropagation()
                    handleDrop(e, role, index)
                }}
                title={`${player} (${getPlayerTeamName(player)})`}
            >
                <div className="flex justify-between items-center gap-1">
                    <span className="text-sm font-medium truncate min-w-0">{player}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {stat && (
                            <span className="text-[10px] font-bold opacity-75 tabular-nums whitespace-nowrap">
                                {stat.value} <span className="font-medium opacity-80">{stat.label}</span>
                            </span>
                        )}
                        <button
                            onClick={() => removeFromRanking(role, index)}
                            className="opacity-0 group-hover:opacity-100 text-sm transition-opacity"
                            style={{ color: textColor }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
