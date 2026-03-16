import { Link } from 'react-router-dom'
import { Gift, Repeat2, Users, Swords, Trophy, BarChart3, CheckCircle2 } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'
import coresIcon from '../../assets/ember.png'

// Each action type has its own color — Tailwind CSS 4 requires complete static class names
const actionStyles = {
    passion:     { icon: 'text-amber-400',  border: 'border-l-amber-400/60',  bg: 'hover:bg-amber-500/10',   glow: 'hover:shadow-[inset_0_0_12px_rgba(245,158,11,0.08)]' },
    cores:       { icon: 'text-teal-400',   border: 'border-l-teal-400/60',   bg: 'hover:bg-teal-500/10',    glow: 'hover:shadow-[inset_0_0_12px_rgba(45,212,191,0.08)]' },
    challenges:  { icon: 'text-emerald-400', border: 'border-l-emerald-400/60', bg: 'hover:bg-emerald-500/10', glow: 'hover:shadow-[inset_0_0_12px_rgba(52,211,153,0.08)]' },
    income:      { icon: 'text-violet-400', border: 'border-l-violet-400/60', bg: 'hover:bg-violet-500/10',  glow: 'hover:shadow-[inset_0_0_12px_rgba(139,92,246,0.08)]' },
    gifts:       { icon: 'text-rose-400',   border: 'border-l-rose-400/60',   bg: 'hover:bg-rose-500/10',    glow: 'hover:shadow-[inset_0_0_12px_rgba(251,113,133,0.08)]' },
    trades:      { icon: 'text-blue-400',   border: 'border-l-blue-400/60',   bg: 'hover:bg-blue-500/10',    glow: 'hover:shadow-[inset_0_0_12px_rgba(96,165,250,0.08)]' },
    teamInvites: { icon: 'text-indigo-400', border: 'border-l-indigo-400/60', bg: 'hover:bg-indigo-500/10',  glow: 'hover:shadow-[inset_0_0_12px_rgba(129,140,248,0.08)]' },
    scrims:      { icon: 'text-orange-400', border: 'border-l-orange-400/60', bg: 'hover:bg-orange-500/10',  glow: 'hover:shadow-[inset_0_0_12px_rgba(251,146,60,0.08)]' },
}

function ActionItem({ icon, count, label, to, styleKey }) {
    if (!count) return null
    const s = actionStyles[styleKey]
    return (
        <Link
            to={to}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white/5 ${s.bg} ${s.glow} border-l-2 ${s.border} transition-all duration-200 shrink-0`}
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
            <div className="col-span-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={16} className="animate-[pulse_2s_ease-in-out_infinite] drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                <span className="drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">You're all caught up!</span>
            </div>
        )
    }

    return (
        <div className="col-span-full flex flex-wrap gap-2">
            <ActionItem icon={<img src={passionCoin} alt="" className="w-4 h-4 object-contain" />} count={canClaimPassion ? 1 : 0}    label="Claim Passion"   to="/leaderboard" styleKey="passion" />
            <ActionItem icon={<img src={coresIcon} alt="" className="w-4 h-4 object-contain" />}   count={canClaimCores ? 1 : 0}      label="Claim Cores"     to="/vault"       styleKey="cores" />
            <ActionItem icon={<Trophy size={16} />}   count={claimableChallenges}         label="Challenges"      to="/challenges"  styleKey="challenges" />
            <ActionItem icon={<BarChart3 size={16} />} count={incomeCollectible ? 1 : 0} label="Collect Income"  to="/vault"       styleKey="income" />
            <ActionItem icon={<Gift size={16} />}     count={pendingGifts}                label="Gifts"           to="/vault"       styleKey="gifts" />
            <ActionItem icon={<Repeat2 size={16} />}  count={pendingTrades}               label="Trades"          to="/vault"       styleKey="trades" />
            <ActionItem icon={<Users size={16} />}    count={pendingTeamInvites}          label="Team Invites"    to="/scrims"      styleKey="teamInvites" />
            <ActionItem icon={<Swords size={16} />}   count={incomingScrimRequests}       label="Scrim Requests"  to="/scrims"      styleKey="scrims" />
        </div>
    )
}
