import { formatNumber } from './profileUtils'

export default function GodPool({ godStats }) {
    if (!godStats || godStats.length === 0) return null
    return (
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                God Pool <span className="text-(--color-text-secondary)/60">({godStats.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {godStats.map(god => (
                    <div key={god.name} className="flex items-center gap-3 bg-(--color-secondary) rounded-lg border border-white/10 p-3">
                        {god.imageUrl ? (
                            <img src={god.imageUrl} alt={god.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-xs text-(--color-text-secondary) flex-shrink-0">?</div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-(--color-text) truncate">{god.name}</span>
                                <span className="text-xs text-(--color-text-secondary) flex-shrink-0">{god.games}G</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                                <span className={god.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                                    {god.winRate.toFixed(0)}% WR
                                </span>
                                <span>{god.kda.toFixed(1)} KDA</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                                <span>{formatNumber(god.avgDamage)} dmg</span>
                                <span>{formatNumber(god.avgMitigated)} mit</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
