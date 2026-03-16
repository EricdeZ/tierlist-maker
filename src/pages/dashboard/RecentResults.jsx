import { Trophy } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'
import { getGodCardUrl } from '../../utils/playerAvatar'
import soloImg from '../../assets/roles/solo.webp'
import jungleImg from '../../assets/roles/jungle.webp'
import midImg from '../../assets/roles/mid.webp'
import suppImg from '../../assets/roles/supp.webp'
import adcImg from '../../assets/roles/adc.webp'

const ROLE_ICONS = { SOLO: soloImg, JUNGLE: jungleImg, MID: midImg, SUPPORT: suppImg, ADC: adcImg, CARRY: adcImg }

function ResultRow({ game, index }) {
    const won = game.winner_team_id === game.player_team_id
    const opponentName = game.team_side === 1 ? game.team2_name : game.team1_name
    const godImg = getGodCardUrl(game.god_played, 64)
    const roleIcon = game.role_played ? ROLE_ICONS[game.role_played.toUpperCase()] : null

    return (
        <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${index % 2 === 0 ? 'bg-white/[0.03]' : ''}`}>
            <span className={`text-xs font-bold w-5 text-center px-1 py-0.5 rounded shrink-0 ${won ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {won ? 'W' : 'L'}
            </span>
            {/* God portrait */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0">
                {godImg ? (
                    <img src={godImg} alt={game.god_played} className="w-full h-full object-cover object-[center_20%]" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-(--color-text-secondary)">?</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm truncate">vs {opponentName || 'Unknown'}</p>
                <div className="flex items-center gap-1">
                    {roleIcon && <img src={roleIcon} alt="" className="w-3 h-3 object-contain opacity-60" />}
                    {game.god_played && (
                        <span className="text-[11px] text-(--color-text-secondary) truncate">{game.god_played}</span>
                    )}
                </div>
            </div>
            <div className="text-xs font-mono shrink-0 flex gap-0.5">
                <span className="text-emerald-400">{game.kills ?? '—'}</span>
                <span className="text-(--color-text-secondary)">/</span>
                <span className="text-red-400">{game.deaths ?? '—'}</span>
                <span className="text-(--color-text-secondary)">/</span>
                <span className="text-blue-400">{game.assists ?? '—'}</span>
            </div>
        </div>
    )
}

export default function RecentResults({ games, linkedPlayer }) {
    if (!linkedPlayer) {
        return (
            <DashboardWidget title="Recent Results" icon={<Trophy size={16} />} size="large">
                <PromoCard
                    title="Link Your Profile"
                    description="See your match history and stats"
                    ctaText="Claim Profile"
                    ctaLink="/players"
                    icon={<Trophy size={28} />}
                />
            </DashboardWidget>
        )
    }

    const profileLink = `/profile/${linkedPlayer.slug}`

    return (
        <DashboardWidget title="Recent Results" icon={<Trophy size={16} />} size="large" linkTo={profileLink} accent="emerald">
            {(!games || games.length === 0) ? (
                <PromoCard
                    title="No Games Yet"
                    description="Browse active leagues and start competing"
                    ctaText="Browse Leagues"
                    ctaLink="/leagues"
                    icon={<Trophy size={28} />}
                />
            ) : (
                <div className="space-y-0.5">
                    {games.slice(0, 5).map((g, i) => (
                        <ResultRow key={i} game={g} index={i} />
                    ))}
                </div>
            )}
        </DashboardWidget>
    )
}
