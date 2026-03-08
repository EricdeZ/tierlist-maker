import { Lock } from 'lucide-react'

export default function ForgeLockBanner({ fuelingLocked, coolingLocked }) {
    if (!fuelingLocked && !coolingLocked) return null

    return (
        <div className="mb-4 p-3 sm:p-4 border border-amber-500/30 bg-amber-500/8 flex items-center gap-3">
            <Lock size={20} className="text-amber-400 flex-shrink-0" />
            <div>
                <div className="forge-head text-sm sm:text-base font-bold tracking-wider text-amber-400">
                    {fuelingLocked && coolingLocked
                        ? 'Trading Locked'
                        : fuelingLocked
                            ? 'Fueling Locked'
                            : 'Cooling Locked'}
                </div>
                <div className="forge-body text-xs sm:text-sm text-[var(--forge-text-mid)]">
                    {fuelingLocked && coolingLocked
                        ? 'All trading is temporarily suspended. You cannot fuel or cool Sparks right now.'
                        : fuelingLocked
                            ? 'Buying Sparks is temporarily suspended. You can still cool (sell) your existing Sparks.'
                            : 'Selling Sparks is temporarily suspended. You can still fuel (buy) new Sparks.'}
                </div>
            </div>
        </div>
    )
}
