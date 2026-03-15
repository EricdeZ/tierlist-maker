import { Link } from 'react-router-dom'
import { Gift, Repeat2, Users, Swords, Flame, Trophy, Coins, BarChart3 } from 'lucide-react'

function ActionItem({ icon, count, label, to }) {
    if (!count) return null
    return (
        <Link
            to={to}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
            <span className="text-(--color-accent)">{icon}</span>
            <span className="text-sm font-semibold">{count}</span>
            <span className="text-xs text-(--color-text-secondary) hidden sm:inline">{label}</span>
        </Link>
    )
}

export default function ActionBar({
    canClaimPassion,
    canClaimCores,
    claimableChallenges,
    incomeCollectible,
    pendingGifts,
    pendingTrades,
    pendingTeamInvites,
    incomingScrimRequests,
}) {
    const hasAny = canClaimPassion || canClaimCores || claimableChallenges > 0 ||
        incomeCollectible || pendingGifts > 0 || pendingTrades > 0 ||
        pendingTeamInvites > 0 || incomingScrimRequests > 0

    if (!hasAny) {
        return (
            <div className="col-span-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-(--color-text-secondary)">
                You're all caught up!
            </div>
        )
    }

    return (
        <div className="col-span-full flex flex-wrap gap-2">
            <ActionItem icon={<Flame size={16} />} count={canClaimPassion ? 1 : 0} label="Claim Passion" to="/leaderboard" />
            <ActionItem icon={<Coins size={16} />} count={canClaimCores ? 1 : 0} label="Claim Cores" to="/vault" />
            <ActionItem icon={<Trophy size={16} />} count={claimableChallenges} label="Challenges" to="/challenges" />
            <ActionItem icon={<BarChart3 size={16} />} count={incomeCollectible ? 1 : 0} label="Collect Income" to="/vault" />
            <ActionItem icon={<Gift size={16} />} count={pendingGifts} label="Gifts" to="/vault" />
            <ActionItem icon={<Repeat2 size={16} />} count={pendingTrades} label="Trades" to="/vault" />
            <ActionItem icon={<Users size={16} />} count={pendingTeamInvites} label="Team Invites" to="/scrims" />
            <ActionItem icon={<Swords size={16} />} count={incomingScrimRequests} label="Scrim Requests" to="/scrims" />
        </div>
    )
}
