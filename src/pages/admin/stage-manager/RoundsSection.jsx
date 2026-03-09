export default function RoundsSection({ rounds, onNewRound, onEditRound, onDeleteRound }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Rounds</h3>
                <button onClick={onNewRound} className="text-xs text-[var(--color-accent)] hover:underline">+ Add Round</button>
            </div>
            {rounds.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] italic">No rounds yet.</p>
            ) : (
                <div className="space-y-1">
                    {rounds.map(round => (
                        <div key={round.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[var(--color-primary)] px-3 py-2">
                            <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-6 text-center">R{round.round_number}</span>
                            <span className="text-sm text-[var(--color-text)] flex-1">{round.name}</span>
                            {round.best_of_override && (
                                <span className="text-xs text-[var(--color-text-secondary)]">Bo{round.best_of_override}</span>
                            )}
                            {round.scheduled_date && (
                                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">{round.scheduled_date.slice(0, 10)}</span>
                            )}
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => onEditRound(round)} className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors">
                                    Edit
                                </button>
                                <button onClick={() => onDeleteRound(round)} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
