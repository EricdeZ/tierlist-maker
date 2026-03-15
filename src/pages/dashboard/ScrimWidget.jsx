import { Swords } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

export default function ScrimWidget({ scrims, incomingCount, isCaptain }) {
    // Hide entirely if not a captain
    if (!isCaptain) return null

    if (!scrims || scrims.length === 0) {
        return (
            <DashboardWidget title="Scrims" icon={<Swords size={16} />} linkTo="/scrims" accent="orange">
                <PromoCard
                    title="Challenge Teams"
                    description="Post or accept scrim requests"
                    ctaText="Open Scrim Planner"
                    ctaLink="/scrims"
                    icon={<Swords size={28} />}
                />
            </DashboardWidget>
        )
    }

    const next = scrims[0]

    return (
        <DashboardWidget title="Scrims" icon={<Swords size={16} />} linkTo="/scrims" accent="orange">
            <div className="space-y-2">
                <div>
                    <p className="text-sm font-semibold truncate">vs {next.opponent_name || 'TBD'}</p>
                    {next.scheduled_time && (
                        <p className="text-xs text-(--color-text-secondary)">
                            {new Date(next.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                    )}
                </div>

                {incomingCount > 0 && (
                    <p className="text-xs text-orange-400 font-semibold">{incomingCount} incoming request{incomingCount !== 1 ? 's' : ''}</p>
                )}
            </div>
        </DashboardWidget>
    )
}
