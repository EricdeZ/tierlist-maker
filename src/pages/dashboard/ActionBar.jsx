import { Link } from 'react-router-dom'
import { Gift, Repeat2, Users, Swords, Flame, Trophy, Coins, BarChart3 } from 'lucide-react'

// Each action type has its own color — Tailwind CSS 4 requires complete static class names
const actionStyles = {
    passion:     { icon: 'text-amber-400',  border: 'border-l-amber-400/60',  bg: 'hover:bg-amber-500/10' },
    cores:       { icon: 'text-teal-400',   border: 'border-l-teal-400/60',   bg: 'hover:bg-teal-500/10' },
    challenges:  { icon: 'text-emerald-400', border: 'border-l-emerald-400/60', bg: 'hover:bg-emerald-500/10' },
    income:      { icon: 'text-violet-400', border: 'border-l-violet-400/60', bg: 'hover:bg-violet-500/10' },
    gifts:       { icon: 'text-rose-400',   border: 'border-l-rose-400/60',   bg: 'hover:bg-rose-500/10' },
    trades:      { icon: 'text-blue-400',   border: 'border-l-blue-400/60',   bg: 'hover:bg-blue-500/10' },
    teamInvites: { icon: 'text-indigo-400', border: 'border-l-indigo-400/60', bg: 'hover:bg-indigo-500/10' },
    scrims:      { icon: 'text-orange-400', border: 'border-l-orange-400/60', bg: 'hover:bg-orange-500/10' },
}

function ActionItem({ icon, count, label, to, styleKey }) {
    if (!count) return null
    const s = actionStyles[styleKey]
    return (
        <Link
            to={to}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 ${s.bg} border-l-2 ${s.border} transition-colors shrink-0`}
        >
            <span className={s.icon}>{icon}</span>
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
            <ActionItem icon={<Flame size={16} />}    count={canClaimPassion ? 1 : 0}    label="Claim Passion"   to="/leaderboard" styleKey="passion" />
            <ActionItem icon={<Coins size={16} />}    count={canClaimCores ? 1 : 0}      label="Claim Cores"     to="/vault"       styleKey="cores" />
            <ActionItem icon={<Trophy size={16} />}   count={claimableChallenges}         label="Challenges"      to="/challenges"  styleKey="challenges" />
            <ActionItem icon={<BarChart3 size={16} />} count={incomeCollectible ? 1 : 0} label="Collect Income"  to="/vault"       styleKey="income" />
            <ActionItem icon={<Gift size={16} />}     count={pendingGifts}                label="Gifts"           to="/vault"       styleKey="gifts" />
            <ActionItem icon={<Repeat2 size={16} />}  count={pendingTrades}               label="Trades"          to="/vault"       styleKey="trades" />
            <ActionItem icon={<Users size={16} />}    count={pendingTeamInvites}          label="Team Invites"    to="/scrims"      styleKey="teamInvites" />
            <ActionItem icon={<Swords size={16} />}   count={incomingScrimRequests}       label="Scrim Requests"  to="/scrims"      styleKey="scrims" />
        </div>
    )
}
