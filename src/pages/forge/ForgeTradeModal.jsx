import { Flame, Snowflake, ChevronDown, ChevronUp, X } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import passionCoin from '../../assets/passion/passion.png'
import sparkIcon from '../../assets/spark.png'

export default function ForgeTradeModal({
    player, mode, amount, setAmount, balance,
    trading, result, error, onExecute, onClose, onFuelSuccess,
}) {
    const isFuel = mode === 'fuel'
    const estimatedCost = isFuel
        ? Math.round(player.currentPrice * amount * (1 + 0.005 * amount))
        : null
    const estimatedProceeds = !isFuel && player.currentPrice
        ? Math.round(player.currentPrice * amount * 0.9)
        : null
    const maxSparks = !isFuel && player.holding ? player.holding.sparks : 10

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="border border-[var(--forge-border)] p-6 w-full max-w-sm mx-4"
                style={{
                    background: 'var(--color-primary)',
                    clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                }}
            >
                {/* Top accent */}
                <div
                    className="h-[3px] -mx-6 -mt-6 mb-4"
                    style={{
                        background: isFuel
                            ? 'linear-gradient(90deg, var(--forge-ember), var(--forge-flame), var(--forge-flame-bright))'
                            : 'linear-gradient(90deg, var(--forge-cool-dim), var(--forge-cool))',
                    }}
                />

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="forge-head text-2xl font-bold tracking-wider flex items-center gap-2">
                        {isFuel
                            ? <Flame className="text-[var(--forge-flame)]" size={20} />
                            : <Snowflake className="text-[var(--forge-cool)]" size={20} />
                        }
                        <TeamLogo slug={player.teamSlug} name={player.teamName} size={20} />
                        {isFuel ? 'Fuel' : 'Cool'} {player.playerName}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Result display */}
                {result && (
                    <div className={`mb-4 p-3 border ${
                        isFuel
                            ? 'bg-[var(--forge-flame)]/8 border-[var(--forge-flame)]/25'
                            : 'bg-[var(--forge-cool)]/8 border-[var(--forge-cool)]/25'
                    }`}>
                        <div className="forge-head text-base font-bold tracking-wider mb-1">
                            {isFuel ? 'Fueled!' : 'Cooled!'}
                        </div>
                        {isFuel ? (
                            <div className="text-sm text-[var(--forge-text-mid)]">
                                Spent <strong className="forge-num text-[var(--forge-flame-bright)]">{result.totalCost?.toLocaleString()}</strong> Passion.
                                New value: <strong className="forge-num text-[var(--forge-flame-bright)]">{Math.round(result.newPrice).toLocaleString()}</strong>
                            </div>
                        ) : (
                            <div className="text-sm text-[var(--forge-text-mid)]">
                                Received <strong className="forge-num text-[var(--forge-gain)]">{result.netProceeds?.toLocaleString()}</strong> Passion
                                (tax: <span className="forge-num">{result.coolingTax?.toLocaleString()}</span>).
                                {result.profit != null && (
                                    <span className={result.profit >= 0 ? ' text-[var(--forge-gain)]' : ' text-[var(--forge-loss)]'}>
                                        {' '}P&L: <span className="forge-num">{result.profit >= 0 ? '+' : ''}{result.profit.toLocaleString()}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-[var(--forge-loss)]/8 border border-[var(--forge-loss)]/25 text-base text-[var(--forge-loss)]">
                        {error}
                    </div>
                )}

                {/* Amount selector */}
                {!result && (
                    <>
                        <div className="mb-4">
                            <label className="forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-text-dim)] mb-2 block">
                                Sparks to {isFuel ? 'fuel' : 'cool'}
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAmount(Math.max(1, amount - 1))}
                                    className="p-2 bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] disabled:opacity-30 transition-colors forge-clip-btn"
                                    disabled={amount <= 1}
                                >
                                    <ChevronDown size={16} />
                                </button>
                                <div className="flex-1 text-center flex items-center justify-center gap-2">
                                    <span className="forge-num text-4xl">{amount}</span>
                                    <img src={sparkIcon} alt="" className="w-6 h-6 object-contain" />
                                    <span className="forge-head text-sm text-[var(--forge-text-dim)]">
                                        Spark{amount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setAmount(Math.min(maxSparks, amount + 1))}
                                    className="p-2 bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] disabled:opacity-30 transition-colors forge-clip-btn"
                                    disabled={amount >= maxSparks}
                                >
                                    <ChevronUp size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Cost preview */}
                        <div className="mb-4 p-3 bg-[var(--forge-surface)]">
                            {isFuel ? (
                                <div className="flex items-center justify-between text-base">
                                    <span className="forge-head text-sm tracking-wider text-[var(--forge-text-dim)]">Estimated cost</span>
                                    <span className="flex items-center gap-1 forge-num text-[var(--forge-flame-bright)]">
                                        <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                        ~{estimatedCost?.toLocaleString()}
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-base mb-1">
                                        <span className="forge-head text-sm tracking-wider text-[var(--forge-text-dim)]">Estimated proceeds</span>
                                        <span className="flex items-center gap-1 forge-num text-[var(--forge-gain)]">
                                            <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                            ~{estimatedProceeds?.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-sm text-[var(--forge-text-dim)] opacity-60">
                                        Includes 10% cooling tax
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Confirm button */}
                        <button
                            onClick={onExecute}
                            disabled={trading}
                            className={`w-full py-3 forge-head text-base font-bold tracking-wider disabled:opacity-50 forge-clip-btn ${
                                isFuel
                                    ? 'text-white forge-btn-fuel'
                                    : 'text-white forge-btn-cool'
                            }`}
                            style={{
                                background: isFuel
                                    ? 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))'
                                    : 'linear-gradient(135deg, var(--forge-cool), var(--forge-cool-dim))',
                            }}
                        >
                            {trading
                                ? (isFuel ? 'Fueling...' : 'Cooling...')
                                : (isFuel ? `Fuel ${amount} Spark${amount !== 1 ? 's' : ''}` : `Cool ${amount} Spark${amount !== 1 ? 's' : ''}`)
                            }
                        </button>
                    </>
                )}

                {/* Done button after result */}
                {result && (
                    <button
                        onClick={onClose}
                        className="w-full py-3 forge-head text-base font-bold tracking-wider bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] transition-colors forge-clip-btn"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    )
}
