import { formatNumber } from './profileUtils'

export function StatCards({ stats }) {
    const { gamesPlayed, wins, winRate, kda, totalKills, totalDeaths, totalAssists } = stats
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
                { label: 'Games', value: gamesPlayed },
                { label: 'Wins', value: wins },
                {
                    label: 'Win Rate',
                    value: gamesPlayed > 0 ? `${winRate.toFixed(0)}%` : '—',
                    color: winRate >= 60 ? 'text-green-400' : winRate >= 45 ? 'text-yellow-400' : 'text-red-400',
                },
                {
                    label: 'KDA',
                    value: gamesPlayed > 0 ? kda.toFixed(2) : '—',
                    color: kda >= 2 ? 'text-green-400' : kda >= 1.5 ? 'text-yellow-400' : 'text-red-400',
                },
                { label: 'Kills', value: totalKills },
                { label: 'Deaths', value: totalDeaths },
                { label: 'Assists', value: totalAssists },
            ].map(stat => (
                <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 text-center">
                    <div className={`text-xl font-bold font-heading ${stat.color || 'text-(--color-text)'}`}>
                        {stat.value}
                    </div>
                    <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                </div>
            ))}
        </div>
    )
}

export function AveragesRow({ stats }) {
    const { gamesPlayed, totalKills, totalDeaths, totalAssists, totalDamage, totalMitigated } = stats
    if (gamesPlayed === 0) return null
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
                { label: 'Avg Kills', value: (totalKills / gamesPlayed).toFixed(1) },
                { label: 'Avg Deaths', value: (totalDeaths / gamesPlayed).toFixed(1) },
                { label: 'Avg Assists', value: (totalAssists / gamesPlayed).toFixed(1) },
                { label: 'Avg Damage', value: formatNumber(totalDamage / gamesPlayed) },
                { label: 'Avg Mitigated', value: formatNumber(totalMitigated / gamesPlayed) },
            ].map(stat => (
                <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 text-center">
                    <div className="text-lg font-bold text-(--color-text)">{stat.value}</div>
                    <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                </div>
            ))}
        </div>
    )
}
