import { Link } from 'react-router-dom'
import { Coins } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'
import DashboardWidget from './DashboardWidget'

export default function CoinFlipCard({ stats }) {
    const wins = stats?.wins ?? 0
    const losses = stats?.losses ?? 0
    const total = wins + losses
    const netProfit = stats?.net_profit ?? stats?.netProfit ?? 0
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

    return (
        <DashboardWidget title="Coin Flip" icon={<Coins size={16} />} linkTo="/coinflip" accent="amber">
            {total === 0 ? (
                <div className="flex flex-col items-center py-2 gap-2">
                    <img src={passionCoin} alt="" className="w-10 h-10 object-contain opacity-60" />
                    <p className="text-xs text-(--color-text-secondary)">Try your luck</p>
                    <Link
                        to="/coinflip"
                        className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                            background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                            boxShadow: '0 0 10px rgba(245,158,11,0.25)',
                            color: 'white',
                            letterSpacing: '0.08em',
                        }}
                    >
                        Flip
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <img src={passionCoin} alt="" className="w-7 h-7 object-contain" />
                            <div>
                                <p className="text-sm font-bold">{wins}W / {losses}L</p>
                                <p className="text-[11px] text-(--color-text-secondary)">{winRate}% win rate</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-sm font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-(--color-text-secondary)">net</p>
                        </div>
                    </div>
                    <Link
                        to="/coinflip"
                        className="block w-full py-1.5 rounded text-center text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                            background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                            boxShadow: '0 0 10px rgba(245,158,11,0.25)',
                            color: 'white',
                            letterSpacing: '0.08em',
                        }}
                    >
                        Flip Again
                    </Link>
                </div>
            )}
        </DashboardWidget>
    )
}
